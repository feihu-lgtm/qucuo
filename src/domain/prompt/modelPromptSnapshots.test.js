import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NNPC_STAGE } from "../narrator/narrator.js";
import { callExtraction } from "./extractionEngine.js";
import { EXTRACTION_SPECS } from "./extractionSpecs.js";
import { factSummaryRequest, factSummaryRequestFromRecall } from "./knowledge.js";
import { buildPigeonPrompt } from "./pigeonPrompt.js";
import { buildWhisperStatePrompt } from "./promptRefs.js";
import { buildPrivateTalkPayload } from "./privateTalkPayload.js";
import { snowLeopardHint } from "../quests/snowLeopardQuest.js";

const SETTLE_OPTIONS = {
  APPEASE: {
    settleNpc: "八云",
    settleKind: "appease",
  },
  GIFT: {
    settleNpc: "桑杰朵杰",
    settleKind: "gift",
    giftInfo: {
      itemName: "青布",
      weight: { label: "薄礼", reaction: "礼貌致谢", range: [0, 1] },
    },
  },
  COMPANION_INVITE: { settleNpc: "才旦", settleKind: "companion_invite", settleBeast: false },
  LEARN_SKILL: {
    settleNpc: "李师傅",
    settleKind: "learn_skill",
    learnInfo: { moveBrief: "流云剑法", isMaster: true, totalPrice: 20 },
  },
};

const extractionState = {
  char: {
    name: "少侠",
    gender: "男",
    hp: [72, 100],
    money: 50,
    neigong: 3,
    waigong: 4,
    special: { 根骨: 5, 悟性: 6 },
  },
  room: {
    name: "鱼定村",
    desc: "村口有几户人家。",
    exits: ["n", "s"],
    npcs: [{ name: "才旦", id: "npc-1", brief: "年轻猎户", carriedItems: [{ name: "猎刀" }] }],
    items: [{ name: "石子", id: "item-1" }],
  },
  inv: [{ name: "金疮药", category: "misc", quality: "白" }],
  varTree: {
    角色: {
      才旦: { 好感度: 37, 态度: "爽朗", 身携: [{ name: "猎刀" }] },
      八云: { 生气状态: { reason: "偷窃未遂", turnsLeft: 2 } },
    },
    世界: { 日总结: [{ label: "前日", text: "少侠在鱼定村歇脚。" }] },
  },
  time: 25,
  getTimeStr: () => "第3日·辰时·08:00",
  skills: [{ name: "流云剑法", level: 2 }],
  dao: { karma: 4, jie: 9 },
  flags: [],
  questProgress: {},
  lockedExits: null,
  lockedDestName: null,
  pickupJudgment: { quality: "绿", category: "misc" },
};

const extractionCases = Object.keys(EXTRACTION_SPECS).map((key) => ({
  key,
  settleOpts: SETTLE_OPTIONS[key] || null,
}));

const apiCfg = {
  model: "snapshot-model",
  apiType: "openai",
  extractionModel: "snapshot-extraction-model",
  extractionModels: {},
  callTokenLimits: { extraction: 1200 },
};

function privateTalkPayload(inSeaNow) {
  const narrator = {
    stage: inSeaNow ? NNPC_STAGE.SPIRIT : NNPC_STAGE.FLIRTING,
    affection: 58,
  };
  const whisperState = {
    char: { name: "少侠", gender: "男" },
    room: {
      name: "鱼定村",
      desc: "村口有几户人家。",
      npcs: [{ name: "才旦", brief: "年轻猎户" }],
      exits: ["n", "s"],
    },
    inv: ["金疮药"],
    varTree: { 角色: { 才旦: { 好感度: 37, 态度: "爽朗" } } },
    time: 25,
    getTimeStr: () => "第3日·辰时·08:00",
  };
  return buildPrivateTalkPayload({
    narrator,
    content: "你还记得鱼定村吗？",
    apiCfg: {
      contextWindow: 20,
      maxTokens: 2048,
      callTokenLimits: { narratorWhisper: 1200 },
      narratorWhisperWords: { chat: 120 },
    },
    convo: [
      { role: "user", content: "先前的一句话" },
      { role: "assistant", content: "先前的一句回应" },
    ],
    inSeaNow,
    seaVars: { comfort: 2, knots: ["hebe"] },
    worldState: inSeaNow ? "" : buildWhisperStatePrompt(whisperState),
    snowLeopardBlock: snowLeopardHint({ questProgress: {}, flags: [], cmd: "你还记得鱼定村吗？" }),
    factsBlock: "\n\n[全知事实]\n少侠曾在鱼定村遇见才旦。",
    recallBlock: "\n[相关回忆]\n少侠与旁白曾在村口谈起往事。",
    tallyBlock: "\n[起居注] 第3日：少侠在鱼定村歇脚。",
    narratorLoreBlock: "\n\n[旁白专属设定]\n保持温和克制。",
    bodyWhisperText: "",
    topicGateText: "",
    questGateText: "",
    whisperGateText: "测试剧本背景。",
    narratorStage: NNPC_STAGE,
  });
}

