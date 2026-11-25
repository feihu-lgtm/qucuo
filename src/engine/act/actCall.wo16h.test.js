// WO-16H-H1 11 号位 inChat 非 settle 拼装顺序快照：roadmap 十二段固定序。
import { describe, expect, it } from "vitest";
import { emptyBodyProfile } from "../../domain/rules/character/bodyProfile.js";
import { defaultPreset } from "../../domain/rules/prompt/presetSystem.js";
import { buildMainCallPayload } from "./actCall.js";

function makeDeps(overrides = {}) {
  const preset = defaultPreset();
  return {
    varTree: { 角色: {}, 世界: { 日总结: [] } },
    gm: false, isSettle: false, isTalk: false,
    intent: { code: "UNKNOWN", label: "x" },
    apiCfg: {
      targetWordCount: 220, model: "m", apiType: "openai", streamEnabled: false,
      extractionEnabled: true, extractionModel: "e", contextWindow: 20,
      maxTokens: 4096, callTokenLimits: {},
    },
    narrator: { stage: "normal", affection: 35 },
    scenario: "测试剧本总纲",
    budgetInstruction: null,
    npcLoreBlockWithQuest: "",
    visibleNpcsCount: 0,
    charName: "少侠",
    charBodyProfile: emptyBodyProfile(),
    pickupJudgment: null,
    cmd: "四下打量",
    convo: [],
    nsfwOn: false,
    ctx: "MARK_CTX_STATE",
    recallBlock: "MARK_RECALL",
    reunionBlock: "MARK_REUNION",
    infoDomainBlock: "MARK_INFODOMAIN",
    hist: "[玩家] 上一句",
    mainConvo: [],
    gambleTalkCtx: null,
    recallInfo: null,
    settleNpc: null, settleKind: null, giftInfo: null,
    activePreset: preset, effectivePreset: preset,
    embeddingEnabled: false,
    ...overrides,
  };
}

function inChatOf(payload) {
  const msgs = payload?.messages || payload?.chatMessages || [];
  const hit = msgs.find((m) => m?.tavernId === "inChat" || m?.key === "inChat");
  return hit?.content ?? hit?.text ?? JSON.stringify(msgs.find((m) => JSON.stringify(m).includes("MARK_CTX_STATE")));
}

describe("WO-16H-H1 11号位十二段拼装顺序", () => {
  it("判官回合：状态→召回→重逢→信息域→判官块→篇幅导向 固定序", () => {
    const payload = buildMainCallPayload(null, true, makeDeps({
      judgeRuleBlock: "MARK_JUDGE_BLOCK",
    }));
    const inChat = inChatOf(payload);
    const idx = (mark) => inChat.indexOf(mark);
    expect(idx("MARK_CTX_STATE")).toBeGreaterThanOrEqual(0);
    expect(idx("MARK_CTX_STATE")).toBeLessThan(idx("MARK_RECALL"));
    expect(idx("MARK_RECALL")).toBeLessThan(idx("MARK_REUNION"));
    expect(idx("MARK_REUNION")).toBeLessThan(idx("MARK_INFODOMAIN"));
    expect(idx("MARK_INFODOMAIN")).toBeLessThan(idx("MARK_JUDGE_BLOCK"));
    // 篇幅文体导向（成文铁律）在判官块之后——贴生成处最深导向位
    expect(idx("MARK_JUDGE_BLOCK")).toBeLessThan(idx("成文铁律"));
  });

  it("群聊回合：群聊尾章块进 11 号位、判官块缺席", () => {
    const payload = buildMainCallPayload(null, true, makeDeps({
      groupTalkRuleBlock: "MARK_GROUPTALK_BLOCK",
    }));
    const inChat = inChatOf(payload);
    expect(inChat).toContain("MARK_GROUPTALK_BLOCK");
    expect(inChat.indexOf("MARK_INFODOMAIN")).toBeLessThan(inChat.indexOf("MARK_GROUPTALK_BLOCK"));
    expect(inChat.indexOf("MARK_GROUPTALK_BLOCK")).toBeLessThan(inChat.indexOf("成文铁律"));
  });

  it("WO-16F-F3：判官激活的 appease settle——settle inChat 也接判官定案单", () => {
    // settle 分支不含 MARK_CTX_STATE（ctx 不注入），直接全量检索消息数组
    const withJudge = buildMainCallPayload(null, true, makeDeps({
      isSettle: true, settleNpc: "八云", settleKind: "appease",
      judgeRuleBlock: "MARK_JUDGE_BLOCK",
    }));
    expect(JSON.stringify(withJudge.messages || withJudge.chatMessages)).toContain("MARK_JUDGE_BLOCK");
    // 普通非判官 settle 仍不收尾章税
    const plain = buildMainCallPayload(null, true, makeDeps({
      isSettle: true, settleNpc: "八云", settleKind: "gift",
    }));
    expect(JSON.stringify(plain.messages || plain.chatMessages)).not.toContain("判官定案");
  });

  it("尾章指引三选一：判官块优先于群聊块；两者皆无则不留尾巴", () => {
    const both = inChatOf(buildMainCallPayload(null, true, makeDeps({
      judgeRuleBlock: "MARK_JUDGE_BLOCK", groupTalkRuleBlock: "MARK_GROUPTALK_BLOCK",
    })));
    expect(both).toContain("MARK_JUDGE_BLOCK");
    expect(both).not.toContain("MARK_GROUPTALK_BLOCK");
    const none = inChatOf(buildMainCallPayload(null, true, makeDeps()));
    expect(none).not.toContain("SEAL");
  });
});
