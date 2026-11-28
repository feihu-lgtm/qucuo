// WO-25J · 人物生活目标分配（纯函数，零状态写入，零新增 AI 调用）。
// 与 #685 ocWander.js 的分工钉死在这里：
//   游走册 = OC 冒险者位置唯一真源（本文件一个字都不碰）；
//   人物动态 = hpRatio（worldPulse 战果账 + 每日 0.2 稳态恢复）与轻量生活快照的读本。
// 本模块只「读」——生活切片完全由（人物档案, 时辰窗, 据点建筑, 银囊, 伤势）确定性推出，
// 同一时辰窗内反复求值恒同，不需要自建账本，也不重复建第二套位置表。

import {
  DIMENSION_LABEL, LIFE_DIMENSIONS, PURSE_TIERS, TYPE_POOR_AFFINITY, dimensionOf, venuesByDimension, affordable, affordanceDetail, signatureOf,
} from "../../data/livingWorld/buildingAffordances.js";
import { seededRand } from "../../../utils/seededRandom.js";

// ── 7.2 四元之一：职业包（白天谋生基准）────────────────────────────
export const AI_PACKAGES = Object.freeze([
  "merchant", "patrol", "herbalist", "ranger", "bounty_hunter", "sect_steward", "injured_rest",
]);

const PACKAGE_RULES = [
  { pkg: "patrol", keys: ["兵", "卒", "巡", "守", "官兵", "衙役", "官差"] },
  { pkg: "sect_steward", keys: ["执事", "管事", "长老", "僧", "喇嘛", "道长", "住持", "方丈"] },
  { pkg: "herbalist", keys: ["药", "医", "大夫", "采药", "郎中"] },
  { pkg: "bounty_hunter", keys: ["镖", "赏金", "捕快", "缉拿"] },
  { pkg: "ranger", keys: ["猎", "牧", "游侠", "浪子", "江湖"] },
  { pkg: "merchant", keys: ["商", "掌柜", "老板", "店", "贩", "锅头", "茶"] },
];

// 由档案推断职业包；带伤（hpRatio<0.4）时一律 injured_rest 压过一切。
export function inferAiPackage(npc, { hpRatio } = {}) {
  if (Number.isFinite(hpRatio) && hpRatio < 0.4) return "injured_rest";
  const text = `${npc?.title || ""}${npc?.brief || ""}${npc?.personality || ""}${npc?.archetypeLabel || ""}`;
  const hit = PACKAGE_RULES.find((r) => r.keys.some((k) => text.includes(k)));
  return hit?.pkg || "ranger";
}

// ── 7.2 四元之三：烟火癖好（1-2 个标签，档案关键词 deterministic 映射）────
export const QUIRK_TAGS = Object.freeze(["饕客", "手痒赌徒", "暗藏戏痴", "茶馆百晓生", "偷闲摸鱼", "惜器爱美"]);

const QUIRK_RULES = [
  { tag: "饕客", keys: ["吃", "馋", "酒", "肉", "饕", "食"] },
  { tag: "手痒赌徒", keys: ["赌", "骰", "牌九"] },
  { tag: "暗藏戏痴", keys: ["戏", "曲", "腔", "唱"] },
  { tag: "茶馆百晓生", keys: ["打听", "消息", "风声", "八卦", "说书", "闲聊", "嘴碎"] },
  { tag: "偷闲摸鱼", keys: ["懒", "闲", "滑头", "摸鱼", "躲懒"] },
  { tag: "惜器爱美", keys: ["剑", "刀", "刃", "兵器", "美", "衣裳", "首饰", "爱俏"] },
];

export function inferQuirks(npc) {
  const text = `${npc?.brief || ""}${npc?.personality || ""}${npc?.lifeHistory || ""}`;
  const tags = QUIRK_RULES.filter((r) => r.keys.some((k) => text.includes(k))).map((r) => r.tag);
  return tags.slice(0, 2);
}

// ── 7.2 四元之二：银囊水位 ─────────────────────────────────────────
// 人物动态里落了 purse 用实账（赌徒输赢、亏本这类状态性波动由写入方记账）；
// 没落账的按（人名 × 三日窗）种子确定性分档——八成「寻常」，偶发宽裕/窘迫，
// 手痒赌徒波动最大（赌性重的人口袋深浅变得快）。纯推导，零写入。
export function purseTierOf(varTree, name, time = 0, quirks = []) {
  const stored = varTree?.世界?.人物动态?.[name]?.purse;
  if (PURSE_TIERS.includes(stored)) return PURSE_TIERS.indexOf(stored);
  const window = Math.floor((time || 0) / 72); // 三日一档
  const rng = seededRand(0, `purse|${name}|${window}`);
  const roll = rng();
  if (quirks.includes("手痒赌徒")) {
    if (roll < 0.25) return 0;
    if (roll < 0.55) return 1;
    if (roll < 0.85) return 2;
    return 3;
  }
  if (roll < 0.08) return 0;
  if (roll < 0.88) return 1;
  if (roll < 0.97) return 2;
  return 3;
}

