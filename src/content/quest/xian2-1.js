// 线二·秘密现世 配套支线（总纲 v3 线二篇章 任务6–10）。
// 地点锁一律 requireLocation——at 只做面板提示，开局 flag 与续接控制都不认。
export default { quest: {

"xian2_6_mixin": {
    id: "xian2_6_mixin",
    type: "QT_DELIVERY",
    title: "贡措海方向的密信",
    giver: null,
    description: "呼延雪在山洞发现遗书之前，一名奉住持之命秘密传信试探「前任经师当年是否真的去过贡措海」的信使，在喇嘛庙通往贡措海的山道上被土司府眼线截杀。",
    stages: [
      {
        id: "s1_messenger",
        description: "喇嘛庙山门外的山道上，一个行脚僧模样的人倒在雪地里，怀里死死护着一封火漆密信。他认出玩家是近来帮过庙里的人，把信塞进玩家手里：「送……贡措海方向……别走官道……」说完便没了气。密信封皮上没有收信人，只有一枚寺里的印记。",
        playerHint: "山道上有个遇袭的行脚僧，去看看。",
        completionFlag: "quest_xian2_6_s1",
        requireLocation: { district: "喇嘛庙", inner: "山门" },
        onReach: { exp: 2 },
      },
      {
        id: "s2_deliver",
        description: "玩家弃官道走山径赶往贡措海，途中两次察觉身后有人尾随，凭轻功甩脱。在湖畔一处不起眼的玛尼堆下找到约定的暗格，投信入内。信封内侧一行小字被雪水浸开一角：「……塔下藏着不该问的东西。」",
        playerHint: "避开尾随，把密信送到贡措海。",
        completionFlag: "quest_xian2_6_s2",
        requireLocation: { district: "贡措海", inner: "湖畔" },
        onReach: { exp: 3, reputation: 2, flags: ["xian2_mixin_delivered", "hint_tower_secret"] },
      },
    ],
    rewardText: "神秘人（住持化名）对你的信任提升——你先于呼延雪窥见了冰山一角：塔下藏着不该问的东西。",
  },

"xian2_7_jiadiqi": {
    id: "xian2_7_jiadiqi",
    type: "QT_MYSTERY",
    title: "地摊上的假地契",
    giver: null,
    description: "线二冲突尚未浮出水面时，锦官城城门地摊上一个小贩低价转卖一批从「某处」流出的旧纸张，谎称是绝世剑谱。",
    stages: [
      {
        id: "s1_stall",
        description: "城门地摊前小贩吆喝得唾沫横飞：「失传剑谱，十文一张！」玩家翻了两页，纸是旧纸，墨迹也做旧了，但剑招路数狗屁不通——倒是纸张背面隐约透出一幅界址图样的墨线。小贩支支吾吾说不清货从哪来的。二选一：A.贪便宜买下当剑谱练，走火入魔吃个小亏；B.觉得蹊跷，拿去给行家鉴定。",
        playerHint: "城门地摊在卖「绝世剑谱」，看看是什么货色。",
        completionFlag: "quest_xian2_7_s1",
        requireLocation: { district: "锦官城", inner: "城门" },
        onReach: { exp: 2 },
      },
      {
        id: "s2_appraise",
        description: "把纸拿给李若由鉴定。她对着光看了半晌脸色骤变——这不是剑谱，是一张地图残片，上面的印记与玉泉寨草场的地界线高度吻合。「这东西你从哪弄的？」她压低声音，「看着像地契的边角，可玉泉寨的地契……不该流出来。」",
        playerHint: "拿着可疑的纸去找懂行的人鉴定。",
        completionFlag: "quest_xian2_7_s2",
        requireLocation: { district: "玉泉寨", inner: "玉泉小栈" },
        onReach: { exp: 3, favorability: { "李若由": 3 }, flags: ["xian2_map_fragment_hint"], items: [{ name: "地图残片", category: "misc", quality: "蓝", tags: ["线索", "地契", "任务"], desc: "看着像剑谱废纸，实则是地图残片，印记与玉泉寨草地界线吻合——贡措海取地契任务的辅助线索。" }] },
      },
    ],
    rewardText: "第一次摸到「伪造地契」这个概念的边缘——全貌还没揭开，但方向有了。",
  },

"xian2_8_tingyu": {
    id: "xian2_8_tingyu",
    type: "QT_PUZZLE",
    title: "白塔檐下的顿悟",
    giver: null,
    description: "呼延雪告知行脚僧真相之后、住持尚未表态之前，玩家途经白塔恰逢连日阴雨，在破败檐廊下静坐听雨。",
    stages: [
      {
        id: "s1_rain",
        description: "白塔的檐廊残破不堪，雨点顺着断瓦滴在石阶上，敲出一种不紧不慢的节奏。玩家索性坐下来听雨——檐下的水线断了又续，续了又断，像极了一种剑理。",
        playerHint: "白塔檐下正落雨，坐一会儿。",
        completionFlag: "quest_xian2_8_s1",
        requireLocation: { district: "白塔", inner: "塔身檐廊" },
        onReach: { exp: 2 },
      },
      {
        id: "s2_satori",
        description: "灵光一闪，快剑的一个关隘忽然想通了。正要起身，塔内隐隐传来一阵诵经声——是住持独自在塔里诵经忏悔，声调压得极低，像是怕惊动了谁，又像是在求谁原谅。玩家没有出声，悄悄记下，退了出去。",
        playerHint: "听雨的功夫，塔里好像有人。",
        completionFlag: "quest_xian2_8_s2",
        requireLocation: { district: "白塔", inner: "塔身檐廊" },
        isCgMoment: true,
        onReach: { exp: 3, pot: 5, flags: ["xian2_abbot_confession_heard"] },
      },
    ],
    rewardText: "招式品阶突破（潜能+5）与「塔内忏悔声」的隐藏线索——住持正在经受良心的煎熬，日后对峙时这就是铺垫。",
  },

"xian2_9_yupei": {
    id: "xian2_9_yupei",
    type: "QT_FETCH",
    title: "当铺里的旧玉佩",
    giver: null,
    description: "一名受都事指使的恶徒强行逼当铺老板典当一枚看似普通的旧玉佩——那玉佩上刻着前朝土司的私印。",
    stages: [
      {
        id: "s1_pawn",
        description: "聚宝当铺里，一个横眉立目的恶徒把一枚旧玉佩拍在柜上，逼着老板按他的价钱收当。老板手在抖：这玉佩是别人多年前寄当的，原主说不定还会回来赎。玩家上前理论，恶徒拔刀，几个回合被打出门去，玉佩留在柜上。",
        playerHint: "当铺里有人在强买强卖，管不管随你。",
        completionFlag: "quest_xian2_9_s1",
        requireLocation: { district: "锦官城", inner: "聚宝当铺" },
        onReach: { exp: 2 },
      },
      {
        id: "s2_seal",
        description: "玩家多嘴问了一句这玉佩的来历，老板凑近了压低声音：「您仔细瞧这印——前朝土司的私印。这种东西，寻常人家哪来的？当这玩意儿的人，多半……不干净。」他把玉佩塞给玩家，「您拿着比放我这儿安全，那些人还会回来的。」",
        playerHint: "问老板这玉佩什么来路。",
        completionFlag: "quest_xian2_9_s2",
        requireLocation: { district: "锦官城", inner: "聚宝当铺" },
        onReach: { exp: 3, reputation: 3, flags: ["xian2_former_seal_evidence"], items: [{ name: "前朝土司私印玉佩", category: "misc", quality: "蓝", tags: ["物证", "地契", "任务"], desc: "刻着前朝土司私印的旧玉佩——伪造地契不是孤立一次造假，而是前朝旧事的延续。" }] },
      },
    ],
    rewardText: "前朝私印玉佩到手——与线二「前代土司私藏罪证」的地契母题互文，物证+1。",
  },

"xian2_10_yinju": {
    id: "xian2_10_yinju",
    type: "QT_TALK",
    title: "贡措海畔的隐居者",
    giver: null,
    description: "线二终局前，玩家决定「谁去贡措海取地契」之前，在湖畔探索时偶然发现一处隐蔽洞府，里面住着一位隐居多年的高人——他与前任经师是旧识。",
    stages: [
      {
        id: "s1_hermit",
        description: "贡措海畔一处不起眼的洞府，门口晒着药草。一位须发皆白的老人盘坐洞前，像是早知道有人要来：「三十年了，你是头一个摸到这儿的。」他抬眼打量玩家，「想听贡措海的旧事？先答我一问——三十年前贡措海畔，死的是谁，为的什么？」",
        playerHint: "湖畔有个隐居的老人，他好像知道些什么。",
        completionFlag: "quest_xian2_10_s1",
        requireLocation: { district: "贡措海", inner: "湖畔" },
        onReach: { exp: 2 },
      },
      {
        id: "s2_answer",
        description: "玩家把一路拼凑的碎片串起来答：前任经师是为销毁地契而死，并非意外身亡。老人沉默良久，点头：「答得对——他临走前在我这儿坐了一夜，说那东西要是公之于众，曲措乡要翻天；要是埋了，又对不起死人。他选了第三条路，把自己赔进去了。」二选一：答对得证词+灵药；答错只得灵药被婉拒。",
        playerHint: "答得出三十年前贡措海畔的事，老人才肯说实话。",
        completionFlag: ["quest_xian2_10_s2_right", "quest_xian2_10_s2_wrong"],
        requireLocation: { district: "贡措海", inner: "湖畔" },
        onReach: {
          exp: 3,
          items: [{ name: "雪山疗伤灵药", category: "misc", quality: "蓝", tags: ["药品", "疗伤"], desc: "隐士自配的伤药，内服外敷皆可。" }],
          byFlag: {
            quest_xian2_10_s2_right: { flags: ["xian2_witness_testimony"] },
            quest_xian2_10_s2_wrong: { flags: ["xian2_hermit_declined"] },
          },
        },
      },
    ],
    rewardText: "确凿证词到手——「公开地契」结局分支的说服力就此立住；答错则只能靠其他途径继续拼真相。",
  },

} };
