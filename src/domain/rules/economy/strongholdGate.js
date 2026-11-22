// 势力据点的声誉门禁（合稿「不共戴天」档）：本势力声誉 ≤ -60 时，据点内层只剩锚点能站，
// 往里走就被守卫截回；据点里所有建筑闭门。建筑另可挂 faction + minRep 单独设门槛。
import { factionRepOf } from "./factionRep.js";

export const STRONGHOLD_BAN_REP = -60;

const STRONGHOLDS = {
  鱼定土司: {
    faction: "鱼定土司府",
    anchor: "府门",
    intercept: "巡捕营的骑手横矛拦在石阶下，白玛次仁冷笑一声：「土司有令，此人见一个拿一个。」刀出了鞘，你只能退回府门外。",
    closed: "差役砰地合上门板：「府里有令，不伺候你。」",
  },
};

export function strongholdBan(district, varTree) {
  const hold = STRONGHOLDS[district];
  if (!hold || factionRepOf(varTree, hold.faction) > STRONGHOLD_BAN_REP) return null;
  return hold;
}

// 合稿各势力「不共戴天」档写明要闭门的建筑：本势力声誉 ≤ -60 时这些建筑关门，打开时给一句原因。
// 只收合稿点了名（或写了「所有建筑」「禁止进入内层建筑」）的；orPrestige：全局威望 ≤ 该值也关（峨眉）。
export const HOSTILE_CLOSURES = [
  {
    faction: "鱼定村",
    buildings: ["shop_yiding", "grocery_yiding", "restaurant_yiding", "inn_yiding", "wuguan_shaiguchang"],
    closed: "门板早早上了闩，屋里的人隔着门缝看了你一眼，再不吭声——村里人不跟你打交道了。",
  },
  {
    faction: "雪山派",
    buildings: ["wuguan_xueshan", "sectshop_xueshan", "sectentry_xueshan", "kitchen_bieyuan", "chest_bieyuan", "inn_xueshan", "hospital_xueshan_wenquan", "library_xueshan"],
    closed: "守门弟子横剑拦住：「陆师姐有令，雪山派山门不对你开。」",
  },
  {
    faction: "喇嘛庙",
    buildings: ["medicine_lama"],
    closed: "药堂的僧人合上药柜，低眉念了声佛号：「施主的药，本寺不配。」",
  },
  {
    faction: "玉泉寨",
    buildings: ["shop_yuquan", "inn_yuquan", "hospital_yuquan"],
    closed: "掌柜把门帘一摔：「李寨主发了话，玉泉寨不做你的生意，不留你的宿，也不给你看病。」",
  },
  {
    faction: "黑风寨",
    buildings: ["sect_entry_heifeng", "wuguan_heifeng", "sectshop_heifeng", "kitchen_heifeng"],
    closed: "刀口的喽啰把路一横：「寨里没你的买卖，再往里走，刀可不认人。」",
  },
  {
    faction: "百花门",
    buildings: ["rest_baihualou", "tea_baihua_tingfeng", "med_baihua_ange", "hosp_baihua_qudu", "wuguan_baihua_huapeng", "pigeon_baihua_caique"],
    closed: "帘后的姑娘们一下子散得干干净净，只留一句冷冷的话：「百花楼不接你这位客。」",
  },
  {
    faction: "欢喜教",
    buildings: ["grocery_tiandu", "teahouse_pinxiangya", "wuguan_huanxitang", "sect_entry_huanxi", "temple_huanxifo", "chest_xianghangkufang"],
    closed: "香行上下见了你便闭门落锁，连一缕香烟都不肯飘出来。",
  },
  {
    faction: "锦官城",
    // 合稿「城北府衙/军需库/锦官驿站全面拒客」：府衙即都事府值房，军需库即城东营房的都事府兵备库。
    buildings: ["sect_entry_guan", "sectshop_guan", "transport_jingguan"],
    closed: "门子对着海捕文书瞧了你两眼，把门一掩：「官府的门，不对在逃之人开。」",
  },
  {
    faction: "青城派",
    buildings: ["wuguan_yajiang", "hospital_qingcheng_yaopu", "sectshop_yajiang", "sect_entry_yajiang"],
    closed: "安澜索桥那头的弟子长剑出鞘：「青城山门不容你踏进一步。」",
  },
  {
    faction: "峨眉派",
    orPrestige: -60,
    buildings: ["sect_entry_emei", "sectshop_emei", "hospital_emei_fotang", "library_emei_jingge", "wuguan_emei"],
    closed: "照微师太立在剑庐门口，拂尘一摆：「剑庐不纳你这样的人。」",
  },
  {
    faction: "唐门",
    buildings: ["tangmen_shop", "wuguan_tangmen", "sectshop_tangmen", "hospital_tangmen", "sect_entry_tangmen"],
    closed: "铺面的竹帘无声落下，帘缝里一点乌光一闪——唐门不再跟你做任何生意。",
  },
  {
    faction: "丐帮三星分舵",
    buildings: ["teahouse_gaibang_chashi", "wuguan_gaibang_zhuping", "sectshop_gaibang", "pigeon_gaibang", "kitchen_gaibang_zhoupeng", "inn_gaibang_xiedian", "sect_gaibang_entry"],
    closed: "白婶拎起大汤勺就往外赶：「走走走，破庙里没你一口饭！」",
  },
  {
    faction: "五仙教",
    buildings: ["inn_wuyinzhai", "sect_entry_wuxian", "wuguan_wuxian", "medicine_wuxian", "sectshop_wuxian", "temple_wuxian", "teahouse_wuxian", "kitchen_wuxian"],
    closed: "门楣上的银铃无风自响，竹门缝里渗出一缕青灰毒雾——五仙教的门不对你开。",
  },
  {
    faction: "天龙教",
    buildings: ["sectshop_tianlong"],
    closed: "玄甲卫士把长戟一交：「军需坊不给外贼一粒米一支箭。」",
  },
  {
    faction: "三星派",
    buildings: ["sanxing_sect_shop"],
    closed: "秘藏阁门前立起了杀戒铜牌，守阁弟子一言不发，只把青铜剑横在门前。",
  },
];

export function hostileClosureOf(buildingId, varTree) {
  if (!buildingId) return null;
  const prestige = Number(varTree?.世界?.威望) || 0;
  return HOSTILE_CLOSURES.find((entry) => entry.buildings.includes(buildingId)
    && (factionRepOf(varTree, entry.faction) <= STRONGHOLD_BAN_REP
      || (entry.orPrestige != null && prestige <= entry.orPrestige))) || null;
}

export function buildingClosedReason(building, district, varTree) {
  const ban = strongholdBan(district, varTree);
  if (ban) return ban.closed;
  const closure = hostileClosureOf(building?.id, varTree);
  if (closure) return closure.closed;
  if (building?.minRep != null && factionRepOf(varTree, building.faction) < building.minRep) {
    return building.repLocked || `须${building.faction}声誉 ≥ ${building.minRep}。`;
  }
  return null;
}
