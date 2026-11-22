import { makeItem, ITEM_CATEGORY } from "../../rules/economy/equipment.js";

// 所有固定商店货品清单。key 对应 qucuoBuildings.js 的 shopKey 字段。
// 货品价格由 makeItem → priceForQuality 统一计算，卖出 = 买价 / 2。
export const QUCUO_SHOPS = {
  唐门暗器: {
    shopName: "唐门暗器铺",
    items: [
      { name: "峨眉刺", category: ITEM_CATEGORY.WEAPON, quality: "蓝" },
      { name: "苗银暗器囊", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝" },
      { name: "毒蝎粉", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "蛇药", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "熊胆解毒丸", category: ITEM_CATEGORY.MISC, quality: "蓝" },
      { name: "假死药", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 15 },
      { name: "百花净毒露", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 15 },
      { name: "铁莲子", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "淬竹袖箭", category: ITEM_CATEGORY.WEAPON, quality: "紫", minRep: 40 },
      { name: "蚕丝防毒衣", category: ITEM_CATEGORY.ARMOR, quality: "紫", minRep: 40 },
      { name: "冰魄解蛊散", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 80 },
    ],
  },
  // 五仙百蛊房（雾隐寨·百蛊药房）。苗疆药房货池，声誉门槛照合稿 6.1：
  // 蓝品 15 起、紫品 40 起、五灵避毒珠 80；溢价/拒售规则在 features/buildings/wuxianShop.js。
  五仙百蛊房: {
    shopName: "五仙百蛊房",
    items: [
      { name: "清瘴丸", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "碧竹吹箭", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "蛇药粉", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "五步断肠散", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 15 },
      { name: "靛蓝百草衫", category: ITEM_CATEGORY.ARMOR, quality: "蓝", minRep: 15 },
      { name: "银铃护腕", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 15 },
      { name: "化瘴清露", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 15 },
      { name: "赤蜈软鞭", category: ITEM_CATEGORY.WEAPON, quality: "紫", minRep: 40 },
      { name: "紫岚织锦甲", category: ITEM_CATEGORY.ARMOR, quality: "紫", minRep: 40 },
      { name: "五灵避毒珠", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", minRep: 80 },
    ],
  },
  // 五仙秘珍坊（雾隐寨·百蛊湿廊内）。门派商坊限量秘货，照合稿 6.2：
  // 金蚕解厄丹需声誉 ≥80 且非敌对；银鳞圣母鞭需 ≥100（声誉上限，一代尊宿；合稿写 140，引擎声誉封顶 100）。
  五仙秘珍坊: {
    shopName: "五仙秘珍坊",
    items: [
      { name: "金蚕解厄丹", category: ITEM_CATEGORY.MISC, quality: "橙", minRep: 80 },
      { name: "银鳞圣母鞭", category: ITEM_CATEGORY.WEAPON, quality: "橙", minRep: 100 },
    ],
  },
  // 丐帮三星分舵·分舵义坊（合稿·丐帮 6.2）。minRep 未到不摆；member 货要拜入，外客按 guestRep。
  三星分舵商坊: {
    shopName: "分舵义坊",
    items: [
      { name: "广汉大锅盔", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "晒干青竹棍", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "粗麻百衲衣", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "驱寒老姜酒", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "铜铃竹哨", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", minRep: 15 },
      { name: "铁头打狗棒", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 15 },
      { name: "察世轻行履", category: ITEM_CATEGORY.ARMOR, quality: "蓝", minRep: 40 },
      { name: "三星叫化鸡", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 40 },
      { name: "紫皮闷倒驴葫芦", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", minRep: 80 },
      { name: "八袋青竹护心甲", category: ITEM_CATEGORY.ARMOR, quality: "紫", minRep: 100 },
    ],
  },
  // 鱼定土司府·土司府军需司（合稿·土司府 6.2）。合稿镇边虎纹玉佩门槛 140，声誉上限 100，收到 100。
  土司军需司: {
    shopName: "土司府军需司",
    items: [
      { name: "巡捕制式短矛", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "牦牛皮护胸", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "官造青稞干粮", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "边军铁柄马刀", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "巡边牛皮镶铁甲", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "土司府云雷铜牌", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", minRep: 15 },
      { name: "藏红花活血膏", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 15 },
      { name: "精钢乌木长矛", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 40 },
      { name: "黑铁札片重甲", category: ITEM_CATEGORY.ARMOR, quality: "紫", minRep: 80 },
      { name: "镇边虎纹玉佩", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", minRep: 100 },
    ],
  },
  // 天龙军需坊（天龙营）。minRep 按天龙教声誉过滤——军需官记账先看脸，声名抵银子。
  // 深交秘货（rep100，合稿写 140、引擎声誉封顶 100）在止戈玉令与陨铁血刃之间二选一，
  // 两条终局路线各得其一——limitOnce 共用同一组标记，买走一件另一件也撤柜。
  天龙军需坊: {
    shopName: "天龙军需坊",
    items: [
      { name: "西域止血散", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "胡杨炭火酒", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "西域弯刀", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "驼绒防风氅", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "狼牙骨哨", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 15 },
      { name: "血槽铁刀", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 15 },
      { name: "西域雪莲清毒丸", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 40 },
      { name: "玄甲护心镜", category: ITEM_CATEGORY.ARMOR, quality: "紫", minRep: 40 },
      { name: "龙纹赤铜战甲", category: ITEM_CATEGORY.ARMOR, quality: "橙", minRep: 80 },
      { name: "止戈玉令", category: ITEM_CATEGORY.ACCESSORY, quality: "橙", minRep: 100, limitOnce: "tianlong_secret" },
      { name: "陨铁血刃", category: ITEM_CATEGORY.WEAPON, quality: "橙", minRep: 100, limitOnce: "tianlong_secret" },
    ],
  },
  // 雅纸铺（雅江）。此前 qucuoBuildings.js 里 shop_yajiang 写了 shopKey: "雅纸铺"，
  // 但这张货池表里没有这个键——玩家进雅纸铺是一间空店。
  // 货品按设计稿第十节：竹青宣 + 竹编器 + 日用，另配青城道门装备（三清殿在这座城）。
  青城商坊: {
    shopName: "青城商坊",
    items: [
      { name: "青城柏香符", category: ITEM_CATEGORY.MISC, quality: "白", minRep: -59 },
      { name: "三清松风铁剑", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 0 },
      { name: "山阴清瘴丹", category: ITEM_CATEGORY.MISC, quality: "绿", minRep: -59 },
      { name: "青城松纹剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 15 },
      { name: "伏龙水雾道袍", category: ITEM_CATEGORY.ARMOR, quality: "蓝", minRep: 15 },
      { name: "玉真青囊针盒", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 15 },
      { name: "紫阳清心散", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 40 },
      { name: "听松玄铁剑", category: ITEM_CATEGORY.WEAPON, quality: "紫", minRep: 40 },
      { name: "三清鹤羽道衣", category: ITEM_CATEGORY.ARMOR, quality: "紫", minRep: 80 },
      { name: "离堆镇水玉佩", category: ITEM_CATEGORY.ACCESSORY, quality: "橙", minRep: 100, member: true, limitOnce: true },
    ],
  },
  峨眉坊: {
    shopName: "峨眉坊",
    items: [
      { name: "素铁峨眉刺", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 0 },
      { name: "白蜡护法枪", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 0 },
      { name: "青布道袍", category: ITEM_CATEGORY.ARMOR, quality: "绿", minRep: -19 },
      { name: "清心避瘴散", category: ITEM_CATEGORY.MISC, quality: "绿", minRep: -59 },
      { name: "净莲木鱼坠", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 15 },
      { name: "流云剑穗袍", category: ITEM_CATEGORY.ARMOR, quality: "蓝", minRep: 15 },
      { name: "金顶净心露", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 40 },
      { name: "素影银簪刺", category: ITEM_CATEGORY.WEAPON, quality: "紫", minRep: 40 },
      { name: "玄清太极佩", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", minRep: 80 },
      { name: "冷月拂柳剑", category: ITEM_CATEGORY.WEAPON, quality: "橙", minRep: 100, member: true, limitOnce: true },
    ],
  },
  雅纸铺: {
    shopName: "雅纸铺",
    items: [
      { name: "竹青宣", category: ITEM_CATEGORY.MISC, quality: "蓝" },
      { name: "青城符箓袋", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "离堆水则牌", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝" },
      { name: "青城练气服", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "青城道袍", category: ITEM_CATEGORY.ARMOR, quality: "蓝" },
      { name: "十三针囊", category: ITEM_CATEGORY.WEAPON, quality: "蓝" },
      { name: "熊山花椒", category: ITEM_CATEGORY.MISC, quality: "绿" },
    ],
  },
  // ── 原有：兼容杂货商人 NPC ──
  杂货商人: {
    shopName: "鱼定村杂货铺",
    items: [
      { name: "鱼定枪", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "熊皮护腕", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "藏地银饰", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "精铁短刀", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
    ],
  },

  // ── 鱼定商号 ──
  鱼定商号: {
    shopName: "鱼定商号",
    items: [
      { name: "制式长刀", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "皮甲背心", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "藏银手镯", category: ITEM_CATEGORY.ACCESSORY, quality: "白" },
      { name: "精铁短刀", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "牛皮软甲", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "青金石吊坠", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
    ],
  },

  // ── 护镖站（防身器具） ──
  护镖站: {
    shopName: "护镖站防身铺",
    items: [
      { name: "防刺护甲", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "短匕首", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "行脚皮靴", category: ITEM_CATEGORY.ARMOR, quality: "白" },
    ],
  },

  // ── 达磨药堂（喇嘛庙势力药堂）──
  // 货单照合稿「喇嘛庙·六、商城设计」10 件：前 4 件常规药剂无门槛，15/40/80 阶梯解锁；
  // 千年雪莲回天丹合稿写 ≥140（一代尊宿），引擎声誉封顶 100，取 100，每局限量 3 颗。拒售规则在 factionShop.js。
  达磨药堂: {
    shopName: "达摩药堂",
    items: [
      { name: "高原酥油膏", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "藏青稞健脾散", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "藏红花活血丸", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "达摩驱寒膏", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "药渍麻布僧袍", category: ITEM_CATEGORY.ARMOR, quality: "绿", minRep: 15 },
      { name: "青竹护法短杖", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 15 },
      { name: "雪莲清毒丸", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 40 },
      { name: "老山檀香护心珠", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 40 },
      { name: "白塔铜鎏金降魔杵", category: ITEM_CATEGORY.WEAPON, quality: "紫", minRep: 80 },
      { name: "千年雪莲回天丹", category: ITEM_CATEGORY.MISC, quality: "橙", minRep: 100, limit: 3 },
    ],
  },

  // ── 孟记铁铺 ──
  孟记铁铺: {
    shopName: "孟记铁铺",
    items: [
      { name: "精铁长剑", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "精铁短刀", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "精铁护手", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "链甲背心", category: ITEM_CATEGORY.ARMOR, quality: "蓝" },
      { name: "铁甲腕护", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
    ],
  },

  // ── 天都镖局 ──
  天都镖局: {
    shopName: "天都镖局防身铺",
    items: [
      { name: "防刺护甲", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "短匕首", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "铁甲腕护", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "皮甲头盔", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
    ],
  },

  // ── 玉器轩 ──
  玉器轩: {
    shopName: "玉器轩",
    items: [
      { name: "翡翠玉佩", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "碧玉扳指", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝" },
      { name: "藏银嵌绿松镯", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝" },
      { name: "白玉如意", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
    ],
  },

  // ── 天下商行 ──
  天下商行: {
    shopName: "天下商行",
    items: [
      { name: "制式长刀", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "精铁长剑", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "青钢斩马刀", category: ITEM_CATEGORY.WEAPON, quality: "蓝" },
      { name: "皮甲背心", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "链甲背心", category: ITEM_CATEGORY.ARMOR, quality: "蓝" },
      { name: "银镶玉戒", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "赤金臂钏", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
    ],
  },

  // ── 锦官镖局 ──
  锦官镖局: {
    shopName: "锦官镖局防身铺",
    items: [
      { name: "精铁护手", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "链甲背心", category: ITEM_CATEGORY.ARMOR, quality: "蓝" },
      { name: "制式腰刀", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "铁叶护甲", category: ITEM_CATEGORY.ARMOR, quality: "蓝" },
    ],
  },

  // ── 云锦成衣铺 ──
  云锦成衣铺: {
    shopName: "云锦成衣铺",
    items: [
      { name: "藏地棉袍", category: ITEM_CATEGORY.ACCESSORY, quality: "白" },
      { name: "锦缎外袍", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "暗花云缎长衫", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝" },
      { name: "织金霞帔", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
    ],
  },

  // ── 金玉行 ──
  金玉行: {
    shopName: "金玉行",
    items: [
      { name: "翠玉手串", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
      { name: "赤金蟠龙佩", category: ITEM_CATEGORY.ACCESSORY, quality: "橙" },
      { name: "星月玉冠", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
      { name: "乌木嵌金护腕", category: ITEM_CATEGORY.ACCESSORY, quality: "橙" },
    ],
  },

  // ── 天都香行（欢喜教明面铺子·礼品/杂货） ──
  天都香行: {
    shopName: "天都香行",
    items: [
      { name: "沉香小饼", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "藏香束", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "茉莉花糕", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "龙涎香囊", category: ITEM_CATEGORY.MISC, quality: "蓝" },
    ],
  },

  // ── 暗巷黑市 ──
  暗巷: {
    shopName: "暗巷黑市",
    karmaLoss: 1,
    items: [
      { name: "铁蒺藜暗器", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "见血封喉毒粉", category: ITEM_CATEGORY.MISC, quality: "蓝" },
      { name: "来路不明的玉佩", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
      { name: "黑铁短戟", category: ITEM_CATEGORY.WEAPON, quality: "蓝" },
    ],
  },

  // ── 永丰粮行 ──
  永丰粮行: {
    shopName: "永丰粮行",
    items: [
      { name: "压缩干粮包", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "青稞饼", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "高原人参", category: ITEM_CATEGORY.MISC, quality: "蓝" },
    ],
  },

  // ── 门派商坊（雪山派）。功德货币改银两，照合稿 §8.1 统一「银两+势力声誉折扣/门槛」；
  // 货单照合稿 6.2 十件：白绿无门槛、蓝品 15、紫品 40、千年冰魄莲 80、霜纹寒玉剑 100（合稿 140，引擎封顶 100）。
  门派商坊: {
    shopName: "雪山派门派商坊",
    items: [
      { name: "雪山姜枣干粮", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "寒岭冻伤膏", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "雪松木剑", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "雪山素棉袍", category: ITEM_CATEGORY.ARMOR, quality: "绿", minRep: 0 },
      { name: "寒铁细剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 15 },
      { name: "雪莲清心丸", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 15 },
      { name: "雪狐绒护肩", category: ITEM_CATEGORY.ARMOR, quality: "紫", minRep: 40 },
      { name: "听雪素玉佩", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", minRep: 40 },
      { name: "千年冰魄莲", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 80 },
      { name: "霜纹寒玉剑", category: ITEM_CATEGORY.WEAPON, quality: "橙", minRep: 100 },
    ],
  },
};

export function buildShopInventory(shopKey) {
  const shop = QUCUO_SHOPS[shopKey];
  if (!shop) return null;
  return {
    shopName: shop.shopName,
    currency: shop.currency || "silver",
    karmaLoss: shop.karmaLoss || 0,
    items: shop.items.map(cfg => ({
      ...makeItem({ name: cfg.name, category: cfg.category, quality: cfg.quality }),
      ...(cfg.minRep == null ? {} : { minRep: cfg.minRep }),
      ...(cfg.member ? { member: true } : {}),
      ...(cfg.limitOnce ? { limitOnce: cfg.limitOnce } : {}),
      ...(cfg.limit ? { limit: cfg.limit } : {}),
    })),
  };
}


// ============================================================================
// 四池铺货 —— rollShopStock：按 region ∩ shopType 从 catalog 抽本地对味的货，
// 每天刷新一次（游戏 time÷24 做随机种子），修掉旧 floating 概率写死 0.5 的 bug。
// 依赖：items/distribution.js（每件货的归属）+ items/regionMap.js（店铺档案/品阶权重）
//       + items/catalog.js（makeNamedItem 取具名货吃专属数值）。
// ============================================================================
import { ITEM_DISTRIBUTION } from "../items/distribution.js";
import { SHOP_PROFILE, TIER_PROFILE } from "../items/regionMap.js";
import { CATALOG_INDEX, makeNamedItem } from "../items/catalog.js";

// 稳定的字符串→整数哈希，给"店铺+第几天"造一个确定性种子（同一天同一店货单固定）
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// mulberry32：种子→[0,1) 伪随机，可复现
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 品阶→在某档店的"出摊基础概率"。tierProfile 是该档店对各品阶的偏好权重，
// 直接拿来当每件货的出现概率：低阶店里蓝档 0.10 → 蓝货一成机会出摊。
function chanceForQuality(quality, tierName) {
  const prof = TIER_PROFILE[tierName] || TIER_PROFILE["中"];
  return prof[quality] != null ? prof[quality] : 0.05;
}

// 该店的候选货名单：region 命中 且 shopTypes 任一命中 的 catalog 可上架商品
function candidatesFor(region, shopTypes) {
  const wanted = Array.isArray(shopTypes) ? shopTypes : [shopTypes];
  const names = [];
  for (const [name, tag] of Object.entries(ITEM_DISTRIBUTION)) {
    if (!tag.regions.includes(region)) continue;
    if (!tag.shopTypes.some(s => wanted.includes(s))) continue;
    if (!CATALOG_INDEX[name]) continue; // 防脏名
    names.push(name);
  }
  return names;
}

/**
 * 按四池规则滚动某店当天的货单。
 * @param {string} shopKey   qucuoBuildings 里的店铺 key
 * @param {number} gameTime  当前游戏时辰计数（time state）。同一天内多次进店货单不变。
 * @returns {{shopName, currency, karmaLoss, items}|null}
 */
export function rollShopStock(shopKey, gameTime = 0) {
  const profile = SHOP_PROFILE[shopKey];
  const legacy = QUCUO_SHOPS[shopKey];
  // 没进四池档案的店（特殊功能店等）回退旧固定逻辑，保证不崩
  if (!profile) return legacy ? buildShopInventory(shopKey) : null;

  const day = Math.floor((gameTime || 0) / 24);           // 每 24 时辰 = 1 天
  const rng = mulberry32(hashSeed(shopKey + "@" + day));   // 当天该店的确定性随机流
  const { region, shopTypes, tier } = profile;

  const pool = candidatesFor(region, shopTypes);
  const picked = [];
  // floating：逐件按"各自品阶概率"掷骰（修掉旧写死 0.5 的 bug）
  for (const name of pool) {
    const entry = CATALOG_INDEX[name];
    const p = chanceForQuality(entry.quality, tier);
    if (rng() < p) picked.push(name);
  }
  // 招牌货 fixed：该店本地货里，取品阶最低的 1~2 件永远在架，给玩家稳定预期
  if (picked.length === 0 && pool.length) {
    const QORD = { 白: 0, 绿: 1, 蓝: 2, 紫: 3, 橙: 4, 红: 5 };
    const sorted = [...pool].sort((a, b) => QORD[CATALOG_INDEX[a].quality] - QORD[CATALOG_INDEX[b].quality]);
    picked.push(sorted[0]);
    if (sorted[1]) picked.push(sorted[1]);
  }
  // 上限：店越高阶货越多，避免一屏塞太多
  const cap = tier === "高" ? 14 : tier === "中" ? 10 : 7;
  const finalNames = picked.slice(0, cap);

  return {
    shopName: (legacy && legacy.shopName) || shopKey,
    currency: (legacy && legacy.currency) || "silver",
    karmaLoss: (legacy && legacy.karmaLoss) || 0,
    items: finalNames.map(n => makeNamedItem(n)).filter(Boolean),
  };
}
