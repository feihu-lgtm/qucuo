import {
  AFFECTION_RULES, WHISPER_AFFECTION_RULES, giftRange, learnRange,
} from "../state/fields.js";
import { UNKNOWN_CHOICE } from "./judge.js";

// ── 软判断规则表 ──
// 今天这些"软结果"由叙事模型在 <mvu> 里顺手写指令裁决；这里改成先由结算层
// 出一道选择题，系统再照选项把数值钉死。每条规则只搬现有数值与条件，
// 不发明新平衡：
//   appease           ← engine/prompt/assemblePrompt.js buildAngryNote
//                       + domain/prompt/appeaseExtraction.js（好感 0~5，示例 +3）
//   gift              ← domain/prompt/extractionSpecs.js GIFT
//                       + domain/npc/giftWeight.js（按受礼人身份分档的分量表）
//   companion_invite  ← extractionSpecs.js COMPANION_INVITE（_.set 高初始好感）
//   learn_skill       ← extractionSpecs.js LEARN_SKILL（绝学/通行两档）
//   narrator_affinity ← app/hooks/usePrivateTalk.js 的 ⟦好感X⟧ 标记
//                       + WHISPER_AFFECTION_RULES（-3~+6，寻常兜底 +1）
//
// 现有规则里两处歧义（详见 PR 描述）：
// · 送礼/邀同行/拜师现状没有"被拒"分支——物品系统已交付、门槛系统已判定。
//   这里保留「婉拒/回绝」选项供模型表达"情境上不成立"，选中时不产好感 delta，
//   是否回退已结算的系统变更由未来接线层决定，本层只管好感。
// · appease 的好感回补现状是"0~5 随意给一个"，这里取中值 +3（与提取 spec 示例一致）。

const UNKNOWN = UNKNOWN_CHOICE;
const mid = ([lo, hi]) => Math.round((lo + hi) / 2);

const affectionPath = (npc) => `角色.${npc}.好感度`;

export const SOFT_RULES = {
  // 求和/赔罪：这次尝试有没有真让对方消气
  appease: {
    label: "平息怒气",
    target: (ctx) => ctx.npc,
    question: (ctx) => {
      const anger = ctx.varTree?.角色?.[ctx.npc]?.生气状态 || ctx.anger || {};
      const reason = anger.reason || "未记录";
      return `${ctx.npc}还在气头上（缘由：${reason}）。玩家这一轮的言行（${ctx.attempt || "这次求和"}）是否真让他消了气？敷衍、空话、不得体都不算奏效。`;
    },
    options: () => ["奏效", "未奏效", UNKNOWN],
    deltas: (choice, ctx) => choice === "奏效" ? [
      { path: `角色.${ctx.npc}.生气解除`, op: "set", value: true },
      { path: affectionPath(ctx.npc), op: "add", value: mid(AFFECTION_RULES.appease) },
    ] : [],
    note: (choice, ctx) => choice === "奏效"
      ? `${ctx.npc}消了气，好感略回升`
      : `${ctx.npc}仍在气头上，这次没说成`,
  },

  // 送礼：收不收、好感加多少（礼物本身已由系统交付/扣除，这里只管好感）
  gift: {
    label: "受礼",
    target: (ctx) => ctx.npc,
    question: (ctx) => {
      const info = ctx.giftInfo || {};
      const band = info.weight ? `，按对方身家这份礼算「${info.weight.label}」` : `，品阶「${info.quality || "白"}」`;
      return `玩家把「${info.itemName || "一件礼物"}」送给${ctx.npc}${band}。${ctx.npc}会收下吗？`;
    },
    options: () => ["收下", "婉拒", UNKNOWN],
    deltas: (choice, ctx) => {
      if (choice !== "收下") return [];
      const info = ctx.giftInfo || {};
      const range = info.weight?.range || info.range || giftRange(info.quality);
      const value = info.suggestedDelta ?? mid(range);
      return [{ path: affectionPath(ctx.npc), op: "add", value }];
    },
    note: (choice, ctx, applied) => {
      const gain = applied.find((d) => d.path === affectionPath(ctx.npc))?.actualDelta;
      if (choice === "收下") {
        return `${ctx.npc}收下了「${ctx.giftInfo?.itemName || "礼物"}」，好感${gain > 0 ? `+${gain}` : "未变"}`;
      }
      return `${ctx.npc}婉拒了「${ctx.giftInfo?.itemName || "礼物"}」`;
    },
  },

  // 邀同行：答不答应；答应则好感直接钉到"一见如故"的高初始值
  companion_invite: {
    label: "邀同行",
    target: (ctx) => ctx.npc,
    question: (ctx) => `玩家郑重邀${ctx.npc}结伴同行。${ctx.npc}会应下吗？`,
    options: () => ["欣然应允", "婉拒", UNKNOWN],
    deltas: (choice, ctx) => choice === "欣然应允" ? [
      { path: affectionPath(ctx.npc), op: "set", value: AFFECTION_RULES.companion.example },
    ] : [],
    note: (choice, ctx) => choice === "欣然应允"
      ? `${ctx.npc}欣然应允，与玩家结为同行`
      : `${ctx.npc}婉拒了同行之邀`,
  },

  // 拜师：收不收徒；收徒则好感只能往上走（束脩与招式已由系统结算）
  learn_skill: {
    label: "拜师",
    target: (ctx) => ctx.npc,
    question: (ctx) => {
      const info = ctx.learnInfo || {};
      return `玩家向${ctx.npc}求教${info.moveBrief ? `「${info.moveBrief}」` : "武艺"}。${ctx.npc}愿意收这个徒、把本事教给他吗？`;
    },
    options: () => ["倾囊相授", "回绝", UNKNOWN],
    deltas: (choice, ctx) => {
      if (choice !== "倾囊相授") return [];
      const [, , suggested] = learnRange(!!ctx.learnInfo?.isMaster);
      return [{ path: affectionPath(ctx.npc), op: "add", value: suggested }];
    },
    note: (choice, ctx, applied) => {
      const gain = applied.find((d) => d.path === affectionPath(ctx.npc))?.actualDelta;
      if (choice === "倾囊相授") {
        return `${ctx.npc}收玩家为徒，倾囊相授，好感${gain > 0 ? `+${gain}` : "未变"}`;
      }
      return `${ctx.npc}不肯收徒`;
    },
  },

  // 私聊旁白：这句话说到什么份上（今日替代散文末尾的 ⟦好感X⟧ 标记）
  narrator_affinity: {
    label: "旁白观感",
    target: () => "旁白",
    question: (ctx) => `玩家私下对旁白说：「${ctx.playerSay || ""}」。这句话在她那里落到什么份上？`,
    options: () => ["投机贴心", "寻常闲聊", "敷衍冒犯", UNKNOWN],
    deltas: (choice) => {
      const value = { 投机贴心: mid([3, WHISPER_AFFECTION_RULES.max]), 寻常闲聊: WHISPER_AFFECTION_RULES.fallback, 敷衍冒犯: -2 }[choice];
      return value == null ? [] : [{ path: "narrator.affection", op: "add", value }];
    },
    note: (choice, _ctx, applied) => {
      const gain = applied.find((d) => d.path === "narrator.affection")?.actualDelta;
      if (choice === "敷衍冒犯") return `旁白听了这话有些不快，好感${gain ?? ""}`;
      if (choice === "投机贴心") return `旁白听进了这句话，好感${gain > 0 ? `+${gain}` : "未变"}`;
      return "旁白照常应了一句";
    },
  },
};

export function getSoftRule(kind) {
  return SOFT_RULES[kind] || null;
}
