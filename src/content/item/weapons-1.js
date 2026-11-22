const items = {
"霜牙": {
    name: "霜牙", category: "weapon", quality: "绿", atkMul: 1.25,
    effect: { applyMark: { name: "内伤印", stacks: 1 }, applyMarkChance: 0.25 },
    desc: "刀身泛青，刃口一道白线如冻痕。在熊山温泉边淬过，出鞘时刀锋上总凝着一层薄霜——被它划中的伤口，寒气会往骨头缝里钻。",
  },
"狼骨匕": {
    name: "狼骨匕", category: "weapon", quality: "绿", atkMul: 1.15,
    effect: { lowHpBonus: 0.15 },
    desc: "大草甸狼王腿骨打磨，握柄保留关节的天然弧度。刀刃吃进皮肉时骨头会发出极细的呜咽——越是见血，握刀的手越稳。",
  },
"折柳": {
    name: "折柳", category: "weapon", quality: "蓝", atkMul: 1.3,
    sixDim: { 身法: 2 },
    desc: "剑身薄可弯绕，平时藏在腰间如一条银线。剑胚在柳枝上挂了三年，沾过春天的露水才开刃，出手轻灵不带风声。",
  },
"牧云": {
    name: "牧云", category: "weapon", quality: "蓝", atkMul: 1.35,
    desc: "刀背厚刀刃薄，刀柄缠牦牛皮绳。玉泉寨老铁匠打了三个月，说这刀不是用来杀人的——是用来切开狼曲河谷的晨雾。",
  },
"雪鸮翎": {
    name: "雪鸮翎", category: "weapon", quality: "紫", atkMul: 1.4,
    effect: { forceFirst: true }, sixDim: { 身法: 2 },
    desc: "六枚飞刀如鸟翎排列，用雪山雪鸮的翼骨磨成，轻得离谱，打出去没有风声——快到对手听见破空声时，刀已在身上。",
  },
"断念": {
    name: "断念", category: "weapon", quality: "紫", atkMul: 1.5,
    effect: { ignoreDefense: true }, sixDim: { 体魄: 1 },
    desc: "无锋，通体漆黑。巴桑从锦官城佣兵头子手里缴来，剑身刻着半句诗“断念如断骨”，后半句被磨平了——势大力沉，寻常护甲卸不去分毫。",
  },
"狼曲旧猎叉": {
    name: "狼曲旧猎叉", category: "weapon", quality: "白", atkMul: 1.1,
    desc: "扎西用了二十年的猎叉，叉尖歪了，叉杆被手汗浸得发亮。不好看，但刺出去的时候杆子会自己找到最省力的角度。",
  },
"百花刺": {
    name: "百花刺", category: "weapon", quality: "蓝", atkMul: 1.3,
    effect: { applyMark: { name: "内伤印", stacks: 1 }, applyMarkChance: 0.35 },
    desc: "峨眉刺一对，兰姐年轻时用过，刺尖淬过百花引残料，见血封不住伤口——但抹了蜜敷一夜就能合拢。她后来再没用过。",
  },
"梵铃杵": {
    name: "梵铃杵", category: "weapon", quality: "紫", atkMul: 1.35,
    effect: { freezeEnergyRecovery: true },
    desc: "梵衍那从天竺带来的旧物，杵身刻梵文六字，摇起来铃声沉得不像铜。铃响之处，对手真气一滞，欢喜堂弟子起誓时左手按杵，铃不响则誓不成。",
  },
"熊山猎刀": {
    name: "熊山猎刀", category: "weapon", quality: "绿", atkMul: 1.2,
    desc: "鱼定村猎户人手一把的制式刀，但每把刀柄刻痕不同——有人刻正字记猎获，有人刻横线记年头，老猎户那把刻的是“莫追”。",
  },
"青鸢": {
    name: "青鸢", category: "weapon", quality: "橙", atkMul: 1.55,
    effect: { enemyCostPenalty: { value: 2, turns: 2 } }, sixDim: { 智谋: 2 },
    desc: "柳青鸢的随身软鞭，鞭梢系一枚青铜鸢鸟，甩出去时鸟喙会叼住目标——被缠上的人手脚发滞，出招愈发迟涩。她练鞭时抽断三棵柳树，从此院里只剩柏。",
  },
"孟记铁锤": {
    name: "孟记铁锤", category: "weapon", quality: "白", atkMul: 1.15,
    desc: "天都镇孟铁匠打铁的手锤，锤头包浆厚得像石头。他不卖——但说要是谁能用这把锤打出比“霜牙”更好的刀，锤子就送谁。",
  },
"大草甸套索": {
    name: "大草甸套索", category: "weapon", quality: "白", atkMul: 1.05,
    effect: { enemyCostPenalty: { value: 1, turns: 1 } },
    desc: "牧民套马用的牦牛皮索，索头坠一枚铅扣。阿索能在二十步外套住牦牛角——套中的对手挣脱前，先乱一记手脚。",
  },
"雪山松纹剑": {
    name: "雪山松纹剑", category: "weapon", quality: "蓝", atkMul: 1.3,
    sixDim: { 悟性: 1, 身法: 1 },
    desc: "雪山派弟子的标准佩剑，剑身有松木纹理。练功堂墙上挂着几十把，剑穗颜色各不同——呼延雪那把系的是白穗。",
  },
"贡措冰晶": {
    name: "贡措冰晶", category: "weapon", quality: "紫", atkMul: 1.4,
    effect: { applyMark: { name: "内伤印", stacks: 2 }, applyMarkChance: 0.4 }, sixDim: { 悟性: 1, 气运: 1 },
    desc: "贡措海深处的矿石碎片，投水会沉底，握久了会化——不是冰，是盐。用它打人，伤口一辈子舔不咸，暗伤缠身难愈。",
  },
"黑风断刃": {
    name: "黑风断刃", category: "weapon", quality: "绿", atkMul: 1.2,
    effect: { lowHpBonus: 0.2 },
    desc: "巴桑十年前从巡捕营手里夺来的第一把刀，断了三寸。他没修，挂在岩洞里——“断了才知道哪里最薄”，越是绝境这刀越狠。",
  },
"金珠算盘": {
    name: "金珠算盘", category: "weapon", quality: "蓝", atkMul: 1.25,
    sixDim: { 智谋: 2 },
    desc: "锦官城永盛钱庄老掌柜的遗物，每颗算珠都是铜胎鎏金。拨起来声音清脆，砸在人身上也是同一个声音——算得清账，也算得准人。",
  },
"藏银护手钩": {
    name: "藏银护手钩", category: "weapon", quality: "绿", atkMul: 1.2,
    effect: { onCounterSuccessDamageRatio: 0.3 },
    desc: "玉泉寨练武场的对练双钩，钩身藏银，钩尖钝了磨、磨了钝。李若由小时候拿它练过，钩柄上还有她咬的牙印——擅接不擅攻。",
  },
"古藤杖": {
    name: "古藤杖", category: "weapon", quality: "白", atkMul: 1.1,
    sixDim: { 悟性: 1 },
    desc: "喇嘛庙达摩药堂师父的拐杖，藤条来自熊山深处，杖头被药汁浸成深褐色。走山路时杖尾会探石头缝——不是找路，是找药。",
  },
"霜角": {
    name: "霜角", category: "weapon", quality: "橙", atkMul: 1.6,
    effect: { forceFirst: true, detonateMark: { perStackRatio: 0.4 } }, sixDim: { 身法: 2 },
    desc: "吊睛虎王骨长错位增生的一块硬骨，形如角。虎王撞断过一棵松树，骨裂愈合后多长这块，从此别的虎再不敢进那片松林——势不可挡，专破暗伤。",
  },
// ── 丐帮三星分舵（广汉）：分舵人物随身兵器与分舵义坊货 ──
"老油青竹棒": { name: "老油青竹棒", category: "weapon", quality: "紫", atkMul: 1.4, effect: { lowHpBonus: 0.2 }, desc: "三十年老竹以桐油反复浸炙，沉重韧滑，严九斤拄了半辈子。棒头磨得发亮，打在人身上不见血，骨头里却要疼上三天。" },
"铁算盘尺": { name: "铁算盘尺", category: "weapon", quality: "蓝", atkMul: 1.25, desc: "精铁包边的长尺，一头刻着刻度，一头嵌着七颗算珠。周小满白天拿它拨账，夜里拿它点穴格挡。" },
"乌铁独脚拐": { name: "乌铁独脚拐", category: "weapon", quality: "紫", atkMul: 1.45, effect: { lowHpBonus: 0.15 }, desc: "碗口粗的枣木拐，头上包着乌铁，重逾二十八斤。胡三爷断腿之后拿它当腿，也拿它破甲。" },
"铁柄大汤勺": { name: "铁柄大汤勺", category: "weapon", quality: "绿", atkMul: 1.15, desc: "厚铁打的大汤勺，白婶抡起来虎虎生风，曾一勺拍晕过偷米贼。勺沿上还挂着半粒米。" },
"牧羊青竹棍": { name: "牧羊青竹棍", category: "weapon", quality: "白", atkMul: 1.05, desc: "一头缠着旧牛皮绳的青竹棍，多吉从玉泉寨一路拄到广汉，放牧赶羊用它，如今打狗练棒也用它。" },
"残纹青竹板": { name: "残纹青竹板", category: "weapon", quality: "蓝", atkMul: 1.2, effect: { applyStatus: { name: "气乱", chance: 0.2 } }, desc: "两片老竹刻着半枚三星云雷纹，哑巴七拿来敲节拍。笃笃三声敲在耳边，对手的心神便乱了半拍。" },
"晒干青竹棍": { name: "晒干青竹棍", category: "weapon", quality: "白", atkMul: 1.1, desc: "三星镇外砍来晒透的老竹，不及精铁锋利，胜在顺手韧长，新手练棒正好。" },
"铁头打狗棒": { name: "铁头打狗棒", category: "weapon", quality: "蓝", atkMul: 1.3, desc: "选用五年老青竹，两端套上精铁箍，抽人带风、架刀不断，是四袋以上弟子的标配。" },
};

export default { item: items, itemGroup: { WEAPONS: Object.keys(items) } };
