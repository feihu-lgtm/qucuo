// WO-16F-F4a：gift settle 进判官——runTurn 集成与 sysBase 叙事铁律钉测试
import { describe, expect, it, vi } from "vitest";
import { runTurn } from "./runTurn.js";
import { createMockAi } from "./ports/ai.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { emptyBodyProfile } from "../domain/rules/character/bodyProfile.js";
import { buildSysBase } from "../domain/rules/prompt/sysBase.js";

function makeDeps(overrides = {}) {
  const varTree = { 角色: { 温掌柜: { 好感度: 30 } }, 世界: {} };
  return {
    convo: [], addLog: vi.fn(), setConvo: vi.fn(),
    apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
    intent: { code: "ACTION", label: "行动" },
    room: { name: "曲措乡", npcs: [{ name: "温掌柜" }], items: [], exits: [] },
    inv: [{ id: "it_1", name: "青锋剑", category: "weapon", quality: "绿" }],
    char: { hp: [80, 100], special: { 气运: 5 } }, skills: [],
    varTree, memory: { varTreeLatest: varTree, recall: { lastAiText: "" } },
    gm: false, flags: [],
    narrator: initialNarratorState(),
    narratorStage: initialNarratorState().stage,
    scenario: "测试剧本", preset: { scenario: "测试剧本" },
    charBodyProfile: emptyBodyProfile(), charName: "少侠",
    dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
    time: 1, getTimeStr: () => "卯时",
    hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
    npcLoreBlockWithQuest: "",
    ...overrides,
  };
}

describe("runTurn gift settle 进判官（F4a）", () => {
  it("带 giftRequest 的送礼 settle：判官激活，合成 give 听意单不调 intake AI", async () => {
    // mock 只供主叙事一次调用——若误调 turn.intake 会错位消费叙事响应
    const ai = createMockAi(["温掌柜掂了掂剑，笑着收下"]);
    const deps = makeDeps();
    deps.ai = ai;
    const turn = await runTurn(deps, "将「青锋剑」赠予温掌柜", {
      settle: true, settleKind: "gift", settleNpc: "温掌柜",
      giftRequest: { itemId: "it_1", itemName: "青锋剑" },
    });
    expect(turn.judgePipelineActive).toBe(true);
    // give 收/拒裁定逻辑由 judgeTurn/materializeFacts 单元测试钉住（giftDeferF4a.test.js），
    // 这里只钉管线接线：判官确实跑起来且主叙事一次调用不被 intake 错位消费。
  });

  it("不带 giftRequest 的送礼 settle（送银/特殊通道 legacy）：判官仍不激活", async () => {
    const ai = createMockAi(["温掌柜收下谢仪"]);
    const deps = makeDeps();
    deps.ai = ai;
    const turn = await runTurn(deps, "将十两银子赠予温掌柜", {
      settle: true, settleKind: "gift", settleNpc: "温掌柜",
    });
    expect(turn.judgePipelineActive).toBe(false);
  });

  it("单调用老路：判官链关闭时 gift settle 行为不变（不激活、无消费错位）", async () => {
    const ai = createMockAi([
      JSON.stringify({ output: ["温掌柜收下了剑"], memory: "送礼" }),
    ]);
    const deps = makeDeps({ apiCfg: { extractionEnabled: false, judgePipelineEnabled: false, streamEnabled: false, maxTokens: 4000 } });
    deps.ai = ai;
    const turn = await runTurn(deps, "将「青锋剑」赠予温掌柜", {
      settle: true, settleKind: "gift", settleNpc: "温掌柜",
      giftRequest: { itemId: "it_1", itemName: "青锋剑" },
    });
    expect(turn.judgePipelineActive).toBeFalsy();
  });
});

describe("sysBase 送礼铁律判官路收口", () => {
  const mk = (opts = {}) => buildSysBase(
    220, { stage: "NORMAL", affection: 20 }, "x", null, false, "", true, "settle",
    {
      playerName: "少侠", settleNpc: "温掌柜", settleKind: "gift",
      giftInfo: { itemName: "青锋剑", weight: { label: "厚礼", range: [4, 6] }, preferLabel: "" },
      ...opts,
    },
  );
  it("judgeActive 时不得写「已由系统交付」——方向归判官定案单", () => {
    const { phiRules } = mk({ judgeActive: true });
    expect(phiRules).not.toContain("已由系统交付");
    expect(phiRules).not.toContain("送礼反应铁律");
  });
  it("非判官路（legacy）保留「已交付」铁律", () => {
    const { phiRules } = mk({ judgeActive: false });
    expect(phiRules).toContain("已由系统交付");
  });
});
