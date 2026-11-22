// 给势力驻场人物送银两涨声誉，每个游戏日只算第一次（合稿各派「声誉·加分行为」）。
// 丐帮：在广汉破庙给白婶捐粥钱，20/40/60 两 → +3/+4/+5（丐帮 7.1 加分行为 1）。
// 鱼定土司府：给管家陆福生递「孝敬银」赔礼，50/100/150 两 → +3/+4/+5（土司府 7.2「重金赔礼」赎罪渠道）。
export const SILVER_DONATIONS = [
  { npcId: "resident_baishen", npcName: "白婶", faction: "丐帮三星分舵", flag: "gaibang_alms_day_", tiers: [[60, 5], [40, 4], [20, 3]],
    log: "银子进了粥锅" },
  { npcId: "resident_luofusheng", npcName: "管家·陆福生", faction: "鱼定土司府", flag: "tusi_tribute_day_", tiers: [[150, 5], [100, 4], [50, 3]],
    log: "陆福生把银子收进袖里，在账上记了一笔" },
];
export const SOUP_KITCHEN = SILVER_DONATIONS[0];

const donationFor = (npc) => npc && SILVER_DONATIONS.find((entry) => npc.id === entry.npcId || npc.id === `pool_${entry.npcId}`);

// 返回 null 表示与送银涨声誉无关、银两不够最低档或今天已送过；否则 { faction, delta, log, flags }：
// 声誉交给 applyFactionRep 写（死对头自动联动），flags 为写回函数（只留今天的标记）。
export function soupKitchenRepGain(state, npc, amount) {
  const entry = donationFor(npc);
  if (!entry) return null;
  const delta = entry.tiers.find(([min]) => amount >= min)?.[1];
  if (!delta) return null;
  const flags = state.flags || [];
  const dayFlag = `${entry.flag}${Math.floor((state.time || 0) / 24)}`;
  if (flags.includes(dayFlag)) return null;
  return { faction: entry.faction, delta, log: entry.log, flags: (prev = []) => [...prev.filter((flag) => !flag.startsWith(entry.flag)), dayFlag] };
}
