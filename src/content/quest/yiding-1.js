const c = (name, count = 1) => Array.from({ length: count }, () => ({ name, fromCatalog: true }));
export default { quest: {
"village1_lubujianbuping": {
    id: "village1_lubujianbuping",
    type: "QT_TALK",
    title: "村1·路见不平",
    giver: "老猎户",
    requiresFactionRep: { 鱼定村: -19 },
    description: "熊山口不太平，土司府管家带人设卡查验货税，实为拦路抽水，过路牧民商贩敢怒不敢言。「外乡来的？正好，有件事老朽不便出面，你或许能帮上忙。」",
    stages: [
      {
        id: "s1_hear",
        description: "老猎户提起熊山口异常——「老朽在村里住了四十年，没见过这么不讲理的。」昨天玉泉寨一个牧民赶牦牛经过被扣了三头，说是「税不够」，牧民理论了两句被管家的手下打了。",
        playerHint: "听老猎户把熊山口的事说完，再去大草甸的熊山口亲眼看看。",
        completionFlag: "quest_village1_s1",
        onReach: { exp: 1 },
      },
      {
        id: "s2_choice",
        description: "前往熊山口，管家的两个手下拦着赶马人阿旺翻他的货驮，阿旺赔着笑「各位爷，真没有了」，手下甲喝问玩家「看什么看？过路的交十文铜钱」。三选一：A.直接动手打退管家手下；B.讲理周旋，援引土司府税制旧例逼退对方；C.袖手旁观，阿旺被讹走一包茶叶。",
        // requireLocation：这一步必须玩家真的走到熊山口才触发，不能在村口听完老猎户
        // 的话（s1）就地展开三选一。熊山口是「大草甸」据点的内层房间，故门槛同时约束
        // 外层据点(district)与内层房间(inner)。判定见 MudRPG.jsx 的 availableQuestsHere。
        // 动线：村口找老猎户听说(s1) → 走到大草甸·熊山口遇到管家手下(s2) → 回村口复命(s3)。
        playerHint: "在熊山口撞见管家手下讹人——你可以动手、讲理、或旁观。",
        requireLocation: { district: "大草甸", inner: "熊山口" },
        completionFlag: ["quest_village1_s2_a", "quest_village1_s2_b", "quest_village1_s2_c"],
        // choices：分支节点的具体选项（本轮新增，配合感叹号面板的分支
        // 选择UI）。有这个字段时，感叹号面板不再只显示一个笼统的"继续
        // 聊这件事"按钮，而是展示每个选项各自的按钮，点击后直接把
        // label 拼进送给AI的指令里，明确指向具体分支，不需要AI自己
        // 猜玩家想选哪个——AI依然负责把这个已经明确的选择演绎成具体
        // 叙事，但"选哪个"这件事本身是确定的。
        choices: [
          { flag: "quest_village1_s2_a", label: "直接动手，打退管家的手下", resolve: "combat", combatNpc: { name: "管家的手下", levelCap: 1, tag: "guanjia_shousi_v1", hostile: true } },
          { flag: "quest_village1_s2_b", label: "讲理周旋，援引土司府税制旧例", resolve: "talk", persuade: {
            who: "管家的手下",
            observe: "两个收黑钱的地痞，斜眼打量你，一脸不耐烦，腰间挎着刀。",
            knot: "仗着管家撑腰在此抽水，只认拳头和上头的意思，不怕讲理的过路人",
            opening: "过路的？规矩懂不懂，交十文，少啰嗦。",
            keys: [
              { id: "k_lawcite", hint: "援引土司府税制旧例，点破正税从无「岔路口查验」这一项", need: null },
              { id: "k_dushi", hint: "抬出锦官城柳青鸢都事，暗示私设卡子是要吃官司的", need: null },
              { id: "k_backfire", hint: "点破他们是替管家中饱私囊，出了事管家第一个把他们推出去顶罪", need: null },
            ],
            resistance: 2,
          } },
          { flag: "quest_village1_s2_c", label: "袖手旁观，不插手这件事", resolve: "none" },
        ],
        onReach: {
          exp: 2,
          byFlag: {
            quest_village1_s2_a: { favorability: { "阿旺": 30 }, reputation: 10, money: 30, items: c("酥油炒面", 2), factionRep: { 鱼定村: 15, 玉泉寨: 5, 鱼定土司府: -5 }, flags: ["flag_yuding_defied_patrol"] },
            quest_village1_s2_b: { favorability: { "阿旺": 20 }, reputation: 6, items: c("酥油炒面", 2), factionRep: { 鱼定村: 10, 玉泉寨: 3, 鱼定土司府: 0 } },
            quest_village1_s2_c: { favorability: { "阿旺": 5 }, factionRep: { 鱼定村: -5 } },
          },
        },
      },
      {
        id: "s3_report",
        description: "回禀老猎户，他若有所思：「温泉？虎王？管家要虎胆做什么……那东西能炼药，也能炼蛊。管家跟天都镇那边走动频繁，老朽早就觉得不对。」管家在查熊山温泉，想要虎胆自用而非献给土司。",
        playerHint: "回鱼定村找老猎户复命，把熊山口的事告诉他。",
        completionFlag: "quest_village1_s3",
        onReach: { exp: 2, favorability: { "老猎户": 15 }, flags: ["rumor_guanjia_sixin"] },
      },
    ],
    rewardText: "老猎户若有所思：「管家要虎胆做什么……这事还没完。」（指向虎胆三重门的引子）",
  },
"village2_jieshixiajiu": {
    id: "village2_jieshixiajiu",
    type: "QT_MYSTERY",
    title: "村2·界石下的旧账",
    giver: "才旦",
    description: "才旦告诉你，村口界石下面埋着一样东西——她小时候亲眼看见前任村长（她阿爸）半夜把一包东西塞进界石底座，死前只留一句话：「界石若是倒了，鱼定村也就散了。」管家最近在界石附近转悠，才旦怀疑他在找那包东西。",
    requiresQuestCompleted: "village1_lubujianbuping",
    requiresFactionRep: { 鱼定村: 10 },
    stages: [
      {
        id: "s1_zhagba",
        description: "才旦要求玩家先替她给老孙饭馆送一篮子糌粑，才肯打开话匣——这是她试探玩家是否可靠的小小考验。",
        playerHint: "才旦要你先替她给老孙饭馆送一篮糌粑，先跑这一趟。",
        completionFlag: "quest_village2_s1",
        deliver: { item: "糌粑", to: "老孙" },
        onReach: { exp: 1 },
      },
      {
        id: "s2_dig",
        description: "夜探界石，挖出油布包里前任村长记的私账——土司府对外宣称每年收牲口税两成，实际收四成，多出的三成进了管家私库。最后几页笔迹慌乱：「土司不知情……界石若是倒了，鱼定村也就散了——不是界石倒，是我倒。我不能倒。还有人看着。」",
        playerHint: "趁夜去村口界石基座下，把埋着的东西挖出来。",
        completionFlag: "quest_village2_s2",
        collect: { item: "油布包", at: "鱼定村·村口", quality: "白", hint: "村口界石基座松动的石缝下埋着，需趁夜挖出" },
        onReach: { exp: 2 },
      },
      {
        id: "s3_choice",
        description: "面对真相三选一。A.交给才旦：她沉默良久问「我阿爸不是坏人，他只是不想惹事。你说，他也是坏人吗？」自答「他是村长，不是圣人」，随后在歇马居找玩家，说管家也在查这本账，需要玩家在场撑腰。B.自己保管：才旦要求玩家承诺——将来若需要这本账，要站在鱼定村这边，不是土司府，不是锦官城。C.埋回去：才旦不怪玩家，但说「下次见面，我不会当你是朋友。不是恨你——是不敢信你。」",
        playerHint: "回程在熊山口被管家的人卡货——你怎么应对，自己定。",
        completionFlag: ["quest_village2_s3_a", "quest_village2_s3_b", "quest_village2_s3_c"],
        choices: [
          { flag: "quest_village2_s3_a", label: "交给才旦", resolve: "none" },
          { flag: "quest_village2_s3_b", label: "自己保管，承诺站在鱼定村这边", resolve: "none" },
          { flag: "quest_village2_s3_c", label: "把私账埋回去", resolve: "none" },
        ],
        outcomeByFlag: { quest_village2_s3_c: "negative" },
        onReach: {
          exp: 3,
          byFlag: {
            quest_village2_s3_a: { favorability: { "才旦": 60 }, money: 50, items: [{ name: "旧账册", category: "misc", quality: "蓝", desc: "前任村长的私账，面对管家的谈判筹码。" }, ...c("旧界石泥拓")], factionRep: { 鱼定村: 20, 玉泉寨: 4, 鱼定土司府: 0 }, flags: ["flag_yuding_deed_clue"] },
            quest_village2_s3_b: { favorability: { "才旦": 40 }, money: 50, items: [{ name: "旧账册", category: "misc", quality: "蓝", desc: "前任村长的私账，面对管家的谈判筹码。" }, ...c("旧界石泥拓")], factionRep: { 鱼定村: 20, 玉泉寨: 4, 鱼定土司府: 0 }, flags: ["promise_village2_side_with_yudingcun", "flag_yuding_deed_clue"] },
            quest_village2_s3_c: { favorabilitySet: { "才旦": 0 } },
          },
        },
      },
    ],
    rewardText: "A/B线得 50 两、「旧账册」与「旧界石泥拓」，鱼定村声誉 +20、玉泉寨 +4，村长府西墙的「界石旧窖」从此对你敞开，作为后续面对管家的谈判筹码；C线才旦好感归零，不再接她的任何任务。",
  },
"village3_zanghan_hunshi": {
    id: "village3_zanghan_hunshi",
    type: "QT_TALK",
    title: "村3·藏汉两姓的婚事",
    giver: "鱼定大娘",
    requiresFactionRep: { 鱼定村: 15 },
    description: "鱼定大娘的儿子小孙（汉）与张商人的女儿卓嘎（藏）私定终身，两边父亲都不同意。鱼定大娘逢人念叨：「熊曲、鹰曲、狼曲，三条水都流进一条曲水。水都不分家，人分什么家。」",
    stages: [
      {
        // 开场接任务 stage（本轮新增）：之前村3第一步就是带 choices 的"说服老孙"，
        // 而 giver 鱼定大娘一开局就在场，导致「去劝老孙」选项开局直接暴露在行动抉择里、
        // 跳过了"先跟鱼定大娘接任务"这一步。补一个无 choices 的开场：鱼定大娘找你、
        // 说起儿子婚事求你帮忙劝两家老人。点了它接下任务，才进入后面的说服环节。
        id: "s0_hear",
        description: "鱼定大娘拉住你，说起心事——儿子小孙跟张商人的女儿卓嘎好上了，两个孩子是真心的，可两边老人都不点头。「你是外乡人，说话没那么多忌讳。帮大娘去劝劝老孙，再劝劝那张商人，成不成的，大娘都记你的情。」",
        playerHint: "鱼定大娘想请你帮忙撮合她儿子的婚事，听她说完就接下这桩事。",
        completionFlag: "quest_village3_s0",
        onReach: { exp: 1 },
      },
      {
        id: "s1a_persuade_laosun",
        description: "先说服老孙。他真正的心结不是族里老人的闲话，是当年娶老孙媳妇时被岳父当众嫌弃、拖了三年才松口——他怕的是被人看不起，不是看不起藏人，这道疤比什么偏见都深。",
        playerHint: "先去劝老孙。他嘴上说怕族里闲话，多聊聊他到底在怕什么、想想他自己当年娶亲的经历。",
        completionFlag: "quest_village3_s1a",
        choices: [
          {
            flag: "quest_village3_s1a",
            label: "去劝老孙",
            resolve: "talk",
            persuade: {
              who: "老孙",
              observe: "老孙饭馆掌柜，一提儿子的婚事就搓着围裙下摆，眼神躲闪。",
              knot: "怕被人看不起——当年娶媳妇被岳父当众嫌弃、拖了三年才娶成，这道疤比谁的偏见都深，不是真的看不起藏人",
              opening: "娃他自己乐意，可村里人怎么看我老孙……",
              keys: [
                { id: "k_notabout_zang", hint: "点破他真正怕的不是「藏人」这两个字，是怕被人看不起", need: null },
                { id: "k_own_past", hint: "提起他当年娶媳妇也被岳父嫌弃拖了三年，这回轮到他自己当那个岳父", need: null },
                { id: "k_kids_happy", hint: "把话题拉回两个孩子是不是真心相待，而不是族别", need: null },
              ],
              resistance: 2,
            },
          },
        ],
        onReach: { exp: 1, favorability: { "老孙": 10 } },
      },
      {
        id: "s1b_persuade_zhangshangren",
        description: "再说服张商人。他年轻时被一个汉族合伙人骗得血本无归，这笔旧账才是他反对的真正理由——说服关键是「不是所有汉人都一样，就像不是所有藏人都信喇嘛庙」。",
        playerHint: "再去劝张商人。他反对另有旧因，试着聊聊他年轻时和汉人打交道吃过的亏。",
        completionFlag: "quest_village3_s1b",
        choices: [
          {
            flag: "quest_village3_s1b",
            label: "去劝张商人",
            resolve: "talk",
            persuade: {
              who: "张商人",
              observe: "张商人算盘打得精，一说这门婚事就连连摆手，像是防着被骗第二次。",
              knot: "年轻时被汉族合伙人骗得血本无归，这笔旧账让他把「汉人女婿」和「骗子」划了等号",
              opening: "我把闺女交给汉人？我年轻时候吃的亏，你不知道。",
              keys: [
                { id: "k_not_all_same", hint: "点破不是所有汉人都一样，就像不是所有藏人都信喇嘛庙", need: null },
                { id: "k_old_debt", hint: "点破他记恨的是那个骗他的人，不是小孙", need: null },
                { id: "k_daughter_choice", hint: "提醒卓嘎是自己认定的人，不是被谁哄骗", need: null },
              ],
              resistance: 2,
            },
          },
        ],
        onReach: { exp: 1, favorability: { "张商人": 10, "鱼定大娘": 10 } },
      },
      {
        id: "s2_wait",
        description: "见证两个年轻人的等待期，每天傍晚可在界石附近看到小孙教卓嘎写汉字、卓嘎教小孙捻羊毛线，字歪线粗，都在笨拙地学对方的东西。驻足观看两天以上，小孙会朝玩家点头一笑。",
        playerHint: "两家松口了，这些天去界石附近看看两个年轻人。",
        completionFlag: "quest_village3_s2",
        onReach: { exp: 1 },
      },
      {
        id: "s3_wedding",
        description: "婚礼当天，没有媒人聘礼嫁妆——张商人说「我女儿嫁过去什么都不带，你们对她好是她应得的」，老孙说「那我也不收聘礼」，两亲家因「谁更该吃亏」差点又吵起来，鱼定大娘打圆场「都不要，那就都送」。小孙敬酒说「多亏你」，卓嘎往玩家手里塞糌粑，糌粑底下压了一截红线。",
        playerHint: "婚礼当天，到场见证。",
        completionFlag: "quest_village3_s3",
        isCgMoment: true,
        onReach: {
          exp: 2,
          favorability: { "鱼定大娘": 40, "老孙": 30, "张商人": 30 },
          money: 40,
          items: [{ name: "红线", category: "accessory", quality: "白", desc: "熊曲、鹰曲、狼曲，三条水都流进一条曲水。水都不分家。" }, ...c("老孙喜酒", 2), ...c("大娘红糖炒面", 3)],
          factionRep: { 鱼定村: 20, 玉泉寨: 10, 鱼定土司府: 0 },
          flags: ["perk_laosun_free_meal"],
        },
      },
    ],
    rewardText: "得 40 两、「红线」（饰品·白）、老孙喜酒×2、大娘红糖炒面×3，鱼定村声誉 +20、玉泉寨 +10；之后在鱼定村歇马居住宿老孙会主动送免费便饭。",
  },
"village4_zahuoshangren_jinhuonan": {
    id: "village4_zahuoshangren_jinhuonan",
    type: "QT_DELIVERY",
    title: "村4·杂货商人的进货难",
    giver: "杂货商人",
    requiresFactionRep: { 鱼定村: 15 },
    description: "锦官城货郎两个月没来送货，杂货商人自己去进货又被管家在熊山口设卡拦下，一担杂货抽三成。他给了一张进货清单，愿按货价四成付跑腿费。",
    stages: [
      {
        id: "s1_accept",
        description: "买过杂货商人的东西后，他叹气「卖完这批不知道啥时候能补上货」，委托玩家按清单去锦官城进货（盐五包、针线十卷、蜡烛二十根、粗纸一刀、灯油两罐）。",
        playerHint: "在杂货商人那儿买过东西后，接下他去锦官城进货的委托。",
        completionFlag: "quest_village4_s1",
        onReach: { exp: 1 },
      },
      {
        id: "s2_purchase",
        description: "锦官城按清单采买，门口遇李掌柜，认出玩家是替杂货商人（姓赵）跑腿的，透露管家不止收税，还拦住了常往鱼定村跑的货郎——「货郎不来了，老赵的摊子早晚要黄……土司本人未必不知道，只是装不知道。」",
        playerHint: "按清单去锦官城采买，留意路上遇到的人透露的消息。",
        completionFlag: "quest_village4_s2",
        onReach: { exp: 2, favorability: { "李掌柜": 10 } },
      },
      {
        id: "s3_choice",
        description: "回程通过熊山口，管家手下宣布「凡是从锦官城贩运杂货进鱼定村，一律在土司府私铺登记，由私铺统一定价」——明摆着垄断。三选一：A.硬闯，打过去安全回村；B.绕路走大草甸，路远但安全，之后杂货商人进货固定绕道；C.谈判，凭村1交情或旧账册亮出底牌威胁，管家手下不敢定夺只能放行。",
        playerHint: "回程在熊山口被管家卡货垄断——硬闯、绕路、还是谈判，你定。",
        completionFlag: ["quest_village4_s3_a", "quest_village4_s3_b", "quest_village4_s3_c"],
        choices: [
          { flag: "quest_village4_s3_a", label: "硬闯，打过去安全回村", resolve: "combat", combatNpc: { name: "管家手下", levelCap: 1, tag: "guanjia_shousi_v4", hostile: true } },
          { flag: "quest_village4_s3_b", label: "绕路走大草甸，虽远但安全", resolve: "none" },
          {
            flag: "quest_village4_s3_c",
            label: "谈判，亮出交情或旧账册施压",
            resolve: "talk",
            persuade: {
              who: "管家手下",
              observe: "拦路的差役，手里攥着私铺的登记簿，眼神游移——这规矩他自己心里也没底气。",
              knot: "只是执行命令的小角色，怕擅自放行担责任，也怕真扣下货惹出乱子被上头甩锅",
              opening: "上头的规矩，杂货一律登记定价，没得商量。",
              keys: [
                { id: "k_village1_tie", hint: "亮出村1熊山口那次的交情，点破你不是外人", need: "rumor_guanjia_sixin" },
                { id: "k_taxbook", hint: "亮出旧账册，暗示私铺定价这套本就是账目不清的延伸", need: null },
                { id: "k_scapegoat", hint: "点破真出了岔子，第一个被推出去顶罪的是他，不是管家", need: null },
              ],
              resistance: 2,
            },
          },
        ],
        onReach: {
          exp: 2, favorability: { "杂货商人": 40 }, flags: ["perk_zahuo_discount"],
          byFlag: {
            quest_village4_s3_a: { money: 60, items: [...c("雅江细盐包", 2), ...c("暗记草条")], factionRep: { 鱼定村: 20, 玉泉寨: 4, 天龙教: -6, 青城派: 5, 唐门: 0, 鱼定土司府: 0 } },
            quest_village4_s3_b: { money: 35, items: c("雅江细盐包"), factionRep: { 鱼定村: 15, 玉泉寨: 3, 鱼定土司府: 0 } },
            quest_village4_s3_c: { money: 60, items: [...c("雅江细盐包", 2), ...c("暗记草条")], factionRep: { 鱼定村: 20, 玉泉寨: 4, 青城派: 5, 天龙教: 0, 唐门: 0, 鱼定土司府: 0 } },
          },
        },
      },
    ],
    rewardText: "硬闯或谈判得 60 两、雅江细盐包×2、暗记草条，鱼定村声誉 +20；绕路得 35 两、细盐包×1，鱼定村 +15。杂货摊对玩家永久八折。",
  },
"village5_laolieshu_chuanren": {
    id: "village5_laolieshu_chuanren",
    type: "QT_LEARN_SKILL",
    title: "村5·老猎户的传人",
    giver: "老猎户",
    description: "老猎户年老体衰，攒下一套看地形、认兽迹、下陷阱的本事，没有儿子，收过一个徒弟后来去了锦官城给都事当随从再没回村——「这套本事要传下去，传给谁不重要，传下去才重要。」",
    requiresQuestCompleted: ["village1_lubujianbuping", "yudingcun_side1_yushan_chuhuan"],
    requiresFactionRep: { 鱼定村: 40 },
    stages: [
      {
        id: "s1_learn",
        description: "大草甸边缘实地教学，三步骤：识兽迹（观察足印/粪便/蹭痕判断动物和方向）、选位置（找兽道卡口）、下陷阱（套索+陷坑组合），玩家需独立完成一次完整陷阱设置。",
        playerHint: "跟老猎户去大草甸边缘，学识兽迹、选位置、下陷阱。",
        completionFlag: "quest_village5_s1",
        onReach: { exp: 2 },
      },
      {
        id: "s2_practice",
        description: "实践猎杀，运用新学的「设陷阱诱捕」，成功率由悟性+熟练度决定，成功可直接捕获跳过一场遭遇战斗。",
        playerHint: "用刚学的设陷阱本事，实地捕一次猎物。",
        completionFlag: "quest_village5_s2",
        onReach: { exp: 2 },
      },
      {
        id: "s3_report",
        description: "老猎户交出一张手绘熊山地图，标注了温泉位置——他年轻时走过，年老后再没去过：「上次你打听虎王的事……这张图你拿着。别一个人去——虎王和别的猎物不一样，它不是畜生，是山里最老的那头。」",
        playerHint: "回猎户小屋找老猎户复命，他有东西要给你。",
        completionFlag: "quest_village5_s3",
        isCgMoment: true,
        onReach: {
          exp: 3,
          favorability: { "老猎户": 50 },
          items: [{ name: "熊山手绘地图", category: "misc", quality: "绿", desc: "老猎户年轻时走过的路，标注着温泉的位置。" }, ...c("熊山密道羊皮图"), ...c("老猎户的狼牙护符")],
          factionRep: { 鱼定村: 25, 玉泉寨: 5, 雪山派: 5, 鱼定土司府: 0 },
          flags: ["unlock_xiongshan_wenquan", "skill_trap_learned", "flag_yuding_hunter_heir", "clue_xionggu_wenquan_zhiwu"],
        },
      },
    ],
    rewardText: "学会技能「陷阱术」，获得「熊山手绘地图」「熊山密道羊皮图」「老猎户的狼牙护符」，鱼定村声誉 +25、玉泉寨 +5、雪山派 +5，晒谷演武场可学《熊山伏息术》（还需鱼定村声誉 ≥ 80），解锁熊山隐藏地点「温泉」（吊睛虎王刷新点）。",
  },
"village6_jieshichongli": {
    id: "village6_jieshichongli",
    type: "QT_CHAIN",
    title: "村6·界石重立",
    giver: "才旦",
    description: "才旦发现界石底座开始松动——可能是管家设卡时动了地基。她要重立界石，且要把村里帮过忙的人的名字刻上去：「界石是鱼定村的人立的，也该鱼定村的人重立。」",
    requiresQuestCompleted: ["village2_jieshixiajiu", "village3_zanghan_hunshi", "village4_zahuoshangren_jinhuonan", "village5_laolieshu_chuanren"],
    requiresFactionRep: { 鱼定村: 60 },
    blockedByFlags: ["quest_village2_s3_c"],
    stages: [
      {
        id: "s1_notify",
        description: "通知名单上帮过忙的人：老猎户「是该重立了」；鱼定大娘要包一锅糌粑；杂货商人主动提出在界石边支个摊放公用盐；老孙（若完成村3）提议立个小石墩给新嫁入鱼定村的人「先站一站」。",
        playerHint: "挨个通知帮过忙的人来重立界石——老猎户、鱼定大娘、杂货商人、老孙他们。",
        completionFlag: "quest_village6_s1",
        onReach: { exp: 2 },
      },
      {
        id: "s2_ceremony",
        description: "重立那天众人到场，老孙和张商人为石墩位置拌嘴（「歪了」／「歪了好看，留个盼头」）。才旦递给玩家凿子，请刻一排字，三选一，情感倾向非线性：「三水归乡」（才旦认可并加刻正面）、「不问来处」（老猎户第一个点头）、「站一站再走」（才旦笑说「这像我说的话，但这回是你说的」）。",
        playerHint: "重立那天众人到场，才旦请你在界石上刻字。",
        completionFlag: ["quest_village6_s2_sanshui", "quest_village6_s2_buwen", "quest_village6_s2_zhanyizhan"],
        choices: [
          { flag: "quest_village6_s2_sanshui", label: "刻「三水归乡」", resolve: "none" },
          { flag: "quest_village6_s2_buwen", label: "刻「不问来处」", resolve: "none" },
          { flag: "quest_village6_s2_zhanyizhan", label: "刻「站一站再走」", resolve: "none" },
        ],
        onReach: { exp: 2 },
      },
      {
        id: "s3_monologue",
        description: "众人散去后，才旦终于回答此前「阿爸是不是坏人」的问题：「他不是坏人，也不是好人。他是村长……他的手，写的是所有人的名字。」她说出「我想当村长……我们鱼定村，总不能一直怕下去」——这句话是说给界石听的，不是说给玩家听的。",
        playerHint: "众人散去后，留下来听才旦把话说完。",
        completionFlag: "quest_village6_s3",
        isCgMoment: true,
        onReach: {
          exp: 4,
          favorabilitySet: { "才旦": 100 },
          favorability: { "老猎户": 20, "鱼定大娘": 20, "杂货商人": 20, "老孙": 20, "张商人": 20 },
          reputation: 12,
          money: 120,
          factionRep: { 鱼定村: 35, 玉泉寨: 7, 鱼定土司府: -15, 锦官城: 5, 欢喜教: 0 },
          items: [{ name: "界石下的土", category: "accessory", quality: "白", desc: "不是武功，不是财物。是有人在这地方站过。" }, ...c("三曲老界石护身拓"), ...c("全村粮药契凭")],
          flags: ["caidan_elected_village_head", "flag_endgame_ally_yuding"],
        },
      },
    ],
    rewardText: "才旦好感锁定100，鱼定村所有参与NPC好感各+20，得 120 两与「界石下的土」「三曲老界石护身拓」「全村粮药契凭」，鱼定村声誉 +35、玉泉寨 +7、锦官城 +5、鱼定土司府 -15，才旦被村民推举为下一任村长。",
  }
} };
