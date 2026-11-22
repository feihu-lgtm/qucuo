import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameActions, gameStore, markGameReplaced, subscribeGameReplaced } from "../../store/gameStore.js";
import { turnMonitor } from "../../infra/turnMonitor.js";
import { createMockAi } from "../ports/ai.js";
import { getLedger } from "../../domain/rules/memory/npcLedger.js";
import { getDistrictAnchor } from "../../domain/rules/map/innerMap.js";
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

const storeAccess = () => ({
  getGameState: () => gameStore.getState(),
  gameActions,
  subscribeGameReplaced,
});

const call = (overrides = {}) => runBookkeepAfterTurn({
  ctx: {
    ai: createMockAi(['{"memory":"x","ledger":{"阿旺":["少侠砍伤阿旺"]}}']),
    apiCfg: {},
    ...storeAccess(),
    ...overrides.ctx,
  },
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
        ...storeAccess(),
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
      ctx: { ai, apiCfg: {}, ...storeAccess() },
      turn: { narrativeText: narration },
      opts: {},
    });
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(gameStore.getState().varTree.角色.路人甲).toBeUndefined();
  });

  it("uses narration presence to exclude other inner rooms and include a following companion", async () => {
    const anchor = getDistrictAnchor("鱼定村");
    const roomNpcs = [
      { name: "隔壁客", innerRoom: "别处" },
      { name: "屋内客", innerRoom: anchor },
    ];
    seed(roomNpcs);
    const room = gameStore.getState().room;
    const companionState = {
      snowLeopard: { unlocked: true, active: true, data: { name: "雪豹" } },
    };
    const ai = createMockAi(['{"memory":"","ledger":{"隔壁客":["不应记账"],"屋内客":["屋内相见"],"雪豹":["一路同行"]}}']);
    await runBookkeepAfterTurn({
      ctx: {
        ai,
        apiCfg: {},
        ...storeAccess(),
        prompt: {
          room,
          isTalk: false,
          lockedDestName: null,
          innerRoomName: anchor,
          companionState,
        },
      },
      turn: { narrativeText: narration },
      opts: {},
    });

    const tree = gameStore.getState().varTree;
    expect(getLedger(tree, "隔壁客").lines).toEqual([]);
    expect(getLedger(tree, "屋内客").lines).toEqual(["屋内相见"]);
    expect(getLedger(tree, "雪豹").lines).toEqual(["一路同行"]);
  });

  it("uses the post-commit destination room for move-turn participants", async () => {
    seed([{ name: "乙" }]);
    gameActions.setRoom({ name: "B", npcs: [{ name: "乙" }] });
    const ai = createMockAi(['{"memory":"","ledger":{"甲":["离开前相遇"],"乙":["抵达后相遇"]}}']);
    await runBookkeepAfterTurn({
      ctx: {
        ai,
        apiCfg: {},
        ...storeAccess(),
        isTalk: false,
        lockedDestName: "B",
        prompt: {
          room: { name: "A", npcs: [{ name: "甲" }] },
          isTalk: false,
          lockedDestName: "B",
        },
      },
      turn: { narrativeText: narration },
      opts: {},
    });

    const tree = gameStore.getState().varTree;
    expect(getLedger(tree, "乙").lines).toEqual(["抵达后相遇"]);
    expect(getLedger(tree, "甲").lines).toEqual([]);
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
      ctx: { ai, apiCfg: {}, ...storeAccess() },
      turn: { narrativeText: narration },
      opts: { duelReport: { rounds: [] } },
    });
    expect(ai.chat).not.toHaveBeenCalled();
  });

  it("swallows AI errors without changing varTree", async () => {
    const before = gameStore.getState().varTree;
    const ai = { chat: vi.fn(async () => { throw new Error("offline"); }) };
    await expect(runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {}, ...storeAccess() },
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
      ctx: { ai, apiCfg: {}, ...storeAccess() },
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
        ...storeAccess(),
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
        ...storeAccess(),
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
      ctx: { ai, apiCfg: {}, talkTarget: "阿旺", ...storeAccess() },
      turn: { narrativeText: narration },
      opts: {},
    });
    await runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {}, ...storeAccess() },
      turn: { narrativeText: " \n " },
      opts: {},
    });
    expect(ai.chat).not.toHaveBeenCalled();
  });

  it("does not call the bookkeeping model on a pure-chat turn with no state writes", async () => {
    // 契约：提取产物只有叙事键、memory 为空、无 mvu/deal/plan/结算时，本回合无变动，
    // 记账调用整体短路（null + ai.chat 零调用）。
    const ai = { chat: vi.fn() };
    const result = await runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {}, ...storeAccess() },
      turn: {
        narrativeText: "两人隔着火炉闲聊了半个时辰。",
        p: {
          output: ["两人隔着火炉闲聊了半个时辰。"], memory: "",
          choices: [], respondedNpcs: ["阿旺"],
        },
      },
      opts: {},
    });
    expect(result).toBeNull();
    expect(ai.chat).not.toHaveBeenCalled();
  });

  it("still books turns that carry any non-narration extraction field", async () => {
    // 任一非白名单键（如 delta/char/emergedNpcName）出现即视为有变动，照常记账。
    const ai = createMockAi(['{"memory":"","ledger":{"阿旺":["打了招呼"]}}']);
    await runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {}, ...storeAccess() },
      turn: {
        narrativeText: narration,
        p: { output: ["少侠冲阿旺挥了挥手。"], delta: { "角色.阿旺.好感度": 1 } },
      },
      opts: {},
    });
    expect(getLedger(gameStore.getState().varTree, "阿旺").lines).toEqual(["打了招呼"]);
  });

  it("still books when extraction wrote a memory line on an otherwise narration-only turn", async () => {
    // 口头承诺/结人情只活在正文、不进任何字段——提取层判"值得记"给出 memory 时
    // 照常记账，承诺不漏账。
    const ai = createMockAi(['{"memory":"","ledger":{"阿旺":["少侠应承明日替他送刀"]}}']);
    await runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {}, ...storeAccess() },
      turn: {
        narrativeText: "少侠应了阿旺一句，明日替他跑一趟。",
        p: { output: ["少侠应了阿旺一句，明日替他跑一趟。"], memory: "少侠应承明日替阿旺送刀", respondedNpcs: ["阿旺"] },
      },
      opts: {},
    });
    expect(getLedger(gameStore.getState().varTree, "阿旺").lines).toEqual(["少侠应承明日替他送刀"]);
  });

  it("still books settle turns whose extraction produced narration-only fields", async () => {
    // 已结算回合（如卖玉）提取被跳过、p 只剩 output/memory——settle 标志按有变动处理，
    // 买卖必须落账，不得被纯叙事短路。
    const ai = createMockAi(['{"memory":"","ledger":{"阿旺":["买走玉佩"]}}']);
    await runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {}, ...storeAccess() },
      turn: { narrativeText: "少侠把玉佩递过去，阿旺付了八十两。", p: { output: ["……"], memory: "卖出玉佩" } },
      opts: { settle: true, settleKind: "sale" },
    });
    expect(getLedger(gameStore.getState().varTree, "阿旺").lines).toEqual(["买走玉佩"]);
  });

  it("still books turns driven by a settle plan or mvu commands", async () => {
    const ai = createMockAi(['{"memory":"","ledger":{"阿旺":["收钱办事"]}}']);
    await runBookkeepAfterTurn({
      ctx: { ai, apiCfg: {}, ...storeAccess(), intentPlan: { kind: "gift" } },
      turn: { narrativeText: narration, p: { output: ["收下银子"] } },
      opts: {},
    });
    const ai2 = createMockAi(['{"memory":"","ledger":{"阿旺":["刀光一闪"]}}']);
    await runBookkeepAfterTurn({
      ctx: { ai: ai2, apiCfg: {}, ...storeAccess() },
      turn: { narrativeText: narration, p: { output: ["出刀"] }, mvuCommands: [["add", "x", 1]] },
      opts: {},
    });
    expect(getLedger(gameStore.getState().varTree, "阿旺").lines).toEqual(["收钱办事", "刀光一闪"]);
  });
});
