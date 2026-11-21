const items = {
"翠玉扳指": { name: "翠玉扳指", category: "weapon", quality: "绿", atkMul: 1.2, jadeWare: true, effect: { applyMark: { name: "崩弦", stacks: 1 }, applyMarkChance: 0.2 }, desc: "扳指本是拉弓扣弦的护手，起于商周。这枚翠玉扳指戴在拇指上，拉弓时增了几分力，射出的劲里裹着一丝内伤。" },
"玉柄峨眉刺": { name: "玉柄峨眉刺", category: "weapon", quality: "蓝", atkMul: 1.3, jadeWare: true, effect: { forceFirst: true }, desc: "玉柄薄刺，贴身暗器，出手快过眼。玉料温润衬着刺尖森寒，握在掌心不起眼，抖手便已及喉。" },
"秧苗绿玉笏": { name: "秧苗绿玉笏", category: "weapon", quality: "蓝", atkMul: 1.3, jadeWare: true, sixDim: { 智谋: 2 }, desc: "笏板本是朝堂礼器，绿中带黄的秧苗绿为色之上品。执笏如执理，压人一头，未动手先怯了对方三分。" },
"玉钺": { name: "玉钺", category: "weapon", quality: "紫", atkMul: 1.45, jadeWare: true, effect: { ignoreDefense: true }, desc: "玉钺是仪仗玉兵器，象征刑杀之权。斧钺加身，甲胄如无物，劈下时连玉带风都是肃杀的。" },
"冰种玉簪": { name: "冰种玉簪", category: "weapon", quality: "紫", atkMul: 1.4, jadeWare: true, effect: { applyMark: { name: "寒芒", stacks: 2 }, applyMarkChance: 0.35 }, desc: "冰种通透泛蓝，簪尖淬骨。看似寻常发簪，斜插鬓边，取命时才知是暗器。" },
"玻璃种翠钺·秧王": { name: "玻璃种翠钺·秧王", category: "weapon", quality: "橙", atkMul: 1.55, jadeWare: true, named: true, effect: { ignoreDefense: true, detonateMark: { perStackRatio: 0.35 } }, desc: "老坑玻璃种满绿，翠色浓得如秧田之王。钺落无视防御，并引爆此前种下的内伤印，一击之下旧伤新创齐发。" },
"帝王绿玉圭·三曲": { name: "帝王绿玉圭·三曲", category: "weapon", quality: "红", atkMul: 1.6, jadeWare: true, named: true, effect: { forceFirst: true, doubleVsStatus: true }, sixDim: { 气运: 2 }, desc: "圭为祭天礼器。传出自雪山老坑，帝王绿满色无绺。执之如执三曲之水，先声夺人，克敌于滞。" },
"缀玉皮护腕": { name: "缀玉皮护腕", category: "armor", quality: "绿", defMul: 1.2, jadeWare: true, effect: { hpRestore: 0.06 }, desc: "牛皮护腕缀几片碎玉，贴腕生温。算不得宝物，胜在日夜贴着脉门，暗里养着一口血气。" },
"玉璜项饰": { name: "玉璜项饰", category: "armor", quality: "蓝", defMul: 1.25, jadeWare: true, sixDim: { 魅力: 1, 气运: 1 }, desc: "玉璜半璧之形，佩饰之属，垂在颈前护住咽喉要害，也护住体面。" },
"糯冰玉牌·护心": { name: "糯冰玉牌·护心", category: "armor", quality: "蓝", defMul: 1.3, jadeWare: true, effect: { onCounterSuccessEnergyGain: 2 }, desc: "一块糯冰种玉牌垂在心口，挡下的每一记都化作一口真气回胸。" },
"白玉璧": { name: "白玉璧", category: "armor", quality: "紫", defMul: 1.5, jadeWare: true, effect: { freezeEnergyRecovery: true }, desc: "玉璧祭地礼器，圆孔含天。近身者气息被这一圈寒玉冻住，回气不得。" },
"满绿玉铠片": { name: "满绿玉铠片", category: "armor", quality: "紫", defMul: 1.5, jadeWare: true, effect: { onCounterSuccessDamageRatio: 0.3 }, sixDim: { 体魄: -1 }, desc: "整片满绿玉打磨的铠甲，沉。挡得住，也压得慌，每挡一记反手更狠。" },
"玻璃种玉衣·雪敛": { name: "玻璃种玉衣·雪敛", category: "armor", quality: "橙", defMul: 1.55, jadeWare: true, named: true, effect: { hpRestore: 0.1, freezeEnergyRecovery: true }, desc: "千片玻璃种玉以金丝缀成，仿古玉衣。寒气自养，敌气自封，穿之如裹一身雪。" },
"豆种玉平安扣": { name: "豆种玉平安扣", category: "accessory", quality: "白", jadeWare: true, sixDim: { 气运: 1 }, desc: "最寻常的豆种，一枚平安扣。护不了什么，图个心安。" },
"翡翠玉镯·温润": { name: "翡翠玉镯·温润", category: "accessory", quality: "绿", jadeWare: true, sixDim: { 魅力: 2 }, desc: "扁条玉镯，环佩叮当。种水一般，胜在通身温润，久戴生光。" },
"灵芝玉如意": { name: "灵芝玉如意", category: "accessory", quality: "蓝", jadeWare: true, sixDim: { 气运: 2, 智谋: 1 }, desc: "如意由笏与搔杖演变，S形灵芝首，明清鼎盛，祈福禳安。握之诸事称心。" },
"秧苗绿玉佩": { name: "秧苗绿玉佩", category: "accessory", quality: "蓝", jadeWare: true, effect: { lowHpBonus: 0.15 }, desc: "秧苗绿佩玉贴身，越是绝境越是烫。祖辈说这玉认主，护到最后一口气。" },
"冰种翡翠珠串": { name: "冰种翡翠珠串", category: "accessory", quality: "紫", jadeWare: true, effect: { energyRestore: 2 }, sixDim: { 悟性: 1 }, desc: "十八子冰种珠串，捻珠静气，起手先饱一口真元。" },
"帝王绿玉观音": { name: "帝王绿玉观音", category: "accessory", quality: "橙", jadeWare: true, named: true, effect: { hpRestore: 0.06 }, sixDim: { 气运: 3, 魅力: 1 }, desc: "满色帝王绿雕观音，男戴观音。玉养人，人养玉，佩久生光，气运随身。" },
"老坑玻璃种·三曲同源璧": { name: "老坑玻璃种·三曲同源璧", category: "accessory", quality: "红", jadeWare: true, named: true, effect: { onCounterSuccessDamageRatio: 0.2 }, sixDim: { 气运: 3, 悟性: 2 }, desc: "传为雪山老坑一块巨料所出，种水到顶，内有三缕色根如熊鹰狼三曲交汇。持之心明眼亮，后发制人。" }
};

export default { item: items, itemGroup: { JADE_WARES: Object.keys(items) } };
