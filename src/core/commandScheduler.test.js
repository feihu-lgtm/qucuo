import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { CATEGORY, COMMANDS, HOOK_COMMANDS, INVENTORY_COMMAND_IDS } from "./commands.js";
import { createScheduler, decide } from "./commandScheduler.js";
import { classifyCliCommand } from "../../cli/runner.mjs";

const categories = Object.values(CATEGORY);
const phases = ["machine", "ai", "commit"];
const hookFiles = {
  useScreenHandlers: "src/app/hooks/useScreenHandlers.js",
  useBuildingHandlers: "src/app/hooks/useBuildingHandlers.js",
  useProgressionHandlers: "src/app/hooks/useProgressionHandlers.js",
  usePigeonHandlers: "src/app/hooks/usePigeonHandlers.js",
  useQuestPanel: "src/app/hooks/useQuestPanel.js",
  useDuel: "src/app/hooks/useDuel.js",
  usePlayerActionHandlers: "src/app/hooks/usePlayerActionHandlers.js",
  useCardImportHandlers: "src/app/hooks/useCardImportHandlers.js",
  useCraftingAI: "src/app/hooks/useCraftingAI.js",
  useAiInspect: "src/app/hooks/useAiInspect.js",
  useOutfitAdvice: "src/app/hooks/useOutfitAdvice.js",
};

function returnedKeys(file, hookName) {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf(`export function ${hookName}(`);
  const next = source.indexOf("\nexport function ", start + 1);
  const body = source.slice(start, next < 0 ? source.length : next);
  const returns = [...body.matchAll(/return\s*\{/g)];
  const match = returns.at(-1);
  if (!match) return [];
  const open = match.index + match[0].length - 1;
  let depth = 0;
  for (let index = open; index < body.length; index += 1) {
    if (body[index] === "{") depth += 1;
    if (body[index] === "}" && --depth === 0) {
      return body.slice(open + 1, index).split(",")
        .map(entry => entry.trim().match(/^(?:\.\.\.)?([\w$]+)/)?.[1])
        .filter(Boolean);
    }
  }
  return [];
}

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
    const running = { id: `running-${runningCategory}`, category: runningCategory, phase };
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
    expect(decide({ id: "apiConfig", category: CATEGORY.SYSTEM }, running)).toBe("queue");
    expect(decide({ id: "settings", category: CATEGORY.SYSTEM }, running)).toBe("run");
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

  it("classifies sequential CLI commands through the shared registry", () => {
    for (const [line, id] of [[":new", "cliSystem"], ["坐车 鱼定村", "cliCarriage"], ["走 北", "cliMovement"]]) {
      const command = classifyCliCommand(line);
      expect(command).toMatchObject({ id, ...COMMANDS[id] });
      expect(decide(command, null)).toBe("run");
    }
  });

  it("maps every returned handler key to a registered command", () => {
    expect(INVENTORY_COMMAND_IDS.length).toBeGreaterThanOrEqual(111);
    for (const [group, file] of Object.entries(hookFiles)) {
      const handlers = HOOK_COMMANDS[group];
      const actualKeys = returnedKeys(file, group).filter(key => !(group === "useAiInspect" && key === "inspecting"));
      expect(actualKeys.sort(), group).toEqual(Object.keys(handlers).sort());
      for (const [handler, commandId] of Object.entries(handlers)) {
        expect(COMMANDS[commandId], `${group}.${handler} → ${commandId}`).toBeDefined();
      }
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
});
