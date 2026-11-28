import { describe, expect, it, vi } from "vitest";
import { emptyBodyProfile } from "../domain/rules/character/bodyProfile.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { startTrace } from "../infra/actionTrace.js";
import { applyKnowledgeTreeDiff } from "../domain/rules/prompt/knowledge.js";
import { gameActions, GAME_KEYS, gameStore, initGameStore, subscribeGameReplaced } from "../store/gameStore.js";
import { getRngState, random, setRngState, setSeed } from "../utils/rng.js";
import { loadSquares, serializeSquares } from "../domain/rules/map/mapSquares.js";
import { createMockAi } from "./ports/ai.js";
import { createExtractionState, runTurn } from "./runTurn.js";
import { playTurn, ROLLBACK_KEYS } from "./playTurn.js";
import { refAccessors } from "../tests/mockRef.js";
import { commitRound } from "./act/commitRound.js";

function createPlayTurnContext(ai, commitRound) {
  const room = { name: "石阶", exits: [], npcs: [], items: [] };
  const char = { name: "测试主角", gender: "男", hp: [10, 10], special: {}, neigong: 0, waigong: 0 };
  const varTree = { 角色: {}, 世界: {}, 主角: {} };
  const apiCfg = {
    apiType: "openai", model: "test-model", targetWordCount: 220, contextWindow: 20,
    streamEnabled: false, extractionEnabled: false, bookkeepEnabled: false, callTokenLimits: {}, intentBudgets: {},
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
    releaseResponse({ text: '{"output":["迟到的叙事"],"delta":{"pot":3}}', finishReason: "stop" });

    await expect(pendingTurn).resolves.toMatchObject({ ok: false, stale: true });
    expect(committed).not.toHaveBeenCalled();
    expect(ctx._trace.phases).toEqual(["MACHINE", "AI_WAIT", "DISCARDED"]);
  });
});

