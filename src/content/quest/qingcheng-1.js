// 青城派主线（雅江）。按《雅江_据点设计稿》§九预留钩子落地：
//   青1 = 青城线·讨公道（松鹤道长：码头一霸扣马帮货）
//   青2 = 青城线·冒名（玉真子：有人冒青城派名行骗）
//   青3 = 伏龙观下的三十年前剑约（青霞子亲授线，武学表 kf_fulong 的 unlock.note 引用了这条任务）
// 门槛一律走 #237 顶层 requiresFactionRep / requiresPrestige，全档 ≤100。
// 派系加分的「拒收人」沿用各势力惯例 -19。
export default { quest: {
  qingcheng_1_taogongdao: {
    id: "qingcheng_1_taogongdao",
    type: "QT_TALK",
    title: "青1·码头讨公道",
    giver: "松鹤道长",
    giverId: "resident_songhe",
    localOnly: true,
    requiresFactionRep: { 青城派: 0 },
    requiresPrestige: -19,
    description: "松鹤道长在剑坪上收剑入鞘，说码头一霸盘老七扣了马帮给青城送来的三船药材，要价翻倍才肯放货——青城不便与一个市井无赖下场动手。",
    stages: [
      {
        id: "brief",
        requireLocation: { district: "雅江", inner: "剑坪" },
        playerHint: "在剑坪找松鹤道长问清来龙去脉。",
        description: "松鹤道长把一卷货单递给你：「药材是药圃等的，玉真子那边拖不得。你去码头上把货要回来——讲道理也好，拔剑也好，货要完完整整到山门。」",
        completionFlag: "quest_qc1_brief",
      },
      {
        id: "dock",
        giver: null,
        requireLocation: { district: "雅江", inner: "江门街" },
        playerHint: "去江门街码头找盘老七讨货。",
        description: "盘老七蹲在一摞封箱的草药上剥胡豆，身后七八个脚夫拎着棍棒围上来：「青城？青城来了也得按码头的规矩办。」",
        completionFlag: ["quest_qc1_fight", "quest_qc1_talk"],
        choices: [
          { flag: "quest_qc1_fight", label: "动手教训", resolve: "combat", combatNpc: { name: "码头一霸盘老七", levelCap: 5 } },
          { flag: "quest_qc1_talk", label: "抬名头压人", resolve: "none", narration: "你把松鹤道长的货单拍在箱子上，把「青城」两个字一笔一划念给他听。盘老七掂了掂腰带，到底让开了路——雅江城里敢明着跟青城叫板的，还没有第二个。" },
        ],
        onReach: {
          byFlag: {
            quest_qc1_fight: { reputation: 4 },
            quest_qc1_talk: { favorability: { 松鹤道长: 10 } },
          },
        },
      },
      {
        id: "report",
        requireLocation: { district: "雅江", inner: "剑坪" },
        playerHint: "押着货回剑坪，向松鹤道长复命。",
        description: "药材整整齐齐码进山门。松鹤道长验完货单，难得地笑了一下：「货能到，就是不丢青城的脸。」",
        completionFlag: "quest_qc1_done",
        onReach: {
          money: 60,
          items: Array.from({ length: 2 }, () => ({ name: "青城老酒", fromCatalog: true })),
          factionRep: { 青城派: 15 },
        },
      },
    ],
    rewardText: "松鹤道长在剑坪上多看了你两眼，说剑坪的场子以后给你留着。",
  },
  qingcheng_2_maoming: {
    id: "qingcheng_2_maoming",
    type: "QT_TALK",
    title: "青2·冒名行骗",
    giver: "玉真子",
    giverId: "resident_yuzhenzi",
    localOnly: true,
    requiresQuestCompleted: "qingcheng_1_taogongdao",
    requiresFactionRep: { 青城派: 0 },
    description: "玉真子在药圃里数药钵，头也不抬：「有人顶着青城的名号在青衣楼外卖假丹药，已经吃倒了两个客商。招牌是我的，麻烦是青城的。」",
    stages: [
      {
        id: "victim",
        requireLocation: { district: "雅江", inner: "药圃" },
        playerHint: "在药圃找玉真子问假丹药的事。",
        description: "玉真子把一丸假丹递给你闻：丹衣裹得工整，里面掺的是河沙和硫磺。「吃倒人的那几个被抬到青衣楼了。你去看一眼，人还活着，胆气不多了。」",
        completionFlag: "quest_qc2_brief",
      },
      {
        id: "inn",
        giver: null,
        requireLocation: { district: "雅江", inner: "青衣楼" },
        playerHint: "去青衣楼找卖假丹的「青城仙人」。",
        description: "一个披着青城式道袍的外乡人正在楼外高谈阔论，身后竹匾上大字写着「青城仙丹」。见你的眼神落在他道袍的领口上，他的笑慢了半拍。",
        completionFlag: ["quest_qc2_expose", "quest_qc2_trace"],
        choices: [
          { flag: "quest_qc2_expose", label: "当众拆穿", resolve: "combat", combatNpc: { name: "冒名卖药人", levelCap: 4 }, narration: "你伸手点了点他袍子的针脚——青城道袍领口收三褶，他身上这件收了五褶。「青城弟子，没你这么穿衣服的。」" },
          { flag: "quest_qc2_trace", label: "放线钓背后人", resolve: "none", narration: "你压住火气，买了他两丸丹跟他称兄道弟。他拍着胸脯说丹药是「上家」按方子配的，上家在西城门的骡马棚交货。" },
        ],
        onReach: {
          byFlag: {
            quest_qc2_expose: { reputation: 6, flags: ["qc2_imposter_publicly_shamed"] },
            quest_qc2_trace: { favorability: { 玉真子: 12 }, flags: ["qc2_supply_line_found"] },
          },
        },
      },
      {
        id: "report",
        requireLocation: { district: "雅江", inner: "药圃" },
        playerHint: "回药圃，向玉真子回话。",
        description: "玉真子听完，把那丸假丹碾碎了倒进药渣：「青城的脸面，要靠青城自己人捡回来。」",
        completionFlag: "quest_qc2_done",
        onReach: {
          money: 80,
          factionRep: { 青城派: 20 },
        },
      },
    ],
    rewardText: "玉真子给你递了一碗药茶：「药圃的草药，以后你要，先来跟我说一声。」",
  },
  qingcheng_3_jianyue: {
    id: "qingcheng_3_jianyue",
    type: "QT_TALK",
    title: "青3·伏龙观下的三十年前剑约",
    giver: "青霞子",
    giverId: "resident_qingxiazi",
    localOnly: true,
    requiresQuestCompleted: "qingcheng_2_maoming",
    requiresFactionRep: { 青城派: 40 },
    description: "练功堂的铜镜前，红袍老者把你拦下：「青城的剑，练到火候的人，得先听一段旧账。」三十年前他在伏龙观下，跟一位过路的塞外剑客论过一场剑。",
    stages: [
      {
        id: "mirror",
        requireLocation: { district: "雅江", inner: "练功堂" },
        playerHint: "在练功堂听青霞子讲那一场剑。",
        description: "青霞子抚着镜面给你看墙上的剑痕：「三十年前，呼延家的剑客路过青城，约我在伏龙观下论剑。他说山外有山的道理，我到现在还没忘。」",
        completionFlag: "quest_qc3_story",
      },
      {
        id: "fulong",
        giver: null,
        requireLocation: { district: "雅江", inner: "伏龙观" },
        playerHint: "去伏龙观，替他取回压在观下石匣里的剑谱残页。",
        description: "伏龙观的老道士听完来意，引你绕到观后，撬开一方青石：石匣里躺着半卷残页，纸色黄得发脆，题款是三十年前那场论剑的日期。",
        completionFlag: "quest_qc3_relic",
        onReach: {
          items: [{ name: "剑约残页", category: "misc", quality: "橙", desc: "半卷发脆的剑谱残页，题款压着三十年前伏龙观下一场论剑的日期。" }],
        },
      },
      {
        id: "return",
        requireLocation: { district: "雅江", inner: "练功堂" },
        playerHint: "把剑约残页带回练功堂，交还给青霞子。",
        description: "青霞子把残页按在胸口，良久才放下：「他没再来，我也没能出蜀赴约。今天这页东西，青城替你收着——你的剑路，自己走远一点。」",
        completionFlag: "quest_qc3_done",
        onReach: {
          factionRep: { 青城派: 25 },
          favorability: { 青霞子: 15 },
          flags: ["qingcheng_jianyue_done", "endgame_qingcheng_sword_pledge"],
        },
      },
    ],
    rewardText: "青霞子把铜镜转向你：「青城认剑不认人。往后剑坪上，你的剑痕自己往里嵌。」",
  },
} };
