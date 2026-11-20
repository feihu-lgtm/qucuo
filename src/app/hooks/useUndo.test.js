import { describe, expect, it, vi } from "vitest";
import { GAME_KEYS, gameActions, gameStore, initGameStore } from "../../core/gameStore.js";
import { travelByCarriage } from "../../features/buildings/logic.js";
import { giftNpc } from "../../features/npc/logic.js";
import { applyResult } from "../../features/run.js";
import { restorePersuasionProgress } from "./useAutosave.js";
import { createUndoController } from "./useUndo.js";

function createController(overrides = {}) {
  const pendingQueue = { current: ["next"] };
  const autoTravelRef = { current: true };
  const queueTimerRef = { current: null };
  const pendingTalksRef = { current: 2 };
  const talkBusyRef = { current: true };
  const waitTimerRef = { current: null };
  const setDuelPending = vi.fn();
  const setDuelingNpc = vi.fn();
  const setQueueCount = vi.fn();
  const turnGenerationRef = { current: 0 };
  const controller = createUndoController({
    undoSnapshotRef: { current: null },
    buildCurrentSnapshot: () => ({}),
    applySnapshot: vi.fn(),
    addLog: vi.fn(),
    pendingQueue,
    setQueueCount,
    autoTravelRef,
    queueTimerRef,
    setDuelPending,
    setDuelingNpc,
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
    talkBusyRef, waitTimerRef, setDuelPending, setDuelingNpc, setQueueCount,
    turnGenerationRef,
  };
}

function freshStore(overrides) {
  const original = structuredClone(gameStore.getState());
  const initial = Object.fromEntries(GAME_KEYS.map((key) => [key, null]));
  initGameStore({ ...initial, ...overrides });
  return () => initGameStore(original);
}

describe("undo controller", () => {
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
      expect(harness.pendingQueue.current).toEqual([]);
      expect(harness.setQueueCount).toHaveBeenCalledWith(0);
      expect(harness.autoTravelRef.current).toBe(false);
      expect(harness.queueTimerRef.current).toBeNull();
      expect(harness.waitTimerRef.current).toBeNull();
      expect(harness.setDuelPending).toHaveBeenCalledWith(null);
      expect(harness.setDuelingNpc).toHaveBeenCalledWith(null);
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
});
