import { describe, expect, it, vi } from "vitest";
import { emptyBodyProfile } from "../domain/rules/character/bodyProfile.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { startTrace } from "../infra/actionTrace.js";
import { applyKnowledgeTreeDiff } from "../domain/rules/prompt/knowledge.js";
import { gameActions, GAME_KEYS, gameStore, initGameStore, subscribeGameReplaced } from "../store/gameStore.js";
import { getRngState, random, setRngState, setSeed } from "../utils/rng.js";
import { loadSquares, serializeSquares } from "../domain/rules/map/mapSquares.js";
import { createMockAi } from "./ports/ai.js";
import { runTurn } from "./runTurn.js";
import { playTurn, ROLLBACK_KEYS } from "./playTurn.js";
import { refAccessors } from "../tests/mockRef.js";
import { commitRound } from "./act/commitRound.js";

function createPlayTurnContext(ai, commitRound) {
  const room = { name: "石阶", exits: [], npcs: [], items: [] };
  const char = { name: "测试主角", gender: "男", hp: [10, 10], special: {}, neigong: 0, waigong: 0 };
  const varTree = { 角色: {}, 世界: {}, 主角: {} };
  const apiCfg = {
    apiType: "openai", model: "test-model", targetWordCount: 220, contextWindow: 20,
    streamEnabled: false, bookkeepEnabled: false, callTokenLimits: {}, intentBudgets: {},
  };
  const trace = startTrace("play-turn-test");
  const ctx = {
    ai,
    apiCfg,
    convo: [],
    isTalk: false,
    prompt: {
      room, char, inv: [], skills: [], dao: { karma: 0, jie: 0 }, flags: [], questProgress: {},
      varTree, time: 1, preset: { scenario: "测试剧本总纲" }, companionState: {}, nsfwOn: false,
      activeTarget: null, isTalk: false, gm: false, movingDir: null, lockedDestName: null,
      outerDepart: null, innerRoomName: null, apiCfg, getTimeStr: () => "卯时",
      hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
    },
    callDeps: () => ({
      varTree, gm: false, isSettle: false, isTalk: false,
      intent: { code: "UNKNOWN", label: "无法判定" }, apiCfg, narrator: initialNarratorState(),
      scenario: "测试剧本总纲", budgetInstruction: null, npcLoreBlockWithQuest: "",
      visibleNpcsCount: 0, charName: char.name, charBodyProfile: emptyBodyProfile(),
      pickupJudgment: null, convo: [], nsfwOn: false, ctx: "", recallBlock: "",
      reunionBlock: "", hist: "", mainConvo: [], gambleTalkCtx: null, recallInfo: null,
      _trace: trace, addLog: () => {}, setLog: () => {},
    }),
    memory: {
      varTreeLatest: varTree, roomNpcNames: [], time: 1, apiCfg, flags: [],
      recall: { apiCfg, cmd: "探索石阶", lastAiText: "", room, varTreeLatest: varTree, flags: [], activeTarget: null, isTalk: false, talkTarget: null },
    },
    state: { room, char, inv: [], dao: {} },
    _trace: trace,
    refs: {
      varTreeRef: { current: varTree },
      roomMapRef: { current: { 石阶: { npcs: [], items: [] } } },
      dayMaterialRef: { current: [] },
    },
    commitDeps: (turn) => ({ turn, setPot: gameActions.setPot }),
    commitRound,
    getGameState: () => gameStore.getState(), gameActions, subscribeGameReplaced,
  };
  return ctx;
}

describe("stale turn handling", () => {
  it("does not commit an AI response after turn invalidation", async () => {
    let releaseResponse;
    let signalStarted;
    const started = new Promise((resolve) => { signalStarted = resolve; });
    const response = new Promise((resolve) => { releaseResponse = resolve; });
    const ai = { chat: vi.fn(() => { signalStarted(); return response; }) };
    const committed = vi.fn();
    const ctx = createPlayTurnContext(ai, committed);
    const generation = { current: 0 };
    ctx.isStale = () => generation.current !== 0;
    const callDeps = ctx.callDeps;
    ctx.callDeps = (...args) => ({ ...callDeps(...args), isStale: ctx.isStale });

    const pendingTurn = playTurn(ctx, "探索石阶");
    await started;
    generation.current += 1;
    releaseResponse({ text: "迟到的叙事", finishReason: "stop" });

    await expect(pendingTurn).resolves.toMatchObject({ ok: false, stale: true });
    expect(committed).not.toHaveBeenCalled();
    expect(ctx._trace.phases).toEqual(["MACHINE", "AI_WAIT", "DISCARDED"]);
  });
});

