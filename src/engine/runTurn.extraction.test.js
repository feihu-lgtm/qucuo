import { describe, expect, it } from "vitest";
import { emptyBodyProfile } from "../domain/rules/character/bodyProfile.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { startTrace } from "../infra/actionTrace.js";
import { createMockAi } from "./ports/ai.js";
import { runTurn } from "./runTurn.js";

describe("runTurn dual-call extraction", () => {
  it("skips the extraction call on settle turns but keeps it on free turns", async () => {
    const buildCtx = (settle) => {
      const calls = { count: 0 };
      const ai = createMockAi([
        "石阶旁的草叶轻轻摇动。",
        `{"output":[],"delta":{}}\n<mvu>_.set('世界.天气', '晴');</mvu>`,
      ], { onRequest: () => { calls.count += 1; } });
      const apiCfg = {
        apiType: "openai", model: "test-model", targetWordCount: 220, contextWindow: 20,
        streamEnabled: false, extractionEnabled: true, callTokenLimits: {}, intentBudgets: {},
      };
      const ctx = {
        ai,
        apiCfg,
        convo: [],
        isTalk: false,
        isSettle: settle,
        prompt: {
          room: { name: "石阶", exits: [], npcs: [], items: [] },
          char: { name: "测试主角", gender: "男", hp: [10, 10], special: {}, neigong: 0, waigong: 0 },
          inv: [], skills: [], dao: { karma: 0, jie: 0 }, flags: [], questProgress: {},
          varTree: { 角色: {}, 世界: {}, 主角: {} }, time: 1,
          preset: { scenario: "测试剧本总纲" }, companionState: {}, nsfwOn: false,
          activeTarget: null, isTalk: false, gm: false, movingDir: null, lockedDestName: null,
          outerDepart: null, innerRoomName: null, apiCfg,
          getTimeStr: () => "卯时", hasInnerMap: () => false,
          describeEquipment: () => "", describeTodayForAI: () => "",
        },
        callDeps: () => ({
          varTree: { 角色: {}, 世界: {}, 主角: {} },
          gm: false, isSettle: settle, isTalk: false,
          intent: { code: "UNKNOWN", label: "无法判定，交由本次调用自行裁量" },
          apiCfg, narrator: initialNarratorState(),
          scenario: "测试剧本总纲", budgetInstruction: null,
          npcLoreBlockWithQuest: "", visibleNpcsCount: 0,
          charName: "测试主角", charBodyProfile: emptyBodyProfile(),
          pickupJudgment: null, convo: [], nsfwOn: false,
          ctx: "[状态] 测试状态行", recallBlock: "", reunionBlock: "", infoDomainBlock: "",
          hist: "", mainConvo: [], gambleTalkCtx: null, recallInfo: null,
          _trace: startTrace("run-turn-test"), addLog: () => {}, setLog: () => {},
        }),
      };
      return { ai, ctx, calls };
    };

    const settleTurn = buildCtx(true);
    const settleResult = await runTurn(settleTurn.ctx, "向八云赔罪", { settle: true });
    expect(settleTurn.calls.count).toBe(1);
    expect(settleResult.narrativeText).toContain("石阶旁的草叶轻轻摇动。");
    expect(settleResult.mvuCommands).toEqual([]);

    const freeTurn = buildCtx(false);
    await runTurn(freeTurn.ctx, "探索石阶");
    expect(freeTurn.calls.count).toBe(2); // 主叙事 + 极简提取
  });

  it("runs extraction as the decider when a soft settle has no soft-settle result", async () => {
    const buildCtx = () => {
      const calls = { count: 0 };
      const ai = createMockAi([
        "八云冷哼一声，到底还是松了口。",
        `{"output":[],"memory":"向八云赔罪","delta":{}}\n<mvu></mvu>`,
      ], { onRequest: () => { calls.count += 1; } });
      const apiCfg = {
        apiType: "openai", model: "test-model", targetWordCount: 220, contextWindow: 20,
        streamEnabled: false, extractionEnabled: true, callTokenLimits: {}, intentBudgets: {},
      };
      const ctx = {
        ai, apiCfg, convo: [], isTalk: false, isSettle: true,
        prompt: {
          room: { name: "石阶", exits: [], npcs: [], items: [] },
          char: { name: "测试主角", gender: "男", hp: [10, 10], special: {}, neigong: 0, waigong: 0 },
          inv: [], skills: [], dao: { karma: 0, jie: 0 }, flags: [], questProgress: {},
          varTree: { 角色: {}, 世界: {}, 主角: {} }, time: 1,
          preset: { scenario: "测试剧本总纲" }, companionState: {}, nsfwOn: false,
          activeTarget: null, isTalk: false, gm: false, movingDir: null, lockedDestName: null,
          outerDepart: null, innerRoomName: null, apiCfg,
          getTimeStr: () => "卯时", hasInnerMap: () => false,
          describeEquipment: () => "", describeTodayForAI: () => "",
        },
        callDeps: () => ({
          varTree: { 角色: {}, 世界: {}, 主角: {} },
          gm: false, isSettle: true, isTalk: false,
          intent: { code: "UNKNOWN", label: "无法判定，交由本次调用自行裁量" },
          apiCfg, narrator: initialNarratorState(),
          scenario: "测试剧本总纲", budgetInstruction: null,
          npcLoreBlockWithQuest: "", visibleNpcsCount: 0,
          charName: "测试主角", charBodyProfile: emptyBodyProfile(),
          pickupJudgment: null, convo: [], nsfwOn: false,
          ctx: "[状态] 测试状态行", recallBlock: "", reunionBlock: "", infoDomainBlock: "",
          hist: "", mainConvo: [], gambleTalkCtx: null, recallInfo: null,
          _trace: startTrace("run-turn-test"), addLog: () => {}, setLog: () => {},
        }),
      };
      return { ctx, calls };
    };

    // 软结算被关掉：软种类 settle 没有裁决者，提取层必须兜底（否则道歉消不了气）
    const noJudge = buildCtx();
    await runTurn(noJudge.ctx, "向八云赔罪", { settle: true, settleKind: "appease", settleNpc: "八云" });
    expect(noJudge.calls.count).toBe(2);

    // 软结算已裁出结果：提取照旧跳过
    const judged = buildCtx();
    await runTurn(judged.ctx, "向八云赔罪", {
      settle: true, settleKind: "appease", settleNpc: "八云",
      softSettle: { choice: "奏效", deltas: [] },
    });
    expect(judged.calls.count).toBe(1);
  });

  it("records the settle text as memory when extraction produced none", async () => {
    const calls = { count: 0 };
    const ai = createMockAi(["八云冷哼一声。"], { onRequest: () => { calls.count += 1; } });
    const apiCfg = {
      apiType: "openai", model: "test-model", targetWordCount: 220, contextWindow: 20,
      streamEnabled: false, extractionEnabled: true, callTokenLimits: {}, intentBudgets: {},
    };
    const ctx = {
      ai, apiCfg, convo: [], isTalk: false, isSettle: true,
      prompt: {
        room: { name: "石阶", exits: [], npcs: [], items: [] },
        char: { name: "测试主角", gender: "男", hp: [10, 10], special: {}, neigong: 0, waigong: 0 },
        inv: [], skills: [], dao: { karma: 0, jie: 0 }, flags: [], questProgress: {},
        varTree: { 角色: {}, 世界: {}, 主角: {} }, time: 1,
        preset: { scenario: "测试剧本总纲" }, companionState: {}, nsfwOn: false,
        activeTarget: null, isTalk: false, gm: false, movingDir: null, lockedDestName: null,
        outerDepart: null, innerRoomName: null, apiCfg,
        getTimeStr: () => "卯时", hasInnerMap: () => false,
        describeEquipment: () => "", describeTodayForAI: () => "",
      },
      callDeps: () => ({
        varTree: { 角色: {}, 世界: {}, 主角: {} },
        gm: false, isSettle: true, isTalk: false,
        intent: { code: "UNKNOWN", label: "无法判定，交由本次调用自行裁量" },
        apiCfg, narrator: initialNarratorState(),
        scenario: "测试剧本总纲", budgetInstruction: null,
        npcLoreBlockWithQuest: "", visibleNpcsCount: 0,
        charName: "测试主角", charBodyProfile: emptyBodyProfile(),
        pickupJudgment: null, convo: [], nsfwOn: false,
        ctx: "[状态] 测试状态行", recallBlock: "", reunionBlock: "", infoDomainBlock: "",
        hist: "", mainConvo: [], gambleTalkCtx: null, recallInfo: null,
        _trace: startTrace("run-turn-test"), addLog: () => {}, setLog: () => {},
      }),
    };
    const result = await runTurn(ctx, "向八云赔罪求和。请让他别再生分，不得再提旧事。", { settle: true });
    expect(calls.count).toBe(1);
    expect(result.p.memory).toBe("向八云赔罪求和");
  });
});
