// 跑马大会（总纲 v3 第四章）配套任务。
// 这些任务不走任务面板接单：大会会场（后山平台·跑马场）的盛会屏直接
// 触发对应 flag——参赛夺冠、比武打赢、子夜出手都由 features/festival
// 经 forceAdvanceQuest 推进，奖励统一走 stage.onReach。
export default { quest: {
"paoma_saima": {
    id: "paoma_saima",
    type: "QT_CONQUEST",
    title: "跑马大会·跑马夺魁",
    giver: null,
    description: "上午的跑马，卫冕的是土司府梅朵。赛道绕跑马场一周，先到彩旗下者夺魁。",
    stages: [
      {
        id: "s1_win",
        description: "蹄声如雷，烟尘一路扬到彩旗下——你压过了年年卫冕的梅朵。她勒马立住，先是一愣，随即放声大笑，扬鞭指着你说「明年我赢回来」。",
        playerHint: "上午到跑马场报名参加跑马，压过梅朵夺魁。",
        completionFlag: "paoma_saima_win",
        onReach: { exp: 2, reputation: 8, money: 20, favorability: { "梅朵": 12 }, factionRep: { 鱼定土司府: 3 } },
      },
    ],
    rewardText: "梅朵逢人便说「今年输得不冤」。",
  },
"paoma_shejian": {
    id: "paoma_shejian",
    type: "QT_CONQUEST",
    title: "跑马大会·射箭夺魁",
    giver: null,
    description: "午后的射箭，三十步外立靶，红心不过铜钱大，老猎户年年占着头名。",
    stages: [
      {
        id: "s1_win",
        description: "三箭连珠，箭箭咬进红心。老猎户捻着胡子看了半晌，把弓往肩上一甩：「老咯——这红心让给你们年轻人了。」",
        playerHint: "午后到跑马场参加射箭，三箭压过老猎户。",
        completionFlag: "paoma_shejian_win",
        onReach: { exp: 2, reputation: 6, favorability: { "老猎户": 10 }, items: [{ name: "雕花箭囊", category: "accessory", quality: "蓝", desc: "跑马大会射箭彩头，牦牛革面上压着云纹，箭囊口镶一圈旧银——老猎户年轻时赢来的那只的同款。" }] },
      },
    ],
    rewardText: "老猎户把酒桌上吹牛的本钱换成了「当年输给的那个人」。",
  },
"paoma_wubi": {
    id: "paoma_wubi",
    type: "QT_CONQUEST",
    title: "跑马大会·擂台夺彩",
    giver: null,
    description: "傍晚的擂台比武，土司当众看彩，点到为止。擂主是土司府骑技教头，格桑顿珠一手教出来的。",
    stages: [
      {
        id: "s1_win",
        description: "教头抱拳认负，土司府当众颁出彩头——一杆仪卫戟，戟缨赭红，是三十骑手方阵同款。土司借这一颁，把「宽厚」二字摆给了全乡人看。",
        playerHint: "傍晚到跑马场上擂台，打过骑技教头夺彩。",
        completionFlag: "paoma_wubi_win",
        onReach: {
          exp: 3, reputation: 10, money: 80, favorability: { "梅朵": 5 }, factionRep: { 鱼定土司府: 5 },
          items: [{ name: "土司府仪卫戟", category: "weapon", quality: "橙", desc: "跑马大会开场，土司府三十骑手方阵统一擎的仪卫长戟，戟缨染成一色的赭红。中看，也中用——格桑顿珠治军严，这批戟的锋刃是真开过的，方阵一动，气势先压人半头。" }],
        },
      },
    ],
    rewardText: "擂台彩头当众颁下，看客记了很多年。",
  },
"paoma_ziye": {
    id: "paoma_ziye",
    type: "QT_DEFEND",
    title: "跑马大会·子夜护会",
    giver: null,
    description: "子夜变故——官府查封、山贼劫会、邪教乱党，三样只来一样。处置得当，大会来年照办；袖了手，土司的威望就再少一分。",
    stages: [
      {
        id: "s1_event",
        description: "子夜人声散尽时，变故撞上门来。",
        playerHint: "子夜留在跑马场，变故来时抉择出不出手。",
        completionFlag: ["paoma_ziye_guan", "paoma_ziye_zei", "paoma_ziye_xie", "paoma_ziye_yield"],
        onReach: {
          byFlag: {
            paoma_ziye_guan: { exp: 4, reputation: 10, factionRep: { 锦官城: -10, 鱼定土司府: 5 }, flags: ["paoma_festival_held_next"] },
            paoma_ziye_zei: { exp: 4, reputation: 8, money: 30, factionRep: { 玉泉寨: 5 }, flags: ["paoma_festival_held_next"] },
            paoma_ziye_xie: { exp: 4, reputation: 8, factionRep: { 喇嘛庙: 5 }, flags: ["paoma_festival_held_next"] },
            paoma_ziye_yield: { reputation: -8, flags: ["paoma_festival_diminished"] },
          },
        },
      },
    ],
    rewardText: "子夜这一晚怎么处置的，来年还办不办得成大会，都记着。",
  },
} };
