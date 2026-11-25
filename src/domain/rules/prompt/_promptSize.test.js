import { describe, expect, it, vi } from "vitest";
import { buildSysBase } from "./sysBase.js";
import { QUCUO_PRESET } from "../../data/presets/qucuo.js";

const state = {
  char: { name: "少侠", gender: "男", hp: [72, 100], money: 50, neigong: 3, waigong: 4, special: { 根骨: 5, 悟性: 6 } },
  room: {
    name: "鱼定村", desc: "村口有几户人家。", exits: ["n", "s"],
    npcs: [{ name: "才旦", id: "npc-1", brief: "年轻猎户", carriedItems: [{ name: "猎刀" }] }],
    items: [{ name: "石子", id: "item-1" }],
  },
  inv: [{ name: "金疮药", category: "misc", quality: "白" }],
  varTree: {
    角色: { 才旦: { 好感度: 37, 态度: "爽朗", 身携: [{ name: "猎刀" }] }, 八云: { 生气状态: { reason: "偷窃未遂", turnsLeft: 2 } } },
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

const SETTLE_OPTIONS = {
  APPEASE: { settleNpc: "八云", settleKind: "appease" },
  GIFT: { settleNpc: "桑杰朵杰", settleKind: "gift", giftInfo: { itemName: "青布", weight: { label: "薄礼", reaction: "礼貌致谢", range: [0, 1] } } },
  COMPANION_INVITE: { settleNpc: "才旦", settleKind: "companion_invite", settleBeast: false },
  LEARN_SKILL: { settleNpc: "李师傅", settleKind: "learn_skill", learnInfo: { moveBrief: "流云剑法", isMaster: true, totalPrice: 20 } },
};

const apiCfg = { model: "m", apiType: "openai", extractionModel: "em", extractionModels: {}, callTokenLimits: { extraction: 1200 } };

// 用真实预设的 scenario（约 2480 字，含好感度维护规则/规则补充等可去重段），
// 并传 gateCtx 让蓝绿灯裁剪真实生效——这样才反映线上每回合实际拼出的体量。
const scenario = QUCUO_PRESET.scenario;
const GATE_CTX = { cmd: "", userInput: "", lastReply: "" };

describe("prompt size baseline", () => {
  it("prints sysBase sizes per scope", () => {
    const rows = [];
    for (const scope of ["full", "talk", "move", "settle"]) {
      for (const narrativeOnly of [false, true]) {
        const { sysBlocks, phiBlock, phiRules } = buildSysBase(400, { stage: "normal", affection: 30 }, scenario, "", false, "", narrativeOnly, scope,
          { settleNpc: "才旦", settleKind: "gift", giftInfo: { itemName: "青布", quality: "绿", range: [4, 6], suggestedDelta: 5 }, playerName: "少侠", gateCtx: GATE_CTX });
        const sysLen = sysBlocks.reduce((s, b) => s + (b.content?.length || 0), 0);
        rows.push({ scope, narrativeOnly, sysLen, phiBlockLen: phiBlock.content.length, phiRulesLen: phiRules.length, total: sysLen + phiBlock.content.length + phiRules.length });
      }
    }
    console.log(JSON.stringify(rows, null, 1));
    expect(rows.length).toBe(8);
  });


});
