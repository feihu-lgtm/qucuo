// 粥棚捐助：在广汉破庙给白婶捐银两，涨丐帮三星分舵声誉（合稿·丐帮 7.1 加分行为 1）。
// 每个游戏日只算第一次；捐 20 两 +3，40 两 +4，60 两及以上 +5。
export const SOUP_KITCHEN = { npcId: "resident_baishen", npcName: "白婶", faction: "丐帮三星分舵", flag: "gaibang_alms_day_", min: 20 };

const deltaFor = (amount) => (amount >= 60 ? 5 : amount >= 40 ? 4 : 3);

// 返回 null 表示与粥棚无关或今天已捐过；否则 { faction, delta, flags }：声誉交给 applyFactionRep 写（死对头自动联动），flags 为写回函数（只留今天的捐助标记）。
export function soupKitchenRepGain(state, npc, amount) {
  if (!npc || !(npc.id === SOUP_KITCHEN.npcId || npc.id === `pool_${SOUP_KITCHEN.npcId}`)) return null;
  if (!(amount >= SOUP_KITCHEN.min)) return null;
  const flags = state.flags || [];
  const dayFlag = `${SOUP_KITCHEN.flag}${Math.floor((state.time || 0) / 24)}`;
  if (flags.includes(dayFlag)) return null;
  const delta = deltaFor(amount);
  return { faction: SOUP_KITCHEN.faction, delta, flags: (prev = []) => [...prev.filter((flag) => !flag.startsWith(SOUP_KITCHEN.flag)), dayFlag] };
}
