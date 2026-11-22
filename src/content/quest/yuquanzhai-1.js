export default { quest: {
// 泉1·小牧童的牦牛（合稿·玉泉寨 任务线 泉1）：阿索的白牦牛被土司府差役当「欠税抵押」牵走。
// A 硬气出手赶差役：玉泉寨+15/黑风寨+3/鱼定村+3/土司府-5、40两、风干牦牛肉×2、小牧童的口哨；
// B 30两赎回：玉泉寨+10/黑风寨+2、谢仪20两（净亏10两）、风干牦牛肉、口哨。
"yuquanzhai_1_mumutongdemaoniu": {
    id: "yuquanzhai_1_mumutongdemaoniu",
    type: "QT_RESCUE",
    title: "玉泉寨·任务一·小牧童的牦牛",
    giver: "小牧童阿索",
    localOnly: true,
    requiresFactionRep: { 玉泉寨: 0 },
    description: "阿索母亲留下的白牦牛（牛角系褪色红布条）被土司府管家陆福生的差役当「虎胆抵税」的抵押牵走，往大草甸方向去了，他追到一半见狼粪还是软的不敢再追。",
    stages: [
      {
        id: "s1_rescue",
        giver: null,
        requireLocation: { district: "大草甸" },
        description: "大草甸浅沟里，两个差役正把白牦牛往寨外牵，牛角上的褪色红布条被风吹得贴在牛脸上。差役说这叫抵税，牵走就是规矩——牦牛在挣扎，阿索在远处哨声都吹哑了。",
        playerHint: "阿索的牦牛被土司府差役往大草甸外牵，去浅沟拦住他们——动手赶人，或者掏30两赎回。",
        completionFlag: ["quest_yuquanzhai1_fight", "quest_yuquanzhai1_pay"],
        choices: [
          { flag: "quest_yuquanzhai1_fight", label: "硬气——替牧民赶走差役", resolve: "combat", combatNpc: { name: "土司府差役", levelCap: 3 } },
          { flag: "quest_yuquanzhai1_pay", label: "花三十两把牛赎回", resolve: "none", requiresMoney: 30,
            narration: "你数出三十两拍在差役手心。差役掂了掂，把牛缰绳丢还给你：「算这户今年运气好。」" },
        ],
        onReach: {
          byFlag: {
            quest_yuquanzhai1_fight: {
              exp: 1, money: 40, reputation: 6,
              favorability: { "小牧童阿索": 30 },
              factionRep: { 玉泉寨: 15, 黑风寨: 3, 鱼定村: 3, 鱼定土司府: -5 },
              items: [
                { name: "风干牦牛肉", category: "misc", quality: "白" },
                { name: "风干牦牛肉", category: "misc", quality: "白" },
                { name: "小牧童的口哨", category: "misc", quality: "白" },
              ],
            },
            quest_yuquanzhai1_pay: {
              exp: 1, money: -10, reputation: 3,
              favorability: { "小牧童阿索": 30 },
              factionRep: { 玉泉寨: 10, 黑风寨: 2 },
              items: [
                { name: "风干牦牛肉", category: "misc", quality: "白" },
                { name: "小牧童的口哨", category: "misc", quality: "白" },
              ],
            },
          },
        },
      },
      {
        id: "s2_return",
        giver: null,
        requireLocation: { district: "玉泉寨", inner: "寨口牧场" },
        description: "牵牛回寨路上，牦牛用角顶了你的手——「它不是顶你，它是在认人。」阿索掰半块存了两年的、母亲留下的最后一块糌粑分给你。",
        playerHint: "把白牦牛牵回玉泉寨还给阿索。",
        completionFlag: "quest_yuquanzhai1_done",
        isCgMoment: true,
        onReach: { exp: 1 },
      },
    ],
    rewardText: "此后阿索见玩家会主动挥赶牛鞭致意，吹起那支骨哨。",
  },
// 泉2·李若由的商队账（合稿·玉泉寨 任务线 泉2）：四成货款被管家私卡吞掉，追到赫连铸对质。
// A 公开私章条原数退货款：+20/+6/+4/-8、120两、通行牌+抽成条；B 私下和解七成：+12/+2/-2、160两、通行牌。
// 门槛：合稿写「完成泉1 或 声誉≥10」——OR 关系表达不了，用 rep≥10 近似（泉1 双分支都给 ≥10）。
"yuquanzhai_2_liruoyoudeshangduizhang": {
    id: "yuquanzhai_2_liruoyoudeshangduizhang",
    type: "QT_TALK",
    title: "玉泉寨·任务二·李若由的商队账",
    giver: "李若由",
    requiresFactionRep: { 玉泉寨: 10 },
    description: "李若由面带愁容：全寨凑了一季羊毛酥油托商队换过冬盐茶，回来的货款竟被扣掉四成。伙计支支吾吾只说「卡口抽了新税」——才旦一句点破，是管家陆福生指使天都恶汉赫连铸设的私卡。",
    stages: [
      {
        id: "s1_confront",
        giver: null,
        requireLocation: { district: "天都镇", inner: "镇口" },
        description: "持李若由的核对单到鱼定村对完账，再去天都镇镇口堵住赫连铸——他怀里揣着盖土司管家私章的「皮毛抽成条」。银子夺回来了，怎么处置，赫连铸盯着你的手看。",
        playerHint: "去鱼定村核对账目，再到天都镇找赫连铸对质，夺回被扣的货银与私章条。",
        completionFlag: ["quest_yuquanzhai2_open", "quest_yuquanzhai2_settle"],
        choices: [
          { flag: "quest_yuquanzhai2_open", label: "公开私章条，原数退回货款", resolve: "none",
            narration: "你把抽成条当众抖开。赫连铸脸白了半边，围观行脚商的唾沫星子快把他淹了——李若由把追回的银两分还给牧户，私章条封存留作弹劾陆福生的罪证。" },
          { flag: "quest_yuquanzhai2_settle", label: "按商界规矩私下和解，只拿七成", resolve: "none",
            narration: "七成银两落袋，赫连铸点头哈腰送你出镇。商路短期不会被土司报复，李若由理解你的务实——只是索朗听了，锤子砸得比平时重三分。" },
        ],
        onReach: {
          byFlag: {
            quest_yuquanzhai2_open: {
              exp: 2, money: 120, reputation: 6,
              favorability: { "李若由": 30 },
              factionRep: { 玉泉寨: 20, 鱼定村: 6, 黑风寨: 4, 鱼定土司府: -8 },
              items: [
                { name: "李记商队通行牌", category: "accessory", quality: "白" },
                { name: "账房私章抽成条", category: "misc", quality: "白" },
              ],
              flags: ["perk_yuquan_xiaozhan_discount"],
            },
            quest_yuquanzhai2_settle: {
              exp: 2, money: 160, reputation: 3,
              favorability: { "李若由": 10 },
              factionRep: { 玉泉寨: 12, 鱼定村: 2, 鱼定土司府: -2 },
              items: [{ name: "李记商队通行牌", category: "accessory", quality: "白" }],
            },
          },
        },
      },
      {
        id: "s2_return",
        giver: null,
        requireLocation: { district: "玉泉寨", inner: "玉泉小栈" },
        description: "回玉泉小栈复命。李若由在账本末页添了一行小字：「某月某日，外乡人为我出过头。」她给你续上茶：「银子记你账上是玩笑——往后打尖，多添一碟风干牛肉不算钱。」",
        playerHint: "回玉泉小栈向李若由复命。",
        completionFlag: "quest_yuquanzhai2_done",
        onReach: { exp: 1 },
      },
    ],
    rewardText: "此后玉泉小栈打尖多添一碟风干牛肉；月底她托阿索给你送一包「今年的第一泡」茶叶。",
  },
// 泉3·丹增的马鞭（合稿·玉泉寨 任务线 泉3）：寻回老土司「曲措公契铜筹」，撞破陆福生销毁旧约。
// A 斩/重创狼王再取铜筹：+30、搏狼鞭法前置 flag；B 智取不死磕：+25，搏狼鞭法改走 rep80。两路都开枯柳暗窖。
"yuquanzhai_3_danzengdemabian": {
    id: "yuquanzhai_3_danzengdemabian",
    type: "QT_COLLECT",
    title: "玉泉寨·任务三·丹增的马鞭",
    giver: "丹增",
    requiresQuestCompleted: "yuquanzhai_2_liruoyoudeshangduizhang",
    requiresFactionRep: { 玉泉寨: 25 },
    description: "丹增望着哈那墙上挂了三十二年的马鞭，说起三十岁被独眼狼王咬断三指那夜——马鞍暗袋里那枚老土司留下的「曲措公契铜筹」，连同半片断马蹄铁遗落在大草甸深处石洼。铜筹拓影送到陆福生眼前，他脸色的变化比什么话都实。",
    stages: [
      {
        id: "s1_recovery",
        giver: null,
        requireLocation: { district: "大草甸" },
        description: "大草甸深处石洼，风化枯骨与碎鞍皮下，半枚锈铜筹和半截马蹄铁还埋着。独眼狼王的腥风就在几十步外——斩了它了却丹增三十二年心魔，或者使轻功声东击西取了东西就走。",
        playerHint: "去大草甸深处石洼寻回曲措旧铜筹与断马蹄铁——可斩狼王，也可智取。",
        completionFlag: ["quest_yuquanzhai3_wolf", "quest_yuquanzhai3_sneak"],
        choices: [
          { flag: "quest_yuquanzhai3_wolf", label: "斩了独眼狼王再取铜筹", resolve: "combat", combatNpc: { name: "独眼狼王", levelCap: 5 } },
          { flag: "quest_yuquanzhai3_sneak", label: "声东击西，智取铜筹不动狼王", resolve: "none",
            narration: "一捧碎石丢向远坡，狼王竖耳扑去的空当，你已从石洼里摸出铜筹塞进怀里。丹增听了只笑：「腿比刀快，也是本事。」" },
        ],
        onReach: {
          byFlag: {
            quest_yuquanzhai3_wolf: { exp: 3, factionRep: { 玉泉寨: 5 }, flags: ["yuquan_bolang_prequal"] },
            quest_yuquanzhai3_sneak: { exp: 2 },
          },
        },
      },
      {
        id: "s2_return",
        giver: null,
        requireLocation: { district: "玉泉寨", inner: "丹增蒙古包" },
        description: "丹增摩挲断马蹄铁良久，第一次带你走进枯柳暗窖——窖里的藏粮和账本摊开在油灯下：「玉泉寨老了，可公道还没老。」他把藏粮与翻案之望，正式托给了你。",
        playerHint: "把铜筹与断马蹄铁带回玉泉寨交给丹增。",
        completionFlag: "quest_yuquanzhai3_done",
        isCgMoment: true,
        onReach: {
          exp: 2, money: 150, reputation: 6,
          favorability: { "丹增": 30 },
          factionRep: { 玉泉寨: 25, 黑风寨: 5, 鱼定村: 5, 鱼定土司府: -10 },
          items: [
            { name: "曲措旧铜筹", category: "misc", quality: "蓝" },
            { name: "狼筋护腕", category: "accessory", quality: "绿" },
          ],
          flags: ["yuquan_kuliu_unlocked"],
        },
      },
    ],
    rewardText: "枯柳暗窖开启；斩狼王者习得《搏狼鞭法》的前置已备。",
  },
// 泉4·卓玛的青稞酒（合稿·玉泉寨 任务线 泉4·情感线前置）：取水收青稞酿还愿酒，巡捕上门索贿，篝火定还酒之约。
// A 郑重接下约定（爱情线开启）：卓玛+20；B 只作同道（关爱情结局）：卓玛+10。门槛合稿另有 zhaxi_line 与卓玛好感≥25，
// 好感无门槛键，用 zhaxi_line + 泉1 + rep30 近似。
"yuquanzhai_4_zhuomadeqingkejiu": {
    id: "yuquanzhai_4_zhuomadeqingkejiu",
    type: "QT_KILL",
    title: "玉泉寨·任务四·卓玛的青稞酒（爱情线前置）",
    giver: "卓玛",
    requiresQuestCompleted: ["zhaxi_line", "yuquanzhai_1_mumutongdemaoniu"],
    requiresFactionRep: { 玉泉寨: 30 },
    description: "扎西平安归寨后，卓玛不再满身竖刺。她约你去狼曲上游取融雪泉水、收向阳坡的新青稞，替父亲酿一坛压惊还愿酒——泉眼边土司巡捕却借「私酿逃税」砸坛索贿。",
    stages: [
      {
        id: "s1_brew",
        giver: null,
        requireLocation: { district: "大草甸" },
        description: "狼曲上游泉眼，卓玛挽袖收水，巡捕一脚踹翻空坛：「私酿？交税。」她攥鞭的手背青筋都起来了——并肩赶人，或者你挺身挡在她身前把那几双眼睛瞪回去。傍晚篝火边，她把新温的青稞酒斟满推到你面前。",
        playerHint: "陪卓玛去狼曲上游取水收青稞，赶走砸坛索贿的巡捕。",
        completionFlag: "quest_yuquanzhai4_patrol",
        choices: [
          { flag: "quest_yuquanzhai4_patrol", label: "与卓玛并肩驱走巡捕", resolve: "combat", combatNpc: { name: "土司府巡捕", levelCap: 4 } },
        ],
        onReach: { exp: 2 },
      },
      {
        id: "s2_promise",
        giver: null,
        requireLocation: { district: "大草甸" },
        description: "篝火毕剥。她说十四岁那年哥哥去土司府讨公道再没回来，她在府门前磕下三个誓头，把沾血马鞭藏进嫁妆箱底。「这壶青稞酒你喝不完，剩下的得还我——别多想，是怕你喝太快，转头就忘了回玉泉寨还酒。」",
        playerHint: "接下卓玛的半壶青稞酒——还酒之约，接还是不接。",
        completionFlag: ["quest_yuquanzhai4_romance", "quest_yuquanzhai4_friend"],
        choices: [
          { flag: "quest_yuquanzhai4_romance", label: "郑重接下还酒之约", resolve: "none",
            narration: "你双手接过锡壶，认真点头。她别过脸去拨火，耳根通红：「那说定了——狼曲河口，我等你回来还酒。」" },
          { flag: "quest_yuquanzhai4_friend", label: "婉言只作江湖同道", resolve: "none",
            narration: "你接过酒，只说江湖路远、同道的酒总要还的。她眼眶微红却昂首一笑：「我就知道江湖人留不住。」" },
        ],
        isCgMoment: true,
        onReach: {
          byFlag: {
            quest_yuquanzhai4_romance: {
              exp: 2, money: 80, reputation: 5,
              favorability: { "卓玛": 20 },
              factionRep: { 玉泉寨: 20, 黑风寨: 4, 鱼定土司府: -6 },
              items: [{ name: "半壶狼曲青稞酒", category: "misc", quality: "蓝" }],
              flags: ["zhuoma_romance_line", "promise_zhuoma_huanjiu"],
            },
            quest_yuquanzhai4_friend: {
              exp: 2, money: 80, reputation: 5,
              favorability: { "卓玛": 10 },
              factionRep: { 玉泉寨: 20, 黑风寨: 4, 鱼定土司府: -6 },
              items: [{ name: "半壶狼曲青稞酒", category: "misc", quality: "蓝" }],
              flags: ["zhuoma_friend_line"],
            },
          },
        },
      },
    ],
    rewardText: "卓玛的半壶酒——剩下的半壶，等你回玉泉寨还她。",
  },
// 泉5·贡措海的约定（合稿·玉泉寨 任务线 泉5·情感与政治双高潮）：梅朵湖畔递税簿副页，刺客灭口。
// A 放走暗探保梅朵（土司府 0、梅朵+15）；B 斩暗探公开副页（玉泉寨 +40、土司府 -20、梅朵受限）。
// 门槛合稿另有卓玛好感≥45——好感无门槛键，用 泉3+泉4 + rep55 近似。
"yuquanzhai_5_gongcuohaideyueding": {
    id: "yuquanzhai_5_gongcuohaideyueding",
    type: "QT_ESCORT",
    title: "玉泉寨·任务五·贡措海的约定（爱情线高潮）",
    giver: "卓玛",
    requiresQuestCompleted: ["yuquanzhai_4_zhuomadeqingkejiu", "yuquanzhai_3_danzengdemabian"],
    requiresFactionRep: { 玉泉寨: 55 },
    description: "卓玛深夜收到旧丝帕包着的无名信，信上只画一株狼曲野杜鹃——那是七年前她与土司之女梅朵当玩伴时的暗号。梅朵约她在贡措海湖畔秘密相见，请你随行护卫。",
    stages: [
      {
        id: "s1_lake",
        giver: null,
        requireLocation: { district: "贡措海" },
        description: "贡措海湖畔，梅朵撇开护卫单骑而来。两名少女隔着七年血仇摊牌：她含泪递出陆福生私改玉泉草场税簿的抄录副页。交接之际，尾随的管家心腹刺客现身灭口——护住她们！",
        playerHint: "随卓玛去贡措海湖畔见梅朵，击退灭口的刺客。",
        completionFlag: "quest_yuquanzhai5_fight",
        choices: [
          { flag: "quest_yuquanzhai5_fight", label: "护住卓玛与梅朵，击退刺客", resolve: "combat", combatNpc: { name: "管家心腹刺客", levelCap: 5 } },
        ],
        onReach: { exp: 3 },
      },
      {
        id: "s2_aftermath",
        giver: null,
        requireLocation: { district: "贡措海" },
        description: "刺客倒地，湖畔风冷。受伤落网的暗探瘫在碎石滩上求一条活路——放他回府传假信能保梅朵清白；斩了永绝后患，副页直接交丹增公开。梅朵回府前与卓玛立下无声之约：「若有一日曲措换了规矩，狼曲的草场，我亲手还给你们。」",
        playerHint: "处置落网的暗探：放走保梅朵，或斩杀公开副页。",
        completionFlag: ["quest_yuquanzhai5_spare", "quest_yuquanzhai5_kill"],
        choices: [
          { flag: "quest_yuquanzhai5_spare", label: "放走暗探，保梅朵清白", resolve: "none",
            narration: "你踢开他手边的匕首：「回去告诉你家主子，今晚湖畔只有风。」暗探连滚带爬走了。梅朵朝你深深一躬，翻身上马没入夜色。" },
          { flag: "quest_yuquanzhai5_kill", label: "斩杀暗探，副页交丹增公开", resolve: "none",
            narration: "一刀了账。你把税簿副页揣进怀里——这东西明早就贴在丹增的聚寨锣上。卓玛望着湖水轻声说：「哥，看见了么。」" },
        ],
        isCgMoment: true,
        onReach: {
          byFlag: {
            quest_yuquanzhai5_spare: {
              exp: 3, money: 200, reputation: 8,
              favorability: { "卓玛": 25, "梅朵": 15 },
              factionRep: { 玉泉寨: 30, 鱼定村: 6, 黑风寨: 6 },
              items: [
                { name: "玉泉草场税簿副页", category: "misc", quality: "紫" },
                { name: "卓玛的藏银松石扣", category: "accessory", quality: "紫" },
              ],
              flags: ["meiduo_kept_clean", "cg_hubianyinshui_muniu"],
            },
            quest_yuquanzhai5_kill: {
              exp: 3, money: 200, reputation: 8,
              favorability: { "卓玛": 25 },
              factionRep: { 玉泉寨: 40, 鱼定村: 6, 黑风寨: 6, 鱼定土司府: -20 },
              items: [
                { name: "玉泉草场税簿副页", category: "misc", quality: "紫" },
                { name: "卓玛的藏银松石扣", category: "accessory", quality: "紫" },
              ],
              flags: ["meiduo_exposed", "cg_hubianyinshui_muniu"],
            },
          },
        },
      },
    ],
    rewardText: "回寨后，卓玛在夕阳下的河谷向你倾吐心意——狼曲的草场之约，记下了。",
  }
} };
