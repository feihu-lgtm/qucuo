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

// 已结识（声誉非零）的势力，按总纲表的顺序
export function listFactionRep(varTree) {
  return FACTIONS.map(({ name }) => ({ name, value: factionRepOf(varTree, name) }))
    .filter((entry) => entry.value !== 0)
    .map((entry) => ({ ...entry, label: factionRepLabel(entry.value) }));
}
