// ============================================================================
// 曲措乡·物资流通 —— 地域 / 店型 / 品阶权重映射表（四池的第一层地基）
// ----------------------------------------------------------------------------
// 本文件只管"分类归属"，不碰任何数值。配合 distribution.js（每件货的标签）
// 与 qucuoShops.js 的 rollShopStock 一起，实现"横向店型 × 纵向地域 × 品阶权重"
// 抽货。设计依据：docs/物品分配设计.md、docs/物品四维分布总表与空缺.md。
// ============================================================================

// ── 六类地域（region）──────────────────────────────────────────────
// 一件货可属多个 region（见 distribution.js 的 regions 数组）。
export const REGIONS = ["村镇", "市镇", "官城", "宗教", "门派", "山野", "异域"];
// 注：设计文档原列六类，此处把"异域"（大理/天竺/欢喜堂/百花楼苗疆）单列，
// 因其民族货色自成一系，混进上述六类会串味，故实际用七类。

// ── 据点 → region 映射 ──────────────────────────────────────────────
// key 用 qucuoMap 里的据点名。游走 NPC 按当前落脚据点反查。
export const DISTRICT_REGION = {
  鱼定村: "村镇",
  玉泉寨: "村镇",
  鱼定土司: "官城",   // 土司府仪卫制式，归官城档
  天都镇: "市镇",
  锦官城: "官城",
  喇嘛庙: "宗教",
  白塔: "宗教",
  雪山派: "门派",
  黑风寨: "山野",
  大草甸: "山野",
  熊山: "山野",
  贡措海: "山野",
  // 异域据点
  百花楼: "异域",
  欢喜堂: "异域",
  大理: "异域",
};

// ── 店型（shopType）── 决定"哪类店卖哪类货" ──────────────────────────
export const SHOP_TYPES = [
  "杂货铺", "铁铺", "药堂", "粮食铺", "成衣皮货", "当铺古玩", "金玉", "门派坊", "官市", "香料",
];

// ── shopKey → { region, shopType, tier } ────────────────────────────
// tier: 低/中/高，决定品阶权重档（见 TIER_PROFILE）。
// region 让同一家店只抽本地货；shopType 让它只抽对味的品类。
// shopTypes 用数组：真实店铺多为"综合店"，一家可覆盖多个品类。
// region ∩ (shopTypes 任一命中) 的货即入该店候选池。
export const SHOP_PROFILE = {
  // 鱼定村（村镇·低阶）——村里就那几家，卖的杂
  杂货商人:   { region: "村镇", shopTypes: ["铁铺", "当铺古玩", "粮食铺", "药堂"], tier: "低" },
  鱼定商号:   { region: "村镇", shopTypes: ["铁铺", "成衣皮货", "当铺古玩", "金玉"], tier: "低" },
  护镖站:     { region: "村镇", shopTypes: ["成衣皮货", "铁铺"], tier: "低" },
  // 喇嘛庙（宗教·中阶）——药堂+佛门器物
  达磨药堂:   { region: "宗教", shopTypes: ["药堂", "当铺古玩", "粮食铺"], tier: "中" },
  // 天都镇（市镇·中阶）
  孟记铁铺:   { region: "市镇", shopTypes: ["铁铺", "成衣皮货"], tier: "中" },
  天都镖局:   { region: "市镇", shopTypes: ["成衣皮货", "铁铺"], tier: "中" },
  玉器轩:     { region: "市镇", shopTypes: ["当铺古玩", "金玉"], tier: "中" },
  暗巷:       { region: "市镇", shopTypes: ["当铺古玩", "铁铺", "药堂"], tier: "中" },  // 黑市：古玩+来路不明兵器+地下药
  永丰粮行:   { region: "市镇", shopTypes: ["粮食铺", "药堂"], tier: "中" },
  // 锦官城（官城·高阶）
  天下商行:   { region: "官城", shopTypes: ["铁铺", "当铺古玩", "粮食铺", "药堂", "成衣皮货"], tier: "高" }, // 综合大商行
  锦官镖局:   { region: "官城", shopTypes: ["成衣皮货", "铁铺"], tier: "高" },
  云锦成衣铺: { region: "官城", shopTypes: ["成衣皮货"], tier: "高" },
  金玉行:     { region: "官城", shopTypes: ["金玉", "当铺古玩"], tier: "高" },
  百香斋:     { region: "官城", shopTypes: ["药堂", "香料", "粮食铺"], tier: "高" }, // 香料点心+药
  // 雪山派（门派·中阶）——门派坊全包
  门派商坊:   { region: "门派", shopTypes: ["铁铺", "成衣皮货", "药堂", "粮食铺", "当铺古玩"], tier: "中" },
};

// ── 品阶权重档（tierProfile）── 每档一套六品阶概率，合计=1 ────────────
// 低阶点几乎只出白绿；高阶点才可能滚出紫橙红。抽货时按此档给每件定档。
export const TIER_PROFILE = {
  低: { 白: 0.60, 绿: 0.30, 蓝: 0.10, 紫: 0.00, 橙: 0.00, 红: 0.00 },
  中: { 白: 0.20, 绿: 0.40, 蓝: 0.30, 紫: 0.10, 橙: 0.00, 红: 0.00 },
  高: { 白: 0.05, 绿: 0.20, 蓝: 0.35, 紫: 0.30, 橙: 0.08, 红: 0.02 },
};

// ── NPC 身份（role）→ 携带风格 ──────────────────────────────────────
// rollNpcCarry 用：决定这个 NPC 抽什么品类、抽几件、什么档。
// count: [最少, 最多] 件；cats: 可携带的物品类别；tier: 品阶档。
export const ROLE_CARRY = {
  平民:     { count: [0, 2], cats: ["MISC", "ACCESSORY"],                 tier: "低" },
  武人:     { count: [1, 3], cats: ["WEAPON", "ARMOR", "MISC"],           tier: "中" },
  高手:     { count: [1, 3], cats: ["WEAPON", "ARMOR", "ACCESSORY"],      tier: "高" },
  宗教:     { count: [0, 2], cats: ["ACCESSORY", "MISC"],                 tier: "中" },
  官吏:     { count: [1, 2], cats: ["WEAPON", "ARMOR", "ACCESSORY"],      tier: "中" },
  江湖闲杂: { count: [0, 1], cats: ["MISC", "ACCESSORY"],                 tier: "低" },
};

// levelCap（1~5）→ role 兜底：residentNpcs/npcDescriptionMapping 没给 role 时用它推
export function levelCapToRole(levelCap) {
  if (levelCap >= 4) return "高手";
  if (levelCap >= 2) return "武人";
  return "平民";
}

// 据点名反查 region（游走 NPC 用当前据点）；查不到给"村镇"兜底
export function regionOf(district) {
  return DISTRICT_REGION[district] || "村镇";
}
