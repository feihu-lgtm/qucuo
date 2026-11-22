import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyBodyProfile } from "../../domain/rules/character/bodyProfile.js";
import { defaultPreset } from "../../domain/rules/prompt/presetSystem.js";
import { buildMainCallPayload } from "./actCall.js";

const scenarios = [
  { name: "look", deps: { cmd: "环顾四周", intent: { code: "LOOK", label: "查看" } } },
  { name: "look-full-scope", deps: { cmd: "环顾四周", intent: { code: "UNKNOWN", label: "查看" } } },
  {
    name: "move-pickup",
    deps: { cmd: "向东走", intent: { code: "MOVE", label: "移动" }, pickupJudgment: { quality: "绿", category: "misc" } },
  },
  { name: "talk", deps: { cmd: "问才旦近况", intent: { code: "TALK_CASUAL", label: "交谈" }, isTalk: true, visibleNpcsCount: 1 } },
  { name: "combat", deps: { cmd: "拔剑迎战", intent: { code: "COMBAT", label: "战斗" }, visibleNpcsCount: 1 } },
  {
    name: "settle-gift-weight",
    deps: {
      cmd: "把青布送给桑杰朵杰",
      isSettle: true,
      settleNpc: "桑杰朵杰",
      settleKind: "gift",
      giftInfo: {
        itemName: "青布",
        weight: { label: "薄礼", reaction: "礼貌致谢，不必惊喜，也不必拉近关系", range: [0, 1] },
      },
    },
  },
  {
    name: "settle-gift-legacy-quality",
    deps: {
      cmd: "把雪莲送给八云",
      isSettle: true,
      settleNpc: "八云",
      settleKind: "gift",
      giftInfo: { itemName: "雪莲", quality: "蓝", desc: "崖上采的", range: [3, 5], suggestedDelta: 4, categoryLabel: "杂项" },
    },
  },
  {
    name: "settle-learn",
    deps: {
      cmd: "向李师傅拜师",
      isSettle: true,
      settleNpc: "李师傅",
      settleKind: "learn_skill",
      learnInfo: { moveBrief: "流云剑法", isMaster: true, totalPrice: 20 },
    },
  },
  {
    name: "settle-companion-invite",
    deps: { cmd: "邀请才旦同行", isSettle: true, settleNpc: "才旦", settleKind: "companion_invite" },
  },
  {
    name: "appease-angry-npc",
    deps: {
      cmd: "向八云赔礼",
      isSettle: true,
      settleNpc: "八云",
      settleKind: "appease",
      visibleNpcsCount: 1,
      varTree: {
        角色: {
          八云: {
            生气状态: {
              active: true,
              reason: "偷窃未遂",
              turnsLeft: 2,
              attempts: [{ kind: "trade", detail: "", time: 1 }],
            },
          },
        },
        世界: { 日总结: [{ label: "前日", text: "少侠在鱼定村歇脚。" }] },
      },
    },
  },
  {
    name: "duel-invite-duelRequest",
    deps: { cmd: "向才旦发起切磋", intent: { code: "COMBAT", label: "战斗" }, visibleNpcsCount: 1 },
  },
  {
    name: "gamble-talk",
    deps: {
      cmd: "再便宜些",
      isTalk: true,
      gambleTalkCtx: {
        bidderName: "贾掌柜",
        stoneId: "stone-1",
        persona: { brief: "精明的玉商", personality: "锱铢必较", bio: "做了三十年玉石生意。" },
        carry: [{ name: "玉佩" }],
        scene: "料场赌桌",
        baseOffer: 120,
        cash: 200,
      },
    },
  },
  { name: "gm-nsfw", deps: { cmd: "描述眼前情形", gm: true, nsfwOn: true } },
];

const cases = scenarios.flatMap((scenario) => [false, true].map((narrativeOnly) => ({
  ...scenario,
  narrativeOnly,
})));

function makeDeps(overrides = {}, narrativeOnly = false) {
  const preset = defaultPreset();
  return {
    varTree: { 角色: {}, 世界: { 日总结: [{ label: "前日", text: "少侠在鱼定村歇脚。" }] } },
    gm: false,
    isSettle: false,
    isTalk: false,
    intent: { code: "UNKNOWN", label: "无法判定，交由本次调用自行裁量" },
    apiCfg: {
      targetWordCount: 220,
      model: "snapshot-model",
      apiType: "openai",
      streamEnabled: false,
      extractionEnabled: narrativeOnly,
      extractionModel: "snapshot-extraction-model",
      contextWindow: 20,
      maxTokens: 4096,
      callTokenLimits: {},
    },
    narrator: { stage: "normal", affection: 35 },
    scenario: "测试剧本总纲\n\n具名人物\n才旦是鱼定村的年轻猎户。",
    budgetInstruction: null,
    npcLoreBlockWithQuest: "",
    visibleNpcsCount: 0,
    charName: "少侠",
    charBodyProfile: emptyBodyProfile(),
    pickupJudgment: null,
    cmd: "四下打量",
    convo: [
      { role: "user", content: "上一句" },
      { role: "assistant", content: "上一回" },
    ],
    nsfwOn: false,
    ctx: "[状态] 时间：第3日·辰时·08:00；主角：少侠；房间：鱼定村。",
    recallBlock: "",
    reunionBlock: "",
    infoDomainBlock: "",
    hist: "[玩家] 上一句\n[引擎] 上一回",
    mainConvo: [
      { role: "user", content: "上一句" },
      { role: "assistant", content: "上一回" },
    ],
    gambleTalkCtx: null,
    recallInfo: null,
    settleNpc: null,
    settleKind: null,
    giftInfo: null,
    activePreset: preset,
    effectivePreset: preset,
    embeddingEnabled: false,
    ...overrides,
  };
}

describe("main-call model payload golden snapshots", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-03T08:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.25);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(cases)("$name narrativeOnly=$narrativeOnly", ({ name, deps, narrativeOnly }) => {
    const payload = buildMainCallPayload(null, narrativeOnly, makeDeps(deps, narrativeOnly));
    expect(JSON.stringify({
      systemPrompt: payload.sysBlocks,
      messages: payload.chatMessages,
    })).toMatchSnapshot(`${name} narrativeOnly=${narrativeOnly}`);
  });
});
