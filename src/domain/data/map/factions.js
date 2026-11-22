// 曲措乡各方势力（总纲 1.2 势力分布表）。districts 是该势力坐镇的外层据点，
// 在这些据点里买东西才吃势力声誉的折扣；天都镇百花门与欢喜教同城，暂不按据点区分。
export const FACTIONS = Object.freeze([
  { name: "鱼定土司府", districts: ["鱼定土司"], foes: ["黑风寨"] },
  { name: "鱼定村", districts: ["鱼定村"], foes: [] },
  { name: "雪山派", districts: ["雪山派"], foes: [] },
  { name: "喇嘛庙", districts: ["喇嘛庙", "白塔"], foes: [] },
  { name: "玉泉寨", districts: ["玉泉寨"], foes: [] },
  { name: "百花门", districts: [], foes: [] },
  { name: "锦官城", districts: ["锦官城"], foes: [] },
  { name: "黑风寨", districts: ["黑风寨"], foes: ["鱼定土司府"] },
  { name: "欢喜教", districts: [], foes: [] },
]);

export const FACTION_NAMES = Object.freeze(FACTIONS.map((faction) => faction.name));