// ── 当下心境与可介入钩子 ────────────────────────────────────────────
const MOOD_BY_DIMENSION = Object.freeze({
  dine: ["畅快", "微醺", "犯馋"],
  play: ["畅快", "肉疼", "惬意"],
  work: ["惬意", "郁闷"],
  leisure: ["惬意", "畅快"],
  recovery: ["郁闷", "戒备"],
});

const HOOK_BY_DIMENSION = Object.freeze({
  dine: "酒足饭饱嘴边松，若有人同桌递话，容易套出近来路上的行情与风声",
  play: "输赢挂在眉梢，此刻提起刚才那一局，他话匣子会比平日松半寸",
  work: "手里活计正到要紧处，若非急事他不会停手，事成之后倒有兴致聊两句",
  leisure: "闲来无事最是好搭话的时候，聊起此地藏故与传闻，他多半接茬",
  recovery: "身上有伤戒心犹在，送药示好或乘虚打探，都是开口的由头",
});

// ── 生活切片分配（核心纯函数）──────────────────────────────────────
// 输入人物档案 + 所在据点建筑清单 + 时间，确定性产出 7.2 节生活快照。
// 时辰窗 4 格（4 小时）一片：窗内恒同，跨窗重掷。无合适场子返回 null（回退通用营生句）。
// anchorBuilding：玩家与 NPC 同处一栋建筑内时强制锚定此建筑——所见即所在，
// 绝不把在场者写进别家场子（Review 实证：玩家在老孙饭馆，切片说人「身处戏楼」）。
export function resolveLifeSlice({ npc, varTree = {}, time = 0, buildings = [], anchorBuilding = null } = {}) {
  if (!npc?.name || !Array.isArray(buildings) || !buildings.length) return null;
  const dyn = varTree?.世界?.人物动态?.[npc.name] || {};
  const hpRatio = Number.isFinite(dyn.hpRatio) ? dyn.hpRatio : 1;
  const quirks = Array.isArray(dyn.quirks) && dyn.quirks.length ? dyn.quirks : inferQuirks(npc);
  const aiPackage = inferAiPackage(npc, { hpRatio });
  const purseTier = purseTierOf(varTree, npc.name, time, quirks);
  const purse = PURSE_TIERS[purseTier];

  const venues = venuesByDimension(buildings);
  const windowStart = Math.floor((time || 0) / 4) * 4;
  // 时辰权重按整窗 4 小时的重叠判定，不取求值瞬间——同窗内早一刻晚一刻权重恒同，
  // 切片在 untilTurn 之前绝不换活（Review 实证：跨过饭点边界窗内中途换场）。
  const windowHours = [0, 1, 2, 3].map((i) => ((windowStart + i) % 24 + 24) % 24);
  const anyHour = (pred) => windowHours.some(pred);
  const rng = seededRand(0, `lifeSlice|${npc.name}|${windowStart}`);

  // 维度权重：职业基准 + 时辰 + 癖好 + 伤势
  const weight = Object.fromEntries(LIFE_DIMENSIONS.map((dim) => [dim, dim === "recovery" ? 0 : 1]));
  if (aiPackage === "merchant") weight.work += 2;
  if (aiPackage === "patrol") { weight.work += 2; weight.leisure += 0.5; }
  if (aiPackage === "sect_steward") weight.leisure += 2;
  if (aiPackage === "herbalist") weight.work += 1; // 药医是坐堂谋生不是病人——recovery 权重只给真正带伤者（下方 hpRatio 两档）
  if (aiPackage === "bounty_hunter") weight.work += 1.5;
  if (aiPackage === "injured_rest") weight.recovery += 6;
  if (hpRatio < 0.7) weight.recovery += 3;
  // 时辰：饭点吃吃喝喝，夜里不干活，午后消遣（窗内任一小时命中即生效）
  if (anyHour((h) => (h >= 6 && h <= 8) || (h >= 11 && h <= 13) || (h >= 17 && h <= 20))) weight.dine += 2.5;
  if (anyHour((h) => h >= 21 || h <= 5)) { weight.work = 0.2; weight.dine += 0.5; weight.leisure += 1; }
  if (anyHour((h) => h >= 14 && h <= 17)) weight.play += 1;
  // 癖好
  if (quirks.includes("饕客")) weight.dine += 2;
  if (quirks.includes("手痒赌徒") && purseTier >= 2) weight.play += 2.5;
  if (quirks.includes("暗藏戏痴") && anyHour((h) => h >= 15)) weight.play += 1.5;
  if (quirks.includes("茶馆百晓生")) weight.leisure += 2;
  if (quirks.includes("偷闲摸鱼")) { weight.leisure += 1.5; weight.work = Math.max(0.2, weight.work - 1); }
  if (quirks.includes("惜器爱美") && purseTier >= 2) weight.leisure += 1;

  // 银囊窘迫翻转：高消费维度压权重，典当/粗茶反升为首选
  if (purseTier === 0) {
    weight.play = 0.2;
    weight.dine = Math.min(weight.dine, 1);
    weight.work += 1.5;
  }

  // 逐维抽场子：先按权重抽维度，再在维度内抽消费得起的建筑
  const pickVenue = () => {
    const entries = Object.entries(weight).filter(([dim, w]) => w > 0 && venues[dim]?.length);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    if (!total) return null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let roll = rng() * total;
      let dim = entries[entries.length - 1][0];
      for (const [d, w] of entries) { roll -= w; if (roll < 0) { dim = d; break; } }
      // 消费不起的场子硬闯不得：窘迫时维度内无可负担场子就重抽维度，全城都进不起则回退 null
      const candidates = venues[dim].filter((b) => affordable(b.type, purseTier));
      if (!candidates.length) continue;
      // 银囊窘迫的建筑级反向亲和：当铺、粗茶杂货、便宜饭馆是落魄人的去处（7.2 消费档次反差）
      const bw = candidates.map((b) => (purseTier === 0 ? 1 + (TYPE_POOR_AFFINITY[b.type] || 0) : 1));
      const btotal = bw.reduce((x, y) => x + y, 0);
      let broll = rng() * btotal;
      let building = candidates[candidates.length - 1];
      for (let i = 0; i < candidates.length; i += 1) {
        broll -= bw[i];
        if (broll < 0) { building = candidates[i]; break; }
      }
      return { dim, building };
    }
    return null;
  };

  let picked = null;
  if (anchorBuilding) {
    const dim = dimensionOf(anchorBuilding.type);
    if (!dim) return null; // 驿站/库房这类无生活维度的处所回退通用营生句
    picked = { dim, building: anchorBuilding };
  } else {
    picked = pickVenue();
  }
  if (!picked) return null;
  // recovery 叙事（带伤戒心/把脉将养）只给真正带伤的人：健康的医者伙计身处药庐医馆
  // 是坐堂捣药谋生，不是躺着养伤的病人（Review 实证：健康玉真子在药园被写成伤员）。
  const injured = aiPackage === "injured_rest" || hpRatio < 0.7;
  if (picked.dim === "recovery" && !injured) picked = { dim: "work", building: picked.building, healingWork: true };
  const { dim, building } = picked;
  const moods = MOOD_BY_DIMENSION[dim] || ["惬意"];
  const mood = moods[Math.floor(rng() * moods.length) % moods.length];
  const detail = picked.healingWork ? "坐堂捣药看诊，秤上药香正浓" : affordanceDetail(building);
  return Object.freeze({
    activity: dim,
    activityLabel: DIMENSION_LABEL[dim],
    aiPackage,
    purse,
    quirks,
    buildingId: building.id || null,
    buildingName: building.name || "",
    signature: signatureOf(building),
    detail,
    mood,
    hook: HOOK_BY_DIMENSION[dim] || "",
    untilTurn: windowStart + 4,
  });
}

// 11 号位模版 A 的「此刻生活」片段渲染（npcSoulFrame 消费）：
// 此刻生活：申时初，身处戏楼，银囊寻常，心境出神，正独自……（可介入由头：……）
const SHICHEN = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

export function renderLifeSliceLine(slice, time = 0) {
  if (!slice) return null;
  const hour = ((Math.floor(time) % 24) + 24) % 24;
  const shi = SHICHEN[Math.min(11, Math.floor(hour / 2))];
  const parts = [`此刻生活：${shi}时，身处${slice.buildingName}，银囊${slice.purse}，心境${slice.mood}，${slice.detail}`];
  if (slice.hook) parts.push(`（可介入由头：${slice.hook}）`);
  return parts.join("");
}

