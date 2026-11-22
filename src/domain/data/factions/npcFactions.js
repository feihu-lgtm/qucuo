// 势力名与 NPC 归属（NPC 冲突系统用）。势力名按全势力设计合稿的 16 家；
// 这里只登记代码里已经有的 NPC，草案里的新角色落地时再补。
export const FACTION = {
  TUSI: "鱼定土司府",
  YUDING: "鱼定村",
  XUESHAN: "雪山派",
  LAMA: "喇嘛庙",
  YUQUAN: "玉泉寨",
  HEIFENG: "黑风寨",
  BAIHUA: "百花门",
  HUANXI: "欢喜教",
  GUAN: "锦官城",
  QINGCHENG: "青城派",
  EMEI: "峨眉派",
  TANGMEN: "唐门",
  GAIBANG: "丐帮三星分舵",
  WUXIAN: "五仙教",
  TIANLONG: "天龙教",
  SANXING: "三星派",
};

const F = FACTION;
const MEMBERS = {
  [F.TUSI]: ["resident_meiduo", "resident_sangjieduojie", "resident_luofusheng", "resident_gesangdunzhu"],
  [F.YUDING]: ["resident_caidan", "resident_laosun", "resident_yudingdaniang", "pool_da_niang", "pool_bidder_caidan"],
  [F.XUESHAN]: ["resident_huyanxue", "resident_xuannu", "resident_heyuxie", "pool_bidder_xueshan"],
  [F.LAMA]: ["resident_lama_abbot", "resident_yaotang_shifu", "pool_you_seng"],
  [F.YUQUAN]: ["resident_danzeng", "resident_liruoyou", "resident_zhaxi", "resident_zhuoma", "pool_mu_tong", "pool_bidder_liruoyou"],
  [F.HEIFENG]: ["resident_basang", "resident_zhuoyang", "resident_gaze", "pool_bidder_heifeng"],
  [F.BAIHUA]: ["pool_lanjie"],
  [F.HUANXI]: ["resident_fanyanna", "resident_luoqi", "resident_laohe", "resident_ayabuddhist", "resident_sangjie_neiyuan", "resident_lizhanggui"],
  [F.GUAN]: ["resident_liuqingyuan", "pool_bidder_chaiyi", "pool_lao_bing"],
  [F.QINGCHENG]: ["resident_yiqing", "resident_qingxiazi", "resident_chitang", "resident_qingxuan", "resident_songhe", "resident_yuzhenzi", "resident_laodaoshi", "resident_huguidizi"],
  [F.EMEI]: ["resident_xuanchen", "resident_zhaowei", "resident_xubai", "resident_liaoyin", "resident_tielian", "resident_situying", "resident_jinglian", "resident_zanniang", "resident_chenjiu"],
  [F.TANGMEN]: ["resident_tanglaotai", "resident_tangsanshao"],
  [F.TIANLONG]: ["resident_litianxing", "resident_xuedao_chuqi", "resident_xuedao_shisan", "resident_xuedao_niansan", "resident_shizhongyue", "resident_anshiheng", "resident_helanzhao"],
  [F.SANXING]: ["resident_zongmuzhe", "resident_qingtong_jia", "resident_qingtong_yi", "resident_qingtong_bing"],
};

const NPC_FACTION = new Map(
  Object.entries(MEMBERS).flatMap(([faction, ids]) => ids.map((id) => [id, faction])),
);

// toRoomNpc 给内容 ID 加一层 pool_ 前缀。不能按名字认领同名导入角色。
export function getBuiltinNpcId(npc) {
  if (npc?.imported || typeof npc?.id !== "string") return null;
  if (NPC_FACTION.has(npc.id)) return npc.id;
  const contentId = npc.id.startsWith("pool_") ? npc.id.slice(5) : null;
  return NPC_FACTION.has(contentId) ? contentId : null;
}

export function getNpcFaction(npc) {
  return NPC_FACTION.get(getBuiltinNpcId(npc)) ?? null;
}

// 势力对势力的基线张力（无向）。取合稿附录一两个方向里最强的负联动：
// -50% → 60（死敌）、-30% → 40（一般敌对）、-15% → 20（暗中戒备）；
// 仅特定活动触发的敌意降一档；须完成任务才进入敌对的关系，不预先增加。
const TENSION_PAIRS = [
  [F.TUSI, F.HEIFENG, 60], [F.TUSI, F.YUQUAN, 60], [F.TUSI, F.XUESHAN, 60],
  [F.QINGCHENG, F.TIANLONG, 60], [F.EMEI, F.TIANLONG, 60], [F.GAIBANG, F.TIANLONG, 60],
  [F.XUESHAN, F.TIANLONG, 40], [F.HUANXI, F.GUAN, 40], [F.EMEI, F.WUXIAN, 40],
  [F.TUSI, F.YUDING, 20], [F.TUSI, F.GUAN, 20], [F.TUSI, F.TANGMEN, 20], [F.TUSI, F.SANXING, 20],
  [F.YUDING, F.TIANLONG, 20], [F.LAMA, F.HUANXI, 20], [F.LAMA, F.TIANLONG, 20],
  [F.HEIFENG, F.TIANLONG, 20], [F.QINGCHENG, F.TANGMEN, 20], [F.EMEI, F.TANGMEN, 20],
  [F.TIANLONG, F.GUAN, 20],
];

export const tensionKey = (a, b) => [a, b].sort().join("|");

export const BASE_TENSION = Object.fromEntries(
  TENSION_PAIRS.map(([a, b, value]) => [tensionKey(a, b), value]),
);
