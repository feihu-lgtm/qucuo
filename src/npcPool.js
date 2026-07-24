// 游走 NPC 池：每天按权重随机出现在各据点，营造活世界感
// routineWeights：各据点出现概率权重（0-100），总和不必为100，按比例采样
// timeSlot：[最早出场时间百分比, 最晚收场时间百分比]，time%100 在此区间内才可能出现
// personality：注入 system prompt 的简短性格描述，AI 据此生成对话

import { seededRand, weightedSample } from "./utils/seededRandom.js";

export const NPC_POOL = [
  // ── 商旅人口 ──
  {
    id: "pool_zhang_shang", name: "张商人", brief: "走南闯北的布料商",
    personality: "精明随和，习惯性砍价，消息灵通但嘴严，对生人先戒备后热络",
    routineWeights: { 天都镇: 40, 玉泉寨: 35, 鱼定村: 25 },
    timeSlot: [15, 85],
  },
  {
    id: "pool_li_zhang", name: "李掌柜", brief: "茶叶商，见谁都认识",
    personality: "健谈爱八卦，见人说人话见鬼说鬼话，但心地不坏",
    routineWeights: { 锦官城: 45, 天都镇: 35, 鱼定村: 20 },
    timeSlot: [10, 90],
  },
  {
    id: "pool_hua_sao", name: "花嫂", brief: "卖糌粑的藏族妇人",
    personality: "热情豪爽爱说笑，儿子在雪山派当外门弟子，骄傲又担心",
    routineWeights: { 鱼定村: 55, 天都镇: 30, 玉泉寨: 15 },
    timeSlot: [5, 65],
  },
  {
    id: "pool_da_hu", name: "大胡子朱四", brief: "商队头领，带队走货",
    personality: "粗豪直爽，手下管得严，私下重义气，遇到强盗绕路不正面冲突",
    routineWeights: { 锦官城: 35, 天都镇: 35, 鱼定村: 30 },
    timeSlot: [20, 80],
  },
  // ── 武林人口 ──
  {
    id: "pool_dao_scar", name: "刀疤镖师", brief: "脸上有刀疤的老镖师",
    personality: "话少冷峻，但对遇到麻烦的人有帮一把的习惯，是过了气的好手",
    routineWeights: { 天都镇: 40, 锦官城: 35, 鱼定村: 25 },
    timeSlot: [10, 80],
  },
  {
    id: "pool_young_xia", name: "愣头侠客", brief: "年轻气盛的江湖人",
    personality: "自以为是，容易冲动，但本质上是个热血少年，碰壁多了会成长",
    routineWeights: { 锦官城: 30, 天都镇: 35, 鱼定村: 20, 大草甸: 15 },
    timeSlot: [10, 90],
  },
  {
    id: "pool_gui_yin", name: "归隐剑客", brief: "不问江湖事的隐士",
    personality: "淡泊宁静，话语里偶尔透着深意，不轻易出手但一出手就稳",
    routineWeights: { 雪山派: 40, 后山平台: 35, 玉泉寨: 25 },
    timeSlot: [30, 70],
  },
  {
    id: "pool_lai_fang", name: "来访武者", brief: "慕名找雪山派切磋的剑客",
    personality: "谦逊好学，见到同行爱套近乎打听武学，身手实际上相当不错",
    routineWeights: { 雪山派: 45, 后山平台: 30, 锦官城: 25 },
    timeSlot: [15, 85],
    levelCap: 2,
  },
  // ── 市井人口 ──
  {
    id: "pool_shuo_shu", name: "说书人陈七", brief: "走街串巷说书的",
    personality: "满腹故事，说话爱卖关子，江湖传闻知道一半编一半，分不清",
    routineWeights: { 锦官城: 50, 天都镇: 35, 鱼定村: 15 },
    timeSlot: [20, 85],
  },
  {
    id: "pool_pian_zi", name: "油嘴小贩", brief: "卖杂货的行商小贩",
    personality: "嘴甜，什么都卖，什么都敢说，有时候会带点来路不明的东西",
    routineWeights: { 锦官城: 35, 天都镇: 40, 鱼定村: 25 },
    timeSlot: [10, 80],
  },
  {
    id: "pool_lao_qi", name: "乞丐老七", brief: "鱼定村一带的流浪汉",
    personality: "看起来邋遢，其实见多识广，曾经是有来头的人，不说过去",
    routineWeights: { 鱼定村: 40, 天都镇: 30, 玉泉寨: 20, 大草甸: 10 },
    timeSlot: [0, 100],
  },
  {
    id: "pool_xi_ban", name: "戏班旦角", brief: "戏班里的花旦",
    personality: "风情万种但心机深，看人很准，在锦官城有不少人脉",
    routineWeights: { 锦官城: 60, 天都镇: 40 },
    timeSlot: [30, 90],
  },
  {
    id: "pool_shi_sheng", name: "落第书生", brief: "屡试不中的文人",
    personality: "一肚子学问但迂腐，被现实打击多了有点愤世嫉俗，喝酒写诗",
    routineWeights: { 锦官城: 40, 天都镇: 35, 鱼定村: 25 },
    timeSlot: [20, 85],
  },
  {
    id: "pool_za_shu", name: "杂耍艺人", brief: "耍把式的江湖艺人",
    personality: "乐观爱笑，身手灵活，走到哪里都能混口饭吃",
    routineWeights: { 天都镇: 45, 锦官城: 35, 鱼定村: 20 },
    timeSlot: [20, 80],
  },
  // ── 藏地本土 ──
  // 卓玛、扎西已从游走池移除，改为玉泉寨固定驻场专属（见 residentNpcs.js），
  // 避免同一个人既在驻场表又在游走池、导致两套 levelCap/人设并存的重复问题。
  {
    id: "pool_awang", name: "赶马人阿旺", brief: "赶着骡马跑路的汉子",
    personality: "老实巴交，方向感极好，碰到麻烦只会低头硬扛",
    routineWeights: { 鱼定村: 35, 天都镇: 35, 玉泉寨: 30 },
    timeSlot: [15, 75],
  },
  {
    id: "pool_mu_tong", name: "小牧童阿索", brief: "放牧的藏族少年",
    personality: "好奇心旺盛，什么都感兴趣，天黑前必须赶羊回家",
    routineWeights: { 大草甸: 45, 玉泉寨: 35, 鱼定村: 20 },
    timeSlot: [5, 65],
  },
  {
    id: "pool_da_niang", name: "鱼定大娘", brief: "村里的老婆婆",
    personality: "热心肠，爱叨叨，什么八卦都清楚，就喜欢把年轻人凑成对",
    routineWeights: { 鱼定村: 65, 玉泉寨: 25, 天都镇: 10 },
    timeSlot: [5, 70],
  },
  // ── 宗教人口 ──
  {
    id: "pool_you_seng", name: "行脚僧", brief: "云游四方的行脚僧",
    personality: "平静慈悲，遇事不惊，但偶尔会说出令人深思的话",
    routineWeights: { 喇嘛庙: 40, 白塔: 30, 鱼定村: 20, 后山平台: 10 },
    timeSlot: [5, 85],
    levelCap: 5,
  },
  {
    id: "pool_xiang_ke", name: "香客老夫人", brief: "来还愿的信众",
    personality: "虔诚善良，见人先念佛号，过去有段不便说的经历",
    routineWeights: { 喇嘛庙: 55, 白塔: 25, 鱼定村: 20 },
    timeSlot: [10, 60],
  },
  {
    id: "pool_chao_sheng", name: "磕长头的朝圣者", brief: "远道来朝圣的藏民",
    personality: "虔诚到执拗，路再远再苦都不停，心里只有信仰",
    routineWeights: { 喇嘛庙: 45, 白塔: 35, 后山平台: 20 },
    timeSlot: [0, 75],
  },
  // ── 游方道士 ──
  {
    id: "pool_dao_ren", name: "游方道人", brief: "云游的道士，不知哪个门派",
    personality: "神神道道，说话爱打哑谜，但有时候确实能说出点有用的东西",
    routineWeights: { 鱼定村: 30, 喇嘛庙: 25, 后山平台: 25, 雪山派: 20 },
    timeSlot: [15, 80],
    levelCap: 3,
  },
  // ── 混混/灰色人口 ──
  {
    id: "pool_hun_hun", name: "街头混混", brief: "在锦官城讨生活的小混混",
    personality: "欺软怕硬，见风使舵，被逼急了才动手，其实胆子不大",
    routineWeights: { 锦官城: 55, 天都镇: 30, 大草甸: 15 },
    timeSlot: [25, 95],
  },
  {
    id: "pool_lao_bing", name: "老兵退伍汉", brief: "退伍的老兵，在路上漂着",
    personality: "沉默寡言，见过大风浪，不抱怨也不诉说，只管往前走",
    routineWeights: { 锦官城: 35, 天都镇: 30, 鱼定村: 25, 大草甸: 10 },
    timeSlot: [10, 85],
    levelCap: 2,
  },

  // ── 赌石竞价者（正式人物：完整 fullBio/carry/levelCap；gambleBidder 标记 + 落点锁料场）──
  // 他们是别处也能投放的真 NPC 分身。温掌柜是驻场庄家（residentNpcs），主持竞价+回收兜底，不在此池。
  // 本轮换人（交接文档§三）：天都富商→李若由、石料小商贩→才旦、跟风牧民→苏宛。
  // 李若由/才旦另有 residentNpcs 驻场实体（玉泉寨/鱼定村）——分身与驻场不同据点不撞名，
  // 好感度按名字在 varTree.角色 合一，正好是同一个人两地行走。
  {
    id: "pool_bidder_liruoyou", name: "李若由", brief: "玉泉小栈的经营者，来料场淘石的商人之女",
    personality: "初见只谈价格，语气精明现实；出价贴市价、利润算死，见裂立刻压价或退出。相处久了才露出重情重义的一面。",
    fullBio: `玉泉寨玉泉小栈的经营者，商人之女，二十四五，一身利落的靛青窄袖，算盘打得比说话快。
父亲走马帮攒下小栈，她接手后把生意越盘越活，隔三差五赶到天都镇进货，顺道进料场淘石——
小栈柜上摆的玉件、镇纸，多半是她在这儿捡的漏。买料只认数：料要看死、价要算尽，
见裂当场压价或起身走人，从不为热闹加价，是料场里出了名的冷面女买家。
初见她只谈价格，句句精明现实；可跟她处久了才知道，这人重情重义——认下的交情，比契纸还硬。`,
    routineWeights: { 天都镇: 100 }, timeSlot: [0, 23], levelCap: 1,
    gambleBidder: true, lockInnerRoom: "玉石料场", bidderKind: "cash",
    carry: [{ name: "紫檀小算盘", category: "misc", quality: "蓝" }],
  },
  {
    id: "pool_bidder_caidan", name: "才旦", brief: "鱼定村长之女，替村里置办石料的账房好手",
    personality: "工于心计说话不留破绽，账算得滴水不漏。嘴上永远贬低窗口，但她肯出价=石里有货（反向信号最可信）。",
    fullBio: `鱼定村村长之女，替村里管账，账算得滴水不漏，说话不留破绽。村里翻修经堂、置办器物
要用石料玉料，都是她赶到天都镇料场来办——既是采买，也是替村里的钱袋子把关。
她看窗口有一套祖传的损法："这窗发闷""种嫩得很""怕是要垮"，一路贬到底，
可行家都懂她的门道：嘴上越损、心里越馋，真肯掏钱出价的必是石里有货；
她要真闭嘴摇头走人，那料多半废了。这张嘴是反着听的信号，比谁的吆喝都准。
卸下算盘和防备的时候，才露出与年纪相符的少女心性——但在料场里，没人见过。`,
    routineWeights: { 天都镇: 100 }, timeSlot: [0, 23], levelCap: 1,
    gambleBidder: true, lockInnerRoom: "玉石料场", bidderKind: "cash",
    carry: [{ name: "鱼定酥油茶砖", category: "misc", quality: "绿" }],
  },
  {
    id: "pool_bidder_chaiyi", name: "锦官差役", brief: "只收武器胚料的官差",
    personality: "面有横肉不凶，官场养出的虚胖；眼神只跟着钱走。只收武器胚料；散场会走到赢家身边递句话，不是邀请是备案。",
    fullBio: `锦官城派驻天都镇的一名皂隶，姓崔，面有横肉却不显凶相，是官场养出的那种虚胖，
一身靛蓝皂衣、腰悬水火棍，说话慢条斯理。他来赌石坊不为玩，专收能打制兵器的硬胚料——
替锦官城军坊采买，只认武器料、玉料一概不碰。出价略高于寻常买家，因为背后是官家的钱。
散场后他常踱到当日赢家身边，不咸不淡递一句"这位好手气，贵姓啊"——不是套近乎，是记档备案，
锦官城要摸清曲措乡谁手里有钱有料。眼睛只跟着钱走，谁赢了他记谁。`,
    routineWeights: { 天都镇: 100 }, timeSlot: [0, 23], levelCap: 2,
    gambleBidder: true, lockInnerRoom: "玉石料场", bidderKind: "cash",
    carry: [{ name: "巡捕营腰牌", category: "accessory", quality: "绿" }],
  },
  {
    id: "pool_bidder_xueshan", name: "雪山弟子", brief: "以物易物的雪山派后生",
    personality: "灰白练功服、腕缠防寒绷带，清冷少话。以物易物——付丹药、练功秘籍残页。",
    fullBio: `雪山派下山采买的年轻外门弟子，姓孟名霜，二十岁出头，一身洗得发白的灰白练功服，
腕上缠着防寒的旧绷带，眉眼清冷、话极少。雪山派银钱不宽裕，他来赌石坊不带多少现银，
惯以物易物——拿门中的雪山当归丸、防冻的秘制药膏、乃至练功心得残页来换料。
他要料多半是替师门配药或琢磨暗器胚子，出价不高但换的东西对练武之人金贵。
急着提升武功、缺丹药秘籍的赌客，跟他换比拿银子实惠。`,
    routineWeights: { 天都镇: 100 }, timeSlot: [0, 23], levelCap: 3,
    gambleBidder: true, lockInnerRoom: "玉石料场", bidderKind: "barter",
    carry: [{ name: "雪山当归丸", category: "misc", quality: "蓝" }, { name: "雪山练功服", category: "armor", quality: "白" }],
  },
  {
    id: "pool_bidder_heifeng", name: "黑风寨采买", brief: "拿人情债换料的敦实汉子",
    personality: "旧刀疤斜拉过颧骨、牦牛皮短褂，话少眼活。出价最低，但加一句人情债。",
    fullBio: `黑风寨下山采买的敦实汉子，人唤"石头巴桑"，三十五六，一道旧刀疤斜拉过颧骨，
穿件油亮的牦牛皮短褂，话少眼活。黑风寨规矩克制、不劫妇孺，采买也守寨规、不硬抢。
他兜里现银最少，出价常压到最低，可他给的不止银子——肯搭一句实打实的人情债：
"巴桑记着，往后过狼曲河谷，报我名字，寨里弟兄不为难你。"这份交情在那条道上比银子好使。
认人不认钱，谁跟他结过善缘，下回见了格外照应。`,
    routineWeights: { 天都镇: 100 }, timeSlot: [0, 23], levelCap: 2,
    gambleBidder: true, lockInnerRoom: "玉石料场", bidderKind: "favor",
    carry: [{ name: "黑风令", category: "accessory", quality: "白" }],
  },
  {
    id: "pool_bidder_suwan", name: "苏宛", brief: "苏记茶货铺的姑娘，料场里最会看人的一双眼",
    personality: "嘴甜眼毒心算快，端着茶壶不推销，等你主动开口局才开始。抬价爽快得有点蹊跷——像替干姑母温掌柜的场子暖局。",
    fullBio: `天都镇苏记茶货铺老板的女儿，二十岁，汉人。铺子开在玉器轩斜对面，卖普洱和滇红，
她从小在柜台后泡茶，练出一双识人的眼睛——哪个客人有钱、哪个好面子、哪个赌输了心情不好
需要多加点糖，一眼看穿。温掌柜是她干姑母，称她"天生的生意胚子"，让她在赌石坊和玉器轩之间
当牵线人：碰到赌红了眼的客人，她递杯茶、聊两句，不着痕迹把人引去玉器轩"看看成品散散心"。
料场是她的猎场。她也下场竞价，出价爽快嘴又甜，只是有时抬价抬得蹊跷——懂行的都咂摸出味来：
这姑娘是在替姑母的场子暖局。可她从头到尾没说过一句假话，你挑不出她半点错处。`,
    routineWeights: { 天都镇: 100 }, timeSlot: [0, 23], levelCap: 1,
    gambleBidder: true, lockInnerRoom: "玉石料场", bidderKind: "cash",
    carry: [{ name: "今年的春尖普洱", category: "misc", quality: "绿" }],
  },
  // ── 兰姐（百花门主·游走特殊：白天赌石坊竞价，入夜回百花楼坐镇）──
  // 苗族出身，与欢喜教罗琦是完全独立两人（总纲红线，不可混）。用 schedule 分昼夜落点。
  {
    id: "pool_lanjie", name: "兰姐", brief: "百花门主，昆明流亡而来",
    personality: "华丽张扬做排场，实则处处提防，对虎胆志在必得。谈价爱加附加条件，附加条件有时比银子值钱。",
    fullBio: `百花门门主，苗族人，昆明流亡而来，三十许人风韵犹存。一身苗银盛装华丽张扬——
牛角银冠、层叠银项圈、蜡染百褶裙，走动间环佩叮当，做排场是她立威的手段，实则处处提防、
灵狐一般机警。百花门是天都镇地下秩序的一极，她对熊山"虎胆"志在必得，为的是门中一味秘药。

【总纲红线·重要区分】兰姐与欢喜教圣女罗琦是完全独立的两个人，容易因都在天都镇、都是地下秩序头目
而被误认成同一人——兰姐是百花门主、苗族出身；罗琦是欢喜教圣女、天竺与大理混血。外貌、势力、
情感线全部各自独立，绝不可混淆。

在赌石坊里她出价未必最高，却总带一句附加条件——"这料我要了，打磨费我出，另请你到百花楼喝盏桂花酿"，
附加条件里藏着交情与算计，有时比银子更值钱。入夜她便回百花楼坐镇，那才是她真正的地盘。`,
    // 白天(辰至酉,8-17)在天都镇赌石坊竞价；入夜(酉末至次日,18-23 及 0-7)回百花楼
    schedule: [
      { slot: [8, 18], weights: { 天都镇: 100 }, lockInnerRoom: "玉石料场" },
      { slot: [18, 24], weights: { 天都镇: 100 }, lockInnerRoom: "百花楼" },
      { slot: [0, 8], weights: { 天都镇: 100 }, lockInnerRoom: "百花楼" },
    ],
    levelCap: 4, bidderKind: "condition",
    carry: [{ name: "百花刺", category: "weapon", quality: "蓝" }, { name: "苗银花丝耳坠", category: "accessory", quality: "蓝" }],
  },
];

