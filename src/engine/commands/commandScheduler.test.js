import { describe, expect, it, vi } from "vitest";
import { CATEGORY, COMMANDS } from "../../infra/commands.js";
import { createScheduler, decide } from "./commandScheduler.js";
import { formatTurnStatus, getTurnContext, PHASE, turnMonitor } from "../../infra/turnMonitor.js";
import { classifyCliCommand } from "./index.js";

const categories = Object.values(CATEGORY);
const phases = ["machine", "ai", "commit"];
function expectedDecision(commandCategory, runningCategory) {
  if (runningCategory === CATEGORY.SYSTEM) return "reject";
  if (commandCategory === CATEGORY.VIEW) return "run";
  if (commandCategory === CATEGORY.BACKGROUND) return "run";
  if (commandCategory === CATEGORY.SYSTEM) return "reject";
  if (
    [CATEGORY.AI_TURN, CATEGORY.LOCAL, CATEGORY.MOVE].includes(commandCategory)
    && [CATEGORY.AI_TURN, CATEGORY.MOVE].includes(runningCategory)
  ) return "queue";
  return "run";
}

describe("command scheduler", () => {
  it.each(categories.flatMap(commandCategory => categories.flatMap(runningCategory => phases.map(phase => [
    commandCategory, runningCategory, phase,
  ]))))("decides %s against %s during %s", (commandCategory, runningCategory, phase) => {
    const command = {
      id: commandCategory === CATEGORY.SYSTEM ? "settings" : `command-${commandCategory}`,
      category: commandCategory,
    };
    const running = {
      id: runningCategory === CATEGORY.SYSTEM ? "save" : `running-${runningCategory}`,
      category: runningCategory,
      phase,
    };
    const expected = commandCategory === CATEGORY.SYSTEM && command.id === "settings"
      ? (runningCategory === CATEGORY.SYSTEM ? "reject" : "run")
      : expectedDecision(commandCategory, runningCategory);
    expect(decide(command, running)).toBe(expected);
  });

  it.each(phases)("applies system-specific decisions in the %s phase", (phase) => {
    const running = { id: "turn", category: CATEGORY.AI_TURN, phase };
    expect(decide({ id: "rollback", category: CATEGORY.SYSTEM }, running)).toBe("reject");
    expect(decide({ id: "save", category: CATEGORY.SYSTEM }, running)).toBe("queue");
    expect(decide({ id: "load", category: CATEGORY.SYSTEM }, running)).toBe("reject");
    expect(decide({ id: "newGame", category: CATEGORY.SYSTEM }, running)).toBe("reject");
    expect(decide({ id: "apiConfig", category: CATEGORY.SYSTEM }, running)).toBe("run");
    expect(decide({ id: "settings", category: CATEGORY.SYSTEM }, running)).toBe("run");
  });

  it.each(["settings", "apiConfig"])("does not block commands while %s is running", (id) => {
    const running = { id, category: CATEGORY.SYSTEM, phase: "machine" };
    for (const category of categories) {
      const command = { id: category === CATEGORY.SYSTEM ? "load" : "worldRules", category };
      expect(decide(command, running)).toBe("run");
    }
  });

  it.each(["save", "load", "newGame", "rollback", "autosave"])(
    "blocks commands while %s is running",
    id => expect(decide(
      { id: "worldRules", category: CATEGORY.BACKGROUND },
      { id, category: CATEGORY.SYSTEM, phase: "machine" },
    )).toBe("reject"),
  );

  it("registers web-specific building and duel labels", () => {
    expect(COMMANDS.inn.label).toBe("住店与求医");
    expect(COMMANDS.carriage).toMatchObject({ category: CATEGORY.MOVE, label: "坐车" });
    expect(COMMANDS.bank.label).toBe("钱庄与当铺");
    expect(COMMANDS.prayer.label).toBe("祈福");
    expect(COMMANDS.book.label).toBe("书籍");
    expect(COMMANDS.duel.label).toBe("决斗");
  });

  it("returns the rejection text for SettingsPanel alerts", async () => {
    const scheduler = createScheduler({ onReject: () => "  当前操作尚未落盘，请稍候再读取。" });
    let finishTurn;
    const turn = scheduler.dispatch("typedAction", () => new Promise(resolve => {
      finishTurn = resolve;
    }));
    const load = await scheduler.dispatch("load", vi.fn());

    expect(load).toEqual({ status: "rejected", message: "  当前操作尚未落盘，请稍候再读取。" });
    finishTurn();
    await turn;
  });

  it.each([CATEGORY.AI_TURN, CATEGORY.MOVE].flatMap(category => phases.map(phase => [category, phase])))(
    "rejects rollback during %s/%s",
    (category, phase) => expect(decide(
      { id: "rollback", category: CATEGORY.SYSTEM },
      { id: "active", category, phase },
    )).toBe("reject"),
  );

  it("replaces an auto-travel route and serializes repeated whispers", () => {
    expect(decide({ id: "mapMovement", category: CATEGORY.MOVE }, {
      id: "autoTravel", category: CATEGORY.MOVE, phase: "ai",
    })).toBe("replaceRoute");
    expect(decide({ id: "privateWhisper", category: CATEGORY.BACKGROUND }, {
      id: "actWhisper", category: CATEGORY.BACKGROUND, phase: "ai",
    })).toBe("queue");
  });

  it.each(phases)("queues rollback behind an auto-travel leg during %s", (phase) => {
    expect(decide({ id: "rollback", category: CATEGORY.SYSTEM }, {
      id: "autoTravel", category: CATEGORY.MOVE, phase,
    })).toBe("queue");
  });

  it("lets background completion drain wait on the active route before running later legs", async () => {
    const scheduler = createScheduler();
    const order = [];
    let finishFirstLeg;
    let finishBackground;
    const firstLeg = scheduler.dispatch("autoTravel", () => {
      order.push("first");
      return new Promise(resolve => { finishFirstLeg = resolve; });
    });
    const secondLeg = scheduler.enqueue("autoTravel", () => { order.push("second"); }, {
      routeQueue: true, routeLeg: true,
    });
    const thirdLeg = scheduler.enqueue("autoTravel", () => { order.push("third"); }, {
      routeQueue: true, routeLeg: true,
    });
    const background = scheduler.dispatch("squarePrerun", () => new Promise(resolve => {
      finishBackground = resolve;
    }));

    finishBackground();
    await background;
    expect(order).toEqual(["first"]);
    expect(scheduler.queue).toHaveLength(2);

    finishFirstLeg();
    await Promise.all([firstLeg, secondLeg, thirdLeg]);
    expect(order).toEqual(["first", "second", "third"]);
  });

  it("classifies sequential CLI commands through the shared registry", () => {
    for (const [line, id] of [[":new", "cliSystem"], ["坐车 鱼定村", "cliCarriage"], ["走 北", "cliMovement"]]) {
      const command = classifyCliCommand(line);
      expect(command).toMatchObject({ id, ...COMMANDS[id] });
      expect(decide(command, null)).toBe("run");
    }
  });

  it("rejects rollback during a turn, but clears the queue when rollback runs", async () => {
    const onReject = vi.fn();
    const turnScheduler = createScheduler({ onReject });
    let finishTurn;
    const turn = turnScheduler.dispatch("typedAction", () => new Promise(resolve => {
      finishTurn = resolve;
    }));
    const queuedLocal = turnScheduler.dispatch("actLocal", vi.fn());
    const turnRollback = await turnScheduler.dispatch("rollback", vi.fn());
    expect(turnRollback.status).toBe("rejected");
    expect(turnScheduler.queue).toHaveLength(1);
    expect(onReject).toHaveBeenCalledOnce();
    finishTurn();
    await turn;
    await queuedLocal;

    const scheduler = createScheduler();
    let finishWhisper;
    const whisper = scheduler.dispatch("actWhisper", () => new Promise(resolve => {
      finishWhisper = resolve;
    }));
    let queuedSaveRan = false;
    const save = scheduler.dispatch("save", () => { queuedSaveRan = true; });
    const rollback = vi.fn();
    const rollbackResult = scheduler.dispatch("rollback", rollback);
    expect(rollback).toHaveBeenCalledOnce();
    expect(scheduler.queue).toHaveLength(0);
    expect(await save).toEqual({ status: "cleared" });
    expect(await rollbackResult).toBeUndefined();
    finishWhisper();
    await whisper;
    expect(queuedSaveRan).toBe(false);
  });

  it("runs a queued local command only after the AI command commits", async () => {
    const scheduler = createScheduler();
    let finishTurn;
    const phasesSeen = [];
    const turn = scheduler.dispatch("typedAction", () => new Promise(resolve => {
      finishTurn = resolve;
    }));
    const localFn = vi.fn();
    const local = scheduler.dispatch("actLocal", localFn);
    expect(localFn).not.toHaveBeenCalled();
    scheduler.setPhase("commit");
    phasesSeen.push(scheduler.running.phase);
    finishTurn("committed");
    await turn;
    await local;
    expect(phasesSeen).toEqual(["commit"]);
    expect(localFn).toHaveBeenCalledOnce();
  });

  it("stops the active turn, drains queued local work, and ignores its late result", async () => {
    const scheduler = createScheduler();
    const updates = [];
    scheduler.subscribe(state => updates.push(state));
    let finishTurn;
    const turn = scheduler.dispatch("typedAction", () => new Promise(resolve => {
      finishTurn = resolve;
    }));
    const localFn = vi.fn();
    const local = scheduler.dispatch("actLocal", localFn);

    expect(localFn).not.toHaveBeenCalled();
    expect(scheduler.stopRunning()).toBe(true);
    expect(await turn).toEqual({ status: "stopped" });
    await local;
    expect(localFn).toHaveBeenCalledOnce();

    const updateCount = updates.length;
    finishTurn("late");
    await Promise.resolve();
    expect(updates).toHaveLength(updateCount);
    expect(scheduler.running).toBeNull();
  });

  it("reports queued command text and positions", async () => {
    const onQueue = vi.fn();
    const scheduler = createScheduler({ onQueue });
    let finishTurn;
    const turn = scheduler.dispatch("typedAction", () => new Promise(resolve => {
      finishTurn = resolve;
    }));
    const local = scheduler.dispatch("actLocal", vi.fn(), { displayText: "给商人送礼" });

    expect(onQueue).toHaveBeenCalledWith(
      expect.objectContaining({ id: "actLocal", meta: { displayText: "给商人送礼" } }),
      1,
    );
    finishTurn();
    await Promise.all([turn, local]);
  });

  it("targets nested AI phases and rollback blocking over the local parent", async () => {
    const scheduler = createScheduler();
    let finishTurn;
    const parent = scheduler.dispatch("npcGift", () => scheduler.dispatch(
      "typedAction",
      () => new Promise(resolve => { finishTurn = resolve; }),
    ));
    let state;
    scheduler.subscribe(next => { state = next; });

    expect(scheduler.running.id).toBe("typedAction");
    scheduler.setPhase("commit");
    expect(scheduler.running.phase).toBe("commit");
    expect(scheduler.canRun("rollback")).toBe(false);
    expect(state.rollbackBlocked).toBe(true);

    finishTurn();
    await parent;
  });

  it("keeps rollback clickable while a settings task is active", async () => {
    const scheduler = createScheduler();
    let state;
    scheduler.subscribe(next => { state = next; });
    let finishSettings;
    const settings = scheduler.dispatch("settings", () => new Promise(resolve => {
      finishSettings = resolve;
    }));

    expect(scheduler.canRun("rollback")).toBe(true);
    expect(state.rollbackBlocked).toBe(false);

    finishSettings();
    await settings;
  });

  it.each(["settings", "apiConfig"])("keeps the generating turn during and after %s", async (id) => {
    const scheduler = createScheduler();
    const response = Promise.withResolvers();
    const generation = scheduler.dispatch("typedAction", async () => {
      const ai = turnMonitor.beginAi(getTurnContext(), { model: "mock-model", callLabel: "主叙事" });
      ai.chunk();
      await response.promise;
      ai.end({ success: true });
    });
    const during = await scheduler.dispatch(id, () => turnMonitor.getSnapshot().current);
    const after = turnMonitor.getSnapshot().current;
    response.resolve();
    await generation;

    expect(during).toMatchObject({ commandId: "typedAction", phase: PHASE.AI_STREAM, model: "mock-model" });
    expect(after).toMatchObject({ id: during.id, phase: PHASE.AI_STREAM });
    expect(turnMonitor.getSnapshot().current).toMatchObject({ id: during.id, phase: PHASE.DONE });
    expect(turnMonitor.getTrees().find((tree) => tree.commandId === id)).toMatchObject({ phase: PHASE.DONE });
  });

  it("clears route legs and queues rollback after the active auto-travel leg", async () => {
    const scheduler = createScheduler();
    let finishLeg;
    const leg = scheduler.dispatch("autoTravel", () => new Promise(resolve => {
      finishLeg = resolve;
    }));
    const queuedRoute = scheduler.enqueue("autoTravel", vi.fn(), { routeQueue: true });
    const queuedLocal = scheduler.dispatch("actLocal", vi.fn());
    const rollbackFn = vi.fn();
    let state;
    scheduler.subscribe(next => { state = next; });
    const rollback = scheduler.dispatch("rollback", rollbackFn);

    expect(await queuedRoute).toEqual({ status: "cleared" });
    expect(scheduler.canRun("rollback")).toBe(false);
    expect(scheduler.queue.map(entry => entry.id)).toEqual(["rollback", "actLocal"]);
    expect(state.rollbackBlocked).toBe(false);
    expect(rollbackFn).not.toHaveBeenCalled();
    const pending = turnMonitor.getSnapshot();
    const rollbackTree = pending.trees.find((tree) => tree.commandId === "rollback");
    expect(rollbackTree).toMatchObject({
      category: CATEGORY.SYSTEM, queued: true, parentId: pending.current.id,
      nodes: expect.arrayContaining([expect.objectContaining({ kind: "queued", label: "回滚已排队" })]),
    });
    expect(formatTurnStatus(pending).label).toContain("回滚已排队");

    finishLeg();
    expect(await queuedLocal).toEqual({ status: "cleared" });
    await Promise.all([leg, rollback]);
    expect(rollbackFn).toHaveBeenCalledOnce();
    expect(turnMonitor.getTrees().find((tree) => tree.id === rollbackTree.id)).toMatchObject({
      queued: false, phase: PHASE.DONE,
    });
    expect(formatTurnStatus(turnMonitor.getSnapshot()).label).not.toContain("回滚已排队");
  });

  it("records a stopped command as discarded only when its late result arrives", async () => {
    const scheduler = createScheduler();
    const gate = Promise.withResolvers();
    let trace;
    const running = scheduler.dispatch("typedAction", () => {
      trace = getTurnContext();
      return gate.promise;
    });
    expect(scheduler.stopRunning()).toBe(true);
    await expect(running).resolves.toEqual({ status: "stopped" });
    expect(trace.phase).toBe(PHASE.MACHINE);
    gate.resolve();
    await gate.promise;
    expect(trace).toMatchObject({ commandId: "typedAction", category: CATEGORY.AI_TURN, phase: PHASE.DISCARDED });
  });
});
