// 调香药房捐药（合稿·欢喜教 7.1 加分行为 3）：把药材送给阿雅，涨欢喜教声誉，每游戏日只算第一次。
// 绿品 +4、蓝品 +6、紫品及以上 +8；白品不算珍稀。
export const HERB_DONATION = { npcId: "resident_ayabuddhist", faction: "欢喜教", flag: "huanxi_herb_day_", tag: "药材" };

const GAIN = { 绿: 4, 蓝: 6, 紫: 8, 橙: 8, 红: 8 };

// 返回 null 表示与捐药无关或今天已捐过；否则 { faction, delta, flags }。
export function herbDonationRepGain(state, npc, item) {
  if (!npc || !(npc.id === HERB_DONATION.npcId || npc.id === `pool_${HERB_DONATION.npcId}`)) return null;
  if (!item?.tags?.includes(HERB_DONATION.tag)) return null;
  const delta = GAIN[item.quality];
  if (!delta) return null;
  const dayFlag = `${HERB_DONATION.flag}${Math.floor((state.time || 0) / 24)}`;
  if ((state.flags || []).includes(dayFlag)) return null;
  return { faction: HERB_DONATION.faction, delta, flags: (prev = []) => [...prev.filter((flag) => !flag.startsWith(HERB_DONATION.flag)), dayFlag] };
}