describe("model prompt golden snapshots", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-03T08:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.25);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(extractionCases)("captures callExtraction prompt: $key", async ({ key, settleOpts }) => {
    const calls = [];
    const ai = {
      chat: vi.fn(async (messages, options) => {
        calls.push({ messages, options });
        return { text: "{}" };
      }),
    };
    const result = await callExtraction(key, "少侠走进村口，与才旦说了几句话。", extractionState, apiCfg, settleOpts, ai);
    expect(JSON.stringify({
      result: key === "META_QUERY" ? result : undefined,
      prompt: calls.length ? {
        systemPrompt: calls[0].options.systemPrompt,
        messages: calls[0].messages,
        modelOptions: calls[0].options.modelOptions,
      } : null,
    })).toMatchSnapshot(`callExtraction ${key}`);
    expect(ai.chat).toHaveBeenCalledTimes(key === "META_QUERY" ? 0 : 1);
  });

  it.each([
    { name: "with-gift", channel: "postgift", giftName: "青布" },
    { name: "ordinary-letter", channel: "letter", giftName: "" },
  ])("captures pigeon prompt: $name", ({ name, channel, giftName }) => {
    const state = {
      ...extractionState,
      room: {
        ...extractionState.room,
        npcs: [{
          name: "才旦",
          brief: "年轻猎户",
          fullBio: "常年在山中打猎。",
          personality: "爽朗直率",
        }],
      },
      varTree: {
        ...extractionState.varTree,
        角色: {
          ...extractionState.varTree.角色,
          才旦: {
            好感度: 37,
            态度: "爽朗",
            飞鸽: [{ dir: "send", content: "村口近来如何？", gift: "青布" }],
          },
        },
        世界: {
          ...extractionState.varTree.世界,
          知识领域: {
            事实: {
              meeting: {
                id: "meeting",
                摘要: "少侠曾在鱼定村遇见才旦。",
                标签: "相逢",
                诞生回合: 12,
              },
            },
          },
        },
      },
    };
    const prompt = buildPigeonPrompt(state, { npcName: "才旦", giftName, channel }, { scenario: "曲措乡多山临水。" });
    expect(prompt).toMatchSnapshot(`pigeon ${name}`);
  });

  it.each([
    { name: "ordinary-private-talk", inSeaNow: false },
    { name: "sea-private-talk", inSeaNow: true },
  ])("captures private-talk prompt: $name", ({ name, inSeaNow }) => {
    const payload = privateTalkPayload(inSeaNow);
    expect(JSON.stringify({
      systemPrompt: payload.systemPrompt,
      messages: payload.messages,
      maxTokens: payload.maxTokens,
    })).toMatchSnapshot(name);
  });

  it("captures fact-summary prompt requests", () => {
    expect(JSON.stringify({
      direct: factSummaryRequest("少侠在鱼定村帮助了才旦"),
      fromRecall: factSummaryRequestFromRecall("少侠与才旦重逢", [
        "少侠曾在鱼定村替才旦寻回猎刀。",
        "才旦后来邀请少侠到山中打猎。",
      ]),
    })).toMatchSnapshot();
  });
});
