// 入册审改 · 随身物的纯逻辑（从 CarryPicker.jsx 拆出）
// ============================================================================
// 只放不碰 React 的部分：特效可勾清单、特效开关、攻防计算、空白草稿、AI 写描述。
// 面板渲染在 ItemDetailPane.jsx / ItemForgePane.jsx。

import { TIERS } from "./widgets.jsx";
import { callModel } from "../../../engine/ports/ai.js";
import { CATALOG } from "../../../domain/data/items/catalog.js";
import { statsForQuality } from "../../../domain/rules/economy/equipment.js";
import { ITEM_DESC_MAX_TOKENS } from "./reviewShared.js";

export const CAT_LABEL = { weapon: "兵器", armor: "护具", accessory: "饰物", misc: "杂物" };

// carry 的元素有两种：在册物品只存名字字符串，自造物品存完整对象。
// 所有增删判重都必须过 nameOf，不能直接 includes——否则自造的那件永远判不出
// "已选"，会被重复加进去。
export const nameOf = (c) => (typeof c === "string" ? c : (c?.name || ""));

// 攻击特效的可勾选清单（物品版的武学标志位）。按 combat/resolveTurn.js 认的
// 字段名，给出默认值——玩家只需勾"这件装备带不带某个效果"，数值交给默认。
// applyMark 需要 name/stacks 这种结构，单独给默认对象。
export const ITEM_EFFECT_CHOICES = [
  { key: "forceFirst", label: "必先手", def: true },
  { key: "ignoreDefense", label: "无视防御", def: true },
  { key: "doubleVsStatus", label: "克中招翻倍", def: true },
  { key: "lowHpBonus", label: "残血增伤", def: 0.15 },
  { key: "highHpBonus", label: "满血增伤", def: 0.15 },
  { key: "afterStatusBonus", label: "趁中招追击", def: 0.2 },
  { key: "detonateMark", label: "引爆内伤", def: true },
  { key: "energyDiffDamage", label: "打能量差", def: true },
  { key: "freezeEnergyRecovery", label: "封气", def: true },
  { key: "onCounterSuccessDamageRatio", label: "应对反击", def: 0.5 },
  { key: "nullifyStatusOnHit", label: "打断状态招", def: true },
  { key: "immuneControl", label: "免控", def: true },
  { key: "energyRestore", label: "起手回气", def: 2 },
  { key: "hpRestore", label: "运功回血", def: 0.2 },
  { key: "applyMark", label: "附内伤印", def: { name: "内伤印", stacks: 1 }, param: "applyMarkChance", paramDef: 0.25 },
  { key: "enemyCostPenalty", label: "封穴耗气", def: { value: 2, turns: 2 } },
];

// 某件（自造）物品当前挂着的 effect 里，某标志位是否为真（含 param 键辅助判断）
export const effectHas = (item, key) => {
  const e = item?.effect || {};
  if (key === "applyMark") return !!e.applyMark;
  if (key === "enemyCostPenalty") return !!e.enemyCostPenalty;
  return !!e[key];
};

// 勾选/取消某特效标志位：返回新的 effect 对象。取消时把 param 键（如
// applyMarkChance）一并清掉。调用方决定写回 draft 还是 patchItem。
export function toggleItemEffect(item, choice) {
  const e = { ...(item.effect || {}) };
  if (effectHas(item, choice.key)) {
    delete e[choice.key];
    if (choice.param) delete e[choice.param];
  } else {
    e[choice.key] = choice.def;
    if (choice.param && e[choice.param] == null) e[choice.param] = choice.paramDef;
  }
  return e;
}

// 一件物品（在册字符串或自造对象）算出的最终攻击力：
//   在册 → catalog 条目自带 atkMul；自造 → 品质基准 × 玩家调的 atkMul。
export const computeAtk = (item) => {
  const isStr = typeof item === "string";
  const catEntry = isStr ? CATALOG.find(e => e.name === item) : null;
  const quality = catEntry ? catEntry.quality : (item?.quality || "白");
  const mul = catEntry ? (catEntry.atkMul ?? 1) : (item?.atkMul ?? 1);
  const base = statsForQuality(catEntry?.category || item?.category || "weapon", quality);
  return base.atk != null ? Math.round(base.atk * mul) : null;
};
// 护甲同理
export const computeDef = (item) => {
  const isStr = typeof item === "string";
  const catEntry = isStr ? CATALOG.find(e => e.name === item) : null;
  const quality = catEntry ? catEntry.quality : (item?.quality || "白");
  const mul = catEntry ? (catEntry.defMul ?? 1) : (item?.defMul ?? 1);
  const base = statsForQuality(catEntry?.category || item?.category || "armor", quality);
  return base.def != null ? Math.round(base.def * mul) : null;
};

export const blankDraft = (cat, levelCap) => ({
  name: "", category: cat || "weapon", quality: TIERS[levelCap]?.label || "白",
  desc: "", sixDim: {}, effect: {}, atkMul: 1, defMul: 1,
});

// 让 AI 补描述。只写描述，不碰数值——数值是玩家自己定的，AI 一插手就会
// 出现"界面上写着加2身法、描述里说这是把重剑"这种自相矛盾。
export async function fetchAiDesc(draft, apiCfg) {
  const six = Object.entries(draft.sixDim || {}).filter(([, v]) => v).map(([k, v]) => `${k}+${v}`).join("、");
  const sys = `你在为一个中文武侠文字游戏写物品描述。用白话古文，两到三句，六十字以内。
只写这件东西看上去什么样、摸上去什么手感、来历或用处的一点线索。
不要复述它的属性数值，不要用"这件装备"这类游戏术语，不要夸大成神兵。
直接输出描述正文，不要引号、不要标题、不要任何说明。`;
  const usr = `名称：${draft.name}
类别：${CAT_LABEL[draft.category] || draft.category}
品阶：${draft.quality}档${six ? `\n附带：${six}` : ""}`;
  const res = await callModel(apiCfg, sys, [{ role: "user", content: usr }], { maxTokens: ITEM_DESC_MAX_TOKENS, temperature: 0.8 });
  return (res.text || "").trim().replace(/^["「『]|["」』]$/g, "").slice(0, 200);
}
