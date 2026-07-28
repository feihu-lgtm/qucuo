// ============================================================================
// 曲措乡·百物录 —— 具名物品库（catalog）
// ============================================================================
//
// 【定位】这是"具名物品"的权威数据源。跟 equipment.js 的关系：
//   - equipment.js 的 statsForQuality/priceForQuality 是"匿名兜底公式"——
//     路途随机掉落、AI 临时生成的无名装备走那套（同品质同数值）。
//   - 本文件是"具名覆盖层"——霜牙、青鸢这类有来历的物品，吃自己的专属数值，
//     不再跟同品质的杂鱼一个数。查表命中具名 → 用这里的值；查不到 → 回退公式。
//
// 【攻防倍率 atkMul / defMul】用户拍板"倍率跟着公式走"：倍率不是新的乘法层，
//   而是乘在 equipment.js 公式算出的品质基准上，最终仍折成 equipAtk/equipDef
//   这个"加数"进 calcBaseDamage（见 makeCatalogItem）。范围 1.0~1.6 横跨六品阶：
//   同品质里，越贵重/越点题的物品倍率越高，但不会离谱到破坏同档平衡。
//     atk 基准(equipment.js WEAPON)：白7 绿12 蓝20 紫34 橙59 红100
//     def 基准(equipment.js ARMOR)：白5 绿9 蓝15 紫26 橙46 红80
//   例：红档"霜角"配 atkMul 1.6 → equipAtk = round(100×1.6)=160。
//
// 【特效 effect】用户拍板"直接复用武学标志位"。这里挂的字段名必须是
//   combat/resolveTurn.js 真正读取的那批（否则是死字段）。可复用白名单：
//     forceFirst 必先手 / ignoreDefense 无视防御 / doubleVsStatus 克状态翻倍
//     enemyCostPenalty 封穴(抬高对方耗气) / applyMark 内伤印 / detonateMark 引爆内伤
//     freezeEnergyRecovery 封气 / onCounterSuccessDamageRatio 应对反击
//     lowHpBonus 残血增伤 / afterStatusBonus 趁中招追击 / energyRestore 起手回气 …
//   物品的 effect 会在进入战斗时，被 combat 层当作"这件装备赋予的临时招式效果"
//   叠加到玩家/NPC 的对应招式上（接线见 equipment.computeEquippedStats 的扩展）。
//   注意：effect 只在"装备类"（武器/护甲/饰品）上有意义，且高品阶才配，低品阶留空。
//
// 【加六维 sixDim】特效的另一种形态（a特效 / b加六维，二选一为主）：
//   直接加 char.special 的七维（根骨/悟性/体魄/魅力/智谋/身法/气运），
//   数值小而克制（+1~+4），装备时生效、卸下时移除（接线同 effect）。
//
// 【AI 可读】文件末尾导出 CATALOG_INDEX（name→条目）和 describeCatalogForAI()，
//   后者把全部具名物品压成一段给主叙事 AI 看的参考文本，让 AI 知道"这个世界
//   里有哪些叫得出名字的物件、分别是什么来历/品级"，叙事时可以自然引用，
//   但 AI 只能引用/描述，不能篡改数值（数值永远由本表 + 公式裁决）。
// ============================================================================

import { ITEM_CATEGORY } from "../equipment.js";

// 特效类型速查（给维护者看，值本身直接用 resolveTurn 认的字段名）：
// 攻击向：forceFirst / ignoreDefense / doubleVsStatus / lowHpBonus / afterStatusBonus / detonateMark
// 控制向：enemyCostPenalty / freezeEnergyRecovery / applyMark
// 防御向：onCounterSuccessDamageRatio / onCounterSuccessEnergyGain
// 续航向：energyRestore / hpRestore

// ---------------------------------------------------------------------------
// 一、武器（20）
// ---------------------------------------------------------------------------
// 结构：{ name, category, quality, atkMul, effect?, sixDim?, desc }
//  - category 固定 weapon；effect/sixDim 二选一（也可都无，纯靠倍率吃饭）
//  - 白绿档基本只有倍率；蓝档偶有轻特效；紫橙红档才挂强特效或六维
export const WEAPONS = [
  {
    name: "霜牙", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.25,
    effect: { applyMark: { name: "内伤印", stacks: 1 }, applyMarkChance: 0.25 },
    desc: "刀身泛青，刃口一道白线如冻痕。在熊山温泉边淬过，出鞘时刀锋上总凝着一层薄霜——被它划中的伤口，寒气会往骨头缝里钻。",
  },
  {
    name: "狼骨匕", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.15,
    effect: { lowHpBonus: 0.15 },
    desc: "大草甸狼王腿骨打磨，握柄保留关节的天然弧度。刀刃吃进皮肉时骨头会发出极细的呜咽——越是见血，握刀的手越稳。",
  },
  {
    name: "折柳", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.3,
    sixDim: { 身法: 2 },
    desc: "剑身薄可弯绕，平时藏在腰间如一条银线。剑胚在柳枝上挂了三年，沾过春天的露水才开刃，出手轻灵不带风声。",
  },
  {
    name: "牧云", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.35,
    desc: "刀背厚刀刃薄，刀柄缠牦牛皮绳。玉泉寨老铁匠打了三个月，说这刀不是用来杀人的——是用来切开狼曲河谷的晨雾。",
  },
  {
    name: "雪鸮翎", category: ITEM_CATEGORY.WEAPON, quality: "紫", atkMul: 1.4,
    effect: { forceFirst: true }, sixDim: { 身法: 2 },
    desc: "六枚飞刀如鸟翎排列，用雪山雪鸮的翼骨磨成，轻得离谱，打出去没有风声——快到对手听见破空声时，刀已在身上。",
  },
  {
    name: "断念", category: ITEM_CATEGORY.WEAPON, quality: "紫", atkMul: 1.5,
    effect: { ignoreDefense: true }, sixDim: { 体魄: 1 },
    desc: "无锋，通体漆黑。巴桑从锦官城佣兵头子手里缴来，剑身刻着半句诗“断念如断骨”，后半句被磨平了——势大力沉，寻常护甲卸不去分毫。",
  },
  {
    name: "狼曲旧猎叉", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.1,
    desc: "扎西用了二十年的猎叉，叉尖歪了，叉杆被手汗浸得发亮。不好看，但刺出去的时候杆子会自己找到最省力的角度。",
  },
  {
    name: "百花刺", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.3,
    effect: { applyMark: { name: "内伤印", stacks: 1 }, applyMarkChance: 0.35 },
    desc: "峨眉刺一对，兰姐年轻时用过，刺尖淬过百花引残料，见血封不住伤口——但抹了蜜敷一夜就能合拢。她后来再没用过。",
  },
  {
    name: "梵铃杵", category: ITEM_CATEGORY.WEAPON, quality: "紫", atkMul: 1.35,
    effect: { freezeEnergyRecovery: true },
    desc: "梵衍那从天竺带来的旧物，杵身刻梵文六字，摇起来铃声沉得不像铜。铃响之处，对手真气一滞，欢喜堂弟子起誓时左手按杵，铃不响则誓不成。",
  },
  {
    name: "熊山猎刀", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.2,
    desc: "鱼定村猎户人手一把的制式刀，但每把刀柄刻痕不同——有人刻正字记猎获，有人刻横线记年头，老猎户那把刻的是“莫追”。",
  },
  {
    name: "青鸢", category: ITEM_CATEGORY.WEAPON, quality: "橙", atkMul: 1.55,
    effect: { enemyCostPenalty: { value: 2, turns: 2 } }, sixDim: { 智谋: 2 },
    desc: "柳青鸢的随身软鞭，鞭梢系一枚青铜鸢鸟，甩出去时鸟喙会叼住目标——被缠上的人手脚发滞，出招愈发迟涩。她练鞭时抽断三棵柳树，从此院里只剩柏。",
  },
  {
    name: "孟记铁锤", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.15,
    desc: "天都镇孟铁匠打铁的手锤，锤头包浆厚得像石头。他不卖——但说要是谁能用这把锤打出比“霜牙”更好的刀，锤子就送谁。",
  },
  {
    name: "大草甸套索", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.05,
    effect: { enemyCostPenalty: { value: 1, turns: 1 } },
    desc: "牧民套马用的牦牛皮索，索头坠一枚铅扣。阿索能在二十步外套住牦牛角——套中的对手挣脱前，先乱一记手脚。",
  },
  {
    name: "雪山松纹剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.3,
    sixDim: { 悟性: 1, 身法: 1 },
    desc: "雪山派弟子的标准佩剑，剑身有松木纹理。练功堂墙上挂着几十把，剑穗颜色各不同——呼延雪那把系的是白穗。",
  },
  {
    name: "贡措冰晶", category: ITEM_CATEGORY.WEAPON, quality: "紫", atkMul: 1.4,
    effect: { applyMark: { name: "内伤印", stacks: 2 }, applyMarkChance: 0.4 }, sixDim: { 悟性: 1, 气运: 1 },
    desc: "贡措海深处的矿石碎片，投水会沉底，握久了会化——不是冰，是盐。用它打人，伤口一辈子舔不咸，暗伤缠身难愈。",
  },
  {
    name: "黑风断刃", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.2,
    effect: { lowHpBonus: 0.2 },
    desc: "巴桑十年前从巡捕营手里夺来的第一把刀，断了三寸。他没修，挂在岩洞里——“断了才知道哪里最薄”，越是绝境这刀越狠。",
  },
  {
    name: "金珠算盘", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.25,
    sixDim: { 智谋: 2 },
    desc: "锦官城永盛钱庄老掌柜的遗物，每颗算珠都是铜胎鎏金。拨起来声音清脆，砸在人身上也是同一个声音——算得清账，也算得准人。",
  },
  {
    name: "藏银护手钩", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.2,
    effect: { onCounterSuccessDamageRatio: 0.3 },
    desc: "玉泉寨练武场的对练双钩，钩身藏银，钩尖钝了磨、磨了钝。李若由小时候拿它练过，钩柄上还有她咬的牙印——擅接不擅攻。",
  },
  {
    name: "古藤杖", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.1,
    sixDim: { 悟性: 1 },
    desc: "喇嘛庙达摩药堂师父的拐杖，藤条来自熊山深处，杖头被药汁浸成深褐色。走山路时杖尾会探石头缝——不是找路，是找药。",
  },
  {
    name: "霜角", category: ITEM_CATEGORY.WEAPON, quality: "橙", atkMul: 1.6,
    effect: { forceFirst: true, detonateMark: { perStackRatio: 0.4 } }, sixDim: { 身法: 2 },
    desc: "吊睛虎王骨长错位增生的一块硬骨，形如角。虎王撞断过一棵松树，骨裂愈合后多长这块，从此别的虎再不敢进那片松林——势不可挡，专破暗伤。",
  },
];

// ---------------------------------------------------------------------------
// 二、装备·衣甲（20）
// ---------------------------------------------------------------------------
// 护甲的特效重心天然落在"防御/反击/续航/挨打后变强"，不跟武器抢输出。
// defMul 范围同样 1.0~1.6 横跨六品阶，乘在 ARMOR def 基准（白5→红80）上。
// 高温放飞：几件故意玩"反常识"——越破越硬、越被打越回气、穿上像别人的味道。
export const ARMORS = [
  {
    name: "青布长衫", category: ITEM_CATEGORY.ARMOR, quality: "橙", defMul: 1.5,
    sixDim: { 魅力: 2, 智谋: 2 },
    effect: { onCounterSuccessEnergyGain: 2 },
    desc: "柳青鸢穿了六年的旧衣，袖口拆过三回线。上司送她时说“做了官不用天天穿官袍——脱了官袍，才知道百姓要什么”。不挡刀，却让人不忍向你落刀。",
  },
  {
    name: "雪豹裘", category: ITEM_CATEGORY.ARMOR, quality: "紫", defMul: 1.55,
    effect: { freezeEnergyRecovery: true },
    sixDim: { 体魄: -1 },
    desc: "雪山派内堂旧物，雪豹皮毛缝制，内衬火浣布。何雨谢年轻时穿过，后来收进箱底——太重了，穿不动。裘上寒气逼人，近身者气息为之一凝，可它自己也压得人喘不过。",
  },
  {
    name: "氆氇藏袍", category: ITEM_CATEGORY.ARMOR, quality: "绿", defMul: 1.2,
    effect: { hpRestore: 0.08 },
    desc: "玉泉寨牧民日常穿着，牦牛毛粗呢，厚实挡风。袍摆常年沾着草屑和牛粪味——牧民说这是“干净的味道”，裹着它，风雪里也能慢慢缓过一口气。",
  },
  {
    name: "百香纱衣", category: ITEM_CATEGORY.ARMOR, quality: "蓝", defMul: 1.3,
    effect: { enemyCostPenalty: { value: 1, turns: 2 } },
    desc: "罗琦的防身之物，在百花引香料里浸过四十九天，刀砍上来先闻到一股异香，近身者神思一晃。她不喜欢穿——说穿上像裹了一层别人的味道。",
  },
  {
    name: "熊皮坎肩", category: ITEM_CATEGORY.ARMOR, quality: "绿", defMul: 1.25,
    desc: "鱼定村猎户冬天的短坎肩，皮板硬得能立在地上。老猎户那件肩头一道抓痕——他说是熊抓的，其实是被媳妇拿擀面杖打的。",
  },
  {
    name: "锦官制式软甲", category: ITEM_CATEGORY.ARMOR, quality: "蓝", defMul: 1.35,
    effect: { onCounterSuccessDamageRatio: 0.25 },
    desc: "都事府差役标配，内衬百层棉纸叠压，外罩青布。柳青鸢上任后重改版型——旧版卡腋下，拔刀慢一拍；新版挨了刀还能顺势反手一记。",
  },
  {
    name: "百褶皮围", category: ITEM_CATEGORY.ARMOR, quality: "白", defMul: 1.1,
    desc: "黑风寨女眷自缝的牛皮围裙，褶子密得像扇面。嘎则那件下摆绣了只白老虎——绣得很丑，雪团看了直打喷嚏。",
  },
  {
    name: "欢喜法衣", category: ITEM_CATEGORY.ARMOR, quality: "紫", defMul: 1.4,
    effect: { applyMark: { name: "内伤印", stacks: 1 }, applyMarkChance: 0.3, applyMarkOnHit: true }, sixDim: { 魅力: 2 },
    desc: "欢喜堂内院礼袍，暗红底子，金线绣着梵衍那家乡的旧神像。罗琦那件压在箱底——神像的眼睛绣错了，不该睁着。谁打这袍子，谁沾一身说不清的暗伤。",
  },
  {
    name: "狼裘大氅", category: ITEM_CATEGORY.ARMOR, quality: "蓝", defMul: 1.3,
    effect: { lowHpBonus: 0.12 },
    desc: "大草甸狼皮缝制，领口镶银狐毛。刀疤镖师年轻时穿过，破了三处洞舍不得补——每个洞都是一趟差点没回来的镖。血流得越多，狼性越烈。",
  },
  {
    name: "丹增旧骑装", category: ITEM_CATEGORY.ARMOR, quality: "绿", defMul: 1.2,
    sixDim: { 身法: 2 },
    desc: "丹增年轻时跑马的装束，右手指关节处被马缰勒出凹痕。三十年前摔马后收起来，卓玛偷偷拿去染坊重新染色——染完还是旧的那抹藏蓝。上马利落，下盘却总带着那年摔的伤。",
  },
  {
    name: "百花楼绸衣", category: ITEM_CATEGORY.ARMOR, quality: "蓝", defMul: 1.25,
    sixDim: { 魅力: 3 },
    desc: "兰姐待客的衣裳，苏州绸缎，袖口绣百花。她说这衣服不能沾酒——沾过一次花色晕开，客人说更好看，她把那件扔了。穿着它，话都好说三分。",
  },
  {
    name: "鱼定粗布短打", category: ITEM_CATEGORY.ARMOR, quality: "白", defMul: 1.05,
    desc: "鱼定村男女日常的短打衣裤，粗糙但透气。才旦穿的时候永远把袖子卷到手肘——她说露手腕好干活，其实是嫌袖口碍事。",
  },
  {
    name: "雪山练功服", category: ITEM_CATEGORY.ARMOR, quality: "白", defMul: 1.1,
    effect: { energyRestore: 1 },
    desc: "雪山派弟子练功专用，轻薄，肩肘膝盖加厚一层。呼延雪那套洗得发白，何雨谢说给她换新的，她说不用——旧的不磨皮，运气更顺。",
  },
  {
    name: "守塔僧袍", category: ITEM_CATEGORY.ARMOR, quality: "绿", defMul: 1.3,
    effect: { ignoreDefensePartialImmune: 0.3 },
    desc: "白塔守塔僧团特制，夹层衬细铁网防机关暗箭。袍子重，夏天穿不住——但地宫四季阴冷，铁网总是冰的。硬招砸上来，也卸得掉几分。",
  },
  {
    name: "锦官城官袍", category: ITEM_CATEGORY.ARMOR, quality: "白", defMul: 1.0,
    sixDim: { 魅力: 1, 智谋: -1 },
    desc: "都事府官吏标配，大一号，袖口挽两圈。柳青鸢私下从不穿——穿上就像戴了个面具，面具是给上面人看的。唬得住外人，却让自己人生分。",
  },
  {
    name: "马帮油布斗篷", category: ITEM_CATEGORY.ARMOR, quality: "白", defMul: 1.1,
    effect: { hpRestore: 0.05 },
    desc: "天都镇马帮通用雨具，桐油浸过的粗布，雨天硬得像铁皮，晴天软塌塌挂马鞍上。阿旺那件背后印着“鹰曲马帮”，褪到只剩“马”字——遮风挡雨，聊胜于无。",
  },
  {
    name: "喇嘛庙绛红袈裟", category: ITEM_CATEGORY.ARMOR, quality: "绿", defMul: 1.2,
    effect: { hpRestore: 0.1 },
    desc: "喇嘛庙僧人日常袈裟，绛红，右肩袒露。达摩药堂师父那件左肩一块深色药渍，洗了十年还在——“不是药渍，是那年给都事治腰伤时溅上的当归汤”。药气养身，缓缓回血。",
  },
  {
    name: "格桑花染布衣", category: ITEM_CATEGORY.ARMOR, quality: "绿", defMul: 1.15,
    sixDim: { 气运: 2 },
    desc: "嘎则自己染的衣裳，用后山格桑花瓣捣汁上色。染三次才染出淡紫，一下雨就掉色，掉到最后变成粉白——她说更好看。穿着它，运气也软软的。",
  },
  {
    name: "孟记皮护腕", category: ITEM_CATEGORY.ARMOR, quality: "白", defMul: 1.1,
    effect: { onCounterSuccessEnergyGain: 1 },
    desc: "孟铁匠顺手做的皮护腕，三层牛皮叠缝，系带马尾编的。刀疤镖师戴了五年断了三根系带——他说这护腕比他的手腕值钱。架招稳，接得住劲。",
  },
  {
    name: "猞猁皮帽", category: ITEM_CATEGORY.ARMOR, quality: "绿", defMul: 1.15,
    sixDim: { 气运: 1, 魅力: 1 },
    desc: "大草甸猞猁皮缝制，耳位留两个毛球。阿索冬天戴，毛球在风里一颤一颤，牦牛看了都多嚼两口草——不是喜欢，是觉得像另外两头小牦牛。",
  },
];