// 给定据点名 + 游戏时间 → 今天在此的游走 NPC 列表（3-8 个）
// 同一天同一地点多次调用结果完全一致（纯函数，依赖种子随机）
export function getScheduledNpcs(locationName, time) {
  // 时间制：24 回合/天（与 getTimeStr 的 t%24 对齐）。dayIdx 分天固化随机，hour 判昼夜时段。
  const dayIdx = Math.floor(time / 24);
  const hour = ((time % 24) + 24) % 24; // 0-23：0=子初…夜；8-9=辰（清晨）；12-13=午；18+=酉戌亥（入夜）
  const rng = seededRand(dayIdx, locationName);

  const eligible = [];
  for (const npc of NPC_POOL) {
    // 分时段落点（schedule）优先：白天/夜晚去不同地方（兰姐等）。
    // 每段 {slot:[startHour,endHour], weights:{据点:权重}, lockInnerRoom?}。
    if (Array.isArray(npc.schedule)) {
      const seg = npc.schedule.find(s => hour >= s.slot[0] && hour < s.slot[1]);
      if (!seg) continue;
      const w = seg.weights[locationName];
      if (!w) continue;
      eligible.push({ ...npc, _w: w, lockInnerRoom: seg.lockInnerRoom ?? npc.lockInnerRoom });
      continue;
    }
    // 老机制：单一 routineWeights + timeSlot（timeSlot 现按小时 0-23 解释；
    // 旧数据是 0-100 百分比，兼容处理：>23 的上界按全天算）。
    const w = npc.routineWeights?.[locationName];
    if (!w) continue;
    const [lo, hiRaw] = npc.timeSlot || [0, 23];
    const hi = hiRaw > 23 ? 23 : hiRaw;
    const loH = lo > 23 ? 0 : lo;
    if (hour < loH || hour > hi) continue;
    eligible.push({ ...npc, _w: w });
  }

  const count = Math.min(eligible.length, 3 + Math.floor(rng() * 6));
  return weightedSample(eligible, "_w", count, rng);
}

// 把游走 NPC 转成 room.npcs 可用的格式（让现有 NpcActionMenu 可以互动）
export function toRoomNpc(poolNpc) {
  return {
    id: `pool_${poolNpc.id}`,
    name: poolNpc.name,
    brief: poolNpc.brief,
    isPoolNpc: true,
    carriedItems: [],
  };
}
