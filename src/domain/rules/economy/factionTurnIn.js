// 势力信物交还：把特定物件送到指定人物手上，涨本派声誉（合稿各派「声誉·加分行为」的交物玩法）。
// 丐帮 7.1：击杀血刀部恶徒带回「血刀信物」交周小满 +8（天龙教 -4 由 applyFactionRep 死对头联动
// 自动扣，青城/峨眉各 +2 按合稿明写）；解救乡民送「流亡凭证」至察世茶棚 +6~10，取中值 +8。
// 喇嘛庙 7.1：雪山崖底拾得的「蜜蜡残珠」归还嘉措 +10 并大幅拉升好感（favor）；
//            采得的雪莲/藏红花平价售予根敦药堂 +6（+5~8 取中值）。
// 不限次数——物件本身要打/偷/捡才拿得到，日限已由物件来源天然卡着。
export const FACTION_TURNINS = [
  {
    items: ["血刀信物"], npc: "周小满", faction: "丐帮三星分舵", rep: 8,
    extra: { 青城派: 2, 峨眉派: 2 },
    log: "周小满接过血色铁符，就着灯下验了验符背刻的村名，往察世堂的册子上重重记了一笔。",
  },
  {
    items: ["流亡凭证"], npc: "周小满", faction: "丐帮三星分舵", rep: 8,
    extra: {},
    log: "周小满把流亡凭证抚平收进匣子里：「名姓来路都在，又多一户能送回去的。」",
  },
  {
    items: ["蜜蜡残珠"], npc: "嘉措", faction: "喇嘛庙", rep: 10,
    extra: {}, favor: { 嘉措: 10 },
    log: "嘉措拈起那颗蜜蜡残珠，对着自己缺了一颗的旧念珠比了比，三十年的缺口对得上——老住持合掌良久没说话。",
  },
  {
    items: ["雪莲幼苗", "寒泉雪莲"], npc: "根敦", faction: "喇嘛庙", rep: 6,
    extra: {},
    log: "根敦把药材摊在药堂柜上验了成色，按平价折了银两给你，转头吩咐小喇嘛拿去捣药。",
  },
];

// 返回交还条目；不匹配（物件不对、人不对）返回 null。
export function factionTurnInOf(npc, itemName) {
  if (!npc || !itemName) return null;
  return FACTION_TURNINS.find((entry) => entry.items.includes(itemName) && entry.npc === npc.name) || null;
}

// 按条目算声誉增量：主派 rep + 合稿明写的盟友追加；死对头扣分交给 grantFactionRep 联动。
export function factionTurnInGain(entry) {
  return { [entry.faction]: entry.rep, ...(entry.extra || {}) };
}