describe("runTurn", () => {
  it("restores rollback keys and RNG while preserving concurrent log writes（WO-06：refs 已清退，不再参与回滚）", async () => {
    const originalStore = structuredClone(gameStore.getState());
    const originalRng = getRngState();
    const originalSquares = serializeSquares();
    const initialStore = Object.fromEntries(GAME_KEYS.map((key) => [key, null]));
    initialStore.room = { name: "石阶", exits: [], npcs: [], items: [] };
    initialStore.char = { name: "测试主角", hp: [10, 10], special: {} };
    initialStore.varTree = { 角色: {}, 世界: {}, 主角: {} };
    initialStore.pot = 7;
    initialStore.log = [{ t: "sys", text: "before" }];
    initGameStore(initialStore);
    loadSquares({ 石阶: { npcs: [], items: [{ name: "before" }] } });
    setSeed(8123);
    const before = structuredClone(gameStore.getState());
    const rngBefore = getRngState();
    const squaresBefore = serializeSquares();

    const committed = await playTurn(createPlayTurnContext(
      createMockAi(["叙事"]),
      ({ setPot }) => setPot(3),
    ), "探索石阶");
    expect(committed.ok).toBe(true);
    expect(gameStore.getState().pot).toBe(3);

    initGameStore(before);
    setRngState(rngBefore);
    const roomBefore = gameStore.getState().room;
    const failingContext = createPlayTurnContext(
      createMockAi(["叙事"]),
      (deps) => {
        for (const key of ROLLBACK_KEYS) {
          if (key === "room") continue;
          const setter = key === "varTree" ? "setVarTreeState" : `set${key[0].toUpperCase()}${key.slice(1)}`;
          gameActions[setter]({ changed: key });
        }
        gameActions.setLog((previous) => [...previous, { t: "sys", text: "concurrent commit" }]);
        gameActions.setQuestProgress({ concurrent: true });
        loadSquares({ partial: { npcs: [], items: [] } });
        random();
        throw new Error("commit failed");
      },
    );
    const failed = await playTurn(failingContext, "探索石阶");
    expect(failed.ok).toBe(false);
    expect(failed.error.message).toBe("commit failed");
    for (const key of ROLLBACK_KEYS) expect(gameStore.getState()[key]).toEqual(before[key]);
    expect(gameStore.getState().room).toBe(roomBefore);
    expect(gameStore.getState().pot).toBe(before.pot);
    expect(gameStore.getState().log).toEqual([
      ...before.log,
      { t: "sys", text: "concurrent commit" },
    ]);
    expect(gameStore.getState().questProgress).toEqual({ concurrent: true });
    expect(getRngState()).toBe(rngBefore);
    expect(serializeSquares()).toEqual(squaresBefore);
    initGameStore(originalStore);
    setRngState(originalRng);
    loadSquares(originalSquares);
  });

  it("merges knowledge changes onto the latest varTree without losing intervening edits", () => {
    const base = {
      角色: { 阿青: { 好感度: 1 } },
      世界: { 知识领域: { 事实: { 山洪: { 摘要: "", 知晓者: {} } } } },
    };
    const evolved = {
      ...base,
      世界: { 知识领域: { 事实: { 山洪: { 摘要: "山洪曾毁坏旧桥", 知晓者: {} } } } },
    };
    const latest = {
      角色: { 阿青: { 好感度: 8 }, 小满: { 好感度: 3 } },
      世界: { 知识领域: { 事实: { 山洪: { 摘要: "", 知晓者: { 阿青: { 途径: "目击", 得知回合: 6 } } }, 旧约: { 摘要: "旧约", 知晓者: {} } } } },
    };

    expect(applyKnowledgeTreeDiff(base, evolved, latest)).toEqual({
      角色: { 阿青: { 好感度: 8 }, 小满: { 好感度: 3 } },
      世界: { 知识领域: { 事实: { 山洪: { 摘要: "山洪曾毁坏旧桥", 知晓者: { 阿青: { 途径: "目击", 得知回合: 6 } } }, 旧约: { 摘要: "旧约", 知晓者: {} } } } },
    });
  });

  it("deduplicates _prefetchedRecall against rendered hist rather than raw mainConvo", async () => {
    const requests = [];
    const ai = createMockAi(["风过石阶。"], {
      onRequest: (messages) => requests.push(messages),
    });
    const ctx = createPlayTurnContext(ai, vi.fn());
    ctx.apiCfg.contextWindow = 2;
    ctx.convo = [
      { role: "user", content: "早先往事" },
      { role: "assistant", content: "已被滑动窗口裁掉的旧记忆" },
      { role: "user", content: "刚才动作" },
      { role: "assistant", content: "还留在当前历史里的近况" },
    ];
    ctx._prefetchedRecall = Promise.resolve({
      recallInfo: {
        visible: [
          { tier: "strong", text: "已被滑动窗口裁掉的旧记忆", meta: { turn: 1 } },
          { tier: "strong", text: "还留在当前历史里的近况", meta: { turn: 3 } },
        ],
      },
      recallBlock: "\n\n[往事]\n· （第1回合）已被滑动窗口裁掉的旧记忆\n· （第3回合）还留在当前历史里的近况",
    });

    await runTurn(ctx, "继续往里走");

    const serialized = JSON.stringify(requests[0]);
    expect(serialized).toContain("（第1回合）已被滑动窗口裁掉的旧记忆");
    expect(serialized).not.toContain("（第3回合）还留在当前历史里的近况");
  });

  it.each([
    [404, 1],
    [401, 1],
    [500, 3],
  ])("HTTP %i 主叙事调用 %i 次后放弃，整轮回滚", async (status, calls) => {
    const error = Object.assign(new Error(`OpenAI 兼容调用 HTTP ${status}：响应体为空`), { httpStatus: status });
    const ai = { chat: vi.fn(async () => { throw error; }) };
    const committed = vi.fn();
    const result = await playTurn(createPlayTurnContext(ai, committed), "探索石阶");
    expect(result).toMatchObject({ ok: false, error });
    expect(ai.chat).toHaveBeenCalledTimes(calls);
    expect(committed).not.toHaveBeenCalled();
  });

  it("429 按 Retry-After 等待，没有就指数退避，再重试", async () => {
    const limited = (retryAfterMs) => Object.assign(new Error("OpenAI 兼容调用 HTTP 429：Rate limit reached"), { httpStatus: 429, retryAfterMs });
    const ai = { chat: vi.fn()
      .mockRejectedValueOnce(limited(5000))
      .mockRejectedValueOnce(limited(undefined))
      .mockResolvedValueOnce({ text: "石阶旁的草叶轻轻摇动。", finishReason: "stop" }) };
    const ctx = createPlayTurnContext(ai, vi.fn());
    ctx.sleep = vi.fn(async () => {});
    const result = await playTurn(ctx, "探索石阶");
    expect(result.ok).toBe(true);
    expect(ai.chat).toHaveBeenCalledTimes(3);
    expect(ctx.sleep.mock.calls).toEqual([[5000], [4000]]);
  });

  it("429 要求等待超过 30 秒时不白重试", async () => {
    const error = Object.assign(new Error("HTTP 429：Rate limit reached"), { httpStatus: 429, retryAfterMs: 60000 });
    const ai = { chat: vi.fn(async () => { throw error; }) };
    const ctx = createPlayTurnContext(ai, vi.fn());
    ctx.sleep = vi.fn(async () => {});
    await expect(playTurn(ctx, "探索石阶")).resolves.toMatchObject({ ok: false, error });
    expect(ai.chat).toHaveBeenCalledTimes(1);
    expect(ctx.sleep).not.toHaveBeenCalled();
  });

  it("429 重试用尽仍失败就整轮回滚", async () => {
    const error = Object.assign(new Error("HTTP 429：Rate limit reached"), { httpStatus: 429 });
    const ai = { chat: vi.fn(async () => { throw error; }) };
    const committed = vi.fn();
    const ctx = createPlayTurnContext(ai, committed);
    ctx.sleep = vi.fn(async () => {});
    await expect(playTurn(ctx, "探索石阶")).resolves.toMatchObject({ ok: false, error });
    expect(ai.chat).toHaveBeenCalledTimes(3);
    expect(committed).not.toHaveBeenCalled();
  });

  it("空内容按空响应重试", async () => {
    const ai = createMockAi(["", "石阶旁的草叶轻轻摇动。"]);
    const chat = vi.spyOn(ai, "chat");
    const committed = vi.fn();
    const result = await playTurn(createPlayTurnContext(ai, committed), "探索石阶");
    expect(result.ok).toBe(true);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(committed).toHaveBeenCalledTimes(1);
  });
});
