// 雪域三宗（萨迦世家、噶举山人、古象雄苯门）与打箭炉具名物品（面具/兵刃/衣甲/奇物/丹药/食酒）。
const items = {
  // ── 兵刃 ──
  "萨迦金铜飞轮": {
    name: "萨迦金铜飞轮", category: "weapon", quality: "蓝", atkMul: 1.25,
    tags: ["兵刃", "飞轮", "萨迦世家"],
    desc: "外姓护法堂按制打造的金铜飞轮，轮缘磨出九道锯齿，运劲掷出时风声如雷，可借石柱弧线折返。",
  },
  "日月五轮": {
    name: "日月五轮", category: "weapon", quality: "紫", atkMul: 1.4,
    effect: { ignoreDefenseRatio: 0.25 },
    tags: ["兵刃", "飞轮", "萨迦世家"],
    desc: "金、银、铜、铁、铅五轮成套，大小相套可分可合，大轮法王卓玛嘉教导外姓护法时常以此物试功。",
  },
  "昆氏金刚法杵": {
    name: "昆氏金刚法杵", category: "weapon", quality: "橙", atkMul: 1.52,
    effect: { forceCrit: { multiplier: 1.45 }, immuneControl: true }, sixDim: { 体魄: 2, 根骨: 1 },
    tags: ["兵刃", "法杵", "萨迦世家"],
    desc: "萨迦昆氏叔侄代代相传的九股紫金法杵，杵身刻满因明密咒，挥出时如龙象压顶。",
  },
  "康巴厚背重刀": {
    name: "康巴厚背重刀", category: "weapon", quality: "绿", atkMul: 1.18,
    tags: ["兵刃", "刀", "打箭炉"],
    desc: "武侯造箭坊水车铁炉锻出的康巴阔背重刀，刀背厚达半指，劈砍河谷灌木与敌兵硬甲皆不卷刃。",
  },
  "武侯破甲重弩": {
    name: "武侯破甲重弩", category: "weapon", quality: "蓝", atkMul: 1.28,
    effect: { ignoreDefenseRatio: 0.2 },
    tags: ["兵刃", "弩", "打箭炉"],
    desc: "相传按诸葛武侯遗制改良的机簧重弩，配炉城所铸三棱破甲铁箭，三十步内能穿双层牛皮甲。",
  },
  "火焰铜刀": {
    name: "火焰铜刀", category: "weapon", quality: "蓝", atkMul: 1.26,
    tags: ["兵刃", "刀", "噶举山人"],
    desc: "焚风渡噶举弟子常用的赤铜弯刀，刀脊铸成火焰波纹，以拙火内劲催动时刃口灼热难当。",
  },
  "三迦叶赤铜戒刀": {
    name: "三迦叶赤铜戒刀", category: "weapon", quality: "紫", atkMul: 1.42,
    effect: { ignoreDefenseRatio: 0.3 }, sixDim: { 体魄: 1 },
    tags: ["兵刃", "刀", "噶举山人"],
    desc: "拜火三迦叶传下来的古制赤铜刀，长期浸在青铜火盆余烬中养锋，刀身隐隐泛着暗红炭光。",
  },
  "天铁掘藏钢钎": {
    name: "天铁掘藏钢钎", category: "weapon", quality: "绿", atkMul: 1.2,
    tags: ["兵刃", "钢钎", "古象雄苯门"],
    desc: "琼隆古墟天铁矿炉坊混入陨铁所锻的长棱钢钎，既可破岩掘藏，也可按九宫算路封死敌手刀路。",
  },
  "天铁九股黑杵": {
    name: "天铁九股黑杵", category: "weapon", quality: "紫", atkMul: 1.42,
    effect: { onCounterSuccessDamageRatio: 0.35 }, sixDim: { 根骨: 1 },
    tags: ["兵刃", "法杵", "古象雄苯门"],
    desc: "雪山雷击陨铁与寒铁合铸的墨色九股杵，入手沉冷如冰，反震敌手兵刃时虎口隐隐生雷音。",
  },
  "大鹏裂石爪套": {
    name: "大鹏裂石爪套", category: "weapon", quality: "橙", atkMul: 1.54,
    effect: { forceCrit: { multiplier: 1.5 }, ignoreDefenseRatio: 0.25 }, sixDim: { 身法: 2, 体魄: 1 },
    tags: ["兵刃", "爪套", "古象雄苯门"],
    desc: "以天铁丝编成的五指利爪，指节仿金翅大鹏鸟喙打造，戴上后抓铁留痕、专破护体罡气。",
  },

  // ── 衣甲 ──
  "三色花纹法袍": {
    name: "三色花纹法袍", category: "armor", quality: "蓝", defMul: 1.25,
    tags: ["衣甲", "萨迦世家"],
    desc: "依萨迦花墙规制织就的红白蓝三色厚氆氇法袍，衬有细牛皮护心，威仪与防身兼备。",
  },
  "白玛草护法软甲": {
    name: "白玛草护法软甲", category: "armor", quality: "紫", defMul: 1.4,
    effect: { immuneControl: true }, sixDim: { 根骨: 1 },
    tags: ["衣甲", "萨迦世家"],
    desc: "内嵌紫铜甲叶的绛红软甲，衣襟染成白玛草深色，能卸去震荡与惑心掌力。",
  },
  "康巴牛皮马帮甲": {
    name: "康巴牛皮马帮甲", category: "armor", quality: "绿", defMul: 1.18,
    tags: ["衣甲", "打箭炉"],
    desc: "打箭炉番市皮毛街熟制的双层牦牛皮甲，挡得住高原寒风与马帮路上的流矢暗算。",
  },
  "噶举单层白布衣": {
    name: "噶举单层白布衣", category: "armor", quality: "蓝", defMul: 1.22,
    sixDim: { 身法: 1 },
    tags: ["衣甲", "噶举山人"],
    desc: "噶举白门弟子严寒亦只穿一袭的单层素白僧衣，看似轻薄如纸，经拙火真气鼓荡后竟刀剑难透。",
  },
  "白牦牛毛暖氅": {
    name: "白牦牛毛暖氅", category: "armor", quality: "绿", defMul: 1.16,
    tags: ["衣甲", "噶举山人"],
    desc: "焚风渡官牧场白牦牛细绒织成的斗篷，冬日御寒极佳，牧民与行商皆视为珍货。",
  },
  "象雄黑石片甲": {
    name: "象雄黑石片甲", category: "armor", quality: "蓝", defMul: 1.28,
    tags: ["衣甲", "古象雄苯门"],
    desc: "将轻薄黑石片与天铁丝铆在牛皮底衬上的古式甲胄，沉重却极耐劈砍。",
  },
  "黑门法王氅": {
    name: "黑门法王氅", category: "armor", quality: "紫", defMul: 1.42,
    effect: { hpRestore: 0.08 }, sixDim: { 根骨: 2 },
    tags: ["衣甲", "古象雄苯门"],
    desc: "绣着左旋雍仲金翅鸟纹的墨色大氅，内衬九宫护心镜，可在绝境中缓缓调息回元。",
  },

  // ── 面具 / 护符 / 奇物饰品（均带 sixDim 或 effect）──
  "萨迦三色护法牌": {
    name: "萨迦三色护法牌", category: "accessory", quality: "绿",
    sixDim: { 智谋: 1, 魅力: 1 },
    tags: ["信物", "萨迦世家"],
    desc: "红白蓝三色珐琅铜牌，背面刻萨迦昆氏押记，持牌者在丹霞城十八溪卡庄园可免盘查。",
  },
  "白幡口传信物": {
    name: "白幡口传信物", category: "accessory", quality: "绿",
    sixDim: { 根骨: 1, 身法: 1 },
    tags: ["信物", "噶举山人"],
    desc: "一截系在牛骨环上的洁白长幡布条，凭此物可在十六白柱敞院听三迦叶口传密法。",
  },
  "左旋雍仲黑铜牌": {
    name: "左旋雍仲黑铜牌", category: "accessory", quality: "绿",
    sixDim: { 根骨: 1, 智谋: 1 },
    tags: ["信物", "古象雄苯门"],
    desc: "铸着逆时针雍仲符号的沉重黑铜牌，靠近左旋正门经轮时不会触发弹飞暗括。",
  },
  "黑木琼鸟面具": {
    name: "黑木琼鸟面具", category: "accessory", quality: "蓝",
    sixDim: { 身法: 1, 魅力: 1 },
    tags: ["面具", "古象雄苯门"],
    desc: "整块高原黑木雕出的金翅琼鸟面具，琼鸟九乘武馆弟子演练《象雄大鹏爪》时必戴此面。",
  },
  "九眼天珠": {
    name: "九眼天珠", category: "accessory", quality: "紫",
    sixDim: { 气运: 2, 悟性: 1 }, effect: { immuneControl: true },
    tags: ["饰品", "奇物", "打箭炉"],
    desc: "雪域珍宝行镇柜的古藏老九眼天珠，黑白蚀纹浑然天成，传说可避横祸、定心神。",
  },
  "辟寒火珠": {
    name: "辟寒火珠", category: "accessory", quality: "蓝",
    sixDim: { 根骨: 1, 体魄: 1 }, effect: { energyRestore: 1 },
    tags: ["奇物", "噶举山人"],
    desc: "焚风渡以红铜裹火晶石炼成的暖珠，揣在怀里如抱小炉，可抵御雪山派与白塔顶的彻骨奇寒。",
  },
  "八思巴玉印拓片": {
    name: "八思巴玉印拓片", category: "accessory", quality: "紫",
    sixDim: { 智谋: 2, 魅力: 2 },
    tags: ["奇物", "萨迦世家"],
    desc: "用丹霞城朱砂从八思巴铁券阁玉印原件拓下的朱文印谱，在雪域官府与各派间颇具分量。",
  },
  "左旋黑铜转经轮": {
    name: "左旋黑铜转经轮", category: "accessory", quality: "蓝",
    sixDim: { 根骨: 1, 气运: 1 }, effect: { onCounterSuccessEnergyGain: 2 },
    tags: ["饰品", "法器", "古象雄苯门"],
    desc: "专按逆时针旋转的手持小经轮，轮轴暗藏机括，接架招式时顺腕一拧便能蓄起内劲。",
  },
  "羊肩胛卜骨挂坠": {
    name: "羊肩胛卜骨挂坠", category: "accessory", quality: "绿",
    sixDim: { 智谋: 1, 气运: 1 },
    tags: ["饰品", "古象雄苯门"],
    desc: "九宫卜算楼炙烤裂纹极佳的洁净卜骨小片，苯门占卜师常佩于胸前以示趋吉避凶。",
  },
  "康定红珊瑚串": {
    name: "康定红珊瑚串", category: "accessory", quality: "蓝",
    sixDim: { 魅力: 2, 气运: 1 },
    tags: ["饰品", "打箭炉"],
    desc: "锅庄大掌柜兰措挑出的红珊瑚手串，色泽浓艳如炉火，汉藏商旅最认的体面信物。",
  },

  // ── 杂物 / 典籍 / 丹药 / 食酒 ──
  "朱砂印经残卷": {
    name: "朱砂印经残卷", category: "misc", quality: "蓝",
    tags: ["典籍", "萨迦世家"],
    consumable: { sixDimTemp: { 悟性: 2, 智谋: 1 } },
    desc: "朱砂印经工坊印坏的半卷五明因明孤本，字句古奥，静心细读颇能开窍。",
  },
  "雅州边茶砖": {
    name: "雅州边茶砖", category: "misc", quality: "白",
    tags: ["货物", "茶饮", "打箭炉"],
    consumable: { energyRestore: 2 },
    desc: "背夫翻越二郎山扛进炉城的紧压黑茶砖，煮沸后去油解腻，高原行路一日不可缺。",
  },
  "康定红酒": {
    name: "康定红酒", category: "misc", quality: "绿",
    tags: ["酒", "打箭炉"],
    consumable: { hpRestore: 0.14, sixDimTemp: { 体魄: 1 } },
    desc: "牦牛骨汤馆配骨汤的本地烈性青稞红酒，入口辛甜醇厚，一口下去从脚底暖到天灵盖。",
  },
  "白牦牛酥油块": {
    name: "白牦牛酥油块", category: "misc", quality: "白",
    tags: ["食品", "噶举山人"],
    consumable: { hpRestore: 0.1, energyRestore: 1 },
    desc: "焚风渡官牧场产出的纯白牦牛酥油，清香不膻，是白门寺众与牧户过冬的干粮至宝。",
  },
  "青稞铁朵玛": {
    name: "青稞铁朵玛", category: "misc", quality: "绿",
    tags: ["食品", "古象雄苯门"],
    consumable: { hpRestore: 0.16, sixDimTemp: { 根骨: 1 } },
    desc: "青稞朵玛庄房揉成小牦牛状的祭食，晾干后坚硬如铁，既可充饥，危急时也能灌劲飞掷。",
  },
  "狼曲沙金袋": {
    name: "狼曲沙金袋", category: "misc", quality: "蓝",
    tags: ["货物", "奇物", "噶举山人"],
    desc: "渡口淘金集淘洗出来的粗粒河沙金，装在白鹿皮小袋里，在各大锅庄随时可折银。",
  },
  "焚风辟寒丹": {
    name: "焚风辟寒丹", category: "misc", quality: "蓝",
    tags: ["丹药", "解毒", "噶举山人"],
    consumable: { dispel: true, hpRestore: 0.2 },
    desc: "结合拙火药理与河谷热草炼制的温阳药丸，可解雪山寒痹并回复两成气血。",
  },
  "中阴还魂散": {
    name: "中阴还魂散", category: "misc", quality: "紫",
    tags: ["丹药", "疗伤", "古象雄苯门"],
    consumable: { hpRestore: 0.4, dispelAll: true },
    desc: "中阴度亡医窟秘制的重伤救命散，以寒水石、雄黄与雪山药草配成，可将濒死之人从鬼门关拉回。",
  },
};

export default { item: items, itemGroup: { SNOWLAND_SECTS_GOODS: Object.keys(items) } };
