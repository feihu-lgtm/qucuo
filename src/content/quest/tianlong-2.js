// 天龙八部护法戏份：夜叉姬无双、阿修罗樊未离各一条支线。门槛用顶层 requiresFactionRep（#237 写法）。
export default { quest: {
  tianlong_z1_yechaxiyan: {
    id: "tianlong_z1_yechaxiyan",
    type: "QT_TALK",
    title: "天支1·夜叉夜宴",
    giver: "姬无双",
    giverId: "resident_jiwushuang",
    localOnly: true,
    requiresFactionRep: { 天龙教: 15 },
    description: "夜叉姬无双递来一盏酒，又递来一桩差事：风沙客帐那个唱曲的胡姬，这个月往外递了三回消息。",
    stages: [
      {
        id: "cup",
        requireLocation: { district: "天龙营", inner: "夜叉罗刹帐" },
        playerHint: "去夜叉罗刹帐见姬无双，接下她的酒和差事。",
        description: "姬无双剥着葡萄，说营里有人往外递信，她查了三年，查到风沙客帐的纳兰露儿就断了。「你是外人，她不防你。替我听一夜曲子。」",
        completionFlag: "quest_tlz1_cup",
      },
      {
        id: "inn",
        giver: null,
        requireLocation: { district: "天龙营", inner: "风沙客帐" },
        playerHint: "在风沙客帐听纳兰露儿唱曲，看她把消息递给谁。",
        description: "后半夜曲子换了调，一个裹着土司府火漆斗篷的人掀帘进来，接过她袖里的一卷曲谱。纳兰露儿抬眼看见你，银铃停了。",
        completionFlag: ["quest_tlz1_seize", "quest_tlz1_trail"],
        choices: [
          { flag: "quest_tlz1_seize", label: "当场擒下来接头的信使", resolve: "combat", combatNpc: { name: "土司府密使", levelCap: 3 } },
          { flag: "quest_tlz1_trail", label: "放信使走，跟到暗道口", resolve: "none", narration: "你装醉伏在案上，等信使出帐再跟上去。他绕过军需坊，在一块松动的地板前停住，掀开就钻了下去——底下是一条斜阶，风里有陈粮的味道。" },
        ],
        onReach: { flags: ["tianlong_anliang_unlocked"] },
      },
      {
        id: "report",
        requireLocation: { district: "天龙营", inner: "夜叉罗刹帐" },
        playerHint: "回夜叉罗刹帐，决定要不要把纳兰露儿的真身告诉姬无双。",
        description: "曲谱里夹着的不是天龙教的军情，是土司府粮车进出暗道的时辰。纳兰露儿拦住你，摘下银铃：她真名罗那，是八部的紧那罗，替天王旧部盯着这条粮道。姬无双在帐里等你回话。",
        completionFlag: ["quest_tlz1_tell", "quest_tlz1_hide"],
        choices: [
          { flag: "quest_tlz1_tell", label: "如实禀报，说出罗那的真身", resolve: "none", narration: "姬无双听完把葡萄皮放下，笑了：「紧那罗啊……难怪。」她把一张夜叉密札推给你，「你办事稳，夜叉部记你一份。」" },
          { flag: "quest_tlz1_hide", label: "只报粮道，替罗那瞒下真身", resolve: "none", narration: "你只说了粮道和土司府。姬无双盯了你很久，忽然笑出声：「会替人藏秘密的，才配知道秘密。」她没再问，罗那那边却托人送来一串银铃。" },
        ],
        onReach: {
          money: 150,
          factionRep: { 天龙教: 10 },
          byFlag: {
            quest_tlz1_tell: { favorability: { 姬无双: 15 }, factionRep: { 鱼定土司府: -10 }, items: [{ name: "夜叉密札", fromCatalog: true }] },
            quest_tlz1_hide: { favorability: { 姬无双: 8, 罗那: 15 }, flags: ["flag_tl_luona_secret"], items: [{ name: "纳兰银铃", fromCatalog: true }] },
          },
        },
      },
    ],
    rewardText: "暗道粮草的事落进了夜叉的黑漆匣子。天龙营里从此有两个人记得你：一个记你办事，一个记你嘴严。",
  },
  tianlong_z2_xiuluogong: {
    id: "tianlong_z2_xiuluogong",
    type: "QT_TALK",
    title: "天支2·修罗三阵",
    giver: "樊未离",
    giverId: "resident_fanweili",
    localOnly: true,
    requiresFactionRep: { 天龙教: 40 },
    requiresPrestige: 0,
    description: "修罗宫宫门关了五年。樊未离要找一个外人替她去断崖石室见天王一面——她去就是表态，外人去只算传话。可想替她传话，先过修罗三阵。",
    stages: [
      {
        id: "trial",
        requireLocation: { district: "天龙营", inner: "修罗宫" },
        playerHint: "在修罗宫闯修罗三阵，堂堂正正赢下樊未离一场。",
        description: "青石地上三个圈。樊未离抱刀站在第三个圈里：「第一圈看你敢不敢进，第二圈看你退不退，第三圈看你认不认。」",
        completionFlag: "quest_tlz2_trial",
        choices: [
          { flag: "quest_tlz2_trial", label: "踏进修罗三阵", resolve: "combat", combatNpc: { name: "樊未离", id: "resident_fanweili", levelCap: 5 } },
        ],
        onReach: { flags: ["tianlong_shishi_unlocked"], favorability: { 樊未离: 10 } },
      },
      {
        id: "cell",
        giver: null,
        requireLocation: { district: "天龙营", inner: "断崖石室" },
        playerHint: "拿樊未离给的钥匙开断崖石室，替她见天王厉苍天一面。",
        description: "石门开了。厉苍天坐在长明灯下抄经，听你说是修罗宫来的，笔停了很久。「她还记着那一场。」他问你：修罗宫要的是什么？",
        completionFlag: ["quest_tlz2_rise", "quest_tlz2_rest"],
        choices: [
          { flag: "quest_tlz2_rise", label: "替樊未离问一句：天王还肯不肯出这扇门", resolve: "none", narration: "厉苍天合上经卷：「告诉她，门是从外头锁的，可人是从里头不肯走。等她想清楚为什么要我出去，再来问。」他把一页手抄的止戈经交给你。" },
          { flag: "quest_tlz2_rest", label: "劝天王死心，修罗宫不该为旧事再动刀", resolve: "none", narration: "厉苍天笑了一下，像松了口气：「她要是肯听你这句，修罗宫就不会死人。」他让你把一枚旧天王印带给她，算作当年那一场的了结。" },
        ],
        onReach: {
          byFlag: {
            quest_tlz2_rise: { favorability: { 樊未离: 15, 厉苍天: 10 }, flags: ["flag_tl_xiuluo_leans_tianwang"], items: [{ name: "手抄止戈经", fromCatalog: true }] },
            quest_tlz2_rest: { favorability: { 樊未离: 10, 厉苍龙: 10 }, flags: ["flag_tl_xiuluo_stays_out"], items: [{ name: "旧天王印", fromCatalog: true }] },
          },
        },
      },
      {
        id: "answer",
        requireLocation: { district: "天龙营", inner: "修罗宫" },
        playerHint: "回修罗宫，把天王的话带给樊未离。",
        description: "樊未离听完一句话都没说，把刀插回鞘里。那是五年来修罗宫第一次收刀。",
        completionFlag: "quest_tlz2_done",
        onReach: {
          money: 300,
          factionRep: { 天龙教: 15 },
        },
      },
    ],
    rewardText: "修罗宫的刀收回了鞘。龙王和天王之间那把最硬的刀往哪边倒，你替它递过一次话。",
  },
} };
