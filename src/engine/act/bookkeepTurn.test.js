import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameActions, gameStore, markGameReplaced } from "../../core/gameStore.js";
import { turnMonitor } from "../../core/turnMonitor.js";
import { createMockAi } from "../ports/ai.js";
import { getLedger } from "../../domain/memory/npcLedger.js";
import { runBookkeepAfterTurn } from "./bookkeepTurn.js";

const originalState = gameStore.getState();
const narration = "少侠砍伤阿旺，随后收剑离开。";

function seed(roomNpcs = [{ name: "阿旺" }]) {
  gameStore.setState({
    room: { name: "鱼定村", npcs: roomNpcs },
    varTree: { 角色: { 阿旺: { 好感度: 10 } } },
    time: 12,
  });
}

const call = (overrides = {}) => runBookkeepAfterTurn({
  ctx: { ai: createMockAi(['{"memory":"x","ledger":{"阿旺":["少侠砍伤阿旺"]}}']), apiCfg: {}, ...overrides.ctx },
  turn: { narrativeText: narration, ...overrides.turn },
  opts: { ...overrides.opts },
  trace: overrides.trace,
});

describe("runBookkeepAfterTurn", () => {
  beforeEach(() => seed());
  afterEach(() => {
    gameStore.setState(originalState, true);
    turnMonitor.clear();
  });

  it("applies ledger entries for NPCs present in the committed room and ignores memory", async () => {
    await call();
    const tree = gameStore.getState().varTree;
    expect(getLedger(tree, "阿旺").lines).toEqual(["少侠砍伤阿旺"]);
    expect(tree.角色.阿旺.旧账.memory).toBeUndefined();
  });

  it("uses the ref-backed setter supplied by the Web turn", async () => {
    const varTreeRef = { current: gameStore.getState().varTree };
    const setVarTree = vi.fn((next) => {
      const value = typeof next === "function" ? next(varTreeRef.current) : next;
      varTreeRef.current = value;
      gameActions.setVarTreeState(value);
    });
    await runBookkeepAfterTurn({
      ctx: {
        ai: createMockAi(['{"memory":"x","ledger":{"阿旺":["少侠砍伤阿旺"]}}']),
        apiCfg: {},
        setVarTree,
      },
      turn: { narrativeText: narration },
      opts: {},
    });
    expect(setVarTree).toHaveBeenCalledOnce();
    expect(typeof setVarTree.mock.calls[0][0]).toBe("function");
    expect(getLedger(varTreeRef.current, "阿旺").lines).toEqual(["少侠砍伤阿旺"]);
  });

  it("ignores ledger entries for names that are not in the room", async () => {
    const onRequest = vi.fn();
    const ai = createMockAi(['{"memory":"","ledger":{"路人甲":["少侠帮过路人甲"]}}'], { onRequest });
    await runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {} },
      turn: { narrativeText: narration },
      opts: {},
    });
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(gameStore.getState().varTree.角色.路人甲).toBeUndefined();
  });

  it("does not call AI when bookkeep is disabled", async () => {
    const ai = { chat: vi.fn() };
    await runBookkeepAfterTurn({
      ctx: { ai, apiCfg: { bookkeepEnabled: false } },
      turn: { narrativeText: narration },
      opts: {},
    });
    expect(ai.chat).not.toHaveBeenCalled();
  });

  it("does not call AI for duel reports", async () => {
    const ai = { chat: vi.fn() };
    await runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {} },
      turn: { narrativeText: narration },
      opts: { duelReport: { rounds: [] } },
    });
    expect(ai.chat).not.toHaveBeenCalled();
  });

  it("swallows AI errors without changing varTree", async () => {
    const before = gameStore.getState().varTree;
    const ai = { chat: vi.fn(async () => { throw new Error("offline"); }) };
    await expect(runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {} },
      turn: { narrativeText: narration },
      opts: {},
    })).resolves.toBeTruthy();
    expect(gameStore.getState().varTree).toBe(before);
  });

  it("applies bookkeep to the latest tree after an intervening write", async () => {
    const ai = {
      chat: vi.fn(async () => {
        gameActions.setVarTreeState((tree) => ({
          ...tree,
          角色: { ...tree.角色, 旁人: { 标记: "保留" } },
        }));
        return { text: '{"memory":"x","ledger":{"阿旺":["少侠砍伤阿旺"]}}' };
      }),
    };
    await runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {} },
      turn: { narrativeText: narration },
      opts: {},
    });
    expect(gameStore.getState().varTree.角色.旁人).toEqual({ 标记: "保留" });
    expect(getLedger(gameStore.getState().varTree, "阿旺").lines).toEqual(["少侠砍伤阿旺"]);
  });

  it("discards a late result after an undo restores the tree", async () => {
    let stale = false;
    let releaseResponse;
    let signalStarted;
    const started = new Promise((resolve) => { signalStarted = resolve; });
    const response = new Promise((resolve) => { releaseResponse = resolve; });
    const restoredTree = { 角色: { 阿旺: { 好感度: 3 } } };
    const setVarTree = vi.fn((next) => gameActions.setVarTreeState(next));
    const trace = turnMonitor.start("回滚中的记账");
    const pending = runBookkeepAfterTurn({
      ctx: {
        ai: { chat: vi.fn(() => { signalStarted(); return response; }) },
        apiCfg: {},
        isStale: () => stale,
        setVarTree,
      },
      turn: { narrativeText: narration },
      opts: {},
      trace,
    });
    await started;
    gameActions.setVarTreeState(restoredTree);
    stale = true;
    releaseResponse({ text: '{"memory":"x","ledger":{"阿旺":["少侠砍伤阿旺"]}}' });
    await pending;

    expect(gameStore.getState().varTree).toEqual(restoredTree);
    expect(setVarTree).not.toHaveBeenCalled();
    const bookkeepTree = turnMonitor.getTrees().find((tree) => tree.background && tree.parentId === trace.id);
    expect(bookkeepTree.nodes).toContainEqual(expect.objectContaining({
      label: "记账结果已作废（回合已回滚）",
    }));
  });

  it("discards a late result after the game is replaced", async () => {
    let releaseResponse;
    let signalStarted;
    const started = new Promise((resolve) => { signalStarted = resolve; });
    const response = new Promise((resolve) => { releaseResponse = resolve; });
    const restoredTree = { 角色: { 阿旺: { 好感度: 3 } } };
    const trace = turnMonitor.start("换档中的记账");
    const pending = runBookkeepAfterTurn({
      ctx: {
        ai: { chat: vi.fn(() => { signalStarted(); return response; }) },
        apiCfg: {},
        setVarTree: vi.fn((next) => gameActions.setVarTreeState(next)),
      },
      turn: { narrativeText: narration },
      opts: {},
      trace,
    });
    await started;
    gameActions.setVarTreeState(restoredTree);
    markGameReplaced();
    releaseResponse({ text: '{"memory":"x","ledger":{"阿旺":["少侠砍伤阿旺"]}}' });
    await pending;

    expect(gameStore.getState().varTree).toEqual(restoredTree);
    const bookkeepTree = turnMonitor.getTrees().find((tree) => tree.background && tree.parentId === trace.id);
    expect(bookkeepTree.nodes).toContainEqual(expect.objectContaining({
      label: "记账结果已作废（回合已回滚）",
    }));
  });

  it("skips when no NPCs are present or narration is empty", async () => {
    const ai = { chat: vi.fn() };
    gameStore.setState({ room: { name: "空房", npcs: [] } });
    await runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {}, talkTarget: "阿旺" },
      turn: { narrativeText: narration },
      opts: {},
    });
    await runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {} },
      turn: { narrativeText: " \n " },
      opts: {},
    });
    expect(ai.chat).not.toHaveBeenCalled();
  });
});
