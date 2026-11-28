// WO-25J · 7.1 建筑生活可供性表（Smart Objects 思路·纯数据零机制）。
// 把全图 33 类建筑（BUILDING_TYPE）归入五大生活维度，直接消费各据点建筑既有的
// menuKey / shopKey 与名称——未来新增任何据点或建筑均自动生效，不改本表。
// 生活维度：dine 吃吃喝喝 / play 娱乐消遣 / work 谋生干活 / leisure 休闲社交 / recovery 救急疗养。

import { SERVICE_MENUS } from "../buildings/menuData.js";

// 建筑类型 → 生活维度。
export const DIMENSION_BY_TYPE = Object.freeze({
  restaurant: "dine",
  kitchen: "dine",
  inn: "dine",
  gamblestone: "play",
  theater: "play",
  gambling: "play",
  auction: "play",
  festival: "play",
  escort: "work",
  smithy: "work",
  forge: "work",
  bounty: "work",
  shop: "work",
  grocery: "work",
  antique: "work",
  bank: "work",
  pawn: "work",
  pigeon_coop: "work",
  teahouse: "leisure",
  temple: "leisure",
  library: "leisure",
  wuguan: "leisure",
  cloth: "leisure",
  jewelry: "leisure",
  hospital: "recovery",
  medicine: "recovery",
  blackmarket: "work", // 黑市是见不得光的营生，不是疗伤处——健康商贩在此谋生活，病人也不靠它治
});

export const LIFE_DIMENSIONS = Object.freeze(["dine", "play", "work", "leisure", "recovery"]);

export const DIMENSION_LABEL = Object.freeze({
  dine: "吃吃喝喝",
  play: "娱乐消遣",
  work: "谋生干活",
  leisure: "休闲社交",
  recovery: "救急疗养",
});

// 银囊水位四档：窘迫/寻常/宽裕/肥实。消费门槛——窘迫只去得起平价处，
// 肥实才进得起戏楼包座、玉石料场这类销金窟（用于 npcGoals 选场过滤）。
export const PURSE_TIERS = Object.freeze(["窘迫", "寻常", "宽裕", "肥实"]);

// 建筑类型 → 消费档次门槛（银囊档位下标，0 窘迫起）：低于门槛的人物不进这类场子。
export const TYPE_COST_TIER = Object.freeze({
  restaurant: 0, kitchen: 0, inn: 0,
  grocery: 0, medicine: 0, teahouse: 0, temple: 0, pigeon_coop: 0, wuguan: 0,
  shop: 1, escort: 1, smithy: 1, forge: 1, bounty: 1, bank: 1, pawn: 0, library: 1, cloth: 1,
  hospital: 1, antique: 2, jewelry: 2, gambling: 2, theater: 2, auction: 2,
  gamblestone: 2, blackmarket: 1, festival: 1,
});

// 建筑类型 → 当不得志/银囊窘迫时的反向吸引力：当铺、粗茶、便宜饭馆是窘迫人的去处。
export const TYPE_POOR_AFFINITY = Object.freeze({
  pawn: 3, grocery: 2, teahouse: 2, restaurant: 1, temple: 1,
});

export function dimensionOf(type) {
  return DIMENSION_BY_TYPE[type] || null;
}

// 取一处建筑的地道风物细节：饭馆/酒楼读 SERVICE_MENUS 真实菜名，其余按类型给通用活计。
// 返回 { detail, signature } —— detail 是「正在做什么」的一句白描骨架，signature 是场所风物词。
const GENERIC_DETAIL = Object.freeze({
  inn: "烤火歇脚，要了一碗热茶慢慢喝",
  kitchen: "守着灶台掂勺，锅里热气直冒",
  restaurant: "拣了张靠窗的桌子坐下吃饭",
  gamblestone: "挤在人堆里看解石，跟着起哄",
  theater: "缩在角落听戏，听到妙处跟着哼",
  gambling: "围着赌桌看人家押大小",
  auction: "听拍卖师唱价，看托儿抬价",
  festival: "挤在会场边上瞧热闹",
  escort: "擦着刀等镖单，跟镖头有一搭没一搭地聊",
  smithy: "蹲在炉边看铁匠抡锤，顺手讨教火候",
  forge: "看铸剑师淬水开刃，火星四溅",
  bounty: "凑在告示榜前逐条看悬赏",
  shop: "在货架前挑挑拣拣，跟掌柜讨价还价",
  grocery: "称了半斤干粮，顺手打听行情",
  antique: "对着架上的老物件端详了半天",
  bank: "在柜上清点银钱，核对折子",
  pawn: "抱着包袱在柜台前踌躇，想典当又舍不得",
  pigeon_coop: "逗弄笼里的信鸽，顺手喂了一把粟米",
  teahouse: "泡了一碗粗茶，竖着耳朵听邻桌摆龙门阵",
  temple: "上了一炷香，在殿前静立了片刻",
  library: "趴在架前翻书，看得入神",
  wuguan: "在场子上练拳脚，一招一式比划得认真",
  cloth: "扯了几尺布料在身上比划",
  jewelry: "对着首饰匣子挑拣，爱不释手",
  hospital: "请大夫把脉换药，老实躺着将养",
  medicine: "抓了几服金疮药，跟坐堂的讨教药性",
  blackmarket: "缩着肩膀在暗格里补些见不得光的货",
});

// 一处建筑此刻能提供的「活计」：优先菜谱第一道真菜名，无菜单走类型通用句。
export function affordanceDetail(building) {
  if (!building) return GENERIC_DETAIL.inn;
  const menu = building.menuKey && SERVICE_MENUS[building.menuKey];
  if (menu?.length && ["restaurant", "kitchen", "inn", "teahouse"].includes(building.type)) {
    const dish = menu[0];
    return `点了${dish.name}，正慢悠悠用着`;
  }
  return GENERIC_DETAIL[building.type] || "寻了个角落自忙自的";
}

// 场所招牌风物词（供白描/切片引用）：菜谱第一道或类型标签。
export function signatureOf(building) {
  if (!building) return "";
  const menu = building.menuKey && SERVICE_MENUS[building.menuKey];
  if (menu?.length) return menu[0].name;
  return building.name || "";
}

// 把某据点的建筑按生活维度分桶：{ dine: [b...], play: [...], ... }，无此维度不留键。
export function venuesByDimension(buildings) {
  const out = {};
  for (const b of buildings || []) {
    const dim = dimensionOf(b?.type);
    if (!dim) continue;
    (out[dim] = out[dim] || []).push(b);
  }
  return out;
}

// 银囊档位能否进这类场子：purse 是 0-3 下标。
export function affordable(type, purseTier) {
  const need = TYPE_COST_TIER[type] ?? 1;
  return purseTier >= need;
}