describe("runTurn", () => {
  it("WO-16G-G2：判官链下复合自由行动 turn.intake 恰好一次、全程无 intent.classify", async () => {
    const calls = [];
    const callOpts = [];
    const intakeJson = JSON.stringify({
      read: "送刀再闲聊", refIds: [],
      actions: [
        { kind: "give", target: "才旦", item: "霜牙短刀", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.9, text: "送刀", useKind: "", intimate: false },
        { kind: "talk", target: "才旦", item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.9, text: "闲聊", useKind: "", intimate: false },
      ],
      proposals: [],
    });
    const ai = {
      async chat(messages, chatOpts) {
        const all = String(chatOpts?.systemPrompt || "") + "\n" + (messages || []).map((m) => String(typeof m === "string" ? m : (m?.content ?? m?.text ?? ""))).join("\n");
        calls.push(all);
        callOpts.push(chatOpts);
        if (all.includes("听意员")) return { text: intakeJson };
        return { text: '正文叙事一句。\n---SEAL---\n{"fills":{},"respondedNpcs":[],"spontaneousPact":null}' };
      },
    };
    const varTree = { 角色: {} };
    const deps = {
      convo: [], addLog: vi.fn(), setConvo: vi.fn(),
      apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000, model: "main-x", extractionModel: "extract-y" },
      intent: { code: "UNKNOWN", label: "无法判定" },
      room: { name: "鱼定村", npcs: [{ name: "才旦" }], items: [], exits: [] },
      inv: [{ id: "it_x", name: "霜牙短刀", category: "weapon" }],
      char: { hp: [80, 100], special: { 气运: 5 } }, skills: [],
      varTree, memory: { varTreeLatest: varTree, recall: { lastAiText: "" } },
      gm: false, flags: [],
      narrator: initialNarratorState(), narratorStage: initialNarratorState().stage,
      scenario: "测试剧本", preset: { scenario: "测试剧本" },
      charBodyProfile: emptyBodyProfile(), charName: "少侠",
      dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
      time: 1, getTimeStr: () => "卯时",
      hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
      visibleNpcsCount: 1, npcLoreBlockWithQuest: "",
      isTalk: false,
      ai,
    };
    const turn = await runTurn(deps, "把霜牙短刀送给才旦，再跟他聊聊家常");

    expect(turn).toBeTruthy();
    // 前哨听意恰好一次——串行双调用已消除
    expect(calls.filter((c) => c.includes("听意员"))).toHaveLength(1);
    // 旧行动识别器（intent.classify）全程零调用
    expect(calls.filter((c) => c.includes("行动识别器"))).toHaveLength(0);
    // WO-16G-G2 模型口径钉住：前哨走提取链模型（extractionModel 优先于主模型）且关思考
    const intakeIdx = calls.findIndex((c) => c.includes("听意员"));
    expect(callOpts[intakeIdx]?.cfg?.model).toBe("extract-y");
    expect(callOpts[intakeIdx]?.cfg?.thinkingMode).toBe("off");
    // 主叙事仍用主模型——提取链口径不影响主调用
    const mainIdx = calls.findIndex((c, i) => i !== intakeIdx && c.length > 100);
    if (mainIdx >= 0) expect(callOpts[mainIdx]?.cfg?.model ?? "main-x").toBe("main-x");
  });

  it("WO-16G-G2：纯搭话跳过前哨——零 intake 调用，判官 talkOnly 照常", async () => {
    const calls = [];
    const ai = {
      async chat(messages, chatOpts) {
        const all = String(chatOpts?.systemPrompt || "") + "\n" + (messages || []).map((m) => String(typeof m === "string" ? m : (m?.content ?? ""))).join("\n");
        calls.push(all);
        return { text: '才旦笑着应了。\n---SEAL---\n{"fills":{},"respondedNpcs":[],"spontaneousPact":null}' };
      },
    };
    const varTree = { 角色: {} };
    const deps = {
      convo: [], addLog: vi.fn(), setConvo: vi.fn(),
      apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
      intent: { code: "TALK_CASUAL", label: "日常闲聊" },
      room: { name: "鱼定村", npcs: [{ name: "才旦" }], items: [], exits: [] },
      inv: [], char: { hp: [80, 100], special: { 气运: 5 } }, skills: [],
      varTree, memory: { varTreeLatest: varTree, recall: { lastAiText: "" } },
      gm: false, flags: [],
      narrator: initialNarratorState(), narratorStage: initialNarratorState().stage,
      scenario: "测试剧本", preset: { scenario: "测试剧本" },
      charBodyProfile: emptyBodyProfile(), charName: "少侠",
      dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
      time: 1, getTimeStr: () => "卯时",
      hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
      visibleNpcsCount: 1, npcLoreBlockWithQuest: "",
      isTalk: true, talkTarget: "才旦",
      ai,
    };
    const turn = await runTurn(deps, "才旦，最近可好？");
    expect(turn).toBeTruthy();
    // 纯搭话：前哨零调用——听意单本地合成
    expect(calls.filter((c) => c.includes("听意员"))).toHaveLength(0);
    // 判官链仍激活：talk 对象系统推导照常（respondedNpcs 来源）
    expect(turn.derivedRespondedNpcs).toEqual(["才旦"]);
    expect(turn.judgePipelineActive).toBe(true);
  });

  it("WO-16G-G2 混合分流：搭话有任务推进候选时仍调一次 turn.intake（说动通道不断）", async () => {
    const calls = [];
    const intakeJson = JSON.stringify({
      read: "说动老猎户", refIds: [],
      actions: [{ kind: "talk", target: "老猎户", item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "sincere", outcome: "无", risk: "无", confidence: 0.8, text: "老猎户，教我几手吧", useKind: "", intimate: false }],
      proposals: [{ claim: "说动了老猎户", kind: "quest_advance", fit: "natural", questId: "hunter_learn_quest", flag: "quest_village1_s1" }],
    });
    const ai = {
      async chat(messages, chatOpts) {
        const all = String(chatOpts?.systemPrompt || "") + "\n" + (messages || []).map((m) => String(typeof m === "string" ? m : (m?.content ?? ""))).join("\n");
        calls.push(all);
        if (all.includes("听意员")) return { text: intakeJson };
        return { text: '大娘点头。\n---SEAL---\n{"fills":{},"respondedNpcs":[],"spontaneousPact":null}' };
      },
    };
    const varTree = { 角色: {} };
    const deps = {
      convo: [], addLog: vi.fn(), setConvo: vi.fn(),
      apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
      intent: { code: "TALK_CASUAL", label: "日常闲聊" },
      // 老猎户在场 + hunter_learn_quest 未开启 → questAdvanceCandidates 非空
      room: { name: "鱼定村", npcs: [{ name: "老猎户" }], items: [], exits: [] },
      inv: [], char: { hp: [80, 100], special: { 气运: 5 } }, skills: [],
      varTree, memory: { varTreeLatest: varTree, recall: { lastAiText: "" } },
      gm: false, flags: [],
      narrator: initialNarratorState(), narratorStage: initialNarratorState().stage,
      scenario: "测试剧本", preset: { scenario: "测试剧本" },
      charBodyProfile: emptyBodyProfile(), charName: "少侠",
      dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
      time: 1, getTimeStr: () => "卯时",
      hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
      visibleNpcsCount: 1, npcLoreBlockWithQuest: "",
      isTalk: true, talkTarget: "老猎户",
      ai,
    };
    const turn = await runTurn(deps, "老猎户，教我几手吧");
    expect(turn).toBeTruthy();
    // 有候选：前哨必须调用——且恰好一次（混合分流的成本是有意保留的）
    expect(calls.filter((c) => c.includes("听意员"))).toHaveLength(1);
    expect(turn.judgePipelineActive).toBe(true);
  });



  it("WO-16F-F2c 交互意向：duel/trade 挂 turn.deferredIntents，叙事注入意向口径而非已打已买", async () => {
    const calls = [];
    const intakeJson = JSON.stringify({
      read: "邀战铁匠再问价掌柜", refIds: [],
      actions: [
        { kind: "duel", target: "铁匠", item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.8, text: "想和铁匠切磋", useKind: "", intimate: false },
        { kind: "trade", target: "掌柜", item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.8, text: "问问掌柜有什么好货", useKind: "", intimate: false },
        { kind: "duel", target: "路人乙", item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.5, text: "还想打路人", useKind: "", intimate: false },
      ],
      proposals: [],
    });
    const ai = {
      async chat(messages, chatOpts) {
        const all = String(chatOpts?.systemPrompt || "") + "\n" + (messages || []).map((m) => String(typeof m === "string" ? m : (m?.content ?? ""))).join("\n");
        calls.push(all);
        if (all.includes("听意员")) return { text: intakeJson };
        return { text: '铁匠抱拳。\n---SEAL---\n{"fills":{},"respondedNpcs":[],"spontaneousPact":null}' };
      },
    };
    const varTree = { 角色: {} };
    const deps = {
      convo: [], addLog: vi.fn(), setConvo: vi.fn(),
      apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
      intent: { code: "FREE", label: "自由行动" },
      room: { name: "鱼定村", npcs: [{ name: "铁匠" }, { name: "掌柜" }], items: [], exits: [] },
      inv: [], char: { hp: [80, 100], special: { 气运: 5 } }, skills: [],
      varTree, memory: { varTreeLatest: varTree, recall: { lastAiText: "" } },
      gm: false, flags: [],
      narrator: initialNarratorState(), narratorStage: initialNarratorState().stage,
      scenario: "测试剧本", preset: { scenario: "测试剧本" },
      charBodyProfile: emptyBodyProfile(), charName: "少侠",
      dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
      time: 1, getTimeStr: () => "卯时",
      hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
      visibleNpcsCount: 2, npcLoreBlockWithQuest: "",
      isTalk: false,
      ai,
    };
    const turn = await runTurn(deps, "跟铁匠切磋，再问问掌柜有什么货");
    expect(turn).toBeTruthy();
    // 收集成功两条（在场铁匠/掌柜），路人乙不在场被滤掉不进意向
    expect(turn.deferredIntents).toHaveLength(2);
    expect(turn.deferredIntents[0]).toMatchObject({ kind: "duel", target: "铁匠" });
    expect(turn.deferredIntents[1]).toMatchObject({ kind: "trade", target: "掌柜" });
    // 叙事输入（判官铁律块）是意向口径：邀战/问价，绝不是已开打/已成交
    const judgeInput = calls.find((c) => c.includes("交互意向")) || "";
    expect(judgeInput).toContain("邀战");
    expect(judgeInput).toContain("问价");
    expect(judgeInput).toContain("不得写已开打或胜负");
    expect(judgeInput).toContain("不得写已成交");
    expect(judgeInput).toContain("未能如愿"); // 路人乙不在场失败回执
  });

  it("WO-16F-F2c 闸门：talkOnly/条件句不收集交互意向", async () => {
    const intakeJson = JSON.stringify({
      read: "要是没人就打铁匠", refIds: [],
      actions: [
        { kind: "duel", target: "铁匠", item: "无", itemId: "", direction: "none", condition: "遇敌", condition_text: "要是碰上", stance: "casual", outcome: "无", risk: "无", confidence: 0.8, text: "打铁匠", useKind: "", intimate: false },
      ],
      proposals: [],
    });
    const ai = {
      async chat(messages, chatOpts) {
        const all = String(chatOpts?.systemPrompt || "") + "\n" + (messages || []).map((m) => String(typeof m === "string" ? m : (m?.content ?? ""))).join("\n");
        if (all.includes("听意员")) return { text: intakeJson };
        return { text: '嗯。\n---SEAL---\n{"fills":{},"respondedNpcs":[],"spontaneousPact":null}' };
      },
    };
    const varTree = { 角色: {} };
    const deps = {
      convo: [], addLog: vi.fn(), setConvo: vi.fn(),
      apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
      intent: { code: "FREE", label: "自由行动" },
      room: { name: "鱼定村", npcs: [{ name: "铁匠" }], items: [], exits: [] },
      inv: [], char: { hp: [80, 100], special: { 气运: 5 } }, skills: [],
      varTree, memory: { varTreeLatest: varTree, recall: { lastAiText: "" } },
      gm: false, flags: [],
      narrator: initialNarratorState(), narratorStage: initialNarratorState().stage,
      scenario: "测试剧本", preset: { scenario: "测试剧本" },
      charBodyProfile: emptyBodyProfile(), charName: "少侠",
      dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
      time: 1, getTimeStr: () => "卯时",
      hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
      visibleNpcsCount: 1, npcLoreBlockWithQuest: "",
      isTalk: false,
      ai,
    };
    const turn = await runTurn(deps, "要是碰上就打铁匠");
    // condition≠无：不收集——deferredIntents 为空（null）
    expect(turn.deferredIntents || null).toBeNull();
  });

  it("normalizes and returns a duel request for an NPC present in the room", async () => {
    const npc = { name: "才旦" };
    const commit = vi.fn();
    const ctx = createPlayTurnContext(
      createMockAi(['{"output":["双方摆开架势"],"duelRequest":"才旦"}']),
      commit,
    );
    ctx.state.room.npcs = [npc];

    const result = await playTurn(ctx, "向才旦切磋");

    expect(result).toMatchObject({ ok: true, duelRequest: npc });
    expect(result.turn.p.duelRequest).toBe(npc);
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({
      turn: expect.objectContaining({ p: expect.objectContaining({ duelRequest: npc }) }),
    }));
  });

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
      createMockAi(['{"output":["叙事"],"delta":{"pot":3}}']),
      ({ turn, setPot }) => setPot(turn.p.delta.pot),
    ), "探索石阶");
    expect(committed.ok).toBe(true);
    expect(gameStore.getState().pot).toBe(3);

    initGameStore(before);
    setRngState(rngBefore);
    const roomBefore = gameStore.getState().room;
    const failingContext = createPlayTurnContext(
      createMockAi(['{"output":["叙事"]}']),
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

  it("forwards the locked destination and its exits to extraction", () => {
    const extractionState = createExtractionState({
      state: {
        room: { name: "山脚", exits: ["东"] },
        char: { hp: [10, 10] },
        inv: [],
        dao: {},
      },
      getMapNode: (name) => name === "山门" ? { exits: { west: "山脚" } } : null,
    }, { varTree: {}, lockedDestName: "山门" });

    expect(extractionState.lockedDestName).toBe("山门");
    expect(extractionState.lockedExits).toEqual({ west: "山脚" });
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

  it("retries a truncated unparseable response and returns the next parsed result", async () => {
    const requests = [];
    const ai = createMockAi([
      { text: "{not json", finishReason: "length" },
      `{"output":["石阶旁的草叶轻轻摇动。"],"delta":{"pot":3}}\n<mvu>_.set('世界.天气', '晴');</mvu>`,
    ], { onRequest: (messages) => requests.push(messages) });
    const apiCfg = {
      apiType: "openai",
      model: "test-model",
      targetWordCount: 220,
      contextWindow: 20,
      streamEnabled: false,
      extractionEnabled: false,
      callTokenLimits: {},
      intentBudgets: {},
    };
    const result = await runTurn({
      ai,
      apiCfg,
      convo: [],
      isTalk: false,
      prompt: {
        room: { name: "石阶", exits: [], npcs: [], items: [] },
        char: { name: "测试主角", gender: "男", hp: [10, 10], special: {}, neigong: 0, waigong: 0 },
        inv: [],
        skills: [],
        dao: { karma: 0, jie: 0 },
        flags: [],
        questProgress: {},
        varTree: { 角色: {}, 世界: {}, 主角: {} },
        time: 1,
        preset: { scenario: "测试剧本总纲" },
        companionState: {},
        nsfwOn: false,
        activeTarget: null,
        isTalk: false,
        gm: false,
        movingDir: null,
        lockedDestName: null,
        outerDepart: null,
        innerRoomName: null,
        apiCfg,
        getTimeStr: () => "卯时",
        hasInnerMap: () => false,
        describeEquipment: () => "",
        describeTodayForAI: () => "",
      },
      callDeps: () => ({
        varTree: { 角色: {}, 世界: {}, 主角: {} },
        gm: false,
        isSettle: false,
        isTalk: false,
        intent: { code: "UNKNOWN", label: "无法判定，交由本次调用自行裁量" },
        apiCfg,
        narrator: initialNarratorState(),
        scenario: "测试剧本总纲",
        budgetInstruction: null,
        npcLoreBlockWithQuest: "",
        visibleNpcsCount: 0,
        charName: "测试主角",
        charBodyProfile: emptyBodyProfile(),
        pickupJudgment: null,
        convo: [],
        nsfwOn: false,
        ctx: "[状态] 测试状态行",
        recallBlock: "",
        reunionBlock: "",
        infoDomainBlock: "",
        hist: "",
        mainConvo: [],
        gambleTalkCtx: null,
        recallInfo: null,
        _trace: startTrace("run-turn-test"),
        addLog: () => {},
        setLog: () => {},
      }),
    }, "探索石阶");

    expect(JSON.stringify(requests[0])).toContain("探索石阶");
    expect(JSON.stringify(requests[0])).toContain("房间:石阶");
    expect(requests).toHaveLength(2);
    expect(result.p.output).toEqual(["石阶旁的草叶轻轻摇动。"]);
    expect(result.p.delta.pot).toBe(3);
    expect(result.mvuCommands).toHaveLength(1);
  });

  it("deduplicates _prefetchedRecall against rendered hist rather than raw mainConvo", async () => {
    const requests = [];
    const ai = createMockAi(['{"output":["风过石阶。"],"delta":{}}'], {
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
      .mockResolvedValueOnce({ text: '{"output":["石阶旁的草叶轻轻摇动。"],"delta":{}}', finishReason: "stop" }) };
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
    const ai = createMockAi(["", '{"output":["石阶旁的草叶轻轻摇动。"],"delta":{}}']);
    const chat = vi.spyOn(ai, "chat");
    const committed = vi.fn();
    const result = await playTurn(createPlayTurnContext(ai, committed), "探索石阶");
    expect(result.ok).toBe(true);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(committed).toHaveBeenCalledTimes(1);
  });

  it("runRecall 与 turn.intake 并行发起，且 fact.summary 不阻塞主调用前路径", async () => {
    const events = [];
    const vt = {
      角色: { 才旦: { 好感度: 10 } },
      世界: { 知识领域: { 事实: { f_pending: { id: "f_pending", 摘要: "", 知晓者: { 才旦: { 途径: "剧本", 得知回合: 0 } } } } } },
    };
    const intakeJson = JSON.stringify({
      read: "和才旦搭话", refIds: [],
      actions: [{ kind: "talk", target: "才旦", item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.9, text: "问好", useKind: "", intimate: false }],
      proposals: [],
    });
    let releaseRecall;
    const prefetched = new Promise((resolve) => { releaseRecall = resolve; });
    const ai = {
      async chat(messages, chatOpts) {
        const text = String(chatOpts?.systemPrompt || "") + "\n" + (messages || []).map((m) => String(m?.content || "")).join("\n");
        if (text.includes("听意员")) {
          events.push("intake_called_before_recall_settled");
          releaseRecall({ recallInfo: { visible: [] }, recallBlock: "" });
          return { text: intakeJson };
        }
        if (text.includes("待补") || text.includes("概括成一句")) {
          events.push("summary_called");
          return { text: "不该在主调用前出现" };
        }
        events.push("main_called");
        return { text: '才旦点了点头。\n---SEAL---\n{"fills":{},"respondedNpcs":["才旦"],"spontaneousPact":null}' };
      },
    };
    const deps = {
      convo: [], addLog: vi.fn(), setConvo: vi.fn(),
      apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000, model: "m", extractionModel: "e" },
      intent: { code: "UNKNOWN", label: "未知" },
      room: { name: "鱼定村", npcs: [{ name: "才旦" }], items: [], exits: [] },
      inv: [], char: { hp: [80, 100], special: { 气运: 5 } }, skills: [],
      varTree: vt,
      memory: { varTreeLatest: vt, roomNpcNames: ["才旦"], time: 1, apiCfg: {}, flags: [], recall: { lastAiText: "" } },
      _prefetchedRecall: prefetched,
      gm: false, flags: [],
      narrator: initialNarratorState(), narratorStage: initialNarratorState().stage,
      scenario: "测试剧本", preset: { scenario: "测试剧本" },
      charBodyProfile: emptyBodyProfile(), charName: "少侠",
      dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
      time: 1, getTimeStr: () => "卯时",
      hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
      visibleNpcsCount: 1, npcLoreBlockWithQuest: "",
      isTalk: false,
      ai,
    };
    const turn = await runTurn(deps, "朝才旦走过去招呼一声");
    expect(events).toEqual(["intake_called_before_recall_settled", "main_called"]);
    expect(turn.pendingFactIds).toEqual(["f_pending"]);
  });
});
