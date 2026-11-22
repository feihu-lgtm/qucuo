// 送药涨声誉（合稿各派 7.1 日常加分行为）：把珍稀药材（五仙教还收蜀锦布料）送给指定驻场人物，
// 涨该派声誉，每派每游戏日只算第一次；白品不算珍稀。
// 欢喜教·阿雅 +4/+6/+8；雪山派·呼延雪/何雨谢 +5/+6/+8；百花门·花婆 +4/+6/+8；五仙教·龙汐月/乌婆婆 +3/+5/+8。
const HERB_DONATIONS = [
  { npcIds: ["resident_ayabuddhist"], faction: "欢喜教", flag: "huanxi_herb_day_", tags: ["药材"],
    gain: { 绿: 4, 蓝: 6, 紫: 8, 橙: 8, 红: 8 }, text: "阿雅把药材收进调香药房" },
  { npcIds: ["resident_huyanxue", "resident_heyuxie"], faction: "雪山派", flag: "xueshan_herb_day_", tags: ["药材"],
    gain: { 绿: 5, 蓝: 6, 紫: 8, 橙: 8, 红: 8 }, text: "药材收进了雪山灶房的药柜" },
  { npcIds: ["resident_huapo"], faction: "百花门", flag: "baihua_herb_day_", tags: ["药材"],
    gain: { 绿: 4, 蓝: 6, 紫: 8, 橙: 8, 红: 8 }, text: "花婆把药草摊进暖棚的竹筛" },
  { npcIds: ["resident_longxiyue", "resident_wupopo"], faction: "五仙教", flag: "wuxian_herb_day_", tags: ["药材", "布料"],
    gain: { 绿: 3, 蓝: 5, 紫: 8, 橙: 8, 红: 8 }, text: "东西收进了五仙祖灵殿的樟木箱" },
];

const donationFor = (npc) => npc && HERB_DONATIONS.find((d) =>
  d.npcIds.some((id) => npc.id === id || npc.id === `pool_${id}`));

// 返回 null 表示与送药无关或今天已送过；否则 { faction, delta, flags, text }。
export function herbDonationRepGain(state, npc, item) {
  const donation = donationFor(npc);
  if (!donation || !item?.tags?.some((tag) => donation.tags.includes(tag))) return null;
  const delta = donation.gain[item.quality];
  if (!delta) return null;
  const dayFlag = `${donation.flag}${Math.floor((state.time || 0) / 24)}`;
  if ((state.flags || []).includes(dayFlag)) return null;
  return {
    faction: donation.faction, delta, text: donation.text,
    flags: (prev = []) => [...prev.filter((flag) => !flag.startsWith(donation.flag)), dayFlag],
  };
}
