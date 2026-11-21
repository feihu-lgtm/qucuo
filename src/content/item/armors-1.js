const items = {
"青布长衫": {
    name: "青布长衫", category: "armor", quality: "橙", defMul: 1.5,
    sixDim: { 魅力: 2, 智谋: 2 },
    effect: { onCounterSuccessEnergyGain: 2 },
    desc: "柳青鸢穿了六年的旧衣，袖口拆过三回线。上司送她时说“做了官不用天天穿官袍——脱了官袍，才知道百姓要什么”。不挡刀，却让人不忍向你落刀。",
  },
"雪豹裘": {
    name: "雪豹裘", category: "armor", quality: "紫", defMul: 1.55,
    effect: { freezeEnergyRecovery: true },
    sixDim: { 体魄: -1 },
    desc: "雪山派内堂旧物，雪豹皮毛缝制，内衬火浣布。何雨谢年轻时穿过，后来收进箱底——太重了，穿不动。裘上寒气逼人，近身者气息为之一凝，可它自己也压得人喘不过。",
  },
"氆氇藏袍": {
    name: "氆氇藏袍", category: "armor", quality: "绿", defMul: 1.2,
    effect: { hpRestore: 0.08 },
    desc: "玉泉寨牧民日常穿着，牦牛毛粗呢，厚实挡风。袍摆常年沾着草屑和牛粪味——牧民说这是“干净的味道”，裹着它，风雪里也能慢慢缓过一口气。",
  },
"百香纱衣": {
    name: "百香纱衣", category: "armor", quality: "蓝", defMul: 1.3,
    effect: { enemyCostPenalty: { value: 1, turns: 2 } },
    desc: "罗琦的防身之物，在百花引香料里浸过四十九天，刀砍上来先闻到一股异香，近身者神思一晃。她不喜欢穿——说穿上像裹了一层别人的味道。",
  },
"熊皮坎肩": {
    name: "熊皮坎肩", category: "armor", quality: "绿", defMul: 1.25,
    desc: "鱼定村猎户冬天的短坎肩，皮板硬得能立在地上。老猎户那件肩头一道抓痕——他说是熊抓的，其实是被媳妇拿擀面杖打的。",
  },
"锦官制式软甲": {
    name: "锦官制式软甲", category: "armor", quality: "蓝", defMul: 1.35,
    effect: { onCounterSuccessDamageRatio: 0.25 },
    desc: "都事府差役标配，内衬百层棉纸叠压，外罩青布。柳青鸢上任后重改版型——旧版卡腋下，拔刀慢一拍；新版挨了刀还能顺势反手一记。",
  },
"百褶皮围": {
    name: "百褶皮围", category: "armor", quality: "白", defMul: 1.1,
    desc: "黑风寨女眷自缝的牛皮围裙，褶子密得像扇面。嘎则那件下摆绣了只白老虎——绣得很丑，雪团看了直打喷嚏。",
  },
"欢喜法衣": {
    name: "欢喜法衣", category: "armor", quality: "紫", defMul: 1.4,
    effect: { applyMark: { name: "内伤印", stacks: 1 }, applyMarkChance: 0.3, applyMarkOnHit: true }, sixDim: { 魅力: 2 },
    desc: "欢喜堂内院礼袍，暗红底子，金线绣着梵衍那家乡的旧神像。罗琦那件压在箱底——神像的眼睛绣错了，不该睁着。谁打这袍子，谁沾一身说不清的暗伤。",
  },
"狼裘大氅": {
    name: "狼裘大氅", category: "armor", quality: "蓝", defMul: 1.3,
    effect: { lowHpBonus: 0.12 },
    desc: "大草甸狼皮缝制，领口镶银狐毛。刀疤镖师年轻时穿过，破了三处洞舍不得补——每个洞都是一趟差点没回来的镖。血流得越多，狼性越烈。",
  },
"丹增旧骑装": {
    name: "丹增旧骑装", category: "armor", quality: "绿", defMul: 1.2,
    sixDim: { 身法: 2 },
    desc: "丹增年轻时跑马的装束，右手指关节处被马缰勒出凹痕。三十年前摔马后收起来，卓玛偷偷拿去染坊重新染色——染完还是旧的那抹藏蓝。上马利落，下盘却总带着那年摔的伤。",
  },
"百花楼绸衣": {
    name: "百花楼绸衣", category: "armor", quality: "蓝", defMul: 1.25,
    sixDim: { 魅力: 3 },
    desc: "兰姐待客的衣裳，苏州绸缎，袖口绣百花。她说这衣服不能沾酒——沾过一次花色晕开，客人说更好看，她把那件扔了。穿着它，话都好说三分。",
  },
"鱼定粗布短打": {
    name: "鱼定粗布短打", category: "armor", quality: "白", defMul: 1.05,
    desc: "鱼定村男女日常的短打衣裤，粗糙但透气。才旦穿的时候永远把袖子卷到手肘——她说露手腕好干活，其实是嫌袖口碍事。",
  },
"雪山练功服": {
    name: "雪山练功服", category: "armor", quality: "白", defMul: 1.1,
    effect: { energyRestore: 1 },
    desc: "雪山派弟子练功专用，轻薄，肩肘膝盖加厚一层。呼延雪那套洗得发白，何雨谢说给她换新的，她说不用——旧的不磨皮，运气更顺。",
  },
"守塔僧袍": {
    name: "守塔僧袍", category: "armor", quality: "绿", defMul: 1.3,
    effect: { ignoreDefensePartialImmune: 0.3 },
    desc: "白塔守塔僧团特制，夹层衬细铁网防机关暗箭。袍子重，夏天穿不住——但地宫四季阴冷，铁网总是冰的。硬招砸上来，也卸得掉几分。",
  },
"锦官城官袍": {
    name: "锦官城官袍", category: "armor", quality: "白", defMul: 1.0,
    sixDim: { 魅力: 1, 智谋: -1 },
    desc: "都事府官吏标配，大一号，袖口挽两圈。柳青鸢私下从不穿——穿上就像戴了个面具，面具是给上面人看的。唬得住外人，却让自己人生分。",
  },
"马帮油布斗篷": {
    name: "马帮油布斗篷", category: "armor", quality: "白", defMul: 1.1,
    effect: { hpRestore: 0.05 },
    desc: "天都镇马帮通用雨具，桐油浸过的粗布，雨天硬得像铁皮，晴天软塌塌挂马鞍上。阿旺那件背后印着“鹰曲马帮”，褪到只剩“马”字——遮风挡雨，聊胜于无。",
  },
"喇嘛庙绛红袈裟": {
    name: "喇嘛庙绛红袈裟", category: "armor", quality: "绿", defMul: 1.2,
    effect: { hpRestore: 0.1 },
    desc: "喇嘛庙僧人日常袈裟，绛红，右肩袒露。达摩药堂师父那件左肩一块深色药渍，洗了十年还在——“不是药渍，是那年给都事治腰伤时溅上的当归汤”。药气养身，缓缓回血。",
  },
"格桑花染布衣": {
    name: "格桑花染布衣", category: "armor", quality: "绿", defMul: 1.15,
    sixDim: { 气运: 2 },
    desc: "嘎则自己染的衣裳，用后山格桑花瓣捣汁上色。染三次才染出淡紫，一下雨就掉色，掉到最后变成粉白——她说更好看。穿着它，运气也软软的。",
  },
"孟记皮护腕": {
    name: "孟记皮护腕", category: "armor", quality: "白", defMul: 1.1,
    effect: { onCounterSuccessEnergyGain: 1 },
    desc: "孟铁匠顺手做的皮护腕，三层牛皮叠缝，系带马尾编的。刀疤镖师戴了五年断了三根系带——他说这护腕比他的手腕值钱。架招稳，接得住劲。",
  },
"猞猁皮帽": {
    name: "猞猁皮帽", category: "armor", quality: "绿", defMul: 1.15,
    sixDim: { 气运: 1, 魅力: 1 },
    desc: "大草甸猞猁皮缝制，耳位留两个毛球。阿索冬天戴，毛球在风里一颤一颤，牦牛看了都多嚼两口草——不是喜欢，是觉得像另外两头小牦牛。",
  }
};

export default { item: items, itemGroup: { ARMORS: Object.keys(items) } };