// ---------------------------------------------------------------------------
// 三、饰品（20）
// ---------------------------------------------------------------------------
// 饰品不占攻防主战场（accessory 没有 atk/def 基准，只有小 bonus），
// 所以它的价值几乎全在 sixDim（加六维）和 effect（挂武学特效）上——这是最能
// 放飞的一类。高温玩法：情感信物给气运/魅力这类"软"属性；邪门物件挂控制/封气；
// 残念执念之物玩残血博弈；甚至几件"负重"物件——强特效配一点属性反噬，让玩家权衡。
// atkMul 对饰品无意义（无武器基准），故饰品不写 atkMul/defMul，只写 effect/sixDim。
export const ACCESSORIES = [
  {
    name: "旧护身符", category: ITEM_CATEGORY.ACCESSORY, quality: "绿",
    sixDim: { 气运: 2 },
    desc: "锦官城镖师遗孀赵氏给亡夫求的，他戴了二十年。临死前托人送到你手里——符袋上还有他最后攥过的手温。护得住命，护不住命数。",
  },
  {
    name: "虎乳牙", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝",
    effect: { lowHpBonus: 0.2 },
    sixDim: { 体魄: 1 },
    desc: "嘎则的白虎雪团换下的乳牙，根部用她辫子上的彩线缠了一圈。她说是借的——你若真不还，她会托巴桑带话：“利息是一包桂花糖”。越到绝境，虎性越壮。",
  },
  {
    name: "红线", category: ITEM_CATEGORY.ACCESSORY, quality: "白",
    sixDim: { 魅力: 1 },
    desc: "藏汉婚事上新娘卓嘎塞给你的。熊曲、鹰曲、狼曲三水都流进一条曲水——水都不分家。手绳编得不太齐，是她连夜赶出来的。",
  },
  {
    name: "界石下的土", category: ITEM_CATEGORY.ACCESSORY, quality: "白",
    sixDim: { 气运: 1 },
    desc: "才旦从村口界石底座下捧的一小撮土，装在小布袋里。不是武功，不是财物，是有人在这地方站过。布袋口系着她自己的头发。",
  },
  {
    name: "半块银锁片", category: ITEM_CATEGORY.ACCESSORY, quality: "绿",
    sixDim: { 智谋: 1, 气运: 1 },
    desc: "卓央阿妈留下的银锁，兄妹各执一半。断口是旧痕，背面刻着“央”，巴桑那半块刻着“桑”。合在一起才看得出——不是锁，是只鹰。（黑风寨据点解锁凭证）",
  },
  {
    name: "青鸢私印", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝",
    sixDim: { 智谋: 2, 魅力: 1 },
    desc: "柳青鸢的私人小印，印文只有“青鸢”二字。她把印按在纸上递给你：“拿去找罗琦，她认得我的字”。印纽雕的是一只收翅的鸟。持此印，江湖人高看一眼。",
  },
  {
    name: "狼曲石子", category: ITEM_CATEGORY.ACCESSORY, quality: "白",
    sixDim: { 体魄: 1 },
    desc: "一颗被狼曲河水冲圆的小石子，嘎则从狼曲石上挑的。她在手心握了很久才递给你，石头是温的——“那块石头的儿子，带它去山下见见世面”。",
  },
  {
    name: "百花引残香囊", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝",
    effect: { enemyCostPenalty: { value: 2, turns: 1 } },
    sixDim: { 悟性: -1 },
    desc: "兰姐用百花引残料缝的香囊，她自己不留——闻久了会忘了自己是谁。内衬绣了朵兰花，用她年轻时在昆明穿的旧裙线。香气缠人，也蚀心神。",
  },
  {
    name: "旧铜镜", category: ITEM_CATEGORY.ACCESSORY, quality: "紫",
    effect: { onCounterSuccessDamageRatio: 0.4 },
    sixDim: { 悟性: 2 },
    desc: "梵衍那故国王宫遗物，背面刻宫室图，细如发丝。罗琦每三天擦一次，不照自己——镜里的自己会越来越像阿雅婶，但镜背的人永远十九岁。以镜观敌，破绽尽显。",
  },
  {
    name: "熊山手绘地图", category: ITEM_CATEGORY.ACCESSORY, quality: "白",
    sixDim: { 悟性: 1, 气运: 1 },
    desc: "老猎户亲手画的熊山地形图，标注温泉位置。不是羊皮纸——是旧年历的反面，边角还印着“庚子年·宜出行”。识途者不慌。",
  },
  {
    name: "达摩药堂念珠", category: ITEM_CATEGORY.ACCESSORY, quality: "绿",
    effect: { hpRestore: 0.06 },
    desc: "喇嘛庙药堂师父常挂的旧念珠，珠子被药汁浸成琥珀色。捻了十几年，有一颗裂了——“裂了就不用补，珠子里住进了药香”。捻珠调息，暗自回血。",
  },
  {
    name: "铃铛", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝",
    effect: { freezeEnergyRecovery: true },
    desc: "嘎则辫子上系过的铃铛，响声不脆，闷闷的。她解下来给你时铃舌已经歪了——是雪团咬歪的，虎牙刚好卡进铃铛缝。铃声一闷，对手的调息乱了半拍。",
  },
  {
    name: "玉器轩断簪", category: ITEM_CATEGORY.ACCESSORY, quality: "白",
    sixDim: { 魅力: 1 },
    desc: "天都镇玉器轩的旧玉簪，簪头雕如意云纹，断了一小截。掌柜说是个老牧民拿来当的，当期过了没赎——后来听说老牧民是扎西的阿爸。",
  },
  {
    name: "守宫砂", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝",
    effect: { applyMark: { name: "内伤印", stacks: 1 }, applyMarkChance: 0.25 },
    desc: "白塔守塔僧团的护身符，形如一滴干涸朱砂。兰姐收来当百花引辅料，但有一颗怎么也化不开——“这颗不是砂，是执念”。执念附身，触之留痕。",
  },
  {
    name: "燕羊胎石", category: ITEM_CATEGORY.ACCESSORY, quality: "绿",
    effect: { hpRestore: 0.05 },
    sixDim: { 魅力: 1 },
    desc: "大草甸燕羊胎里取出的小石子，光滑如卵。百花楼的姑娘们贴身带一颗——不是催情，是它在体温下会散发极淡奶香，治痛经比药好，也养神。",
  },
  {
    name: "青铜鸢", category: ITEM_CATEGORY.ACCESSORY, quality: "橙",
    effect: { enemyCostPenalty: { value: 2, turns: 2 }, onCounterSuccessEnergyGain: 2 },
    sixDim: { 智谋: 2 },
    desc: "柳青鸢软鞭的鞭梢铜坠，雕成收翅青鸢。老兵说她装了这坠后再没抽断过树枝——不是准头好了，是不忍心让鸟喙再啄树。缠敌于无形，收放皆在一念。",
  },
  {
    name: "藏银耳坠", category: ITEM_CATEGORY.ACCESSORY, quality: "白",
    sixDim: { 魅力: 2 },
    desc: "卓玛十六岁生日扎西托人从锦官城打的一对，银丝绕成狼曲河湾的形状。她舍不得戴，红布包着压枕头底下三年——直到发现左坠被压弯才赶紧戴上。",
  },
  {
    name: "鸡足山贝叶经残片", category: ITEM_CATEGORY.ACCESSORY, quality: "紫",
    effect: { energyRestore: 2 },
    sixDim: { 悟性: 3 },
    desc: "梵衍那从大理带来的旧经残叶，纸缘焦黑，兵燹中抢出。他不让任何人碰——罗琦说那上面的梵文不是经文，是他母亲的名字。诵之凝神，真气自生。",
  },
  {
    name: "黑风寨木牌", category: ITEM_CATEGORY.ACCESSORY, quality: "白",
    sixDim: { 魅力: 1, 气运: 1 },
    desc: "巴桑给过路人的通行木牌，刻着狼头印记，刀法粗朴。背面歪歪扭扭刻着“说话算话”——嘎则刻的，巴桑嫌丑，但每块木牌都用了。持牌行走狼曲，无人为难。",
  },
  {
    name: "老兵烟斗", category: ITEM_CATEGORY.ACCESSORY, quality: "白",
    effect: { lowHpBonus: 0.1 },
    desc: "老兵退伍汉用了十几年的烟斗，斗钵磕掉一小块瓷。他说是战场上磕的——趴地上装死，烟斗硌着胸口，敌人走过去他才敢翻身。烟斗还在，敌人不在了。命悬一线时，反而稳。",
  },
];

