// 线一·土司杀子 配套支线（总纲 v3 线一篇章 任务2–任务5）。
// 任务1「熊山口的不平事」已由村1·路见不平落地（yiding-1.js）。
// 四条均无固定接取人：按总纲设计是路途随机遭遇型支线，用 requireLocation
// 锚定触发场景，玩家走到对应内层房间自然撞上。
export default { quest: {

"tusiline_2_xueshan_dizi": {
    id: "tusiline_2_xueshan_dizi",
    type: "QT_RESCUE",
    title: "雪山派弟子之难",
    giver: null,
    description: "土司拒绝雪山派出山复仇的消息传开后，大草甸深处一名雪山派外门弟子被误认成「雪山派已经答应帮土司府出手复仇」，遭仇家追杀——那是管家安插的眼线。",
    stages: [
      {
        id: "s1_rescue",
        description: "大草甸深处，三名蒙面刀客围着一个浑身是血的雪山派外门弟子。弟子抱剑半跪，见玩家出现，嘶声喊「我雪山派根本没应过土司府——他们杀错人了」。刀客转向玩家：「闲事少管，滚。」三选一：A.拔剑击退追兵；B.亮出名号喝退；C.先静观其变，见弟子快撑不住再出手。",
        playerHint: "大草甸深处有追杀声——去看看，或绕开。",
        completionFlag: "quest_tusiline2_s1",
        requireLocation: { district: "大草甸", inner: "草甸深处" },
        onReach: { exp: 2 },
      },
      {
        id: "s2_heal",
        description: "追兵退去，弟子肋下中了一刀血流不止。玩家以内力帮他止血续命，他挣扎着报出名号，回山前要玩家留一句话带给掌门：「雪山派确实拒绝了土司的请求，但拒绝的理由……没那么简单。」他没再多说，一瘸一拐往北去了。",
        playerHint: "弟子伤得不轻，用内力帮他疗伤，听他留下的话。",
        completionFlag: "quest_tusiline2_s2",
        requireLocation: { district: "大草甸", inner: "草甸深处" },
        isCgMoment: true,
        onReach: { exp: 3, favorability: { "何雨谢": 3 }, flags: ["tusiline_xueshan_debt", "hint_xueshan_refusal_reason"], items: [{ name: "雪山派外门信物", category: "misc", quality: "蓝", tags: ["信物", "雪山派", "任务"], desc: "一枚素银雪花佩，外门弟子贴身之物。凭此在雪山派可享受一次优惠拜访。" }] },
      },
    ],
    rewardText: "数日后何雨谢私下传话致谢，并隐晦提及雪山派拒绝土司另有内情——为线三掌门下落的悬念埋下伏笔。",
  },

"tusiline_3_zuihua": {
    id: "tusiline_3_zuihua",
    type: "QT_TALK",
    title: "玉泉寨老丈的醉话",
    giver: null,
    description: "线一冲突升温期间，玉泉寨的酥油茶棚里有个喝闷酒的老牧民——儿子死于管家之手，如今眼见管家丧子，五味杂陈借酒消愁。",
    stages: [
      {
        id: "s1_drink",
        description: "酥油茶棚角落，一个老牧民独自抱着酒囊灌青稞酒，眼神浑浊。店家低声说这位老丈这几日天天来买醉，谁劝都不听。老丈抬头打量玩家，把酒囊往桌上一顿：「外乡人？陪我喝。喝赢了我，听我说个事；喝输了，滚蛋。」拼酒开始——可以用内力逼酒，也可以凭真本事硬喝。",
        playerHint: "茶棚里有个喝闷酒的老牧民要跟过路人拼酒。",
        completionFlag: "quest_tusiline3_s1",
        requireLocation: { district: "玉泉寨", inner: "寨场酥油茶棚" },
        onReach: { exp: 2 },
      },
      {
        id: "s2_secret",
        description: "酒过三巡老丈醉眼朦胧，忽然拍着桌子苦笑：「老天爷替我们报了仇，可我痛快不起来——这乡里的债，从来都是穷人先还。」他压低声音，含糊说起银灰独眼狼王最近在大草甸北面的活动规律：几处必过的水源地、夜里嚎叫的方位。说完便趴在桌上鼾声如雷。",
        playerHint: "老丈醉了，听他含糊吐露的话。",
        completionFlag: "quest_tusiline3_s2",
        requireLocation: { district: "玉泉寨", inner: "寨场酥油茶棚" },
        onReach: { exp: 3, pot: 3, flags: ["tusiline_wolf_pattern"] },
      },
    ],
    rewardText: "狼王活动规律到手——线一终局「大草甸决战」的一个可选提前接触方式；老丈的身份，熟悉寨子的人自然心知肚明。",
  },

"tusiline_4_husong": {
    id: "tusiline_4_husong",
    type: "QT_ESCORT",
    title: "护送最后一程",
    giver: null,
    description: "线一冲突白热化同期，鱼定村通往锦官城的官道上，一名替土司府押送文书的镖师遭不明劫匪伏击重伤身亡——劫匪暗中受都事指使，意图截获文书试探虚实。",
    stages: [
      {
        id: "s1_dying",
        description: "官道边的草丛里躺着个重伤的镖师，胸口插着半截断刀，身旁散落的镖旗被血浸透。他攥住玩家的手腕，断断续续说女儿在鱼定村等他回门，求玩家把他送回去——「银子……分文不少给你」。话没说完便咽了气。",
        playerHint: "官道边有个重伤的镖师，去看看。",
        completionFlag: "quest_tusiline4_s1",
        requireLocation: { district: "锦官城", inner: "官道" },
        onReach: { exp: 2 },
      },
      {
        id: "s2_ambush",
        description: "玩家背起镖师遗体往鱼定村走，半路两拨蒙面劫匪先后拦截，开口就要搜尸身——他们找的是镖师贴身藏的那份文书。击退劫匪后搜查尸身，发现镖师怀里确有一封官府暗记的文书包，以及一把带暗记的佩刀。",
        playerHint: "劫匪盯上了镖师身上的东西，护送遗体回村。",
        completionFlag: "quest_tusiline4_s2",
        requireLocation: { district: "锦官城", inner: "官道" },
        onReach: { exp: 3, flags: ["tusiline_dushi_evidence"], items: [{ name: "镖师遗留的佩刀", category: "weapon", quality: "白", tags: ["武器", "物证", "任务"], desc: "镖师随身佩刀，刀柄内侧錾着一枚极小的官府暗记——可作为日后揭露都事手段的物证。" }] },
      },
      {
        id: "s3_daughter",
        description: "镖师之女在村口接过父亲的遗体，跪地磕了三个头。玩家递上镖师留下的酬金，她摇头拒收，只求一件事：「查清我爹是被谁害死的。」她红着眼眶说，官府在这场冲突里的手段，远比表面看上去脏。",
        requireLocation: { district: "鱼定村", inner: "村口" },
        playerHint: "把镖师送回他女儿手上。",
        completionFlag: "quest_tusiline4_s3",
        isCgMoment: true,
        onReach: { exp: 3, reputation: 3, flags: ["tusiline_biaoshi_daughter_vow"] },
      },
    ],
    rewardText: "镖师之女拒收酬金只求报仇——一个可选的小复仇支线就此挂起；官府的手段不干净，玩家已亲眼所见。",
  },

"tusiline_5_daifu": {
    id: "tusiline_5_daifu",
    type: "QT_MURDER",
    title: "代雪山派赴的约",
    giver: null,
    description: "线一终局前夕，大草甸边缘一处临时擂台。一个欠下赌债被逼上擂台的怯懦书生求玩家代他出战——对手是个蒙面的神秘挑战者，招式路数莫名眼熟。",
    requiresQuestCompleted: "tusiline_2_xueshan_dizi",
    stages: [
      {
        id: "s1_duel",
        description: "临时擂台周围聚了一圈看热闹的，书生躲在玩家身后直哆嗦：「我、我当真打不过他……」蒙面挑战者上了擂台不发一言，起手就是一记又快又狠的鞭腿——这路数，玩家越看越眼熟。三招过后对方摘了面巾，竟是梅朵。她收势大笑：「就想找个人打一架，谁都行——是你更好！」",
        playerHint: "怯懦书生求玩家代他赴生死擂台，对手不知是谁。",
        completionFlag: "quest_tusiline5_s1",
        requireLocation: { district: "大草甸", inner: "草甸边缘" },
        isCgMoment: true,
        onReach: { exp: 3, favorability: { "梅朵": 5 } },
      },
      {
        id: "s2_confide",
        description: "擂台散了，梅朵坐在桩子上跟玩家说了实话：父亲土司府对不住管家丧子之痛，雪山派又见死不救，她心里憋着一股劲没处撒，才借这场擂台发泄。她压低声音透露，她已经在准备孤身闯大草甸找那头银灰独眼狼王——「这事你别劝我，劝也白劝。」",
        playerHint: "梅朵有话要说，听她说完。",
        completionFlag: "quest_tusiline5_s2",
        requireLocation: { district: "大草甸", inner: "草甸边缘" },
        onReach: { exp: 2, flags: ["tusiline_meiduo_wolf_plan"] },
      },
    ],
    rewardText: "梅朵的独行打算就此挑明——线一终局「帮梅朵一起猎狼」分支的提前预热已经就位。",
  },

} };
