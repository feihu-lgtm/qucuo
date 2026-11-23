import { ITEM_CATEGORY } from "../../rules/economy/equipment.js";

export const shopsA = {
  // 跑马大会外围集市（总纲 v3 4.1）：锦官商号/土特产/小礼物/食品/药品，
  // 摊型收成一家商行货架，不设声誉门槛。
  跑马集市: {
    shopName: "跑马集市",
    items: [
      { name: "烤羊腿", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "青稞酒", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "牦牛皮护腕", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "金疮药", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "鎏银发簪", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "绣纹荷包", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "风干牦牛肉", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "安神香囊", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝" },
      { name: "锦官琉璃珠", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝" },
      { name: "雪山当归", category: ITEM_CATEGORY.MISC, quality: "蓝" },
    ],
  },
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
      { name: "七星绣针匣", category: ITEM_CATEGORY.WEAPON, quality: "橙", minRep: 100, limitOnce: true },
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
  // 黑风货栈（黑风寨·山寨货栈）。义匪货池：清水药与口粮随便买，
  // 15 起上刀口货、40 起发寨里制式装备（重铠与断刃只给入伙弟兄）、80 摆镇仓的犀牛皮重甲（只此一件）。
  黑风货栈: {
    shopName: "黑风货栈",
    items: [
      { name: "苞谷酒", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "风干牦牛肉", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "黑风寨金疮药", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "黑风寨草药包", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "老阿雅婶的止咳散", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "结绳护腕串", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "黑风短矛", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "黑风寨土烧", category: ITEM_CATEGORY.MISC, quality: "绿", minRep: 15 },
      { name: "毒蝎粉", category: ITEM_CATEGORY.MISC, quality: "绿", minRep: 15 },
      { name: "马帮硬皮褂", category: ITEM_CATEGORY.ARMOR, quality: "绿", minRep: 15 },
      { name: "黑风寨出征席", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 15 },
      { name: "厚背大砍刀", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 15 },
      { name: "红缨枪", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 15 },
      { name: "黑风寨分发刀", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 40 },
      { name: "黑风寨牛皮重铠", category: ITEM_CATEGORY.ARMOR, quality: "紫", minRep: 40, member: true },
      { name: "黑风断刃", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 40, member: true },
      { name: "犀牛皮重甲", category: ITEM_CATEGORY.ARMOR, quality: "红", minRep: 80, limitOnce: true },
    ],
  },
  // 锦官兵备（锦官城·都事府兵备库）。官仓货池：白货随便买，15 起摆差役
  // 制式、40 起发府里制式装备（标兵甲只发特派巡查）、80 摆御赐銮铃（只此一件）。
  锦官兵备: {
    shopName: "都事府兵备库",
    items: [
      { name: "锦官城官袍", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "乡勇木棓", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "乡勇布甲", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "锦官巡街棍", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "镖师护腕", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "锦官文思膏", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "锦官城红烧牦牛肉", category: ITEM_CATEGORY.MISC, quality: "蓝" },
      { name: "巡捕营皂隶衣", category: ITEM_CATEGORY.ARMOR, quality: "绿", minRep: 15 },
      { name: "巡捕营制式腰刀", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 15 },
      { name: "锦官烧刀子", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 15 },
      { name: "锦官精铁剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 15 },
      { name: "紫铜护心镜", category: ITEM_CATEGORY.ARMOR, quality: "绿", minRep: 15 },
      { name: "锦官制式软甲", category: ITEM_CATEGORY.ARMOR, quality: "蓝", minRep: 40 },
      { name: "锦官坊标兵剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 40 },
      { name: "锦官验讫牙牌", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 40 },
      { name: "锦官续命丹", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 40 },
      { name: "锦官坊标兵甲", category: ITEM_CATEGORY.ARMOR, quality: "蓝", minRep: 40, member: true },
      { name: "御赐銮铃", category: ITEM_CATEGORY.ACCESSORY, quality: "红", minRep: 80, member: true, limitOnce: true },
    ],
  },
  // 三星派·古墟秘藏阁（合稿·三星派 6.2）。声誉 < 15 不摆货；声誉上限 100，合稿 ≥140 的镇阁剑收到 100、限购一次。
  三星秘藏: {
    shopName: "古墟秘藏阁",
    items: [
      { name: "绿锈青铜剑", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 15 },
      { name: "粗布护心藤甲", category: ITEM_CATEGORY.ARMOR, quality: "绿", minRep: 15 },
      { name: "古蜀艾草宁神香", category: ITEM_CATEGORY.MISC, quality: "绿", minRep: 15 },
      { name: "听风柳叶铜剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 15 },
      { name: "墨麻轻行衣", category: ITEM_CATEGORY.ARMOR, quality: "蓝", minRep: 40 },
      { name: "青铜纵目护符", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 40 },
      { name: "归墟凝神丹", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 40 },
      { name: "古铜重剑", category: ITEM_CATEGORY.WEAPON, quality: "紫", minRep: 40 },
      { name: "玄麻祭天袍", category: ITEM_CATEGORY.ARMOR, quality: "紫", minRep: 80 },
      { name: "神鸟金纹剑", category: ITEM_CATEGORY.WEAPON, quality: "橙", minRep: 100, limitOnce: true },
    ],
  },
  // 玉泉茶马货栈（玉泉寨·茶马古道中转站，合稿·玉泉寨 六）。白品日用人人有，
  // 声誉 15/40/80 摆好物，rep100 深交出百年雪水青稞陈酿（合稿限购两坛，limit:2 计次撤柜）。
  玉泉货栈: {
    shopName: "玉泉茶马货栈",
    items: [
      { name: "狼曲酥油炒面", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "牦牛粪饼", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "羊皮护腿", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "绿松石铜戒", category: ITEM_CATEGORY.ACCESSORY, quality: "白" },
      { name: "牧羊短刀", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "草原驯马长鞭", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 15 },
      { name: "雪羊皮软甲", category: ITEM_CATEGORY.ARMOR, quality: "绿", minRep: 15 },
      { name: "巴登跌打接骨膏", category: ITEM_CATEGORY.MISC, quality: "绿", minRep: 40 },
      { name: "索朗精锻牧刀", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 40 },
      { name: "狼牙护心铜镜", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", minRep: 80 },
      { name: "百年雪水青稞陈酿", category: ITEM_CATEGORY.MISC, quality: "橙", minRep: 100, limit: 2 },
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

  // ── 鱼定商号（鱼定村势力商号，周铭章掌柜）──
  // 货单照合稿「鱼定村·六、6.1」12 件：原有 6 件无门槛，新增 6 件按 15/40/80 阶梯；
  // 三曲通商路引合稿写 ≥140，引擎声誉封顶 100，取 100，限购 1 件。拒售规则在 factionShop.js。
  西头药铺: {
    shopName: "西头药铺",
    items: [
      { name: "金疮药", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "止血散", category: ITEM_CATEGORY.MISC, quality: "白" },
    ],
  },
};