// ---------------------------------------------------------------------------
// 翡翠玉器成品（20）——赌石系统产出/金玉行雕琢的成品，词条预制（对照
// docs/赌石_玉器与原石设计.md §1）。玉非利器，武器类靠"礼器/法器/暗器"立意；
// 护甲玉甲重身；饰品走增益与气运。白绿档基本只倍率，蓝档起才带特效/六维。
// jadeWare:true 标记它是"玉器成品"身份，供金玉行"选购成品/预制打造"柜台按此筛货。
// ---------------------------------------------------------------------------
export const JADE_WARES = [
  // 武器类（7）
  { name: "翠玉扳指", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.2, jadeWare: true, effect: { applyMark: { name: "崩弦", stacks: 1 }, applyMarkChance: 0.2 }, desc: "扳指本是拉弓扣弦的护手，起于商周。这枚翠玉扳指戴在拇指上，拉弓时增了几分力，射出的劲里裹着一丝内伤。" },
  { name: "玉柄峨眉刺", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.3, jadeWare: true, effect: { forceFirst: true }, desc: "玉柄薄刺，贴身暗器，出手快过眼。玉料温润衬着刺尖森寒，握在掌心不起眼，抖手便已及喉。" },
  { name: "秧苗绿玉笏", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.3, jadeWare: true, sixDim: { 智谋: 2 }, desc: "笏板本是朝堂礼器，绿中带黄的秧苗绿为色之上品。执笏如执理，压人一头，未动手先怯了对方三分。" },
  { name: "玉钺", category: ITEM_CATEGORY.WEAPON, quality: "紫", atkMul: 1.45, jadeWare: true, effect: { ignoreDefense: true }, desc: "玉钺是仪仗玉兵器，象征刑杀之权。斧钺加身，甲胄如无物，劈下时连玉带风都是肃杀的。" },
  { name: "冰种玉簪", category: ITEM_CATEGORY.WEAPON, quality: "紫", atkMul: 1.4, jadeWare: true, effect: { applyMark: { name: "寒芒", stacks: 2 }, applyMarkChance: 0.35 }, desc: "冰种通透泛蓝，簪尖淬骨。看似寻常发簪，斜插鬓边，取命时才知是暗器。" },
  { name: "玻璃种翠钺·秧王", category: ITEM_CATEGORY.WEAPON, quality: "橙", atkMul: 1.55, jadeWare: true, named: true, effect: { ignoreDefense: true, detonateMark: { perStackRatio: 0.35 } }, desc: "老坑玻璃种满绿，翠色浓得如秧田之王。钺落无视防御，并引爆此前种下的内伤印，一击之下旧伤新创齐发。" },
  { name: "帝王绿玉圭·三曲", category: ITEM_CATEGORY.WEAPON, quality: "红", atkMul: 1.6, jadeWare: true, named: true, effect: { forceFirst: true, doubleVsStatus: true }, sixDim: { 气运: 2 }, desc: "圭为祭天礼器。传出自雪山老坑，帝王绿满色无绺。执之如执三曲之水，先声夺人，克敌于滞。" },
  // 护甲类（6）
  { name: "缀玉皮护腕", category: ITEM_CATEGORY.ARMOR, quality: "绿", defMul: 1.2, jadeWare: true, effect: { hpRestore: 0.06 }, desc: "牛皮护腕缀几片碎玉，贴腕生温。算不得宝物，胜在日夜贴着脉门，暗里养着一口血气。" },
  { name: "玉璜项饰", category: ITEM_CATEGORY.ARMOR, quality: "蓝", defMul: 1.25, jadeWare: true, sixDim: { 魅力: 1, 气运: 1 }, desc: "玉璜半璧之形，佩饰之属，垂在颈前护住咽喉要害，也护住体面。" },
  { name: "糯冰玉牌·护心", category: ITEM_CATEGORY.ARMOR, quality: "蓝", defMul: 1.3, jadeWare: true, effect: { onCounterSuccessEnergyGain: 2 }, desc: "一块糯冰种玉牌垂在心口，挡下的每一记都化作一口真气回胸。" },
  { name: "白玉璧", category: ITEM_CATEGORY.ARMOR, quality: "紫", defMul: 1.5, jadeWare: true, effect: { freezeEnergyRecovery: true }, desc: "玉璧祭地礼器，圆孔含天。近身者气息被这一圈寒玉冻住，回气不得。" },
  { name: "满绿玉铠片", category: ITEM_CATEGORY.ARMOR, quality: "紫", defMul: 1.5, jadeWare: true, effect: { onCounterSuccessDamageRatio: 0.3 }, sixDim: { 体魄: -1 }, desc: "整片满绿玉打磨的铠甲，沉。挡得住，也压得慌，每挡一记反手更狠。" },
  { name: "玻璃种玉衣·雪敛", category: ITEM_CATEGORY.ARMOR, quality: "橙", defMul: 1.55, jadeWare: true, named: true, effect: { hpRestore: 0.1, freezeEnergyRecovery: true }, desc: "千片玻璃种玉以金丝缀成，仿古玉衣。寒气自养，敌气自封，穿之如裹一身雪。" },
  // 饰品类（7）
  { name: "豆种玉平安扣", category: ITEM_CATEGORY.ACCESSORY, quality: "白", jadeWare: true, sixDim: { 气运: 1 }, desc: "最寻常的豆种，一枚平安扣。护不了什么，图个心安。" },
  { name: "翡翠玉镯·温润", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", jadeWare: true, sixDim: { 魅力: 2 }, desc: "扁条玉镯，环佩叮当。种水一般，胜在通身温润，久戴生光。" },
  { name: "灵芝玉如意", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", jadeWare: true, sixDim: { 气运: 2, 智谋: 1 }, desc: "如意由笏与搔杖演变，S形灵芝首，明清鼎盛，祈福禳安。握之诸事称心。" },
  { name: "秧苗绿玉佩", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", jadeWare: true, effect: { lowHpBonus: 0.15 }, desc: "秧苗绿佩玉贴身，越是绝境越是烫。祖辈说这玉认主，护到最后一口气。" },
  { name: "冰种翡翠珠串", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", jadeWare: true, effect: { energyRestore: 2 }, sixDim: { 悟性: 1 }, desc: "十八子冰种珠串，捻珠静气，起手先饱一口真元。" },
  { name: "帝王绿玉观音", category: ITEM_CATEGORY.ACCESSORY, quality: "橙", jadeWare: true, named: true, effect: { hpRestore: 0.06 }, sixDim: { 气运: 3, 魅力: 1 }, desc: "满色帝王绿雕观音，男戴观音。玉养人，人养玉，佩久生光，气运随身。" },
  { name: "老坑玻璃种·三曲同源璧", category: ITEM_CATEGORY.ACCESSORY, quality: "红", jadeWare: true, named: true, effect: { onCounterSuccessDamageRatio: 0.2 }, sixDim: { 气运: 3, 悟性: 2 }, desc: "传为雪山老坑一块巨料所出，种水到顶，内有三缕色根如熊鹰狼三曲交汇。持之心明眼亮，后发制人。" },
];

// 四、杂货·药材食品（20）
// ---------------------------------------------------------------------------
// 归 misc（杂物），大多不进战斗结算，是叙事道具 / 任务辅料 / 商品。少数带
// consumable 字段的是"可服用消耗品"——用户"食材食品1-6"里第5、6批的雏形，
// 本轮先把即时效果占位（hpRestore/energyRestore/临时六维），战斗内外皆可用，
// 待食物 buff 系统（交接任务4）接通后正式生效。tags 标注它在世界里的用途，
// 供商店铺货和 AI 引用（辅料/毒药/燃料/信物类）。
export const SUNDRIES = [
  { name: "雪山当归", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["药材", "疗伤"], consumable: { hpRestore: 0.15 }, desc: "喇嘛庙达摩药堂自采的稀有药材，根部还带雪泥。治的不是骨伤，是骨碎后遗症——能忍住痛的人吃了才见效。" },
  { name: "欢喜丹", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["迷香", "邪物", "任务"], desc: "欢喜堂炼制的迷香丸，外裹金箔。取一丸投茶，饮者神志渐弛，逢人辄笑。罗琦说这不是毒——是让不快乐的人暂时忘了自己不快乐。" },
  { name: "百花引", category: ITEM_CATEGORY.MISC, quality: "橙", tags: ["蛊香", "剧情核心", "虎胆三重门"], desc: "兰姐炼的蛊香，闻过的人会言听计从。她炼成后没给自己用——封在瓷瓶里，瓶底压张字条：“此物害人。炼者自慎。”" },
  { name: "安息香", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["香料", "安神"], consumable: { energyRestore: 2 }, desc: "波斯传来经天竺入大理的香料，闻之安神。欢喜教每月从锦官城进三斤，账面写“供佛”——他们的佛不闻香，闻香的是人。" },
  { name: "曼陀罗花", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药材", "致幻", "毒"], desc: "缅甸传来的药材，适量止痛，过量致幻。罗琦十六岁学配药拿自己试过一次——看到阿妈在河对岸招手，但那条河是假的。" },
  { name: "迦南脂", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["香料", "炼丹辅料"], desc: "天竺供神的树脂香，梵衍那用它炼欢喜丹。他说供神的香和控制人的药是同一种东西，区别只是用量——罗琦一直不确定这是狡辩还是禅机。" },
  { name: "冰片", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["药材", "提神"], consumable: { energyRestore: 1 }, desc: "提神醒脑的寻常药材。罗琦发现冰片和曼陀罗按三比一研磨外敷能止血——她试了三回，前两回敷自己胳膊上，第三回才敢给别人用。" },
  { name: "陈皮", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食材", "遗物"], desc: "罗琦母亲留下的最后一包陈皮，存了好几年。她煮过几次红豆沙都没煮出阿妈的味道，后来不煮了——陈皮不是调料，是遗物。" },
  { name: "醒神丹", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["丹药", "提神"], consumable: { energyRestore: 3 }, desc: "罗琦配的提神丹，比武招贤时给连胜三场的对手备着。“不是怕你晕，是怕你晕了之后说我下药——我没下，但没人信。”" },
  { name: "虎骨酒", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["药酒", "疗伤"], consumable: { hpRestore: 0.2, sixDimTemp: { 体魄: 1 } }, desc: "老猎户泡的药酒，用熊山温泉水和吊睛虎王胫骨泡了三年。不能多喝——喝多了骨头会痒，痒到想跑进熊山再打一头虎。" },
  { name: "牦牛粪饼", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["燃料", "日用"], desc: "玉泉寨牧民家家户户晒的燃料饼，摊在寨口牧场晒成圆饼。阿索说新来的外乡人以为是大饼掰了一小块——后来他笑了一整天，牦牛也跟着哞了一天。" },
  { name: "青稞酒", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["酒", "食品", "信物"], consumable: { hpRestore: 0.08 }, desc: "卓玛泡的狼骨青稞酒，在狼骨坛里闷了三个月。“你尝一口，这是我阿爸的谢礼——但酒是我泡的”，说完把碗放桌上，没递，让你自己端。" },
  { name: "老孙饭馆的糌粑", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "主食"], consumable: { hpRestore: 0.1 }, desc: "老孙学做的藏式糌粑，头几次硬得能当暗器扔。后来鱼定大娘手把手教，第七回终于不硬了——但没人告诉他，糌粑本来就是粗的。" },
  { name: "桂花糖", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "零嘴", "信物"], consumable: { energyRestore: 1, sixDimTemp: { 魅力: 1 } }, desc: "锦官城百香斋总号的招牌糖果，嘎则存了三个月舍不得吃。后来被雪团偷了一颗，虎舌头舔过糖纸湿了一大片，她追着白虎跑了半个山寨。" },
  { name: "虎糖草", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食材", "兽食"], desc: "狼曲下游特有的甜根草，雪团每年春天要去吃一次。嘎则说那草根嚼起来像甘蔗但更韧——咬不断，只能含着，雪团含草根的样子像在叼自己的尾巴。" },
  { name: "老阿雅婶的止咳散", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药材", "止咳"], consumable: { hpRestore: 0.06 }, desc: "黑风寨老阿雅婶自配的草药粉，用熊山贝母和雪山枇杷叶碾成。寨里人冬天咳了一喝就好——不好喝，苦得雪团闻到都打喷嚏。" },
  { name: "孟记铁铺淬火油", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["材料", "锻造"], desc: "天都镇孟铁匠自制淬火油，配方保密。他说不是油好，是熊山的水冷——淬出的刀刃有细密羽毛纹，叫“雪羽”。" },
  { name: "格桑花籽", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["种子", "信物"], desc: "嘎则从后山草坡收的花籽，包在旧布里。“这花哪都能活，石头缝里也能长——但不是撒在哪都开。不开的地方，说明那地方不喜欢花。”" },
  { name: "狼王牙", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["兽材", "任务", "辅料"], desc: "银灰独眼狼王的犬齿，咬合力能碎牦牛腿骨。老牧民说这牙不能留——留着别的狼会闻到气味，以为这片草甸还有狼王，不敢来。" },
  { name: "老猎户陷阱绳", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["工具", "狩猎"], desc: "老猎户自编的陷阱套索，用熊山野山羊筋和牦牛尾毛。力道刚好套住虎脚踝——太紧伤筋，太松挣脱，力道要对，像跟山握手。" },
  // ── 吊睛虎王掉落素材（一头虎王三样分取：虎胆入药/抵税/炼蛊——虎胆三重门；
  //    虎牙+虎筋制弓——虎啸支线。两条线共用同一头虎王，猎杀后按需分取，不冲突）──
  { name: "虎胆", category: ITEM_CATEGORY.MISC, quality: "橙", tags: ["兽材", "剧情核心", "虎胆三重门", "药引"], desc: "吊睛虎王的胆，比拳头还大，青黑发亮。何雨谢入药拔阴毒要它、扎西献土司抵税要它、兰姐炼百花引要它——三方都盯着这一颗胆。取胆要趁虎王咽气前那口热乎，凉了药性就散。" },
  { name: "虎王牙", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["兽材", "制弓", "虎啸支线"], desc: "吊睛虎王的獠牙，一对，根部还连着齿龈。咬合力能碎牦牛腿骨，老猎户说这牙做弓梢装饰最好——不为好看，为的是让拉弓的人记得这弓是从什么东西身上来的。" },
  { name: "虎王筋", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["兽材", "制弓", "虎啸支线"], desc: "吊睛虎王后腿的大筋，韧得刀都难断。三十年前那个无名猎户的弓胎，等的就是这么一根弦——他等了三年没等到，老猎户替他等到了。" },

  // ── 食品药品100件（消耗品系统第5步录入，2026-07-21）──
  // 字段只用 useConsumable 已支持的：hpRestore/energyRestore/dispel/dispelAll/
  // rebirthOnce/sixDimTemp/combatBuff/hpRestoreOverTime。涂抹武器类已按第4步砍为
  // 纯回血，跳回合回满(安魂香)简化为 hpRestore:1.0，全队席面降级为只对自己。
  { name: "止血散", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["药材", "疗伤"], consumable: { hpRestore: 0.1 }, desc: "鱼定村药摊最常见的止血药粉，粗布包着，撒伤口上辣得人龇牙——但血确实停了。" },
  { name: "金疮药", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["药材", "疗伤"], consumable: { hpRestore: 0.12 }, desc: "比止血散贵三文，多一味熊山白及，药粉细得像面粉。老巡捕说这药“撒上去不疼——不是不疼，是疼在肉里”。" },
  { name: "三七活血散", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药材", "疗伤"], consumable: { hpRestore: 0.18 }, desc: "玉泉寨牧民用土三七根晒干碾粉，专治牦牛踩伤。人也能用——就是药性猛，敷上去先疼后麻。" },
  { name: "熊山续骨膏", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药材", "疗伤"], consumable: { hpRestore: 0.2 }, desc: "老猎户的独门膏药，熊骨熬胶配雪山续断。骨折敷七天能扶墙走——但拆膏药时那股熊油味三天散不掉。" },
  { name: "雪山当归丸", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["丹药", "疗伤"], consumable: { hpRestore: 0.25 }, desc: "达摩药堂师父手工搓的药丸，每颗裹一层蜂蜡。咬开蜡皮，当归味冲得眼泪都要下来。" },
  { name: "锦官续命丹", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["丹药", "疗伤"], consumable: { hpRestore: 0.35 }, desc: "杏林医馆的镇馆方子，三蒸三晒，一颗丹药要熬七天。柳青鸢腰伤发作时老兵偷偷给她买过一颗——她吃了半颗，剩下半颗留给“更需要的”。" },
  { name: "大草甸鹿胎膏", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["药膏", "疗伤"], consumable: { hpRestore: 0.3, sixDimTemp: { 体魄: 2 } }, desc: "大草甸深处梅花鹿的胎衣熬制，牧民说这膏“不是给人吃的，是给还能救的人吃的”。微腥，回甘。" },
  { name: "百花续命散", category: ITEM_CATEGORY.MISC, quality: "橙", tags: ["丹药", "疗伤", "任务"], consumable: { hpRestore: 0.45, hpRestoreOverTime: { ratio: 0.05, turns: 5 } }, desc: "兰姐用百花引残料反炼的解毒续命散——蛊能害人，也能救人，区别只在剂量和心意。" },
  { name: "贡措冰蟾丸", category: ITEM_CATEGORY.MISC, quality: "红", tags: ["丹药", "疗伤", "稀世"], consumable: { hpRestore: 0.6, dispelAll: true }, desc: "贡措海冰窟里偶现的冰蟾，通体透明如琉璃。炼成丸药只有三颗——一颗救命，一颗换命，第三颗留给故事的结局。" },
  { name: "薄荷醒神叶", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["药材", "提神"], consumable: { energyRestore: 1 }, desc: "晒干的野薄荷叶，放嘴里嚼，辣味窜上脑门——人醒了大半，嘴里像含了一把针。" },
  { name: "参须茶包", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["药材", "提神"], consumable: { energyRestore: 2 }, desc: "锦官城清风茶馆的标配，拇指大一包参须碎末，泡三道水就没味了——但头一道是真提神，账房先生全靠它撑到月底。" },
  { name: "天麻提气散", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药材", "提神"], consumable: { energyRestore: 3 }, desc: "达摩药堂师父采的野生天麻，切片晒干研粉。他说这不是药——是让修行人打坐时不至于睡着的“提醒”。" },
  { name: "马帮醒神油", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药油", "提神"], consumable: { energyRestore: 3 }, desc: "马帮走夜路用的薄荷脑樟脑油，抹太阳穴上凉得人一激灵。阿旺说用多了上瘾——“不是瘾，是没它你不敢走夜路”。" },
  { name: "鸡足山贝叶露", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["药露", "提神"], consumable: { energyRestore: 5 }, desc: "罗琦从大理带来的配方，贝叶经残片泡安息香水——梵衍那说这配方他小时候见过，但“泡的不是贝叶，是菩提叶”。" },
  { name: "喇嘛庙酥油灯芯丸", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["丹药", "提神"], consumable: { energyRestore: 6 }, desc: "喇嘛庙大殿酥油灯烧剩的灯芯捻成丸，浸在灯油里三年。捻一颗含在舌下，暖意从喉咙一直沉到丹田——住持说这是“佛前借的火”，用完要还。" },
  { name: "寒潭冰魄", category: ITEM_CATEGORY.MISC, quality: "橙", tags: ["奇物", "提神"], consumable: { energyRestore: 8, sixDimTemp: { 根骨: 2 } }, desc: "呼延大侠坠崖处寒潭底凝结的冰晶，含在嘴里不化，只会慢慢变小。凉意透骨，真气自生——他死前含过一颗，撑了三天，没等到人。" },
  { name: "甘草解毒汤", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["药汤", "解毒"], consumable: { dispel: true }, desc: "最寻常的解毒方子，甘草、绿豆、金银花三味煮水。解不了真毒，但能拖一拖。" },
  { name: "蛇药", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药材", "解毒"], consumable: { dispel: true }, desc: "天都镇药摊的蛇药，专治大草甸蝮蛇咬伤。黑乎乎一坨，外敷内服一起用——老牧民说这药不能闻，闻了就吐，吐完就好了。" },
  { name: "熊胆解毒丸", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["丹药", "解毒"], consumable: { dispel: true }, desc: "老猎户用熊胆配的解毒丸，一颗顶十包蛇药。他说熊什么都吃——毒蘑菇、腐肉、毒蛇——从不中毒，熊胆就是山里的万能解药。" },
  { name: "达摩清心丸", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["丹药", "解毒"], consumable: { dispel: true }, desc: "达摩药堂师父专为走火入魔的修行人配的——不是解外毒，是解“心毒”。药丸外面裹了一层金箔，吞下去胃里先凉后暖。" },
  { name: "百花净毒露", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["药露", "解毒"], consumable: { dispelAll: true, hpRestore: 0.15 }, desc: "兰姐说百花引是蛊，反炼之后就是药——“蛊让人听话，药让人自由。你觉得哪个更贵？”" },
  { name: "欢喜除障香", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["熏香", "解毒", "任务"], consumable: { dispelAll: true }, desc: "梵衍那的独门熏香，不是吃的是闻的。燃一寸香，烟走七窍，附体的毒/印/封穴一并逼出——但闻完会想哭，不知道为什么。罗琦说“那是你身体里的东西在跟你告别”。" },
  { name: "雪山冰蚕丝", category: ITEM_CATEGORY.MISC, quality: "橙", tags: ["奇物", "解毒", "稀世"], consumable: { dispelAll: true, hpRestore: 0.4 }, desc: "何雨谢压箱底的救命之物。冰蚕只在雪山顶峰的雪莲心里吐丝，一根丝比头发细，含嘴里能拔一切毒——她说“这东西用一根少一根，雪莲一年只开一朵，一朵只住一条蚕”。" },
  { name: "艾草止血贴", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["药贴", "疗伤"], consumable: { hpRestore: 0.06 }, desc: "鱼定大娘夏天收的艾草晒干捣烂，糊在粗布上。贴伤口上暖烘烘的——不是药效，是艾草自己的温度。" },
  { name: "马帮金创贴", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["药贴", "疗伤"], consumable: { hpRestore: 0.08 }, desc: "马帮用的狗皮膏药，剪成小方块，贴上去撕下来都疼——但中间那三天，伤口不红不肿。" },
  { name: "黑风寨草药包", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药包", "疗伤"], consumable: { hpRestore: 0.12 }, desc: "老阿雅婶配的草药包，捣烂了敷伤口，一股子熊山贝母的苦味。嘎则给雪团敷过一次——白虎舔了一口，打了三个喷嚏。" },
  { name: "守塔僧金疮药", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药材", "疗伤"], consumable: { hpRestore: 0.15 }, desc: "守塔僧团自己配的接骨药，地宫里潮，药粉里加了石灰吸水。敷上去骨头自己知道该往哪个方向长——老僧说这不是药好，是骨头自己想好。" },
  { name: "雪山接骨膏", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["药膏", "疗伤"], consumable: { hpRestore: 0.22, sixDimTemp: { 体魄: 1 } }, desc: "雪山派弟子练功摔断腿的标配。何雨谢说这膏药是呼延大侠年轻时亲口试过方子才定的——他试的时候断了三根肋骨，笑着说“不够疼，再加一味”。" },
  { name: "孟记铁铺烫伤膏", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["药膏", "疗伤"], consumable: { hpRestore: 0.05, dispel: true }, desc: "孟铁匠自己烫了三十年才调出来的方子——蛋清、麻油、冰片，打铁烫伤一抹就不起泡。来买膏的人比来买刀的多。" },
  { name: "牦牛骨髓粉", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["药粉", "强身"], consumable: { sixDimTemp: { 体魄: 1 } }, desc: "玉泉寨牧民熬牦牛骨汤时撇出来的骨髓晒干研粉。喝下去骨头缝里暖烘烘的——阿索说这是“牦牛借给你的力气”。" },
  { name: "熊山参片", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药材", "强身"], consumable: { sixDimTemp: { 体魄: 2, 根骨: 1 } }, desc: "老猎户在熊山北坡挖的野山参，切片含在舌下，参味从舌根慢慢往下渗。他说这根参长了至少二十年——“二十年才长拇指粗，比人活得有耐心”。" },
  { name: "高原红景天", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药材", "强身"], consumable: { sixDimTemp: { 体魄: 1, 身法: 1 } }, desc: "贡措海畔石缝里长的红景天，牧民上高原前嚼一根。丹增说这草根苦得人想骂娘——但骂完了气就顺了，喘不上来的毛病也没了。" },
  { name: "天都大力丸", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["丹药", "强身"], consumable: { sixDimTemp: { 体魄: 3 } }, desc: "天都镇地下药贩子卖的“大力丸”，吃了力大无穷一炷香，然后浑身酸软半天。刀疤镖师说这不是药——是跟你自己的身体借力气，利息很高。" },
  { name: "才旦的薄荷脑", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["药膏", "醒神"], consumable: { sixDimTemp: { 悟性: 1 } }, desc: "才旦算账时擦在太阳穴上的薄荷脑，她说这东西不能多擦——擦多了脑子太清醒，账算得太清楚，会睡不着。" },
  { name: "锦官文思膏", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药膏", "醒神"], consumable: { sixDimTemp: { 悟性: 2 } }, desc: "锦官城科举考生人手一盒的膏药，擦额头上凉丝丝的。李掌柜说他年轻时用过——“没用，该落榜还是落榜，但擦上去感觉自己能中，也算值了”。" },
  { name: "藏经阁线香", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["熏香", "醒神"], consumable: { sixDimTemp: { 悟性: 2, 智谋: 1 } }, desc: "喇嘛庙藏经阁专用的线香，药香里混了安息香和迦南脂。僧人说不点香看不懂经——点了香经文自己会进脑子。住持说那是“心静了，不是香灵了”。" },
  { name: "孔雀胆酒", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["药酒", "奇物", "险物"], consumable: { sixDimTemp: { 根骨: 1, 悟性: 1, 体魄: 1, 魅力: 1, 智谋: 1, 身法: 1, 气运: 1 } }, desc: "兰姐压箱底的“最后手段”——苗疆孔雀胆泡的青稞酒，一滴封喉，兑酒千倍变补药。喝了浑身是胆一炷香，然后吐半盆血。她说“这不是给打架用的，是给打不过还得打的人用的——你最好用不上”。" },
  { name: "假死药", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["丹药", "奇物"], consumable: { rebirthOnce: true }, desc: "天都镇黑市上偶尔能买到的灰色药丸，据说是缅甸传来的。吃了之后心跳慢到摸不出来，伤口不流血——但不是不死，是装死。老兵说战场上这东西能救命，也能害命——装死装过头就是真死。" },
  { name: "狂战丸", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["丹药", "奇物", "任务"], consumable: { combatBuff: { moveMul: 0.5, waigong: 6 } }, desc: "梵衍那从天竺带来的旧方子——曼陀罗花粉配虎骨酒。吃了像发了疯一样不怕疼不怕死，药劲过后浑身散了架。罗琦说这药“是给没有明天的人用的”。" },
  { name: "安魂香", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["熏香", "疗伤"], consumable: { hpRestore: 1.0 }, desc: "喇嘛庙僧人守灵时点的安魂香，闻着闻着就睡着了——醒来骨头缝都是软的，伤口也不疼了。达摩药堂师父说“睡一觉比吃药管用，但香不能老点，点多了会想一直睡下去”。" },
  { name: "忘忧散", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药散", "解毒"], consumable: { dispel: true }, desc: "锦官城药铺最畅销的药——不是治病，是治心病。喝下去什么烦恼都忘了，药效过了烦恼还在，只是没那么疼了。李掌柜说“这不是药，是跟烦恼请了三天假”。" },
  { name: "毒蝎粉", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药粉", "疗伤"], consumable: { hpRestore: 0.1 }, desc: "大草甸石头底下抓的毒蝎晒干研粉。黑风寨的人涂在矛尖上——不是杀人，是让对面知道“这仗打完就算你赢了，回去也得躺半个月”。（毒粉外敷亦可止血生肌。）" },
  { name: "雪盲药水", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["药水", "疗伤"], consumable: { hpRestore: 0.15 }, desc: "雪山派弟子切磋时涂在剑上的药水，不是毒——是雪莲汁混冰片，溅到眼睛里辣得睁不开。何雨谢不赞成用这个，但也没禁过。（雪莲汁本身亦是上好的疗伤药。）" },
  { name: "七十味珍珠丸", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["丹药", "藏药", "稀世"], consumable: { hpRestoreOverTime: { ratio: 0.05, turns: 5 } }, desc: "藏药名方，达摩药堂师父一年只配三颗。珍珠、珊瑚、玛瑙、麝香、藏红花……七十味药材逐一研磨，配一颗要念一整天经——他说不是经让药灵了，是念经的时候手不抖。" },
  { name: "苗疆蛊母", category: ITEM_CATEGORY.MISC, quality: "橙", tags: ["蛊物", "奇物", "任务", "险物"], consumable: { dispelAll: true }, desc: "兰姐从昆明带出来的最后一只蛊母，装在银盒里喂了六年百花引。她说这不是用来害人的——是用来逼人和解的。“两边都中了蛊，就只能坐下来好好说话。反正解药只有一份，不和解就一起死。”" },
  { name: "天竺神油", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药油", "奇物"], consumable: { sixDimTemp: { 魅力: 3, 身法: 1 } }, desc: "梵衍那卖的“天竺神油”，说是檀香油——其实是大理白族的桂花油兑了几滴迦南脂。罗琦每次看他推销都别过脸去偷笑，“他在大理卖这个卖了十年，从来没被人拆穿过”。" },
  { name: "缅甸蛇酒", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["药酒", "疗伤"], consumable: { hpRestore: 0.2, sixDimTemp: { 体魄: 2 } }, desc: "一条缅甸眼镜蛇整条泡在青稞酒里，泡到蛇骨都化了酒还是清的。刀疤镖师说这是真货——他亲眼看见卖酒的人从竹篓里抓活蛇往酒坛里塞，“蛇尾巴扫到坛沿，那人手都不抖”。" },
  { name: "大理白药", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药材", "疗伤"], consumable: { hpRestore: 0.15 }, desc: "罗琦从大理带来的白族秘方，三七、重楼、血竭三味主药。她说这药在大理叫“刀口药”——不是治刀口的，是吃了能顶上刀口的。白族人上山采药前都含一包在嘴里，万一摔了立刻咽下去。" },
  { name: "青稞饼", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "主食"], consumable: { hpRestore: 0.08 }, desc: "玉泉寨牧民的主食，青稞面贴石板上烤到两面焦黄，掰开热气扑脸。阿索说最好的青稞饼是“石头烤的、手掰的、趁热吃的”。" },
  { name: "酥油炒面", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "主食"], consumable: { hpRestore: 0.12 }, desc: "鱼定大娘的拿手——青稞炒面拌牦牛酥油和红糖，搓成团子揣怀里能放三天不坏。她说是给上山的人带的，“山上风硬，吃一口甜的，心就不慌了”。" },
  { name: "牦牛肉包子", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "主食"], consumable: { hpRestore: 0.18 }, desc: "天都行脚楼的招牌。牦牛肉剁碎了拌大葱，皮薄得透光，咬开一包滚烫的肉汁。张商人每次路过必吃两笼——“吃完了再上路，路上想起这味道，就不觉得远了”。" },
  { name: "熊曲鱼汤面", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "主食"], consumable: { hpRestore: 0.2 }, desc: "老孙偶尔从熊曲钓上来的冷水鱼，熬到鱼骨都化了，汤白得像奶。他说这鱼一年只能钓两个月——“不是钓不到，是这两个月鱼最肥，再往后就太瘦了”。" },
  { name: "喇嘛庙罗汉面", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "主食", "素斋"], consumable: { hpRestore: 0.25 }, desc: "喇嘛庙素斋的招牌——十八种素菜切丝盖在面上，浇一勺菌菇熬的高汤。住持说这面是前任经师定下的配菜，“他说和尚吃素不是为了苦，是为了把菜做出肉的味道，还没杀生——这本就是修行”。" },
  { name: "锦官城红烧牦牛肉", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "主食"], consumable: { hpRestore: 0.28 }, desc: "醉仙楼的镇店菜，牦牛腱子肉炖到筷子一夹就散。柳青鸢每次结了大案会犒劳手下吃一顿——她自己不吃，坐在旁边喝茶，说“看你们吃比我自己吃香”。" },
  { name: "贡措海全鱼宴", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["食品", "宴席"], consumable: { hpRestore: 0.4 }, desc: "贡措海的冷水鱼，一条能做四吃——鱼头清蒸、鱼骨炸酥、鱼片生吃蘸山葵、鱼尾红烧。丹增说这鱼一年只吃一次，“吃多了湖里的鱼会少，但少的那几条恰好是你这辈子吃到的最好的几条”。" },
  { name: "风干牦牛肉", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "肉食"], consumable: { hpRestore: 0.08, sixDimTemp: { 体魄: 1 } }, desc: "玉泉寨牧民过冬的口粮，牦牛后腿肉切条风干，硬得能当棍子使。阿索说吃这个有诀窍——含在嘴里不要嚼，让口水慢慢泡软，“一块肉能吃一上午，放牦牛的时候最合适”。" },
  { name: "手抓羊肉", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "肉食"], consumable: { hpRestore: 0.15, sixDimTemp: { 体魄: 2 } }, desc: "天都镇马帮的规矩——走完一趟大镖，全队吃一顿手抓羊肉。白水煮，蘸椒盐，肉要用手撕——刀疤镖师说“刀子切出来的肉有一股铁锈味，手撕的才是人吃的”。" },
  { name: "烤羊腿", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "肉食"], consumable: { hpRestore: 0.22 }, desc: "跑马大会集市上现烤的整条羊腿，孜然和辣椒面撒得厚厚一层。梅朵每年跑完马都要吃半条——“跑马消耗大，不多吃点补不回来”，才旦在旁边说“你每年都这么说，每年都吃一整条”。" },
  { name: "藏香猪烤肉", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "肉食"], consumable: { hpRestore: 0.25, sixDimTemp: { 身法: 2 } }, desc: "雪山派后山散养的藏香猪，吃松果和野菌长大的，烤起来一股松脂香。呼延雪不吃猪肉，但每次烤猪都会站在上风处——“闻闻味道，就当吃过了”。" },
  { name: "辣子牦牛干锅", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "肉食"], consumable: { hpRestore: 0.28 }, desc: "锦官城川菜厨子用朝天椒炒牦牛肉干，辣得人眼泪鼻涕一起流，但筷子停不下来。老兵退伍汉说“吃了这个，什么旧伤都不疼了——不是药效，是嘴里的疼盖过了腰上的疼”。" },
  { name: "虎骨火锅", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["食品", "肉食", "稀世"], consumable: { hpRestore: 0.35, sixDimTemp: { 根骨: 3 } }, desc: "天都镇地下渠道偶尔能弄到的虎骨熬的火锅，整根虎胫骨在红汤里滚，骨髓从骨缝里冒出来凝成一层油。老猎户说这不是吃的——是“把虎王的命煮进汤里，喝一口，虎王的力气就是你的”。" },
  { name: "雪鸡炖松茸", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["食品", "肉食"], consumable: { hpRestore: 0.38, sixDimTemp: { 悟性: 2 } }, desc: "何雨谢亲手炖的雪鸡——雪山顶上的雪鸡，熊山松林的松茸，小火煨一天一夜。呼延雪说师母只炖过三次：掌门下山那次、她走火入魔那次、还有一次她不说。" },
  { name: "百花全羊席", category: ITEM_CATEGORY.MISC, quality: "橙", tags: ["食品", "宴席", "稀世"], consumable: { hpRestore: 0.5, sixDimTemp: { 根骨: 1, 悟性: 1, 体魄: 1, 魅力: 1, 智谋: 1, 身法: 1, 气运: 1 } }, desc: "兰姐请客的最高规格——整只羊用十二种花的香料腌三天，烤一天，切开时花香和肉香一起涌出来。她说这席面不是用来填肚子的，“是让被请的人知道——我在你身上花了三天准备，你也该在我身上花点心思”。" },
  { name: "酥油茶", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "茶饮"], consumable: { energyRestore: 2 }, desc: "藏家日常，砖茶煮开加酥油和盐，用木桶打出来。第一次喝的人觉得咸，喝惯了的人说“不咸的酥油茶不是酥油茶，是奶茶——奶茶是给娃娃喝的”。" },
  { name: "甜奶茶", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "茶饮"], consumable: { hpRestore: 0.06 }, desc: "鱼定大娘专给小孩和不喝酥油茶的外乡人煮的。牛奶、砖茶、红糖，煮到面上结一层奶皮。她说“不喝酥油茶的人有的是，但没人不喝甜的”。" },
  { name: "牦牛骨汤", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "汤羹"], consumable: { hpRestore: 0.12, sixDimTemp: { 体魄: 1 } }, desc: "玉泉寨牧民熬了一夜的牦牛骨汤，骨髓熬化了，汤白得像奶。卓玛说这汤是给病人喝的——“不是药，但比药暖”。" },
  { name: "虫草炖雪鸡汤", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "汤羹"], consumable: { hpRestore: 0.22, sixDimTemp: { 根骨: 2 } }, desc: "达摩药堂师父用药材炖的雪鸡，虫草、贝母、天麻三味配雪山雪鸡。他说这不是药膳——“是让吃药吃怕了的人，换个方式把药吃下去”。" },
  { name: "罗琦的陈皮红豆沙", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "汤羹", "好感"], consumable: { hpRestore: 0.15, dispel: true }, desc: "罗琦用母亲留下的陈皮煮的红豆沙。她只煮过一次——煮的时候香料味从欢喜堂飘到百花楼，兰姐派人来问“谁在煮家乡的东西”。罗琦没回话，盛了一碗让人端过去。" },
  { name: "柳青鸢的菊花茶", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "茶饮"], consumable: { energyRestore: 2, sixDimTemp: { 智谋: 1 } }, desc: "柳青鸢办公桌上永远有一壶菊花茶，凉了也不换。老兵说她喝茶跟办案一样——一小口一小口抿，抿到茶没味了，案子也差不多了。" },
  { name: "梅朵的马奶酒", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "酒", "好感"], consumable: { energyRestore: 4, sixDimTemp: { 魅力: 2 } }, desc: "梅朵自己酿的马奶酒，劲大得老牧民都摇头。她说这酒“喝第一口想吐，第二口想打人，第三口就想唱歌了——你喝到第几口了？”" },
  { name: "黑风寨土烧", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "酒"], consumable: { hpRestore: 0.1, sixDimTemp: { 体魄: 2 } }, desc: "黑风寨自己酿的苞谷酒，嘎则偷喝过一口——辣得她追着雪团跑了三圈，雪团以为在跟它玩，跟着跑，尾巴扫翻了晾药的竹筛。巴桑说这酒是“给难过的人喝的，喝完了头难受，心就不难受了”。" },
  { name: "天都桂花酿", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "酒"], consumable: { energyRestore: 4, sixDimTemp: { 魅力: 2 } }, desc: "天都镇的招牌甜酒，桂花、冰糖、糯米酿，酒味淡得像桂花味的露水。兰姐每次去锦官城前会在天都镇喝一壶——“喝完了，说话都比平时好听三分”。" },
  { name: "锦官烧刀子", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "酒"], consumable: { hpRestore: 0.15, sixDimTemp: { 体魄: 3 } }, desc: "锦官城最烈的酒，一杯下去喉咙像被刀刮过。老兵退伍汉说他喝了三十年——“第一杯是为了壮胆上战场，后来发现战场不需要胆子，需要命。现在喝，是为了想那些命还在的人”。" },
  { name: "梵衍那的芒果酒", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["食品", "酒", "任务"], consumable: { energyRestore: 5, combatBuff: { energyBonus: 3 } }, desc: "梵衍那用缅甸芒果和天竺香料酿的酒，天都镇没人喝得惯——太甜，甜得不像酒。他说这酒在天竺是给要上战场的战士喝的，“甜是让你记住活着是什么味道”。" },
  { name: "百花酿", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["食品", "酒", "好感"], consumable: { hpRestore: 0.2, sixDimTemp: { 魅力: 4 } }, desc: "兰姐亲手酿的百花酒，每朵花是不同季节采的——春天的杜鹃、夏天的栀子、秋天的金桂、冬天的腊梅。她说这一壶就是一年，“喝完一年，又是一年。我在曲措乡喝了六年了”。" },
  { name: "曲措三曲水", category: ITEM_CATEGORY.MISC, quality: "橙", tags: ["食品", "酒", "好感", "稀世"], consumable: { hpRestore: 0.35, sixDimTemp: { 根骨: 2, 悟性: 2, 体魄: 2, 魅力: 2, 智谋: 2, 身法: 2, 气运: 2 } }, desc: "才旦用熊曲、鹰曲、狼曲三水各取一瓢酿的酒——不是手艺，是心意。才旦说这是“鱼定村最后的礼数”，喝的时候她说：“三曲交汇处，就是我等你回来的地方。”" },
  { name: "牦牛奶疙瘩", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "零嘴"], consumable: { hpRestore: 0.04, sixDimTemp: { 体魄: 1 } }, desc: "玉泉寨牧民把牦牛奶发酵晒干做成的硬疙瘩，酸得人皱眉。阿索说这是他阿妈留下的味道——“阿妈走了以后，我再没吃过这么酸的奶疙瘩，别人的都没她的酸”。" },
  { name: "松子糖", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "零嘴"], consumable: { energyRestore: 1, sixDimTemp: { 身法: 1 } }, desc: "熊山松林里采的松子，裹一层麦芽糖。呼延雪口袋里总揣两颗——不是自己吃，是碰到雪山派的松鼠时喂的，“那只松鼠认识我了，见到我会翻口袋”。" },
  { name: "蜜渍青梅", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "零嘴"], consumable: { hpRestore: 0.05, dispel: true }, desc: "罗琦在大理学的手艺，青竹梅用蜂蜜渍三个月，酸里带甜还有一丝咸。她说这是“大理的味道——大理没有冬天，四季都是青梅熟了又青，青了又熟”。" },
  { name: "酥油曲奇", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "零嘴"], consumable: { hpRestore: 0.08, sixDimTemp: { 魅力: 2 } }, desc: "鱼定商号偶尔从锦官城进的“洋点心”，牦牛酥油做的曲奇饼。鱼定大娘吃了一口说“这不就是糌粑加糖烤干了嘛”，然后悄悄跟杂货商人订了三包。" },
  { name: "核桃糕", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "零嘴"], consumable: { hpRestore: 0.1, sixDimTemp: { 悟性: 2 } }, desc: "锦官城清风茶馆配茶的糕点，核桃仁、红糖、麦芽糖压成块。李掌柜说吃了“脑子清楚、嘴皮子利索”——但他自己每次吃都是因为嘴馋，不是因为要动脑子。" },
  { name: "卓玛的狼骨糖", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "零嘴", "好感"], consumable: { hpRestore: 0.08, sixDimTemp: { 气运: 2 } }, desc: "卓玛用狼骨酒剩下的酒糟滤出来做的糖——苦甜苦甜的，带着一股酒味。她说这不是糖，是“让人记住酒味的糖”。她一共做了三颗，自己吃了一颗，给阿爸一颗，剩下那颗攥在手心，不说是留给谁的。" },
  { name: "土司府宴客席", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["食品", "宴席"], consumable: { hpRestore: 0.35, sixDimTemp: { 体魄: 2 } }, desc: "桑杰朵杰宴客的标准席面——八凉八热十六道，头菜是红烧牦牛头，压轴是虫草炖雪鸡。梅朵说她最烦这席面——“每道菜都要等人夸，夸完了菜也凉了”。" },
  { name: "跑马大会烤全羊", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["食品", "宴席"], consumable: { hpRestore: 0.4, sixDimTemp: { 根骨: 1, 悟性: 1, 体魄: 1, 魅力: 1, 智谋: 1, 身法: 1, 气运: 1 } }, desc: "跑马大会集市正中央烤的整只羊，炭火从早烧到晚，羊肉一层层片下来。才旦负责收钱，老孙负责片肉，鱼定大娘负责往肉上撒孜然——丹增吃了三盘说“今年的羊比去年的肥”，梅朵说“是你比去年馋了”。" },
  { name: "喇嘛庙罗汉全席", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["食品", "宴席", "素斋"], consumable: { hpRestore: 0.35, sixDimTemp: { 悟性: 3 } }, desc: "喇嘛庙素斋的巅峰之作，十八道素菜每道做出一种肉的味道。住持说前任经师吃了这席面后说过一句话——“把素菜做出肉的味道是修行；把肉菜吃出素的味道是智慧。修行容易，智慧难。”" },
  { name: "欢喜教天竺手抓饭", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["食品", "宴席", "好感"], consumable: { hpRestore: 0.35, sixDimTemp: { 魅力: 3 } }, desc: "梵衍那亲手做的天竺手抓饭——藏红花染的金黄米饭、羊肉、葡萄干、腰果，用手抓着吃。罗琦说他已经五年没做过——“上次做还是离开大理那天。他说那天是大理最冷的一天，但他做的饭是大理最香的。”" },
  { name: "百花宴", category: ITEM_CATEGORY.MISC, quality: "橙", tags: ["食品", "宴席", "好感", "稀世"], consumable: { hpRestore: 0.5, sixDimTemp: { 魅力: 4, 气运: 3 } }, desc: "兰姐的终极排场——十二道菜每道以一味花入菜，玫瑰花红烧肉、桂花糖藕、菊花鱼片、茉莉花蒸蛋……最后一道是“百花引茶”，她当着客人面把百花引瓷瓶拿出来，滴一滴入茶——“这一滴不是蛊，是信任。我当着你面滴百花引，你也当着我的面喝下去。”" },
  { name: "三水归乡宴", category: ITEM_CATEGORY.MISC, quality: "红", tags: ["食品", "宴席", "终局", "稀世"], consumable: { hpRestore: 0.6, sixDimTemp: { 根骨: 3, 悟性: 3, 体魄: 3, 魅力: 3, 智谋: 3, 身法: 3, 气运: 3 } }, desc: "才旦在界石重立后张罗的宴席——熊曲的鱼、鹰曲的雪鸡、狼曲的牦牛，三条支流各自的馈赠，做成一桌菜。鱼定大娘掌勺，老孙帮厨，杂货商人出盐，张商人出茶叶，所有人都在。才旦说这顿饭“不是庆功，是还账——还曲措乡的山水养了我们这么多年的账”。" },
  { name: "马帮干粮包", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "战前餐"], consumable: { combatBuff: { energyBonus: 1 } }, desc: "马帮出发前的标配——压缩干粮、风干肉、酥油茶包三样捆在一起。阿旺说这不是吃饱的，是“让肚子知道有人在惦记它”的心理安慰。" },
  { name: "熊山猎户餐", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "战前餐"], consumable: { combatBuff: { waigong: 8, energyBonus: 2 } }, desc: "老猎户进熊山前的标准餐——烤兽肉蘸岩盐，配一壶熊山温泉烧的热水。他说“吃太饱跑不动，不吃没力气，关键是刚好——跟下陷阱一样，力道要刚好”。" },
  { name: "雪山派晨练餐", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "战前餐"], consumable: { combatBuff: { moveMul: 0.15, waigong: 6 } }, desc: "雪山派弟子每天晨练前的定食——一碗酥油茶、两个青稞饼、一小块风干牦牛肉。何雨谢定的量，多了少了都不行——“练功是跟自己的身体对话，不能饿着它，也不能惯着它”。" },
  { name: "黑风寨出征席", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "战前餐"], consumable: { combatBuff: { waigong: 12, hpBonusRatio: 0.1 } }, desc: "巴桑每次下山行动前全寨人一起吃的饭——不是丰盛，是规矩。老阿雅婶端上青稞饼和牦牛肉汤，巴桑第一个动筷子，大家才跟着吃。嘎则偷偷往雪团的碗里多放了一块肉，雪团用尾巴扫她脚踝。" },
  { name: "锦官城壮行宴", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["食品", "战前餐"], consumable: { combatBuff: { energyBonus: 3, hpBonusRatio: 0.2, moveMul: 0.2 } }, desc: "柳青鸢给要出远差的差役准备的席面——红烧肉、辣子鸡、蒜泥白肉、一壶烧刀子。她说吃了这顿“路上心里想着家里还有一顿等着，就舍得回来了”。她自己不吃，看着他们吃，筷子给她夹的菜她只动一口。" },
  { name: "百花楼战前茶", category: ITEM_CATEGORY.MISC, quality: "橙", tags: ["食品", "战前餐", "好感"], consumable: { combatBuff: { energyBonus: 5, waigong: 16 } }, desc: "兰姐专为要打硬仗的人泡的茶——百花引残料反炼后只剩一味极淡的茉莉香，喝下去手脚发热、手心出汗但不是紧张。她说“这是我自己要上战场前喝的茶。现在给你喝——说明你替我上。你要回来，我茶还没凉。”" },
  { name: "熊山松茸", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "食材"], consumable: { hpRestore: 0.05 }, desc: "熊山松林里雨后冒出来的松茸，伞盖还没完全展开的时候最肥。老猎户说这东西不能洗——洗了就没了山的味道，要用小刀刮泥，再用松针擦。" },
  { name: "狼曲冷水鱼", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "食材"], consumable: { hpRestore: 0.06 }, desc: "狼曲上游的冷水鱼，手掌大，刺多但肉极细嫩。嘎则和雪团在狼曲石上捉的——雪团用爪子拍水面，鱼被震晕浮上来，嘎则拿草绳串着提回山寨。" },
  { name: "牦牛奶酪", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "食材"], consumable: { hpRestore: 0.1 }, desc: "卓玛用自家牦牛奶做的鲜酪，什么都不加，只有奶香和一丝青草味。她说酪做得好不好要看牦牛吃的是什么草——“春天吃野花的牛，奶做的酪是甜的”。" },
  { name: "雪山雪鸡肉", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "食材"], consumable: { hpRestore: 0.12 }, desc: "雪山派弟子偶尔在后山打到的新鲜雪鸡肉，肉紧但嫩，清炖最好——何雨谢说“加一味当归就够了，加多了就尝不出雪鸡自己的味道”。" },
  { name: "大草甸野蜂蜜", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "食材"], consumable: { energyRestore: 3 }, desc: "大草甸深处野蜂巢里的蜜，采的是格桑花、杜鹃花和一种叫不出名字的紫色野花。老猎户说这蜜是“大草甸的甜，一年只有一季，一季只有一窝”。" },
  { name: "贡措海盐", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["食品", "食材"], consumable: { hpRestore: 0.03 }, desc: "贡措海畔天然结晶的盐，不是晒的是湖水自己结的——湖畔石头上一片白霜，刮下来就是盐。丹增说这盐是贡措海的眼泪，“但眼泪不咸怎么算眼泪——不够咸的盐不是好盐，不够咸的眼泪也不是真哭”。" },

  // ── 补货批次·59件带特效商品（2026-07-21，AI生成+人工设计特效/数值裁决）──
  // 饰品补全线+护甲高阶+紫橙红武器；白绿素数值，蓝1弱特效，紫1~2，橙红强特效/组合。
  { name:"藏银錾花镯", category:ITEM_CATEGORY.ACCESSORY, quality:"绿", tags:["饰品","藏银"], sixDim:{魅力:1}, desc:"玉泉寨银匠錾出的缠枝纹手镯，接口处故意留了一道缝，牧女说那是给风留的路——风从镯缝穿过时声音像狼曲的水。" },
  { name:"牦牛骨扳指", category:ITEM_CATEGORY.ACCESSORY, quality:"白", tags:["饰品","骨器"], desc:"牦牛腿骨磨成的扳指，没镶没嵌，戴久了骨色从白转黄再转褐。老牧民说骨头会吃手汗，吃得越多越润。" },
  { name:"菩提子手串", category:ITEM_CATEGORY.ACCESSORY, quality:"白", tags:["饰品","佛珠"], desc:"喇嘛庙香积厨外那棵老菩提树结的籽，僧人自己打眼穿串，每颗大小不一，挂在腕上磕磕碰碰，声音像木鱼。" },
  { name:"绿松石耳坠", category:ITEM_CATEGORY.ACCESSORY, quality:"绿", tags:["饰品","宝石"], sixDim:{气运:1}, desc:"天都镇玉器轩从藏地收来的老松石，色如雨后的草甸。掌柜说这对耳坠原来是一个牧女当的，当期过了三十年没赎，松石还在等人。" },
  { name:"桃木平安牌", category:ITEM_CATEGORY.ACCESSORY, quality:"白", tags:["饰品","护符"], desc:"熊山桃木削成的小牌，正面刻平安，背面刻一道歪扭的剑痕。不是开过光——是削牌的猎户用猎刀随手划的，说刀比佛快。" },
  { name:"苗银花丝耳坠", category:ITEM_CATEGORY.ACCESSORY, quality:"蓝", tags:["饰品","苗银"], sixDim:{魅力:2}, desc:"百花楼的姑娘从苗寨带出来的花丝耳坠，银丝拉得比头发还细，编成蜂巢纹。走路时耳坠晃动的幅度刚好扫到颈侧。" },
  { name:"蜜蜡手串", category:ITEM_CATEGORY.ACCESSORY, quality:"蓝", tags:["饰品","蜜蜡"], sixDim:{体魄:1}, desc:"喇嘛庙老僧人盘了十几年的蜜蜡串，颗颗色如陈蜜，对着日光能看到蜡纹如云。老僧说蜜蜡是松脂变的，松脂是树的血。" },
  { name:"白水晶耳坠", category:ITEM_CATEGORY.ACCESSORY, quality:"蓝", tags:["饰品","水晶"], sixDim:{悟性:1}, effect:{ nullifyStatusOnHit: true }, desc:"雪山派商坊从雪山顶上采的白水晶磨成，澄澈如冰。耳坠切面极简，不追求折射——雪山派的人说水晶不是拿来炫的，是拿来照自己的。" },
  { name:"旧银长命锁", category:ITEM_CATEGORY.ACCESSORY, quality:"绿", tags:["饰品","银器"], sixDim:{根骨:1}, desc:"天都镇银楼打的长命锁，正面刻长命富贵，背面是空白的。掌柜说这是留给买家自己刻的——有人刻儿女名字，有人刻冤家名字。" },
  { name:"蓝田玉镯", category:ITEM_CATEGORY.ACCESSORY, quality:"蓝", tags:["饰品","玉器"], sixDim:{魅力:2}, desc:"锦官城金玉行从关中运来的蓝田玉，色如远山含雾。镯子内圈刻了一圈极细的水纹，戴在腕上贴着皮肤，天热时会沁出微凉。" },
  { name:"金丝发箍", category:ITEM_CATEGORY.ACCESSORY, quality:"紫", tags:["饰品","金器"], sixDim:{魅力:2,气运:1}, desc:"锦官城老字号金铺的镇店细工，发箍上的缠枝纹用金丝盘了七层。箍在发间不夹头发——金丝内侧磨得比绸缎还滑。" },
  { name:"古铜镜佩", category:ITEM_CATEGORY.ACCESSORY, quality:"紫", tags:["饰品","古玩","铜器"], sixDim:{智谋:2}, effect:{ nullifyStatusOnHit: true }, desc:"天都镇当铺流出来的汉制古铜镜，镜面已锈得照不见人，但背面四神纹清晰如新。掌柜说镜面锈了更好——照不见人脸，照得见人心。" },
  { name:"九眼天珠", category:ITEM_CATEGORY.ACCESSORY, quality:"橙", tags:["饰品","天珠"], sixDim:{气运:3}, effect:{ forceFirst: true }, desc:"喇嘛庙密藏的至宝，珠身上天然生成九眼纹路。老住持说天珠不是人做的，是天降石，每一眼都是一劫——九眼就是九劫尽过。" },
  { name:"天竺旧玉坠", category:ITEM_CATEGORY.ACCESSORY, quality:"橙", tags:["饰品","天竺","古玉"], sixDim:{悟性:2,魅力:2}, effect:{ nullifyStatusOnHit: true, afterStatusBonus: 0.3 }, desc:"欢喜堂从天竺故国带来的旧玉坠，玉质不纯，有絮有筋。梵衍那说这是天竺河边捡的璞玉，没雕过，絮是河水的痕，筋是山根的脉。" },
  { name:"象牙骨簪", category:ITEM_CATEGORY.ACCESSORY, quality:"蓝", tags:["饰品","骨器"], sixDim:{魅力:2}, desc:"玉泉寨老牧民用雪猪牙磨的簪子，弯如月牙。他说雪猪牙比牦牛骨轻，插在发间走路时簪子会微微颤动，像那只雪猪还活着。" },
  { name:"红珊瑚耳坠", category:ITEM_CATEGORY.ACCESSORY, quality:"红", tags:["饰品","珊瑚"], sixDim:{魅力:3,气运:2}, effect:{ forceFirst: true, highHpBonus: 0.2 }, desc:"锦官城金玉行从南海运来的老珊瑚，色如凝血，打磨后泛哑光。耳坠切面保留珊瑚天然的虫眼，掌柜说有虫眼才真——没虫眼的是染的。" },
  { name:"黑曜石手串", category:ITEM_CATEGORY.ACCESSORY, quality:"紫", tags:["饰品","黑曜石"], sixDim:{根骨:2}, effect:{ freezeEnergyRecovery: true }, desc:"天都镇黑市流出来的黑曜石串，颗颗如墨，对着光能看到石纹如暗流。卖家说这石头在贡措海底埋了一百年，出水时还是冰的。" },
  { name:"玛瑙扳指", category:ITEM_CATEGORY.ACCESSORY, quality:"紫", tags:["饰品","玛瑙"], sixDim:{体魄:2}, effect:{ afterCounterBonus: 0.25 }, desc:"锦官城古玩铺收来的缠丝玛瑙扳指，丝纹如红云绕山。内圈磨得极薄，戴久了能感觉到自己脉搏在扳指里跳。" },
  { name:"紫铜护心镜", category:ITEM_CATEGORY.ARMOR, quality:"绿", tags:["护具","铜器"], desc:"天都镇铁铺打的护心铜镜，镜面凸起一道脊，不是装饰——是打铁的孟铁匠说护心镜凸脊能卸力，力道从脊上滑过去比硬扛强。" },
  { name:"牦牛皮护臂", category:ITEM_CATEGORY.ARMOR, quality:"白", tags:["护具","皮甲"], desc:"玉泉寨牧民自制的护臂，三层牦牛皮叠缝，系带是马尾编的。磨得起毛的那一面是外侧——老牧民说皮子起毛才合手，新皮太硬。" },
  { name:"铁网僧袍", category:ITEM_CATEGORY.ARMOR, quality:"蓝", tags:["护具","僧袍"], effect:{ doubleReflectDamage: true }, desc:"白塔守塔僧的制式僧袍，夹层衬细铁网。袍子重，夏天穿不住——但地宫阴冷，铁网常年冰凉，穿久了反而觉得那层凉意是护身符。" },
  { name:"蜀锦软甲", category:ITEM_CATEGORY.ARMOR, quality:"橙", tags:["护具","锦缎"], effect:{ doubleReflectDamage: true, ignoreDefensePartialImmune: 0.3 }, sixDim: { 身法: 2 }, desc:"锦官城成衣铺的镇店货，蜀锦织就，夹层衬百层棉纸叠压。轻得能叠进包袱，展开后刀砍上去先吃进锦缎的经纬，再被棉纸卸掉余力。" },
  { name:"百炼锁子甲", category:ITEM_CATEGORY.ARMOR, quality:"橙", tags:["护具","锁子甲"], effect:{ immuneControl: true, ignoreDefensePartialImmune: 0.4 }, desc:"天都镇孟记铁铺的孟铁匠打了三个月的锁子甲，每个铁环接口都焊死。甲重十二斤，穿上后行动如常——铁环会随动作滑移，不卡关节。" },
  { name:"犀牛皮重甲", category:ITEM_CATEGORY.ARMOR, quality:"红", tags:["护具","皮甲","重甲"], effect:{ immuneControl: true, rebirthOnce: true }, sixDim: { 根骨: 3, 体魄: 2 }, desc:"黑风寨老铁匠用熊山犀牛皮硝了一年才做成的重甲，皮板厚得像门板。甲身上有三道旧抓痕——不是伤，是犀牛生前和虎王打架留下的。" },
  { name:"天竺金丝软甲", category:ITEM_CATEGORY.ARMOR, quality:"红", tags:["护具","金丝"], effect:{ immuneControl: true, doubleReflectDamage: true }, sixDim: { 身法: 3, 根骨: 1 }, desc:"欢喜堂从天竺带来的金丝软甲，金丝细如发，编成细密的网眼。甲重不到两斤，穿在衣服里完全看不出，但刀尖捅上来时金丝会绞住刀刃。" },
  { name:"熊山皮坎肩", category:ITEM_CATEGORY.ARMOR, quality:"绿", tags:["护具","皮甲","猎户"], desc:"鱼定村猎户人手一件的熊皮坎肩，硝得不透，皮板还硬着。肩头有一道抓痕——老猎户说是母熊抓的，母熊比公熊凶，因为它身后有崽。" },
  { name:"镖师护腕", category:ITEM_CATEGORY.ARMOR, quality:"白", tags:["护具","皮具"], desc:"锦官城镖局统一配发的牛皮护腕，内衬一层薄铁片。新护腕磨手腕，走第一趟镖就能磨出血，老镖师说磨破了结痂就好——痂比皮厚。" },
  { name:"贡措海蟒皮护腰", category:ITEM_CATEGORY.ARMOR, quality:"蓝", tags:["护具","蟒皮"], effect:{ applyMark: { name: "内伤印", stacks: 1 }, applyMarkChance: 0.3, applyMarkOnHit: true }, desc:"锦官城皮货铺从贡措海收来的水蟒皮，鞣制后仍保留鳞片纹路。护腰系紧后不松不滑——蟒鳞遇热会微微收缩，贴着皮肤的力道刚好。" },
  { name:"老藤护膝", category:ITEM_CATEGORY.ARMOR, quality:"白", tags:["护具","藤甲"], desc:"熊山深处老藤编的护膝，用雪山水煮过三遍。藤条煮软后弯成膝盖弧度，冷却后定型，蹲下时护膝会发出极细的藤条摩擦声。" },
  { name:"柏木护肩", category:ITEM_CATEGORY.ARMOR, quality:"绿", tags:["护具","木甲"], desc:"喇嘛庙后山老柏木削的护肩，木质轻而韧，柏香经年不散。僧人练武时戴，说是护肩不如说是闻香——柏香入鼻，心先静了。" },
  { name:"钢鳞护臂", category:ITEM_CATEGORY.ARMOR, quality:"蓝", tags:["护具","钢制"], effect:{ doubleReflectDamage: true }, desc:"天都镇铁铺用百炼钢片叠成的护臂，鳞片层层相扣，抬手时钢鳞会顺着肌肉滑动。孟铁匠说这是仿鱼鳞的——鱼鳞长在鱼身上不是为了好看。" },
  { name:"黑风寨牛皮重铠", category:ITEM_CATEGORY.ARMOR, quality:"紫", tags:["护具","皮甲","重甲"], effect:{ ignoreDefensePartialImmune: 0.3, immuneControl: true }, desc:"黑风寨老铁匠用三张成年牦牛皮叠在一起硝的重铠，甲片用铜钉铆死，穿上去像披了一堵墙。巴桑说不用怕刀砍，倒是怕从马上摔下来——甲太重。" },
  { name:"明光铠改制", category:ITEM_CATEGORY.ARMOR, quality:"红", tags:["护具","重甲"], effect:{ immuneControl: true, ignoreDefensePartialImmune: 0.5, rebirthOnce: true }, sixDim: { 根骨: 3, 体魄: 1 }, desc:"锦官城官造坊按前朝明光铠图纸改制的制式重甲，胸前两块护心镜锃亮如镜。镜面上隐隐有锤纹——不是工艺粗糙，是打甲的老匠人故意留的锤痕。" },
  { name:"百炼苗刀", category:ITEM_CATEGORY.WEAPON, quality:"紫", tags:["武器","刀"], effect:{ applyStatus: { name: "淬毒", chance: 0.5 }, afterStatusBonus: 0.3 }, desc:"天都镇黑市从苗疆流出来的百炼长刀，刀身窄而微弧，刀背留着一道锻造时的锤印。黑市贩子说苗刀淬的是牛血，砍人时刀刃会发出一声极细的嗡鸣。" },
  { name:"陨铁刀", category:ITEM_CATEGORY.WEAPON, quality:"橙", tags:["武器","陨铁"], effect:{ ignoreDefense: true, applyStatus: { name: "裂伤", chance: 0.5 } }, sixDim: { 体魄: 2 }, desc:"锦官城老铁铺用贡措海畔捡的陨铁打的长刀，刀身泛暗蓝纹，纹路如夜空流云。掌柜说陨铁打了三个月才成形——不是铁硬，是陨铁认生，不肯被锤子驯服。" },
  { name:"虎骨猎叉", category:ITEM_CATEGORY.WEAPON, quality:"紫", tags:["武器","猎具"], effect:{ ignoreDefense: true, lowHpBonus: 0.12 }, desc:"熊山猎户用吊睛虎王的大腿骨打磨的猎叉，叉尖保留虎骨的天然弧度，刺出去时叉身会发出低沉的骨鸣。老猎户说这叉不沾血腥——骨鸣会惊走猎物，只适合猎虎。" },
  { name:"点钢枪", category:ITEM_CATEGORY.WEAPON, quality:"紫", tags:["武器","长兵"], effect:{ afterCounterBonus: 0.35 }, sixDim: { 身法: 1 }, desc:"锦官城武馆的教头用枪，枪尖是百炼钢反复折叠锻打的，枪杆是老白蜡木。枪尖点地时枪杆会颤，颤到第三下才停——教头说这颤劲是活的。" },
  { name:"松纹剑", category:ITEM_CATEGORY.WEAPON, quality:"蓝", tags:["武器","剑","门派"], effect:{ forceFirst: true }, desc:"雪山派弟子人手一柄的制式长剑，剑身有天然松木纹理，不是刻意锻造——是雪山寒铁淬雪水时自然凝结的纹路。剑穗分五色，呼延雪那柄系的是白色。" },
  { name:"厚背大砍刀", category:ITEM_CATEGORY.WEAPON, quality:"蓝", tags:["武器","重兵"], effect:{ highHpBonus: 0.2 }, desc:"黑风寨兄弟人手一把的砍刀，刀背厚如指节，刀刃开得糙。巴桑说这刀不用磨得太利——砍人靠的不是刃，是刀背的份量，砸下去比劈下去实在。" },
  { name:"牛角弓", category:ITEM_CATEGORY.WEAPON, quality:"绿", tags:["武器","弓","猎具"], desc:"熊山猎户用牦牛角和老牦牛皮筋做的猎弓，弓臂保留牛角的天然弧度，拉满时会发出牛角受力的嘎吱声。老猎户说这弓的声音像牛在叹气。" },
  { name:"连弩", category:ITEM_CATEGORY.WEAPON, quality:"蓝", tags:["武器","弩","机关"], effect:{ nextAttackBonus: 1.6 }, desc:"锦官城官造坊的制式连弩，一匣十矢，弩机用齿轮卡榫联动。弩身漆暗红，老兵说这红色是官造坊故意用的——不是好看，是暗处不容易反光。" },
  { name:"峨眉刺", category:ITEM_CATEGORY.WEAPON, quality:"蓝", tags:["武器","短兵"], effect:{ applyStatus: { name: "裂伤", chance: 0.35 } }, desc:"百花楼的姑娘防身用的短刺，刺身细如蜂针，尾部套在指尖旋转如花。兰姐说峨眉刺不是用来杀人的——是用来划衣服的，划破比刺穿更让人怕。" },
  { name:"锻钢苗刀", category:ITEM_CATEGORY.WEAPON, quality:"蓝", tags:["武器","刀"], effect:{ applyStatus: { name: "淬毒", chance: 0.3 } }, desc:"天都镇铁铺用苗刀刀型改打的钢刀，刀身比苗刀略宽，刀尖保留苗刀的微弧。孟铁匠说苗刀不趁手他改——改了还是叫苗刀，是敬苗人。" },
  { name:"乌木鞭", category:ITEM_CATEGORY.WEAPON, quality:"绿", tags:["武器","软兵","鞭"], desc:"熊山老乌木削的软鞭，鞭身有天然的木节凸起，抽出去时木节划过空气发出呜呜声。老猎户说这鞭子打人比打兽疼——木节硌骨头。" },
  { name:"玄铁重剑", category:ITEM_CATEGORY.WEAPON, quality:"紫", tags:["武器","重兵","剑"], effect:{ highHpBonus: 0.3, forceFirst: true }, sixDim: { 体魄: 2 }, desc:"锦官城武馆压馆的玄铁重剑，无锋无刃，剑身通体墨黑。教头说这剑不是用来刺的——是让人练腕力的，每天举三百次，一年后才能用正常剑。" },
  { name:"飞石索", category:ITEM_CATEGORY.WEAPON, quality:"白", tags:["武器","猎具","软兵"], desc:"大草甸牧民用的投石索，牦牛皮编的索兜，装一颗圆石甩三圈掷出去，能打到三十步外的兔子腿。小牧童阿索甩得最准——他专打兔子后腿。" },
  { name:"藏刀", category:ITEM_CATEGORY.WEAPON, quality:"绿", tags:["武器","短刀","藏刀"], desc:"玉泉寨铁匠打的藏式短刀，刀柄嵌一块绿松石，刀鞘包牦牛皮。牧民人手一柄，用来割肉、削木、防身——用得最久的刀柄上会凹进去一个拇指印。" },
  { name:"天竺弯刀", category:ITEM_CATEGORY.WEAPON, quality:"橙", tags:["武器","天竺","刀"], effect:{ forceCrit: { multiplier: 1.6 }, afterCounterBonus: 0.3 }, sixDim: { 气运: 2 }, desc:"欢喜堂从天竺带来的弯刀，刀身弧如新月，刀柄缠金丝。梵衍那说这刀型从天竺孔雀王朝传到今天，刀刃弧度刚好贴合手腕内旋的角度。" },
  { name:"雪山秘密药膏", category:ITEM_CATEGORY.MISC, quality:"橙", tags:["药膏","雪山"], consumable:{hpRestore:0.35,dispel:true}, desc:"喇嘛庙达摩药堂的秘制外敷药膏，瓷罐封存。膏体黑如沥青，涂在伤口上先是剧痛，再是麻痒——药堂师父说麻痒是筋在长，剧痛是毒在退。" },
  { name:"天竺醒神膏", category:ITEM_CATEGORY.MISC, quality:"橙", tags:["丹药","天竺"], consumable:{energyRestore:8,dispelAll:true}, desc:"欢喜堂用天竺古方配的醒神膏，内服后太阳穴一跳，神识骤然清明。罗琦说这膏药她配了三年才成功——失败了就是麻药，成功才是醒药。" },
  { name:"百花陈酿", category:ITEM_CATEGORY.MISC, quality:"橙", tags:["酒","花酿"], consumable:{hpRestoreOverTime:{ratio:0.15,turns:5},sixDimTemp:{魅力:3}}, desc:"百花楼地窖里埋了二十年的桂花陈酿，开坛时酒香能飘满整条街。兰姐自己从不喝——她说陈酿是等一个人来才开的，那个人一直没来。" },
  { name:"三十年窖藏青稞酒", category:ITEM_CATEGORY.MISC, quality:"橙", tags:["酒","青稞"], consumable:{combatBuff:{waigong:8,moveMul:0.9},hpRestore:0.25}, desc:"锦官城醉仙楼珍藏的三十年陈青稞酒，酒液已转琥珀色，入口无酒气只有粮香。掌柜说这酒是开酒楼那年埋的，埋酒的人已不在了。" },
  { name:"老参酥油茶", category:ITEM_CATEGORY.MISC, quality:"紫", tags:["饮品","药膳"], consumable:{hpRestore:0.22,sixDimTemp:{体魄:2}}, desc:"玉泉寨老牧民才舍得喝的酥油茶，茶汤里搁了熊山野参片，酥油打得浓到能立住筷子。喝完后手脚暖半天，牧民说这是穷人的皮袄。" },
  { name:"苞谷酒", category:ITEM_CATEGORY.MISC, quality:"白", tags:["酒","山寨"], consumable:{energyRestore:2}, desc:"黑风寨自己酿的苞谷酒，酒味糙而冲，入喉像吞了一团火。巴桑说这酒不是拿来品的——是用来灌倒新入伙的兄弟，灌醉了才好套真话。" },
  { name:"熊山野蜂蜜", category:ITEM_CATEGORY.MISC, quality:"绿", tags:["食品","蜂蜜","山货"], consumable:{hpRestore:0.1}, desc:"大草甸深处的野蜂巢掏出来的蜜，色深如琥珀，甜中带一丝草腥。赶马人阿旺说这蜜是燕羊蹄子踩过的花酿的，甜得不干净但回味长。" },
  { name:"百花蛊香囊", category:ITEM_CATEGORY.MISC, quality:"蓝", tags:["香囊","蛊术"], consumable:{sixDimTemp:{魅力:2}}, desc:"百花楼的姑娘亲手缝的蛊香囊，内装百花引的边角料和苗疆香草，挂在腰间能香三天。兰姐说香囊里的香料是淘汰过的——留香太久的蛊味太重。" },
  { name:"老姜红糖膏", category:ITEM_CATEGORY.MISC, quality:"绿", tags:["饮品","药膳"], consumable:{hpRestore:0.1,dispel:true}, desc:"锦官城杏林医馆配的红糖姜膏，用汉源小黄姜和甘蔗熬成，膏体浓稠挂勺。医馆大夫说这是给产妇坐月子喝的——但走镖的人冬天也喝，比酒暖。" },
  { name:"黑风寨金疮药", category:ITEM_CATEGORY.MISC, quality:"绿", tags:["药材","山寨"], consumable:{hpRestore:0.12}, desc:"黑风寨老阿雅婶自己碾的草药粉，用熊山三七和雪山艾叶配成。她说这药止血快但不治内伤——刀伤抹一把，内伤还得喝羊肉汤慢慢养。" },
  { name:"苗银暗器囊", category:ITEM_CATEGORY.ACCESSORY, quality:"蓝", tags:["暗器","苗银"], effect:{ applyStatus: { name: "淬毒", chance: 0.3 } }, desc:"百花楼姑娘随身带的暗器囊，囊口用苗银扣锁住，囊内分三格。一格装蛊香，一格装银针，一格空着——兰姐说空的那格是留给自己的。" },

  // —— 补货批次「收尾」24件(红档通货武器/白绿饰品/白族谱系/天竺白档)——
  { name: "百炼玄铁大刀", category: ITEM_CATEGORY.WEAPON, quality: "红", tags: ["通货", "重兵"], effect: { ignoreDefense: true }, sixDim: { 体魄: 3 }, desc: "锦官城铸剑坊接了大主顾才肯开炉的一批重刀，百炼折叠的刀身黑得发青，寻常皮甲铁甲一概当纸糊，价钱也贵得能买半座宅子。至于用得动用不动，铁匠只笑不答，说买得起的自然抡得起。" },
  { name: "赤铜错金枪", category: ITEM_CATEGORY.WEAPON, quality: "红", tags: ["通货", "长兵"], effect: { forceFirst: true }, sixDim: { 身法: 3 }, desc: "官造军械里最扎眼的一杆长枪，枪杆赤铜错着金线，出手快得对方还没看清就已中招。原是给品级够高的武官配的仪仗，流到市面上的都是有门路的人转手，寻常铺子摆不出这么一杆。" },
  { name: "寒锋七星剑", category: ITEM_CATEGORY.WEAPON, quality: "红", tags: ["通货", "名匠"], effect: { forceCrit: true }, sixDim: { 气运: 2, 身法: 1 }, desc: "剑脊上嵌着七枚北斗样的星纹，据说是某位隐姓名匠晚年一年只出三口的活儿。剑虽利，却不认人,谁使都是一样的锋,故而算不得独一份的名器,只是贵得离谱的一件好货罢了。" },
  { name: "镔铁破阵斧", category: ITEM_CATEGORY.WEAPON, quality: "红", tags: ["通货", "重兵"], effect: { highHpBonus: 0.3 }, sixDim: { 体魄: 2, 根骨: 1 }, desc: "边军里淘汰下来的破阵重斧，斧头厚得能当砧板，人越是气力充沛这一斧劈得越狠，脱了力反倒抡不圆。军中说这斧子挑人，挑的不是身份，是那口还没泄的气。" },
  { name: "点睛乌金鞭", category: ITEM_CATEGORY.WEAPON, quality: "红", tags: ["通货", "软兵"], effect: { nullifyStatusOnHit: true }, sixDim: { 身法: 2, 智谋: 1 }, desc: "十三节乌金软鞭，节节相扣如活蛇，鞭梢一点便能把对方刚运起的花招震散。会使的人不多，肯花大价钱买的更少，铺子里挂着更多是充门面，真买走的据说都不是善茬。" },
  { name: "牛骨素圈", category: ITEM_CATEGORY.ACCESSORY, quality: "白", tags: ["饰品", "藏地"], desc: "玉泉寨牧人拿吃剩的牦牛胫骨磨的素圈，不錾花不镶石，戴手上凉丝丝的。牧女说磨得越亮的准是戴了十几年的，新的那批白得刺眼，一看就没经过日子。" },
  { name: "红绳桃核串", category: ITEM_CATEGORY.ACCESSORY, quality: "白", tags: ["饰品", "平安"], desc: "鱼定村妇人给出远门的人串的桃核，一颗颗自己啃的核，红绳是染布剩的边角。挡不了刀枪，倒是攥在手里心里踏实，走夜路的人多半兜里揣着一串。" },
  { name: "铜钱压襟", category: ITEM_CATEGORY.ACCESSORY, quality: "白", tags: ["饰品", "市井"], desc: "天都镇小贩把穿旧了的制钱编成压襟坠子，走起路来叮当响。图个财气，也图个响动——夜里独行,响声比刀还壮胆。" },
  { name: "松石小坠", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", tags: ["饰品", "藏银"], sixDim: { 魅力: 1 }, desc: "喇嘛庙山下摊子上论堆卖的松石坠，成色参差，好的那几颗蓝得正,配上藏银托子颇能唬人。香客求个吉利,牧女图个好看,倒也各取所需。" },
  { name: "缠丝玛瑙牌", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", tags: ["饰品", "当铺"], sixDim: { 气运: 1 }, desc: "天都镇当铺里压了几年没人赎的玛瑙牌，缠丝的纹路像水波,当铺老板嫌占地方,肯让价出。据说原主戴着它赢过几回钱,后来输光了连它一起当了——玛瑙无辜,运气这东西本就不长在一件物件上。" },
  { name: "银鎏花簪", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", tags: ["饰品", "锦官"], sixDim: { 魅力: 2 }, desc: "锦官城金玉行给寻常人家姑娘备的鎏银花簪，样子仿的是官眷诰命簪，鎏的却是薄薄一层银，戴出去远看体面近看便知深浅。掌柜从不点破,买的人也心知肚明。" },
  { name: "结绳护腕串", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", tags: ["饰品", "山寨"], sixDim: { 体魄: 1 }, desc: "黑风寨弟兄拿牛皮条编的护腕串，缠三圈打个死结，说是护腕其实更像个念想——上山的人一人一条,断了就知道少了个人。寨里妇人手快,一晚上能编七八条。" },
  { name: "冷水鱼骨坠", category: ITEM_CATEGORY.ACCESSORY, quality: "白", tags: ["饰品", "山野"], desc: "狼曲冷水鱼的脊骨晒干磨圆穿成的坠子，泛着淡青的光。捞鱼的娃娃拿它当稀罕玩意换糖吃,大人戴着倒说压水汽,常年在河边讨生活的图这么个说法。" },
  { name: "羊脂玉平安扣", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", tags: ["饰品", "锦官"], sixDim: { 根骨: 1 }, desc: "锦官城金玉行的中档货，一块囫囵的羊脂玉钻个孔,不雕花只求个圆满。买的多是给小辈压岁的长辈,说玉能养人,戴住了骨头都结实些——真假不论,这份心思是真的。" },
  { name: "大理苍山剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", tags: ["白族", "长剑"], effect: { forceFirst: true }, desc: "大理苍山下铁铺出的窄身长剑，剑格上錾着白族的雪花纹,轻快灵巧,是随梵衍那这一路流亡人带过来的家乡样式。用惯了藏刀汉剑的人初上手嫌它飘,使顺了才知道这份巧劲另有门道。" },
  { name: "白族扎染披肩", category: ITEM_CATEGORY.ARMOR, quality: "绿", tags: ["白族", "衣物"], desc: "大理白族妇人板蓝根染的披肩，蓝底上洇开一朵朵素白的花，说不上挡什么,风寒夜露倒是能遮一遮。异乡人裹着它,像把大理的天也带来了半片。" },
  { name: "点苍茶刀", category: ITEM_CATEGORY.WEAPON, quality: "绿", tags: ["白族", "短兵"], desc: "大理人分茶饼用的小茶刀,巴掌长,原不是兵器,可流落江湖的白族人贴身藏一把,急了也能捅人。刃口薄得能片下一层茶,握柄是点苍山的老黄杨,盘得发亮。" },
  { name: "白族银泡帽", category: ITEM_CATEGORY.ARMOR, quality: "蓝", tags: ["白族", "护具"], sixDim: { 魅力: 1 }, effect: { freezeEnergyRecovery: true }, desc: "大理白族少女出嫁戴的银泡帽，一圈圈缀满小银泡,叮当作响。硬皮衬里意外挡得住闷棍,只是戴出来太扎眼,流亡在外的白族人多半收进箱底,舍不得戴也不敢戴。" },
  { name: "苍洱桂花油", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["白族", "香品"], consumable: { sixDimTemp: { 魅力: 1 }, buffDuration: 20 }, desc: "大理白族拿苍山桂花窨的头油,抹一点满头香气,能压住旅途风尘味。异乡开香铺的人卖它卖得最贱,说不图挣钱,图买的人问一句'这是大理的桂花吗'。" },
  { name: "白族三道茶", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["白族", "茶饮"], consumable: { hpRestore: 0.12, energyRestore: 1 }, desc: "一苦二甜三回味的白族待客茶,头道烤得焦苦,二道搁了核桃红糖,三道添花椒姜片。走远路的人讨一碗,苦过甜过,那点辛麻的回味竟把浑身的乏都逼出来了几分。" },
  { name: "天竺粗香饼", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["天竺", "香品"], desc: "欢喜堂外院随手施舍给香客的粗香饼,料杂,燃起来烟大味冲,却是最不值钱也最不迷人的一种——教里人说,肯让你闻的香,才是没打你主意的香。" },
  { name: "天竺棉布缠头", category: ITEM_CATEGORY.ARMOR, quality: "白", tags: ["天竺", "衣物"], desc: "天竺流亡人惯裹的长条棉布缠头,一圈圈绕上七八尺,挡日头也挡风沙。缠得好的能垫一垫闷棍,缠不好的自己先绊倒。异乡人认这个,老远看缠头的绕法就知是不是同乡。" },
  { name: "贝叶抄经纸", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["天竺", "杂货"], desc: "欢喜堂裁下的空白贝叶,压平晾干可抄经也可记账。教里穷,好纸舍不得,便拿这个抵。识字的异乡人攒一沓,说等攒够了要把家乡的事从头写一遍——写给谁看,他们也不知道。" },
  { name: "天竺赤陶油灯", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["天竺", "器物"], desc: "欢喜堂供役自己捏的赤陶小油灯,粗手粗脚一个坯,灌上迦南脂的边角料就能点。夜里欢喜堂后院一排排点起来,昏黄一片,倒比正殿的鎏金大灯更像个有人住的地方。" },
  // ── 雅江特产 ──
  { name: "冷锅鱼", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食品", "雅江特产"], consumable: { hpRestore: 0.2, energyRestore: 2 }, desc: "青衣楼招牌。冷锅底料铺上七分熟的江团鱼片，不开火，余温慢慢煨。第一口嫩滑，越吃越入味。鱼吃完加高汤涮菜，一锅两吃。雅江人待客必点——不吃冷锅鱼等于没来过雅江。" },
  { name: "竹青宣", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["文房", "雅江特产"], desc: "当年新竹嫩皮捣浆手工捞的纸，对着光能看到竹纤维纹理。青城派符箓必须用它——别的纸承不住符文。" },
  { name: "熊山花椒", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["食材", "调料", "曲措乡产"], consumable: { sixDimTemp: { 身法: 1 } }, desc: "冷锅鱼底料的灵魂。产自曲措乡熊山，麻得舌头打颤但停不下来。最近断货了——青衣楼老板娘急得在江门街来回走。" },
  { name: "青城老酒", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["酒", "雅江特产"], consumable: { hpRestore: 0.1, energyRestore: 1 }, desc: "青城山后山泉酿的米酒，甜润不烈。道士们晚课后喝一碗——一清道长不喝，松鹤道长喝三碗。" },
  { name: "竹叶青蛇胆", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["药材", "解毒"], consumable: { hpRestore: 0.12 }, desc: "竹海里竹叶青蛇的胆，玉真子用来配解毒散。取胆不杀蛇——他捏着蛇头挤出来，蛇吐着信子走了，他也走了。" },
  { name: "熊猫笋", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食材", "兽食"], consumable: { hpRestore: 0.06 }, desc: "熊猫啃剩的冷箭竹笋尖，嫩得能掐出水。护谷弟子说别捡——「那是它挑剩下的，你捡了它下次不来了。」但确实好吃。" },
  // ── 常驻NPC身上那些"只写在 carry 里、catalog 却没有"的随身物 ──────────────
  // 【为什么补】residentNpcs.js 开头的 carry 设计原则写着「具名物优先用 catalog 里
  // 有主的（掉出来有来历）」。但全表体检下来有 20 件只存在于某个人的 carry 数组里，
  // catalog 查无此名——makeItemSmart 找不到就退回公式生成，于是这些**明明有名有姓、
  // 明显是为某个角色专门写的**东西掉出来是一件没有词条、没有来历的白板装备。
  // 玄女那把"温泉边的青石子"、赫连铸那张"半张欠条"，本来是人物侧写，落地却成了通货。
  // 补进 catalog 之后它们才真正带得上 effect/sixDim，也才进得了物件志给 AI 引用。
  { name: "珍珠的缰绳", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", tags: ["饰品", "坐骑", "信物"], sixDim: { 气运: 1, 身法: 1 }, desc: "编了三股的皮缰，握处被手汗浸成深褐。珍珠不怎么需要牵——你走它就走，你停它拿脑袋顶你后背。缰绳更像是给人握着安心用的。" },
  { name: "藏纹小马鞍", category: ITEM_CATEGORY.ARMOR, quality: "绿", tags: ["护具", "坐骑"], sixDim: { 体魄: 1 }, desc: "鞍桥压着藏式卷草纹，边缘的漆掉得七零八落。尺寸偏小，是照着矮脚马打的——换匹高头大马就绷不住了。" },
  { name: "一袋青稞精料", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["草料", "坐骑"], consumable: { hpRestore: 0.1 }, desc: "掺了豆饼和盐的青稞料，比寻常草料金贵。珍珠闻见袋子响就凑过来，鼻息喷得人手背发烫。" },
  { name: "晒干的苜蓿草", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["草料", "坐骑"], consumable: { hpRestore: 0.04 }, desc: "晒到发脆的苜蓿，一捏就碎。珍珠挑食，苜蓿要挑叶子多的那把——梗子多了它就拿舌头把整把顶开。" },
  { name: "土司印信", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", tags: ["饰品", "印信", "权柄"], effect: { justiceStrike: true }, sixDim: { 魅力: 2, 智谋: 1 }, desc: "鎏金铜印，钮作卧狮，印面阴刻藏汉两种文字。桑杰朵杰很少用它——他说盖了印的事就不能反悔了，「所以能不盖就不盖」。" },
  { name: "戍边税册抄本", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["文书", "权柄"], desc: "历年戍边税的抄本，字迹换过四五个人。最后几页是桑杰朵杰亲笔，数目越记越少,他没有解释，只是把册子往抽屉更深处塞了塞。" },
  { name: "白狐裘披风", category: ITEM_CATEGORY.ARMOR, quality: "紫", tags: ["护具", "裘皮"], effect: { immuneControl: true }, sixDim: { 魅力: 2 }, desc: "整张白狐皮缝的披风，领口那圈绒毛还带着活物似的光。玄女只在雪线以上穿它——山下太暖，「穿着像在演给谁看」。" },
  { name: "素银项圈", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", tags: ["饰品", "银器"], sixDim: { 悟性: 1, 魅力: 1 }, desc: "没有一点纹样的素银圈，磨得极亮。她说有花纹的东西看久了会走神，「素的才照得见人」。" },
  { name: "温泉边的青石子", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["信物", "念想"], desc: "后山温泉边随手捡的一颗青石子，被水冲得溜圆。她揣在袖里，想事情时就在指间转，转得那面已经发亮。" },
  { name: "冻不化的霜花", category: ITEM_CATEGORY.MISC, quality: "蓝", tags: ["奇物", "雪山"], consumable: { sixDimTemp: { 悟性: 2 }, buffDuration: 20 }, desc: "雪线上采的一片霜花，装在小瓷盒里，离了雪山也不化。玉真子看过一眼就摇头——他说不出道理，「不化就是不化」。" },
  { name: "无字木牌", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["信物", "念想"], desc: "一块巴掌大的桦木牌，两面都空白。她随身带了很多年。有人问牌子上该刻什么，她说等想好了再刻——刻上就定死了。" },
  { name: "雪莲幼苗", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["药材", "雪山"], consumable: { hpRestore: 0.1, sixDimTemp: { 根骨: 1 } }, desc: "巴掌高的雪莲苗，根上还裹着雪线的碎石土。移下山种不活——她试过三次，每次都埋回原处。" },
  { name: "开山锤", category: ITEM_CATEGORY.WEAPON, quality: "蓝", tags: ["武器", "锤"], effect: { ignoreDefenseRatio: 0.35 }, sixDim: { 体魄: 1 }, desc: "本是采石场的家伙什，锤头有一角被磕掉了。赫连铸拿它收过路费——不砸人，砸地。青石板裂开的声音比什么话都管用。" },
  { name: "牛皮护腕", category: ITEM_CATEGORY.ARMOR, quality: "绿", tags: ["护具"], sixDim: { 体魄: 1 }, desc: "厚牛皮缝的护腕，左边那只磨穿了露出里衬。他不换——说穿了洞的才知道哪个角度会挨刀。" },
  { name: "过路费钱袋", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["钱物"], desc: "收来的散碎银钱都塞在这个油腻布袋里，掂着不算沉。他从不数，数了就得想这些钱是从谁手里拿的。" },
  { name: "劣质烧刀子", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["食品", "酒"], consumable: { hpRestore: 0.05 }, desc: "最便宜的那种烧酒，喝下去嗓子眼像被砂纸刮。他说好酒喝了会想事，这种不会。" },
  { name: "半张欠条", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["文书", "念想"], desc: "从中间撕开的一张欠条，只剩署名那半边。另外半边在谁手里他不说，也没人敢问。" },
  { name: "缺角骰子", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["赌具"], desc: "六点那角磕缺了一块，掷出来总往那边偏。他知道，赌坊的人也知道——但没人当面说破。" },
  { name: "油腻头巾", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["杂物"], desc: "看不出本来颜色的一条头巾，汗渍叠着汗渍。天都镇的人隔着半条街就认得出这块布。" },
  { name: "金蛋", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["奇物", "禽产"], desc: "大公鸡下的蛋，通体金黄——不是金子，是蛋壳真就这个色。鱼定大娘研究了半个月也没研究明白，最后决定不吃，供起来。" },
  // ── 青城装备（道门·雅江）──
  // 设计稿只写了食品/武学/招式/伙伴，没有装备章节，而 catalog 里护甲一栏只有僧袍与
  // 袈裟（佛门），道士无衣可穿。这几件按「具名物优先用 catalog 里有主的（掉出来有
  // 来历）」补上，主人就是三清殿那几位，effect/sixDim 按同档具名物的既有惯例给。
  { name:"青竹杖", category:ITEM_CATEGORY.WEAPON, quality:"紫", tags:["武器","杖","门派"], effect:{ onCounterSuccessDamageRatio: 0.5, onCounterSuccessEnergyGain: 2 }, sixDim:{悟性:2}, desc:"一清道长手里那根杖，通体青竹，握处已被磨成琥珀色。他很少拿它当兵器——点地、指路、敲不听话的弟子。真要动手时才发现杖比剑重。" },
  { name:"鹤鸣剑", category:ITEM_CATEGORY.WEAPON, quality:"紫", tags:["武器","剑","门派"], effect:{ forceFirst: true }, sixDim:{身法:1}, desc:"松鹤道长的剑，剑脊起一道细棱，出鞘时空气被劈开的声音像鹤唳。青城剑法讲绵柔，这柄剑偏偏锋利得不讲道理——跟它主人一个脾气。" },
  { name:"十三针囊", category:ITEM_CATEGORY.WEAPON, quality:"蓝", tags:["武器","暗器","医"], effect:{ ignoreDefenseRatio: 0.3 }, sixDim:{悟性:1}, desc:"玉真子的针囊，十三支长短不一的钢针插在羊皮卷里。他管这叫针不叫暗器——「针是治病的，只是有些病长在别人身上。」" },
  { name:"青城道袍", category:ITEM_CATEGORY.ARMOR, quality:"蓝", tags:["护具","道袍","门派"], effect:{ immuneControl: true }, sixDim:{悟性:1}, desc:"三清殿道士的常服，靛青粗布，交领右衽，袖口收得极窄——青城派讲究袖不带风，免得剑意被袖子带偏。下摆有一圈竹叶暗纹。" },
  { name:"青城练气服", category:ITEM_CATEGORY.ARMOR, quality:"绿", tags:["护具","门派"], sixDim:{根骨:1}, desc:"剑坪上练剑的弟子穿的短打，比道袍利索，洗得发白。松鹤道长说穿这个摔了不心疼——「道袍摔破了要自己缝，缝一晚上，比摔疼。」" },
  { name:"离堆水则牌", category:ITEM_CATEGORY.ACCESSORY, quality:"蓝", tags:["饰品","治水","雅江"], effect:{ energyRestore: 1 }, sixDim:{智谋:1}, desc:"宝瓶口水则石的拓片刻成的小木牌，上面是「深淘滩、低作堰」六个字。雅江人下水前都摸一摸——不是求平安，是提醒自己水有水的道理。" },
  { name:"青城符箓袋", category:ITEM_CATEGORY.ACCESSORY, quality:"绿", tags:["饰品","符箓","门派"], sixDim:{气运:1}, desc:"竹青宣写的符折成三角，装在靛蓝布袋里。玉真子说符本身不灵——「灵的是写符那半个时辰你什么都没想。」" },
];

// ---------------------------------------------------------------------------
// 五、制式量产（武器10 / 装备10 / 饰品10）—— 江湖通货
// ---------------------------------------------------------------------------
// 跟上面"具名物件"是两个层次：具名是独一份、有来历、带私人故事的宝贝；制式是
// 成批打造、流派/产地/用途成套的量产货，铺满白→红全梯度，供商店常规铺货与
// 路途掉落。用户拍板：低中高各1-2个型号；只有少量高阶（紫橙红）制式挂"轻"特效
// （比具名物温和、更通用），白绿蓝素攻素防。制式的脑洞开在"批量特征"上——
// 某个门派/作坊/地域成套的制式风味，不写具体人名。standardIssue:true 标记通货身份。
const S = true; // standardIssue 简写

// —— 制式武器10（白2 绿2 蓝2 紫2 橙1 红1）——
export const STANDARD_WEAPONS = [
  { name: "乡勇木棓", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.0, standardIssue: S, desc: "曲措乡各村团练发下来的枣木短棒，一头烤硬熏黑。谁家都有一根，白天赶牦牛，夜里守寨门——打不死人，但能把偷粮的手打肿三天。" },
  { name: "市集杀猪刀", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.05, standardIssue: S, desc: "天都镇铁铺按斤称着卖的宽背厚刀，本是杀年猪用的。江湖人图它便宜结实，磨一磨也能开脸——就是拔出来时总带着一股洗不掉的油腥。" },
  { name: "巡捕营制式腰刀", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.2, standardIssue: S, desc: "土司府巡捕营统一配发，刀鞘烙着编号，握把缠红漆布。制式归制式，二十把里总有三五把是以次充好的私铸货——认得出的老兵会挑刀柄不晃的那把。" },
  { name: "马帮护商弩", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.15, standardIssue: S, desc: "鹰曲马帮走商路防狼防匪的手弩，机括简陋但上弦快。弩身刻着马帮记号，转手过好几道，记号叠着记号，像一截被反复烙印的木头。" },
  { name: "锦官坊标兵剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.3, standardIssue: S, desc: "锦官城铸剑坊接官府订单成批打的制式剑，剑格统一雕缠枝纹，锋口验过才出坊。一整个武馆能配齐一色的这剑——齐是齐了，就是少了点各自的脾气。" },
  { name: "黑风寨分发刀", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.25, standardIssue: S, desc: "巴桑给新入伙兄弟统一发的厚背刀，刀身没花样，刀柄一律缠三圈麻绳。寨规：刀可以钝，麻绳不能松——松了说明你偷懒没保养，先罚站三天寨门。" },
  { name: "雪山派传习剑", category: ITEM_CATEGORY.WEAPON, quality: "紫", atkMul: 1.4, standardIssue: S, effect: { onCounterSuccessDamageRatio: 0.25 }, desc: "雪山派内门弟子出师时统一授予的传习剑，剑脊一道浅浅的松纹（比松纹剑那道淡），是门派量产而非亲铸。剑随人走，人亡剑归——练功堂剑架上空着的位置，比挂着的更让人不敢多看。" },
  { name: "欢喜堂供役杖", category: ITEM_CATEGORY.WEAPON, quality: "紫", atkMul: 1.35, standardIssue: S, effect: { enemyCostPenalty: { value: 1, turns: 2 } }, desc: "欢喜堂外院供役统一持的铜头长杖，杖身缠暗红布条，走起来布条扫地无声。梵衍那说这不是兵器是法器——可挨过一杖的人都知道，法器也硌骨头，且沾了那股香，手脚发沉。" },
  { name: "土司府仪卫戟", category: ITEM_CATEGORY.WEAPON, quality: "橙", atkMul: 1.5, standardIssue: S, effect: { forceFirst: true }, desc: "跑马大会开场，土司府三十骑手方阵统一擎的仪卫长戟，戟缨染成一色的赭红。中看，也中用——格桑顿珠治军严，这批戟的锋刃是真开过的，方阵一动，气势先压人半头。" },
  { name: "官铸镇仓槊", category: ITEM_CATEGORY.WEAPON, quality: "红", atkMul: 1.6, standardIssue: S, effect: { forceFirst: true, ignoreDefense: true }, sixDim: { 身法: 2, 体魄: 1 }, desc: "锦官城军械库封存的重槊，本是戍边镇仓的制式重兵，一整排列在架上落灰。柳青鸢上任清点军械时发现少了两杆——账上写的是“锈蚀报废”，她盯着那行字看了很久，没说话。" },
];

// —— 制式装备10（白2 绿2 蓝2 紫2 橙1 红1）——
export const STANDARD_ARMORS = [
  { name: "乡勇布甲", category: ITEM_CATEGORY.ARMOR, quality: "白", defMul: 1.0, standardIssue: S, desc: "团练发的粗麻缝棉甲，前襟一块补丁摞补丁。挡不住刀，挡得住冷——多数乡勇一辈子只指望它挡冷。" },
  { name: "脚夫护肩", category: ITEM_CATEGORY.ARMOR, quality: "白", defMul: 1.05, standardIssue: S, desc: "天都镇脚行统一发的皮护肩，扛货压出来的包浆比铠甲还厚。江湖人拿它当轻甲使——图的是不起眼，混在人堆里没人多看一眼。" },
  { name: "巡捕营皂隶衣", category: ITEM_CATEGORY.ARMOR, quality: "绿", defMul: 1.2, standardIssue: S, desc: "土司府巡捕营的青黑制式服，衣摆压铅边防风也防人扯。穿上它在鱼定村走一圈，牧民的门都关得快一点——不是怕人，是怕这身衣裳。" },
  { name: "马帮硬皮褂", category: ITEM_CATEGORY.ARMOR, quality: "绿", defMul: 1.15, standardIssue: S, desc: "鹰曲马帮走高原的耐磨皮褂，桐油反复浸过，硬挺得能挂在墙上立着。褂子越旧越值钱——旧，说明主人跑了很多趟还活着。" },
  { name: "锦官坊标兵甲", category: ITEM_CATEGORY.ARMOR, quality: "蓝", defMul: 1.3, standardIssue: S, desc: "铸剑坊配套打的制式扎甲，甲片一色的青灰，编绳一色的麻黄。一队差役穿出来齐整威风，但老兵嫌它腋下卡——柳青鸢改软甲版型，就是被这甲逼的。" },
  { name: "守塔僧团铁网衲", category: ITEM_CATEGORY.ARMOR, quality: "蓝", defMul: 1.35, standardIssue: S, desc: "白塔守塔僧统一的铁网夹层僧衲，比外袍那件轻些，是巡夜用的。地宫里潮，铁网锈得慢却锈得匀，一件衲子传三代守塔僧，锈色就是年轮。" },
  { name: "雪山派御寒裘", category: ITEM_CATEGORY.ARMOR, quality: "紫", defMul: 1.4, standardIssue: S, effect: { hpRestore: 0.08 }, sixDim: { 根骨: 2 }, desc: "雪山派弟子上顶峰当值统一配的羊羔皮裘，内衬缝了艾草。比雪豹裘轻贱得多，却是弟子们真正天天穿的那件——真金白银的宝物锁在箱底，护命的是这些不起眼的制式货。" },
  { name: "欢喜堂内院锦襕", category: ITEM_CATEGORY.ARMOR, quality: "紫", defMul: 1.35, standardIssue: S, effect: { enemyCostPenalty: { value: 1, turns: 1 } }, sixDim: { 魅力: 1, 智谋: 1 }, desc: "欢喜堂内院弟子统一的暗红锦襕，比礼服素，日常穿。锦线里掺了极细的香丝，穿久了自己闻不出，别人一近身先恍神半瞬——罗琦说这是梵衍那的主意，她不喜欢。" },
  { name: "土司府仪卫明光铠", category: ITEM_CATEGORY.ARMOR, quality: "橙", defMul: 1.5, standardIssue: S, effect: { onCounterSuccessDamageRatio: 0.3 }, desc: "骑手方阵的制式明光铠，胸背两面圆护擦得能照见人。格桑顿珠不许手下把铠甲当摆设——每副都配实战绑带，挨了打能顺势卸力反撞。中看的皮相底下，是真练过的骨头。" },
  { name: "官铸镇边重铠", category: ITEM_CATEGORY.ARMOR, quality: "红", defMul: 1.6, standardIssue: S, effect: { onCounterSuccessDamageRatio: 0.4, ignoreDefensePartialImmune: 0.3 }, sixDim: { 根骨: 2, 体魄: 2 }, desc: "锦官军械库封存的戍边重铠，全身鱼鳞甲片，一个人穿不动，得两个人抬着套。太平年月锁在库里生绿锈，柳青鸢摸着冰凉的甲片想：上一个穿它的人，六年前跟着上司一起，没回来。" },
];

// —— 制式饰品10（白2 绿2 蓝2 紫2 橙1 红1）——
export const STANDARD_ACCESSORIES = [
  { name: "村社护佑结", category: ITEM_CATEGORY.ACCESSORY, quality: "白", sixDim: { 气运: 1 }, standardIssue: S, desc: "鱼定村口经幡拆下的旧布条打的结，家家门楣挂一个。不灵验，但挂着心安——才旦说，心安本身就是一种灵验。" },
  { name: "脚夫铜牌", category: ITEM_CATEGORY.ACCESSORY, quality: "白", sixDim: { 体魄: 1 }, standardIssue: S, desc: "天都镇脚行发的记工铜牌，穿绳挂脖子上，磨得字都平了。扛一趟货刻一道，牌子越油亮，肩膀越结实——也越驼。" },
  { name: "巡捕营腰牌", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", sixDim: { 魅力: 1, 智谋: 1 }, standardIssue: S, desc: "巡捕营制式腰牌，火漆烙号。亮出来能唬住半条街的市井混混——但在真认得土司府门道的人面前，这牌子反而是个把柄。" },
  { name: "马帮路引", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", sixDim: { 气运: 1, 智谋: 1 }, standardIssue: S, desc: "鹰曲马帮通用的过路凭信，牛皮上烙鹰纹，背面盖了沿途各卡的骑缝章。章越多越好使——每一个章都是一次“这人以前来过、没惹事”的背书。" },
  { name: "锦官验讫牙牌", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", sixDim: { 智谋: 2 }, standardIssue: S, desc: "锦官城官市统一发的验货牙牌，商户凭它进出。牌上一道道刻痕是历年验讫的记录——懂行的人拿到手先数刻痕，数完就知道这商户底子有多深。" },
  { name: "雪山问心珠", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", effect: { energyRestore: 1 }, sixDim: { 悟性: 1 }, standardIssue: S, desc: "雪山派弟子入门统一分的一串素木珠，十八颗，不值钱。师父说犯难时捻一颗问一句心——珠子答不了，但捻着捻着，人自己就答了。" },
  { name: "欢喜堂持斋牌", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", effect: { freezeEnergyRecovery: true }, sixDim: { 魅力: 1 }, standardIssue: S, desc: "欢喜堂外围信众统一佩的持斋牌，暗红漆木刻梵字。牌子熏过堂里的香，佩久了自己那点心事就淡了——罗琦说这才是最厉害的地方，不用下药，人自己就交出去了。" },
  { name: "土司府门客玉扣", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", sixDim: { 魅力: 2, 智谋: 1 }, standardIssue: S, desc: "土司府养的清客门人统一佩的青玉扣，形制一色，只在成色上分高下。管家陆福生最会看这个——一眼扫过谁的玉扣发暗，谁就该被从名单上划掉了。" },
  { name: "官眷诰命簪", category: ITEM_CATEGORY.ACCESSORY, quality: "橙", effect: { onCounterSuccessEnergyGain: 2 }, sixDim: { 魅力: 3 }, standardIssue: S, desc: "锦官城按品级颁给官眷的制式银簪，簪头花样定死了不许僭越。柳青鸢有一支，从没戴过——她说这簪子的花样是别人替她定的，连她该是什么身份，都不用她自己开口。" },
  { name: "御赐銮铃", category: ITEM_CATEGORY.ACCESSORY, quality: "红", effect: { enemyCostPenalty: { value: 2, turns: 2 }, onCounterSuccessEnergyGain: 2 }, sixDim: { 魅力: 2, 智谋: 2 }, standardIssue: S, desc: "本是官驿快马统一悬的铜銮铃，铃声一响沿途让道——太平年月早不用了，成了库房里论堆称的旧物。可老驿卒说，六年前有一队人快马出城，銮铃摇得整条官道都静下来，那之后就再没听过这声了。" },
];

// ---------------------------------------------------------------------------
// 六、西南武林库·三十品 —— 更放飞的具名宝器
// ---------------------------------------------------------------------------
// 跟第一批具名物同层（named），但整体档次更高（橙紫居多）、脑洞更大、故事更满，
// 且多与现有人物/剧情深度勾连：断念之锷接缴获剑"断念"、青鸢尾/软鞭·柳接柳青鸢、
// 霜角弓接吊睛虎王+狼王、呼延雪的剑穗接雪山崖底真相……属"传世名器/私人信物"级。
// 数值同样倍率跟公式走、特效复用武学标志位；情感信物类（马鞭/剑穗/旧锁/拓片）
// 攻防低但六维/风味重，是"叙事分量 > 战力"的那一类。
export const LEGENDARY = [
  { name: "紫电", category: ITEM_CATEGORY.WEAPON, quality: "橙", atkMul: 1.6, effect: { forceFirst: true }, sixDim: { 身法: 2 }, desc: "出鞘时隐隐有紫芒流转，非淬毒，是陨铁锻打时渗入的天然矿纹。柳青鸢年轻时在锦官城暗巷见过一次——持剑者出剑太快，她只看到一道紫线从巷头拉到巷尾。" },
  { name: "青霜", category: ITEM_CATEGORY.WEAPON, quality: "橙", atkMul: 1.5, effect: { applyMark: { name: "内伤印", stacks: 2 }, applyMarkChance: 0.4, freezeEnergyRecovery: true }, desc: "剑身覆一层幽蓝薄锈，触手冰凉，仿佛刚从雪里刨出。雪山派故老相传，此剑曾插在白塔塔顶冻了一百年，拔剑时锈迹剥落，露出剑脊上天然凝结的霜花纹。中剑者寒气入体，真气凝滞。" },
  { name: "含阿", category: ITEM_CATEGORY.WEAPON, quality: "橙", atkMul: 1.45, effect: { forceFirst: true, onCounterSuccessDamageRatio: 0.3 }, sixDim: { 身法: 2 }, desc: "剑名“含阿”，无姓无名，唯余一个“阿”字。玉器轩掌柜说是百年前一对剑客的定情信物，剑身极软，可绕腕三圈如银镯。女剑客死后，男剑客把剑当在当铺，当期写的是“永赎”——再没来过。" },
  { name: "西瓜刀", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.1, effect: { lowEnemyEnergyBonus: { threshold: 2, multiplier: 2 } }, desc: "锦官城夏日街头瓜贩人手一把，薄刃宽身，切瓜如切豆腐。切了十年西瓜，刀刃渗进瓜汁，舔起来是甜的。后来有个刺客用过一次——一刀封喉，伤口是甜的。" },
  { name: "降魔杵", category: ITEM_CATEGORY.WEAPON, quality: "紫", atkMul: 1.4, effect: { ignoreDefense: true, detonateMark: { perStackRatio: 0.4 } }, sixDim: { 根骨: 2 }, desc: "白塔守塔僧团代代相传的镇塔法器，杵身刻满梵文降魔咒。老僧说这杵不是用来杀人的——是用来敲地宫机关石板。敲对了门开；敲错了杵头金刚铃会响，但没人知道响铃代表什么。" },
  { name: "红缨枪", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.2, desc: "黑风寨马队人手一杆，枪尖磨得锃亮，红缨被风吹雨打褪成灰白。巴桑那杆的红缨是他阿妈出嫁时扎头的红布——他从未对人说过，但每次擦枪都先擦红缨。" },
  { name: "软鞭·柳", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.3, effect: { enemyCostPenalty: { value: 1, turns: 2 } }, sixDim: { 身法: 1 }, desc: "柳青鸢年轻时练鞭的旧物，鞭身是熊山老藤，鞭梢系一枚青铜柳叶。老兵说她抽断过三棵柳树，这鞭抽出来的声音不像鞭响，像风穿过柳条——嗖的一声，然后是叶子落地的声音。" },
  { name: "月照", category: ITEM_CATEGORY.WEAPON, quality: "橙", atkMul: 1.55, effect: { forceFirst: true, ignoreDefense: true }, desc: "剑身宽厚如门板，通体灰白，只有月圆之夜浸在贡措海水中，剑脊才浮出极淡的蓝纹——形如月光照水面。巴桑说此剑非人力所铸，是贡措海底一块陨石被湖水冲刷千年自然成形。" },
  { name: "万工如意棍", category: ITEM_CATEGORY.WEAPON, quality: "紫", atkMul: 1.4, effect: { doubleVsStatus: true, afterStatusBonus: 0.5 }, sixDim: { 悟性: 1 }, desc: "两端各箍一匝暗金如意箍，中段暗藏三道活扣，旋之可缩为齐眉短棍、簪棍、判官笔三形。铸剑坊老匠人打了一万锤，锤到最后一面如意图案时锤头裂了——他说这棍自己不想打完，剩三锤留给后人。" },
  { name: "百花杀", category: ITEM_CATEGORY.WEAPON, quality: "橙", atkMul: 1.45, effect: { applyMark: { name: "内伤印", stacks: 2 }, applyMarkChance: 0.5, enemyCostPenalty: { value: 2, turns: 2 } }, sixDim: { 魅力: 2 }, desc: "兰姐压箱底的暗器囊，内藏三十六枚淬了百花引残料的银针。她说这针不是用来杀人的——是用来让不听话的人听话。但她自己一次没用过，因为“让人听话这种事，针做不到，蛊也做不到”。" },
  { name: "梵音铃", category: ITEM_CATEGORY.WEAPON, quality: "紫", atkMul: 1.35, effect: { freezeEnergyRecovery: true, enemyCostPenalty: { value: 1, turns: 2 } }, desc: "梵衍那从天竺带来的旧物，形如手铃而无声，只有被欢喜真气催动时才会发出人耳听不到的震颤。罗琦试过一次——铃响时心里忽然安静了一瞬，像有人在很远处念了一句她听不懂的经。" },
  { name: "青鸢尾", category: ITEM_CATEGORY.WEAPON, quality: "橙", atkMul: 1.5, effect: { forceFirst: true, enemyCostPenalty: { value: 2, turns: 1 } }, sixDim: { 智谋: 2 }, desc: "柳青鸢亲手磨的飞刀三柄，形如鸢尾花瓣，刀脊刻着她名字里的“鸢”字。三柄藏在官袍袖口、腰间、靴筒——老兵说她的上司失踪后她开始随身带刀，不是防人，是防自己某天会忘了查下去。" },
  { name: "血刀·不饮", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.35, effect: { lowHpBonus: 0.25 }, desc: "刀身暗红如干涸的血，刀柄缠着浸过牦牛血的麻绳。老巡捕说这刀砍过三十七个人，但刀主从不擦刀——“血干了就干了，擦掉等于忘了。忘了的人，下次砍人时会犹豫”。" },
  { name: "霜角弓", category: ITEM_CATEGORY.WEAPON, quality: "紫", atkMul: 1.45, effect: { forceFirst: true, ignoreDefense: true }, desc: "用吊睛虎王的角状骨增生打磨，弓弦是银灰独眼狼王的筋腱。老猎户说此弓拉满时会发出虎啸般的低鸣，那不是弓鸣——是两种本不该共存的东西被强行绷在一起时发出的哀音。" },
  { name: "格桑铃", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", sixDim: { 气运: 2, 魅力: 1 }, desc: "一串银铃，每颗铃铛内壁刻一朵格桑花。嘎则系在脚踝，走路叮当，雪团循铃声在灌木丛里追她，每次都能找到——因为铃声里混着她独有的笑声频率。" },
  { name: "黑风令", category: ITEM_CATEGORY.ACCESSORY, quality: "白", sixDim: { 魅力: 1, 气运: 1 }, desc: "黑风寨通行令牌，正面刻狼头，背面刻“说话算话”。嘎则闲时在后山捡木板刻着玩，巴桑说她刻得太丑，但所有兄弟都挂上了没人嫌——因为格桑（嘎则）说“刻坏了也不许扔”。" },
  { name: "藏银经轮", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", effect: { hpRestore: 0.08, energyRestore: 1 }, sixDim: { 悟性: 2 }, desc: "喇嘛庙前任经师生前所用的转经轮，银壳被手指摩挲得发亮，但经轮里装的不是经文——是空白的纸。达摩药堂师父说经师圆寂前把经文取出来了，“他说经不在纸上，在转经人心里”。" },
  { name: "熊山猎哨", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["工具", "狩猎", "诱敌"], desc: "鱼定村猎户通用的骨哨，吹起来声音像母鹿发情。老猎户那把是用银灰独眼狼王父亲的腿骨做的——他说这哨一吹，虎王不会来，但狼王会来。狼王以为是它爹在叫。" },
  { name: "断念之锷", category: ITEM_CATEGORY.WEAPON, quality: "橙", atkMul: 1.55, effect: { ignoreDefense: true, lowHpBonus: 0.2 }, desc: "半截断剑，只剩剑锷和四寸残刃，却比寻常宝剑更利。原剑“断念”被巴桑缴获时已断。剑锷上诗句后半句被磨平，柳青鸢看过之后沉默半晌，说后半句她知道——“断念如断骨，不断心上人”。" },
  { name: "云锦香囊", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", effect: { hpRestore: 0.05 }, sixDim: { 悟性: 1, 魅力: 1 }, desc: "罗琦从大理带来的旧物，内装安息香、迦南脂、冰片三味，是她母亲临终前缝的。布料是白族扎染，蓝色已洗得泛白。她说这东西不能打开——打开的话，大理就散了。" },
  { name: "贡措水晶坠", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", sixDim: { 魅力: 2, 气运: 1 }, desc: "卓玛托丹增从贡措海底捞上来的水晶碎石打磨而成，澄澈如冰。她只在跑马大会那天戴过一次——梅朵看见说了句“好看”，卓玛回寨后摘下来包进红布，从此再没戴。不是不高兴，是觉得那天已经够好了。" },
  { name: "老兵的护腕", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", effect: { onCounterSuccessEnergyGain: 1 }, sixDim: { 体魄: 1 }, desc: "老兵退伍汉在战场上捡的护腕，原主是他的营官，战死前从腕上解下塞给他。内侧墨笔写着一行小字——“活着回来”。老兵说这行字每次出征前都看，看了二十年，终于不用看了。" },
  { name: "梅朵的马鞭", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", sixDim: { 魅力: 3 }, desc: "梅朵十七岁亲手编的马鞭，柄上嵌一颗绿松石——是她阿妈留给她的唯一遗物。她说这鞭从来没抽过马，只在跑马大会上举起来挥过。她说马不需要打——鞭子是举给人看的。" },
  { name: "才旦的旧锁", category: ITEM_CATEGORY.ACCESSORY, quality: "白", sixDim: { 智谋: 1 }, desc: "一把打不开的铜锁，锁孔被泥封死。才旦说她阿爸死前把界石下的旧账册用这把锁锁在柜子里，钥匙扔进了熊曲。“阿爸不想让人看，我就不看。但锁不能扔——锁是阿爸的嘴。”" },
  { name: "扎西的猎叉", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.1, desc: "叉尖歪了，叉杆被手汗浸得发亮。扎西年轻时用它在大草甸叉死过一头野狼——叉尖卡进狼肩胛骨拔不出，他被拖行十步最后还是扎透了。后来卓玛出生，他把叉尖磨钝，从此只叉草垛。" },
  { name: "守塔僧的念珠", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", effect: { hpRestore: 0.05 }, sixDim: { 悟性: 1 }, desc: "白塔守塔老僧捻了三十年的念珠，珠子是熊山野核桃核磨的，光滑如玉。但珠串只剩九颗——他说本来一百零八颗，每守一年地宫就散一颗，散到最后只剩这九颗，“说明我守够了”。" },
  { name: "欢喜残卷", category: ITEM_CATEGORY.MISC, quality: "紫", tags: ["古籍", "功法", "剧情"], desc: "欢喜教前任教主留下的手抄残本，封面被火烧掉一半，只剩“欢喜”二字的上半截。罗琦说这书里的功法她只敢看前三页——第四页开头写“舍己从人”，她怕自己看懂了会做不到。" },
  { name: "百花引瓷瓶", category: ITEM_CATEGORY.MISC, quality: "橙", tags: ["容器", "剧情核心", "虎胆三重门"], desc: "百花引的原装瓷瓶，瓶底压着兰姐写的字条——“此物害人，炼者自慎”。瓶子空了她也没扔，摆在梳妆台上当花瓶。插的不是花，是她在昆明时院子里种的狗尾巴草，晒干了像一朵不散的烟。" },
  { name: "呼延雪的剑穗", category: ITEM_CATEGORY.ACCESSORY, quality: "白", sixDim: { 悟性: 1, 气运: 1 }, desc: "白色剑穗，编得歪歪扭扭，是何雨谢教呼延雪编的第一根。穗尾沾过雪山崖底的雪，洗多次还有一小块淡灰。呼延雪说不是脏——是那天她在崖底哭了，泪滴在穗上，干了之后永远多了一小块湿痕。" },
  { name: "曲措乡界石拓片", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["卷轴", "信物", "剧情"], desc: "才旦在界石重立那天用纸墨拓下旧界石上的“曲措乡”三字。旧石头要埋进土里，但字不能丢。拓片上还有前任村长当年刻字的凿痕，一笔一划歪歪的，像喝醉了写的——才旦说阿爸不会写字，拿凿子当毛笔用。" },
];

// ---------------------------------------------------------------------------
// 七、通货武器补完（15把，白/绿/蓝各5）—— 填公共池低中档缺口
// ---------------------------------------------------------------------------
// 本批专补"缺口热力图"里武器白绿蓝偏薄的洞：各据点杂货铺/铁铺/武馆的流通货，
// 有地域来历但不写私人故事，走 standardIssue（量产通货），入商店 floating + 掉落池。
export const SUPPLEMENT_WEAPONS = [
  // 白档·基础通货
  { name: "鱼定猎刀", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.1, standardIssue: S, desc: "鱼定村三曲交汇处最常见的猎刀，刀柄缠着旧布条。杀猪宰羊、防身赶狼都用它，钝了在门槛石上蹭两下又能用。" },
  { name: "狼曲短猎矛", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.1, standardIssue: S, desc: "玉泉寨牧民防狼用的短矛，矛尖是旧马蹄铁打扁磨出来的。牧民说扎狼要扎脖子，扎身上它还能咬你一口。" },
  { name: "锦官巡街棍", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.05, standardIssue: S, desc: "锦官城差役配发的红漆硬木棍，漆面磨得斑驳。打人不见血、留得住活口——差役说这是规矩，也是本事。" },
  { name: "熊山柴斧", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.15, standardIssue: S, desc: "大草甸和熊山进山的人都背一把伐木斧，开过刃。劈柴劈得，遇上野物一斧下去也劈得——就是抡起来慢，得算准了再落。" },
  { name: "天都短匕", category: ITEM_CATEGORY.WEAPON, quality: "白", atkMul: 1.1, standardIssue: S, desc: "天都镇市井常见的护身短匕，鞘上刻着摊主自家记号。买的人多半不为杀人，为的是走夜路心里有个底。" },
  // 绿档·进阶通货
  { name: "孟记弯刀", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.25, standardIssue: S, desc: "天都镇孟记铁铺的招牌货，刀背加厚、适合劈砍，马帮最爱。孟铁匠说这刀的好处是“钝了也能砸，砸不动了还能当柴刀”。" },
  { name: "雪山巡山剑", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.2, standardIssue: S, desc: "雪山派外门弟子的制式佩剑，剑身窄长，适合雪地步战。比传习剑素得多，是弟子入门头三年用的——练废了不心疼。" },
  { name: "喇嘛庙戒刀", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.2, standardIssue: S, effect: { hpRestore: 0.05 }, desc: "喇嘛庙护寺僧的佩刀，刀镡刻六字真言，开过光的护身兵器。僧人说这刀不为杀生，为的是“让起了歹念的人，看一眼这几个字，收收手”。" },
  { name: "玉泉马帮刀", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.25, standardIssue: S, desc: "玉泉寨马帮护卫的制式长刀，刀柄缠牦牛皮绳，马背上单手挥砍不脱手。刀身有一道道细痕，都是在狼曲护商时留下的。" },
  { name: "黑风短矛", category: ITEM_CATEGORY.WEAPON, quality: "绿", atkMul: 1.25, standardIssue: S, desc: "黑风寨给兄弟分发的武器，矛身刻着寨规首句“不抢救命口粮”。巴桑说刻这句不是给外人看的，是给拿矛的人自己看的。" },
  // 蓝档·精良通货
  { name: "鹰曲长剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.3, standardIssue: S, sixDim: { 身法: 1 }, desc: "喇嘛庙藏经阁有记载的制式长剑，剑身有鹰羽纹，百年前曲措乡铁匠参照唐剑形制所铸。图谱尚在，会打的铁匠却越来越少了。" },
  { name: "狼曲猎弩", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.3, standardIssue: S, effect: { lowEnemyEnergyBonus: { threshold: 2, multiplier: 2 } }, desc: "老猎户同款的精制猎弩，熊山猎户口耳相传的“三发不卡”好弩。上弦费力，但认准了猎物再射，十有八九不落空。" },
  { name: "锦官精铁剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.35, standardIssue: S, desc: "锦官城铸剑坊的镇坊之作——不是一把，是“这一批”，每把剑脊都有坊号戳记。买的时候要认戳记，没戳记的多半是仿的。" },
  { name: "天都护商长刀", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.35, standardIssue: S, effect: { onCounterSuccessDamageRatio: 0.3 }, desc: "天都镇护商队制式，刀柄包铜、刀身加宽。护商队凭这刀在狼曲杀退过三次劫匪，第三次之后，劫匪就绕着挂这刀的商队走了。" },
  { name: "贡措冰铁矛", category: ITEM_CATEGORY.WEAPON, quality: "蓝", atkMul: 1.35, standardIssue: S, effect: { freezeEnergyRecovery: true }, desc: "贡措海畔偶然掘出的冰铁打造，矛尖泛着湖水的冷蓝色，来历不明但锋利异常。握久了掌心发凉，挑中人时，那点寒意会顺着伤口钻进去。" },
];

// ---------------------------------------------------------------------------
// 八、五神兵（红字武器）—— 各配独立支线，激活5处闲置隐藏地点
// ---------------------------------------------------------------------------
// 特效字段映射说明（避免死字段）：设计稿里的自造字段已映射到 resolveTurn 现成或
// 本轮新增会消费的字段：
//   onHitFreeze → freezeEnergyRecovery（命中封回气，现成）
//   counterDamageRatio → onCounterSuccessDamageRatio（现成）
//   energyRecoveryOnCounterSuccess → onCounterSuccessEnergyGain（现成）
//   justiceStrike / immuneControl / forceCrit / rebirthOnce → 本轮在 resolveTurn/
//     DuelScreen 新增消费分支（见对应文件），不是死字段
//   beastFear → 战斗外遇怪率，接 encounter.js（本轮标记，随支线落地时接）
// 神兵不进公共池、不进商店/掉落——只通过各自支线获得（named:true，非 standardIssue）。
export const DIVINE_ARMS = [
  {
    name: "霜天月", category: ITEM_CATEGORY.WEAPON, quality: "红", atkMul: 1.6,
    effect: { forceFirst: true, freezeEnergyRecovery: true },
    sixDim: { 身法: 3 },
    desc: "呼延大侠的佩剑。三十年前他从雪山之巅坠崖时，这把剑先他一步脱手，插在崖底冰壁上冻了三十年。剑身裹着一层永不解冻的薄霜，剑格处刻着一个“雪”字。何雨谢只见过它一次——大婚那天，呼延大侠执此剑挑开她的红盖头。",
  },
  {
    name: "地藏", category: ITEM_CATEGORY.WEAPON, quality: "红", atkMul: 1.6,
    effect: { ignoreDefense: true, justiceStrike: true },
    sixDim: { 悟性: 2, 根骨: 1 },
    desc: "桑杰大侠的佩刀。他带这把刀来贡措海，本是想当着呼延大侠的面把假地契和刀一起沉进湖底——“桑杰家从此不沾兵戈”。刀没来得及沉。他死前用最后的力气把刀插进密室石壁，刀尖没入石中三寸，三十年没锈。",
  },
  {
    name: "不动明王杵", category: ITEM_CATEGORY.WEAPON, quality: "红", atkMul: 1.5,
    effect: { onCounterSuccessDamageRatio: 1.5, immuneControl: true, onCounterSuccessEnergyGain: 3 },
    sixDim: { 根骨: 3 },
    desc: "喇嘛庙前任经师从西域带回的法器，本是修“不动明王法”时杵地结界用的。经师去贡措海前把它留在白塔地宫，对守塔僧说：“等一个能听懂我为什么去贡措海的人。”杵身刻梵文“不动”，杵地时地面微微震动，像地下有东西在回应。",
  },
  {
    name: "虎啸", category: ITEM_CATEGORY.WEAPON, quality: "红", atkMul: 1.55,
    effect: { forceCrit: { multiplier: 1.8 }, lowHpBonus: 0.8, beastFear: 0.7 },
    sixDim: { 体魄: 2, 气运: 1 },
    desc: "用吊睛虎王的牙和筋制成的弓。弓胎是三十年前一具无名猎户遗骸旁的半成品，用了三十年等一根配得上的弦——虎王的筋正好。弓身是熊山老铁木，拉开时有虎啸声，方圆十里的野兽听到会四散奔逃。",
  },
  {
    name: "涅槃引", category: ITEM_CATEGORY.WEAPON, quality: "红", atkMul: 1.4,
    effect: { selfSacrifice: { hpCost: 30, damageMultiplier: 3.5 }, rebirthOnce: true },
    sixDim: { 悟性: 3 },
    desc: "一根用凤凰木芯做的长香，前任经师游历天竺边境时从一个苦行僧手中所得。苦行僧说：“这香燃三次。第一次见你想见的人，第二次听他想说的话，第三次——你自己决定要不要跟他走。”经师只敢燃过一次，藏在了荤食地下室。",
  },
];

// ============================================================================
// 核心：把 catalog 条目实例化成一个完整物品对象
// ============================================================================
import { statsForQuality, priceForQuality } from "../equipment.js";

// 攻防倍率折成"加数"：先用 equipment 的品质公式算出基准 atk/def，
// 再乘具名倍率（atkMul/defMul，1.0~1.6），四舍五入 —— 结果仍是 equipAtk/equipDef
// 这个"加数"，进 calcBaseDamage/calcDefenseValue，不新增乘法层（用户："倍率跟着公式走"）。
// 价格：具名物品在同品质基准价上，按倍率同步抬价（贵重物件更值钱），卖价仍为买价一半。
export function makeCatalogItem(entry) {
  const base = statsForQuality(entry.category, entry.quality); // { atk?/def?/durability?/bonus? }
  const price = priceForQuality(entry.category, entry.quality);

  const out = {
    id: `${entry.name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: entry.name,
    category: entry.category,
    quality: entry.quality,
    equipped: false,
    desc: entry.desc,
    named: true, // 标记：这是具名物品（走 catalog），区别于公式随机生成的匿名装备
    durability: base.durability,
  };

  // 攻击倍率（仅武器有 atk 基准）
  if (base.atk != null) {
    const mul = entry.atkMul ?? 1;
    out.atk = Math.round(base.atk * mul);
    out.buyPrice = Math.round(price.buyPrice * mul);
  }
  // 防御倍率（仅护甲有 def 基准）
  if (base.def != null) {
    const mul = entry.defMul ?? 1;
    out.def = Math.round(base.def * mul);
    out.buyPrice = Math.round(price.buyPrice * mul);
  }
  // 饰品/杂物没有攻防基准，价格用基准价（饰品的价值在 effect/sixDim，不体现在攻防倍率）
  if (out.buyPrice == null) out.buyPrice = price.buyPrice;
  if (base.bonus != null) out.bonus = base.bonus;
  out.sellPrice = Math.max(1, Math.round(out.buyPrice / 2));

  // 特效（复用武学标志位，装备时叠到招式上；接线见 combat 层）
  if (entry.effect) out.effect = { ...entry.effect };
  // 加六维（装备时加到 char.special，卸下移除）
  if (entry.sixDim) out.sixDim = { ...entry.sixDim };
  // 消耗品即时效果（食物 buff 系统接通后生效）
  if (entry.consumable) out.consumable = { ...entry.consumable };
  if (entry.tags) out.tags = [...entry.tags];

  return out;
}

// ============================================================================
// 索引 + 查询
// ============================================================================
// CATALOG 含全部：具名80 + 制式30 = 110。named 与 standardIssue 两个布尔区分层次。
export const CATALOG = [
  ...WEAPONS, ...ARMORS, ...ACCESSORIES, ...SUNDRIES,
  ...STANDARD_WEAPONS, ...STANDARD_ARMORS, ...STANDARD_ACCESSORIES,
  ...LEGENDARY,
  ...SUPPLEMENT_WEAPONS,   // 15把通货武器（standardIssue，进公共池）
  ...DIVINE_ARMS,          // 5把神兵（named，只走支线，不进公共池）
  ...JADE_WARES,           // 20件翡翠玉器成品（jadeWare，金玉行选购/预制打造）
];

// name → 条目，供"按名取物"（任务发放具名物品、商店铺货、AI 引用时反查数值）
export const CATALOG_INDEX = Object.fromEntries(CATALOG.map(e => [e.name, e]));

// 按名字生成一件物品实例；查不到返回 null（调用方回退 equipment.makeItem 公式）。
// 具名物 named:true，制式物 standardIssue:true，实例会带上对应标记。
export function makeNamedItem(name) {
  const entry = CATALOG_INDEX[name];
  if (!entry) return null;
  const item = makeCatalogItem(entry);
  if (entry.standardIssue) { item.named = false; item.standardIssue = true; }
  return item;
}

// ── 老档补丁：把 catalog 后续更新的词条同步补回旧存档里已经生成好的实例 ──────
// 物品实例是"生产时拍照"：makeCatalogItem 在物品诞生那一刻把 catalog 条目的
// effect/sixDim 复制进实例，此后 catalog 再怎么改，已经存在背包里的那份实例都
// 不会跟着变——这就是"红档武器护甲补七维"那次改动（catalog 数据从"12把只带1把"
// 补到全带）之后，老存档里早就拿到手的红档神兵右栏仍旧空空、装备了也不吃加成的
// 根源：它们诞生时 catalog 那一条压根没有 sixDim 可抄。
// 战斗/属性那边一直是活的（computeEquippedStats 每次都现读 inv 里已装备物件的
// sixDim/effect 求和），不存在"额外重算"这一步——只要把实例上缺失的字段用 catalog
// 现在的数据补上，装备加成和右栏显示会立刻一起恢复正常。
// 只按 name 精确命中 catalog 具名条目，且只补实例上**缺失/空**的字段，绝不覆盖
// 已有值——打造/金玉行定制等系统万一撞名（玩家自己给定制剑起名"折柳"之类），
// 已经写好的词条不该被这次补丁抹掉，这和 makeItemSmart 里"catalog 已有的同名键
// 不覆盖"是同一条原则。
function isEmptyDict(v) {
  return !v || typeof v !== "object" || Object.keys(v).length === 0;
}

export function backfillItemFromCatalog(item) {
  if (!item || typeof item !== "object" || !item.name) return item;
  const entry = CATALOG_INDEX[item.name];
  if (!entry) return item;
  const patch = {};
  if (entry.sixDim && isEmptyDict(item.sixDim)) patch.sixDim = { ...entry.sixDim };
  if (entry.effect && isEmptyDict(item.effect)) patch.effect = { ...entry.effect };
  return Object.keys(patch).length ? { ...item, ...patch } : item;
}

// 供读档时整袋子过一遍（老存档恢复 + 手动读档两处入口都要调，见 MudRPG.jsx）。
// 非物件（纯字符串道具）原样放过。
export function backfillInventoryFromCatalog(inv) {
  if (!Array.isArray(inv)) return inv;
  return inv.map(i => (typeof i === "object" ? backfillItemFromCatalog(i) : i));
}

// ── 智能生成：具名优先，公式兜底 ──────────────────────────────────────────
// 这是"让140件真正进游戏"的总闸。玩家背包物品、NPC carry 都改调这个：
// 传入 { name, category, quality }，若 name 命中 catalog → 吃具名的专属数值/特效/
// 六维（品质以调用方传入的为准还是以 catalog 为准？——以 catalog 条目为准，
// 因为具名物的品质是设计死的，"绿档霜牙"不该被 AI 一句话说成红档）；
// 未命中 → 用传入的 makeItemFallback（即 equipment.makeItem）走匿名公式。
// makeItemFallback 由调用方注入，避免 catalog↔equipment 循环 import。
export function makeItemSmart(spec, makeItemFallback) {
  const named = spec?.name ? makeNamedItem(spec.name) : null;
  if (named) {
    // 具名物的数值/词条以 catalog 为准（"绿档霜牙"不该被一句话说成红档）。
    // 但**调用方显式传入的 effect/sixDim 要能补上**：打造/定制出来的东西名字
    // 多半不在 catalog 里，可万一撞名（比如玩家把定制剑起名"折柳"），
    // 不该因此把这次打造出来的词条丢掉。catalog 已有的同名键不覆盖。
    if (spec.effect) named.effect = { ...spec.effect, ...(named.effect || {}) };
    if (spec.sixDim) named.sixDim = { ...spec.sixDim, ...(named.sixDim || {}) };
    return named;
  }
  return makeItemFallback(spec);
}

// 按分类/品质/标签/层次筛选（供商店按地域性质铺货，见交接任务7"用百物录充实各店"）。
// tier: "named"只出具名 | "standard"只出制式 | 不传则全部。
export function filterCatalog({ category, quality, tag, tier } = {}) {
  return CATALOG.filter(e =>
    (!category || e.category === category) &&
    (!quality || e.quality === quality) &&
    (!tag || (e.tags || []).includes(tag)) &&
    (!tier || (tier === "standard" ? e.standardIssue : tier === "named" ? !e.standardIssue : true))
  );
}

// ============================================================================
// 给 AI 看的参考文本 —— "这世界有哪些叫得出名字的物件"
// ============================================================================
// 原则：只给 AI 名字/品级/一句话来历，不给具体数值——数值永远由本表+公式裁决，
// AI 只能在叙事里自然引用/描述这些物件（"墙上挂着一柄雪山松纹剑"），不能篡改属性。
// 输出压缩成紧凑文本，控制 token 占用。
export function describeCatalogForAI({ categories } = {}) {
  const CAT_NAME = { weapon: "兵器", armor: "衣甲", accessory: "饰品", misc: "杂货" };
  const named = { weapon: WEAPONS, armor: ARMORS, accessory: ACCESSORIES, misc: SUNDRIES };
  const std = { weapon: STANDARD_WEAPONS, armor: STANDARD_ARMORS, accessory: STANDARD_ACCESSORIES };
  // LEGENDARY 按 category 归入具名层各类
  const legendaryByCat = { weapon: [], armor: [], accessory: [], misc: [] };
  for (const e of LEGENDARY) legendaryByCat[e.category]?.push(e);
  const keys = categories || Object.keys(named);
  const namedLines = [];
  for (const k of keys) {
    const all = [...(named[k] || []), ...(legendaryByCat[k] || [])];
    if (!all.length) continue;
    namedLines.push(`【${CAT_NAME[k]}】` + all.map(e => `${e.name}(${e.quality})`).join("、"));
  }
  const stdLines = [];
  for (const k of ["weapon", "armor", "accessory"]) {
    if (categories && !categories.includes(k)) continue;
    if (!std[k]?.length) continue;
    stdLines.push(`【${CAT_NAME[k]}】` + std[k].map(e => `${e.name}(${e.quality})`).join("、"));
  }
  return [
    "曲措乡的物件分两层，叙事时可自然引用其名与来历，但不得虚构其数值属性，",
    "也不得凭空创造未列出的“神兵/秘宝”——具名宝物仅限下列，其余皆寻常之物：",
    "",
    "一、有名有姓、独一份、带来历的宝物（罕见，多与人物/剧情绑定，遇之应郑重）：",
    ...namedLines,
    "",
    "二、成批量产的制式通货（常见，江湖上、店铺里、差役身上到处都是，叙事中",
    "可随口带出，不必渲染稀奇）：",
    ...stdLines,
  ].join("\n");
}


// ── 消耗品·探索态服用（消耗品系统第2步）──
// useConsumable：纯函数，输入一件消耗品的 consumable 字段 + 当前角色状态快照，
// 计算"在探索态（非战斗）服用"会产生的即时效果，返回结构化指令交给 MudRPG 应用。
// 严格遵循"AI 提议内容、系统裁决数值"——所有数值在这里算死，AI 不参与。
//
// 探索态与战斗态的能力边界（重要）：
//   · hpRestore（比例回血）——探索态主力效果，按角色最大气血比例回血、夹在上限内。
//   · energyRestore（回气/真气）——真气是纯战斗内概念（每场重置的 [10,10]），
//     探索态没有对应的持久字段，故不在探索态生效，提示玩家"此丹药需在切磋中服用"。
//   · dispel / rebirthOnce——解异常、假死保命同样是战斗内机制（异常状态存在战斗的
//     statusSlots 里、假死是血将尽时救命），探索态无从施展，同样引导去战斗中用。
//   · sixDimTemp / hpRestoreOverTime / combatBuff 等 B 档 buff——第 3 步接 buffSystem
//     时再处理，本函数暂不负责，遇到时按"尚未支持"返回 ok:false 提示。
//
// 返回：{ ok, hpDelta, note, reason }
//   ok=true  时 hpDelta 为应加到 char.hp[0] 的增量（已按上限夹好上界，负溢出不会发生），
//            note 是给玩家看的服用反馈文字；
//   ok=false 时 reason 说明为何这件东西在探索态吃不出效果（战斗类/未支持/非消耗品）。
export function useConsumable(consumable, char) {
  const c = consumable || {};
  if (!c || Object.keys(c).length === 0) {
    return { ok: false, reason: "这不是能服用的东西。" };
  }

  // 能力分类：
  //   即时回血 hpRestore —— 探索态主力，直接回血。
  //   B档增益 —— 临时六维 sixDimTemp（挂 time 计时的 buff flag）、战前餐 combatBuff
  //     （存 pendingCombatBuff）、持续回血 hpRestoreOverTime（探索态降级为即时回一笔）。
  //   纯战斗内 battleOnly —— 回气/解异常/假死，探索态引导去战斗中用。
  const battleOnly = c.energyRestore || c.dispel || c.dispelAll || c.rebirthOnce;

  // 收集本次服用产生的所有效果（一件药可同时带多种，如"回血+临时体魄"）。
  let hpDelta = 0;
  const sixDimBuffs = [];   // [{ attr, val, duration }]，交给 MudRPG 用 makeBuffFlag 写 flag
  let combatBuff = null;    // 战前餐，交给 MudRPG 累加进 char.pendingCombatBuff
  const noteBits = [];

  // ① 即时回血
  if (c.hpRestore) {
    const maxHp = char?.hp?.[1] ?? 100;
    const curHp = char?.hp?.[0] ?? maxHp;
    const heal = Math.round(maxHp * c.hpRestore);
    const room = maxHp - curHp;
    const actual = Math.min(room, heal);
    if (actual > 0) { hpDelta += actual; noteBits.push(`气血回复 ${actual} 点`); }
  }

  // ② 持续回血 hpRestoreOverTime——探索态没有逐回合结算机制，降级为即时回一笔
  //    （总量 = 每回合比例 × 回合数），战斗内道具栏本就不列它。
  if (c.hpRestoreOverTime) {
    const ov = c.hpRestoreOverTime;
    const ratio = typeof ov === "number" ? ov : (ov.ratio || 0);
    const turns = typeof ov === "object" ? (ov.turns || 1) : 1;
    const maxHp = char?.hp?.[1] ?? 100;
    const curHp = char?.hp?.[0] ?? maxHp;
    const heal = Math.round(maxHp * ratio * turns);
    const room = maxHp - curHp - hpDelta;
    const actual = Math.max(0, Math.min(room, heal));
    if (actual > 0) { hpDelta += actual; noteBits.push(`药力绵长，气血又回 ${actual} 点`); }
  }

  // ③ 临时六维 sixDimTemp: { 属性: 增量 }，默认持续 30 个时辰单位（约合十余回合）
  if (c.sixDimTemp && typeof c.sixDimTemp === "object") {
    const duration = c.buffDuration || 30;
    for (const [attr, val] of Object.entries(c.sixDimTemp)) {
      if (val > 0) { sixDimBuffs.push({ attr, val, duration }); noteBits.push(`${attr}暂增 ${val}`); }
    }
  }

  // ④ 战前餐 combatBuff（作用于下一场战斗）
  if (c.combatBuff && typeof c.combatBuff === "object") {
    combatBuff = { ...c.combatBuff };
    noteBits.push("一餐入腹，只待临阵，气力自不同往日");
  }

  // ── C 档降级（消耗品系统第4步：砍/降级重机制，不为个别药新增系统）──
  // ⑤ 跳回合回满 skipTurnsHeal / fullHeal：原设计"跳过N回合、睡一觉回满血"需要一套
  //    时间跳跃机制，砍掉，简化为"即时回满血"（探索态最实用、也最省事）。
  if (c.skipTurnsHeal || c.fullHeal) {
    const maxHp = char?.hp?.[1] ?? 100;
    const curHp = char?.hp?.[0] ?? maxHp;
    const room = maxHp - curHp - hpDelta;
    if (room > 0) { hpDelta += room; noteBits.push("沉沉睡去，再睁眼时气血已复如初"); }
  }
  // ⑥ 全队 buff teamBuff：玩家没有队友系统，降级为"只作用于自己"。teamBuff 里若是
  //    六维增量，按临时六维处理；若是回血比例，并进即时回血。
  if (c.teamBuff && typeof c.teamBuff === "object") {
    const duration = c.buffDuration || 30;
    if (typeof c.teamBuff.hpRestore === "number") {
      const maxHp = char?.hp?.[1] ?? 100;
      const curHp = char?.hp?.[0] ?? maxHp;
      const heal = Math.round(maxHp * c.teamBuff.hpRestore);
      const room = maxHp - curHp - hpDelta;
      const actual = Math.max(0, Math.min(room, heal));
      if (actual > 0) { hpDelta += actual; noteBits.push(`众人本欲同飨，然形单影只，独得气血 ${actual} 点`); }
    }
    for (const [attr, val] of Object.entries(c.teamBuff)) {
      if (attr !== "hpRestore" && typeof val === "number" && val > 0) {
        sixDimBuffs.push({ attr, val, duration });
        noteBits.push(`${attr}暂增 ${val}`);
      }
    }
  }
  // ⑦ 涂抹武器 weaponCoat（毒蝎粉/雪盲药水，原为"下一击附加中毒/目盲"）：这是全新的
  //    "给招式挂临时异常"重机制，砍掉不做。第5步录 catalog 时这类物件应改用 hpRestore
  //    等已支持字段录入；万一仍带了 weaponCoat 字段，这里静默忽略、不报错、不产生效果。
  //    （不在这里给兜底回血——避免"砍了却又偷偷补一个效果"的语义混乱。）

  const producedSomething = hpDelta > 0 || sixDimBuffs.length > 0 || combatBuff;
  if (producedSomething) {
    const extra = battleOnly ? "（另有回气/解毒之效，须在切磋中服用方见）" : "";
    return {
      ok: true,
      hpDelta,
      sixDimBuffs,
      combatBuff,
      note: `服下之后，${noteBits.join("，")}。${extra}`,
    };
  }

  // 没产生任何探索态效果：要么纯战斗内、要么血已满
  if (c.hpRestore && hpDelta === 0) {
    return { ok: false, reason: "气血本已充盈，此时服用未免暴殄，且留着日后急用。" };
  }
  if (battleOnly) {
    return { ok: false, reason: "此丹药回气解毒、救命于须臾，须在切磋交手之际服用方能立竿见影。" };
  }
  return { ok: false, reason: "这东西一时看不出该怎么用。" };
}
