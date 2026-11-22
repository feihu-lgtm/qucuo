// 势力声誉：玩家与一方势力的关系，存 varTree.世界.势力声誉.<势力>（-100~100）。
// 参照千山一诺的分域侠名：在该势力据点买东西按声誉打折（15/40/80 → 九二/八五/七五折）。
import { FACTIONS } from "../../data/map/factions.js";

const TIERS = [
  { min: 80, label: "生死之交", coef: 0.75 },
  { min: 40, label: "敬重", coef: 0.85 },
  { min: 15, label: "友善", coef: 0.92 },
  { min: -19, label: "平常", coef: 1 },
  { min: -59, label: "交恶", coef: 1 },
  { min: -Infinity, label: "死敌", coef: 1 },
];

const tierOf = (value) => TIERS.find((tier) => (Number(value) || 0) >= tier.min);

export const factionRepLabel = (value) => tierOf(value).label;
export const factionRepCoef = (value) => tierOf(value).coef;

export function factionRepOf(varTree, faction) {
  return Number(varTree?.世界?.势力声誉?.[faction]) || 0;
}

export function factionOfDistrict(district) {
  return FACTIONS.find((faction) => faction.districts.includes(district))?.name || null;
}

export function factionShopCoef(varTree, district) {
  const faction = factionOfDistrict(district);
  return faction ? tierOf(factionRepOf(varTree, faction)).coef : 1;
}

// 声誉联动：帮了一家（声誉实涨），它的死对头（FACTIONS.foes）各扣实涨量的一半（向上取整）。
// 只在涨时联动，掉声誉不连带；deltas 里已写明的势力按写明的算，不再叠加联动。
// 实涨按 varTree 里的当前声誉算（默认单次限幅 ±10、上限 100），到顶了对头也不扣。
// 系统直接结算、不经 AI 限幅的来源（拜入 +20 等）传 { step: Infinity }，按真实涨幅算。
// 返回 { 势力: 增量 }，供任务奖励、切磋等各处统一落盘。
const REP_MIN = -100;
const REP_MAX = 100;
const REP_STEP = 10;
const clampRep = (value) => Math.max(REP_MIN, Math.min(REP_MAX, value));

export function factionRepDeltas(deltas, varTree = {}, { step = REP_STEP } = {}) {
  const out = {};
  for (const [faction, delta] of Object.entries(deltas || {})) {
    if (delta) out[faction] = (out[faction] || 0) + delta;
  }
  for (const [faction, delta] of Object.entries(deltas || {})) {
    if (!(delta > 0)) continue;
    const before = factionRepOf(varTree, faction);
    const gain = clampRep(before + Math.min(delta, step)) - before;
    if (!(gain > 0)) continue;
    const foes = FACTIONS.find((entry) => entry.name === faction)?.foes || [];
    for (const foe of foes) {
      if (Object.prototype.hasOwnProperty.call(deltas, foe)) continue;
      out[foe] = (out[foe] || 0) - Math.ceil(gain / 2);
    }
  }
  return out;
}

// 把一组势力声誉增量（含联动）写进 varTree，返回新的 varTree。
export function applyFactionRep(varTree, deltas) {
  const changes = factionRepDeltas(deltas, varTree || {});
  const reps = { ...(varTree?.世界?.势力声誉 || {}) };
  for (const [faction, delta] of Object.entries(changes)) {
    const step = Math.max(-REP_STEP, Math.min(REP_STEP, delta));
    reps[faction] = clampRep(factionRepOf(varTree, faction) + step);
  }
  return { ...(varTree || {}), 世界: { ...(varTree?.世界 || {}), 势力声誉: reps } };
}

// 系统直接结算的声誉（拜入、日常善举），按当前 varTree 实涨量连带对头扣分，不走 AI 单回合 ±10 限幅。
export function grantFactionRep(varTree, deltas) {
  const changes = factionRepDeltas(deltas, varTree || {}, { step: Infinity });
  const reps = { ...(varTree?.世界?.势力声誉 || {}) };
  const applied = {};
  for (const [faction, delta] of Object.entries(changes)) {
    const before = factionRepOf(varTree, faction);
    reps[faction] = clampRep(before + delta);
    if (reps[faction] !== before) applied[faction] = reps[faction] - before;
  }
  return { applied, varTree: { ...(varTree || {}), 世界: { ...(varTree?.世界 || {}), 势力声誉: reps } } };
}

export const formatRepChanges = (applied) =>
  Object.entries(applied).map(([faction, delta]) => `${faction}声誉 ${delta > 0 ? "+" : ""}${delta}`).join("，");

// 已结识（声誉非零）的势力，按总纲表的顺序
export function listFactionRep(varTree) {
  return FACTIONS.map(({ name }) => ({ name, value: factionRepOf(varTree, name) }))
    .filter((entry) => entry.value !== 0)
    .map((entry) => ({ ...entry, label: factionRepLabel(entry.value) }));
}
