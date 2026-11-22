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

// 声誉联动：帮了一家（声誉上涨），它的死对头（FACTIONS.foes）各扣上涨量的一半（向上取整）。
// 只在涨时联动，掉声誉不连带；explicit 里已写明的势力按写明的算，不再叠加联动。
// 返回 { 势力: 增量 }，供任务奖励、切磋等各处统一落盘。
export function factionRepDeltas(deltas, explicit = deltas) {
  const out = {};
  for (const [faction, delta] of Object.entries(deltas || {})) {
    if (delta) out[faction] = (out[faction] || 0) + delta;
  }
  for (const [faction, delta] of Object.entries(deltas || {})) {
    if (!(delta > 0)) continue;
    const foes = FACTIONS.find((entry) => entry.name === faction)?.foes || [];
    for (const foe of foes) {
      if (Object.prototype.hasOwnProperty.call(explicit || {}, foe)) continue;
      out[foe] = (out[foe] || 0) - Math.ceil(delta / 2);
    }
  }
  return out;
}

// 已结识（声誉非零）的势力，按总纲表的顺序
export function listFactionRep(varTree) {
  return FACTIONS.map(({ name }) => ({ name, value: factionRepOf(varTree, name) }))
    .filter((entry) => entry.value !== 0)
    .map((entry) => ({ ...entry, label: factionRepLabel(entry.value) }));
}
