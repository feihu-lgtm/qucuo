export default { quest: {
"yuquanzhai_1_mumutongdemaoniu": {
    id: "yuquanzhai_1_mumutongdemaoniu",
    type: "QT_RESCUE",
    title: "玉泉寨·任务一·小牧童的牦牛",
    giver: "小牧童阿索",
    description: "阿索母亲留下的白牦牛（牛角系褪色红布条）跑丢，往大草甸方向去，他追到一半见狼粪还是软的不敢再追。",
    stages: [
      {
        id: "s1_rescue",
        description: "玩家在大草甸浅沟找到被野狼围困的白牦牛，击退野狼后牦牛用角顶了玩家的手——「它不是顶你，它是在认人。」牵牛回寨路上阿索掰半块存了两年的、母亲留下的最后一块糌粑分给玩家。",
        playerHint: "阿索的牦牛在大草甸走失，去找到它、赶走围着它的野狼。",
        completionFlag: "quest_yuquanzhai1_s1",
        isCgMoment: true,
        onReach: { exp: 1, favorability: { "小牧童阿索": 30 }, reputation: 6, factionRep: { 玉泉寨: 5 } },
      },
    ],
    rewardText: "此后阿索见玩家会主动挥赶牛鞭致意。",
  },
"yuquanzhai_2_liruoyoudeshangduizhang": {
    id: "yuquanzhai_2_liruoyoudeshangduizhang",
    type: "QT_TALK",
    title: "玉泉寨·任务二·李若由的商队账",
    giver: "李若由",
    description: "李若由上月进的茶叶在熊山口被管家的人扣下，交税后收据数目被多记一倍，管家的人称「回头补」却翻脸不认账。茶叶本钱是向天都镇张商人所借，月底到期。",
    stages: [
      {
        id: "s1_confront",
        description: "陪李若由去熊山口对质，可用村1「熊山口的不平事」获取的管家密信施压（若已持有），或直接武力威胁。追回差额后李若由在账本末页记下「某月某日，外乡人为我出过头」。",
        playerHint: "陪李若由去熊山口对质，讨回被克扣的差额。",
        completionFlag: "quest_yuquanzhai2_s1",
        onReach: { exp: 2, favorability: { "李若由": 25 }, money: 30, flags: ["perk_yuquan_xiaozhan_discount"] },
      },
    ],
    rewardText: "此后玉泉小栈购物九折，月底她会托阿索给玩家送一包「今年的第一泡」茶叶。",
  },
"yuquanzhai_3_danzengdemabian": {
    id: "yuquanzhai_3_danzengdemabian",
    type: "QT_COLLECT",
    title: "玉泉寨·任务三·丹增的马鞭",
    giver: "丹增",
    description: "丹增摩挲三十年未修的断马鞭——是当年驯野马摔断三根手指那晚甩断的。卓玛帮他晒牛粪饼时看见鞭子，找了根硬木新鞭杆放在门口三天，丹增没动。他想让鞭子修好，不是自己需要，是「她想看的不是骑马，是她伯父还没老」。",
    stages: [
      {
        id: "s1_gather",
        description: "收集三样材料——熊山野山羊筋（弓弦用）、天都镇孟记铁铺铜箍圈（鞭杆接头）、鱼定村杂货商的桐油（浸鞭用）。",
        playerHint: "凑齐三样材料：熊山野山羊筋、天都镇孟记铁铺铜箍、鱼定村杂货商的桐油。",
        completionFlag: "quest_yuquanzhai3_s1",
        collect: [
          { item: "熊山野山羊筋", at: "大草甸·熊山口", quality: "白", hint: "草甸边缘猎得野山羊，抽其后腿筋" },
          { item: "孟记铁铺铜箍圈", at: "天都镇·孟记铁铺", quality: "白", hint: "天都镇孟记铁铺现打" },
          { item: "桐油", at: "鱼定村·杂货铺摊位", quality: "白", hint: "向鱼定村杂货商赵掌柜讨" },
        ],
        onReach: { exp: 2 },
      },
      {
        id: "s2_repair",
        description: "当众修好后，卓玛站在人群最外面看到鞭子修好便转身离开——「不是不高兴——是怕别人看到她高兴，她跟她哥一样。」丹增没有骑马，但把卓玛送的新鞭杆挂上了哈那墙最显眼的位置。",
        playerHint: "当众把丹增的马鞭修好。",
        completionFlag: "quest_yuquanzhai3_s2",
        isCgMoment: true,
        onReach: {
          exp: 3,
          favorability: { "丹增": 30, "卓玛": 15 },
          items: [{ name: "丹增的旧马鞭", category: "weapon", quality: "绿", desc: "这条旧的你留着。它断过，但甩出去还是响。" }],
        },
      },
    ],
    rewardText: "后续对话卓玛会不经意提「伯父最近精神好多了」。",
  },
"yuquanzhai_4_zhuomadeqingkejiu": {
    id: "yuquanzhai_4_zhuomadeqingkejiu",
    type: "QT_KILL",
    title: "玉泉寨·任务四·卓玛的青稞酒（爱情线前置）",
    giver: "卓玛",
    description: "扎西腿伤好得差不多但走路仍跛。卓玛听闻银灰独眼狼王骨可泡酒治骨伤，托玩家猎狼取骨——不要虎胆，只要一根骨：「我阿爸不会跟你开口的，他觉得欠你已经欠得够多了。我不怕欠。你帮我这次，我欠你的，以后还。」说这话时把碎发别到耳后，耳根微红但目光不闪避。",
    requiresQuestCompleted: "yuquanzhai_3_danzengdemabian",
    stages: [
      {
        id: "s1_hunt",
        description: "大草甸猎杀银灰独眼狼王取骨泡酒（可与虎胆三重门并行不冲突，同一头命名怪，两条支线各自独立触发各自的取用理由）。帮忙搬酒缸时她问「三个月后，你还来吗」——这不是调情，是她从小不敢问的问题：外面的人会不会回来。",
        playerHint: "去大草甸猎那头银灰独眼狼王，取骨给卓玛泡酒。",
        completionFlag: "quest_yuquanzhai4_s1",
        isCgMoment: true,
        onReach: {
          exp: 3,
          favorability: { "扎西": 25, "卓玛": 30 },
          items: [{ name: "狼骨青稞酒一壶", category: "misc", quality: "蓝", desc: "战斗中临时提升攻击力，效果持续三回合。" }],
          flags: ["promise_zhuoma_sanyuehou"],
        },
      },
    ],
    rewardText: "",
  },
"yuquanzhai_5_gongcuohaideyueding": {
    id: "yuquanzhai_5_gongcuohaideyueding",
    type: "QT_ESCORT",
    title: "玉泉寨·任务五·贡措海的约定（爱情线高潮）",
    giver: "卓玛",
    description: "卓玛此前去鱼定村找梅朵，两人在歇马居后院坐了一下午——梅朵问她恨不恨土司府，她说恨，梅朵说「我也恨，但我恨的是管事的人，不是这块地……我可以改。到时候你来鱼定村，不必走侧门」，卓玛说「我不走任何需要别人点头才能走的门」。她请玩家带她一同去贡措海：「我阿爸说贡措海是最干净的水。我哥小时候去过一次，回来跟我说'姐，那水能照见人'。我想去看一眼。」",
    requiresQuestCompleted: "yuquanzhai_4_zhuomadeqingkejiu",
    stages: [
      {
        id: "s1_lake",
        description: "贡措海终局时卓玛以「同行者」身份出现在场景中，不参与战斗，战斗结束后的寂静时刻走到湖边捧水：「我哥骗我。这水照不见人——太深了。但能照见天。」第一次露出笑容。",
        playerHint: "贡措海一战之后，去湖边找卓玛。",
        completionFlag: "quest_yuquanzhai5_s1",
        isCgMoment: true,
        onReach: { exp: 5, favorabilitySet: { "卓玛": 100 }, flags: ["cg_hubianyinshui_muniu"] },
      },
    ],
    rewardText: "终局专属CG场景「湖边饮水的牧女」。",
  }
} };
