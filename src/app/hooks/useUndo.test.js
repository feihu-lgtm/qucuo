import { describe, expect, it, vi } from "vitest";
import { GAME_KEYS, gameActions, gameStore, initGameStore } from "../../core/gameStore.js";
import { travelByCarriage } from "../../features/buildings/logic.js";
import { giftNpc } from "../../features/npc/logic.js";
import { applyResult } from "../../features/run.js";
import { runQuestChoice, settlePersuasion } from "./useQuestPanel.js";
import { restorePersuasionProgress } from "./useAutosave.js";
import { createTurnStaleCheck, createUndoController } from "./useUndo.js";
import { turnMonitor } from "../../core/turnMonitor.js";

it("records persuasion settlement as one command and clears only that attempt", () => {
  const setActivePersuasion = vi.fn();
  const setPersuasionProgress = vi.fn();
  const setChar = vi.fn();
  const forceAdvanceQuest = vi.fn();
  const addLog = vi.fn();
  const active = { questId: "hunter_learn_quest", flag: "agreed" };
  settlePersuasion({ setActivePersuasion, setPersuasionProgress, setChar, forceAdvanceQuest, addLog }, active, {
    outcome: "success", via: "bribe", cost: 3,
  });
  expect(setActivePersuasion).toHaveBeenCalledWith(null);
  expect(setPersuasionProgress.mock.calls[0][0]({ "hunter_learn_quest|agreed": 1, other: 2 })).toEqual({ other: 2 });
  expect(setChar.mock.calls[0][0]({ money: 10 })).toEqual({ money: 7 });
  expect(forceAdvanceQuest).toHaveBeenCalledWith(expect.objectContaining({ id: active.questId }), "agreed");
  expect(addLog).toHaveBeenCalledWith([expect.objectContaining({ t: "affection" })]);
  expect(turnMonitor.getTrees()[0]).toMatchObject({
    cmd: "quest.persuasionFinish", phases: ["MACHINE", "COMMIT", "DONE"],
  });
});

function createController(overrides = {}) {
  const pendingQueue = { current: ["next"] };
  const autoTravelRef = { current: true };
  const queueTimerRef = { current: null };
  const pendingTalksRef = { current: 2 };
  const talkBusyRef = { current: true };
  const waitTimerRef = { current: null };
  const setDuelPending = vi.fn();
  const setDuelingNpc = vi.fn();
  const setActiveBuilding = vi.fn();
  const setQueueCount = vi.fn();
  const clearCommandQueue = vi.fn();
  const turnGenerationRef = { current: 0 };
  const controller = createUndoController({
    undoSnapshotRef: { current: null },
    buildCurrentSnapshot: () => ({}),
    applySnapshot: vi.fn(),
    addLog: vi.fn(),
    pendingQueue,
    setQueueCount,
    clearCommandQueue,
    autoTravelRef,
    queueTimerRef,
    setDuelPending,
    setDuelingNpc,
    setActiveBuilding,
    pendingTalksRef,
    changePendingTalks: (delta) => {
      pendingTalksRef.current = Math.max(0, pendingTalksRef.current + delta);
    },
    talkBusyRef,
    setLoading: vi.fn(),
    waitTimerRef,
    setWaitSecs: vi.fn(),
    turnGenerationRef,
    ...overrides,
  });
  return {
    controller, pendingQueue, autoTravelRef, queueTimerRef, pendingTalksRef,
    talkBusyRef, waitTimerRef, setDuelPending, setDuelingNpc, setQueueCount, clearCommandQueue,
    setActiveBuilding, turnGenerationRef,
  };
}

function freshStore(overrides) {
  const original = structuredClone(gameStore.getState());
  const initial = Object.fromEntries(GAME_KEYS.map((key) => [key, null]));
  initGameStore({ ...initial, ...overrides });
  return () => initGameStore(original);
}

