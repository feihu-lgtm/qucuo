import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameActions, gameStore } from "../../core/gameStore.js";
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