describe("undo controller", () => {
  it("exposes turn invalidation for the generation stop action", () => {
    const harness = createController();
    const isStale = createTurnStaleCheck(harness.turnGenerationRef);
    harness.controller.invalidateTurns();
    expect(isStale()).toBe(true);
  });

  it("preserves the pre-gift snapshot across the nested settle action", () => {
    const item = { id: "gift-1", name: "青玉" };
    const npc = { name: "商人" };
    const restoreStore = freshStore({
      room: { name: "鱼定村", npcs: [npc], items: [] },
      inv: [item],
      varTree: { 世界: {}, 角色: {} },
    });
    try {
      const before = {
        inv: gameStore.getState().inv,
        varTree: gameStore.getState().varTree,
      };
      const harness = createController({
        buildCurrentSnapshot: () => ({
          inv: gameStore.getState().inv,
          varTree: gameStore.getState().varTree,
        }),
        applySnapshot: (snapshot) => {
          gameActions.setInv(snapshot.inv);
          gameActions.setVarTreeState(snapshot.varTree);
        },
      });
      const settleOptions = [];

      harness.controller.captureUndo();
      applyResult({
        setVarTree: gameActions.setVarTreeState,
        act: (_cmd, _replies, opts) => {
          settleOptions.push(opts);
          if (!opts.keepUndo) harness.controller.captureUndo();
        },
      }, giftNpc(gameStore.getState(), npc, item, 123));

      expect(gameStore.getState().inv).toEqual([]);
      expect(gameStore.getState().varTree).not.toEqual(before.varTree);
      expect(settleOptions[0].keepUndo).toBe(true);
      harness.controller.rollbackOneStep();
      expect(turnMonitor.getSnapshot().current).toMatchObject({ phase: "ROLLED_BACK" });
      expect(gameStore.getState().inv).toEqual([item]);
      expect(gameStore.getState().varTree).toEqual(before.varTree);
    } finally {
      restoreStore();
    }
  });

  it("restores room, money, and the mutable room cache after carriage travel", () => {
    const roomMapRef = {
      current: {
        鱼定村: { items: ["旧物"], npcs: ["旧人"] },
        喇嘛庙: { items: ["新物"], npcs: ["新人"] },
      },
    };
    const restoreStore = freshStore({
      room: { name: "鱼定村", items: ["在地物"], npcs: ["在场人"] },
      char: { money: 100 },
      mapData: { 鱼定村: { x: 0, y: 0 }, 喇嘛庙: { x: 0, y: -1 } },
      time: 8,
    });
    try {
      const beforeRoomMap = structuredClone(roomMapRef.current);
      const harness = createController({
        buildCurrentSnapshot: () => {
          const state = gameStore.getState();
          return { room: state.room, char: state.char, time: state.time, roomMap: roomMapRef.current };
        },
        applySnapshot: (snapshot) => {
          gameActions.setRoom(snapshot.room);
          gameActions.setChar(snapshot.char);
          gameActions.setTime(snapshot.time);
          roomMapRef.current = snapshot.roomMap;
        },
      });

      harness.controller.captureUndo();
      roomMapRef.current.鱼定村 = { items: ["在地物"], npcs: ["在场人"] };
      applyResult({}, travelByCarriage(gameStore.getState(), "喇嘛庙", 10, { roomMap: roomMapRef.current }));
      expect(gameStore.getState().room.name).toBe("喇嘛庙");
      expect(gameStore.getState().char.money).toBe(90);

      harness.controller.rollbackOneStep();
      expect(gameStore.getState().room.name).toBe("鱼定村");
      expect(gameStore.getState().char.money).toBe(100);
      expect(roomMapRef.current).toEqual(beforeRoomMap);
    } finally {
      restoreStore();
    }
  });

  it("clears queued travel, duel, and pending-talk state and invalidates active turns", () => {
    vi.useFakeTimers();
    try {
      const harness = createController({
        buildCurrentSnapshot: () => ({ room: { name: "鱼定村" } }),
      });
      harness.queueTimerRef.current = setTimeout(() => {}, 1000);
      harness.waitTimerRef.current = setInterval(() => {}, 1000);
      harness.controller.captureUndo();

      harness.controller.rollbackOneStep();

      expect(harness.turnGenerationRef.current).toBe(1);
      expect(harness.clearCommandQueue).toHaveBeenCalledOnce();
      expect(harness.setQueueCount).toHaveBeenCalledWith(0);
      expect(harness.autoTravelRef.current).toBe(false);
      expect(harness.queueTimerRef.current).toBeNull();
      expect(harness.waitTimerRef.current).toBeNull();
      expect(harness.setDuelPending).toHaveBeenCalledWith(null);
      expect(harness.setDuelingNpc).toHaveBeenCalledWith(null);
      expect(harness.setActiveBuilding).toHaveBeenCalledWith(null);
      expect(harness.pendingTalksRef.current).toBe(0);
      expect(harness.talkBusyRef.current).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores persuasion progress from a snapshot", () => {
    let current = { quest: { score: 1 } };
    restorePersuasionProgress(
      { persuasionProgress: { quest: { score: 4 } } },
      (value) => { current = value; },
    );
    expect(current).toEqual({ quest: { score: 4 } });
    restorePersuasionProgress({}, (value) => { current = value; });
    expect(current).toEqual({});
  });

  it("captures undo before a quest-choice combat opens the duel", async () => {
    const calls = [];
    await runQuestChoice({
      act: vi.fn(),
      apiCfg: { questTriggerMode: "ai" },
      addLog: () => calls.push("log"),
      setPendingQuestBranch: () => calls.push("branch"),
      setDuelingNpc: () => calls.push("duel"),
      setActivePersuasion: vi.fn(),
      setInteractMode: vi.fn(),
      setTalkTarget: vi.fn(),
      captureUndo: () => calls.push("capture"),
      forceAdvanceQuest: vi.fn(),
    }, {
      quest: { id: "quest-1", title: "山路之争" },
      stage: {},
    }, {
      resolve: "combat",
      flag: "quest_branch_won",
      label: "迎战",
      combatNpc: { name: "山匪", levelCap: 1 },
    });

    expect(calls).toEqual(["capture", "log", "branch", "duel"]);
  });

});
