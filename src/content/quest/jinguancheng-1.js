export default { quest: {
"jinguancheng_guan1_xinren": {
    id: "jinguancheng_guan1_xinren",
    type: "QT_TALK",
    title: "官1·凤隐于青（信任的积累）",
    giver: "柳青鸢",
    description: "锦官城都事柳青鸢，姓柳名青鸢，锦官城人背后叫她「柳娘子」。她的上司六年前在曲措乡失踪，生不见人死不见尸——上司是第一个让她穿男装考吏部试的人，那年她十九岁。她极美，却永远穿大一号官袍，袖口挽两圈，领口扣到最上面一颗。",
    stages: [
      {
        id: "s1_first_case",
        description: "在协助调查一桩镖师遇害案的过程中，柳青鸢亲自出面坦言案中一味安息香是她定的、是给天都镇罗琦的，且透露死者曾替她运过药材、替她挡过一次管家手下的误伤。她告知死者临死前托人送来的镖箱里不是药材，是一封指认凶手的信，她压着没发，「时机不对，让她等」。",
        playerHint: "帮柳青鸢查镖师遇害案，看她愿意透露多少。",
        completionFlag: "quest_guan1_s1",
        onReach: { exp: 2, favorability: { "柳青鸢": 15 }, flags: ["lore_dushi_anxixiang_caigou"] },
      },
      {
        id: "s2_second_case",
        description: "在一桩地契摹本的调查中，柳青鸢认出摹本底图是六年前她调阅、标注给上司出巡看熊曲上游水源的地图，墨点是她亲手标的，上司的腰牌后来在温泉边被人捡到过但人不在。她首次向玩家暴露「我一直想去那个温泉自己看一眼，我没去，是怕到了那里发现什么都没有」，托玩家日后去熊山温泉替她看一眼、回来告诉她他最后在什么地方。",
        playerHint: "查那张地契摹本，它跟柳青鸢六年前的旧事有关。",
        completionFlag: "quest_guan1_s2",
        onReach: { exp: 3, favorability: { "柳青鸢": 20 }, flags: ["promise_liu_qingyuan_wenquan"] },
      },
      {
        id: "s3_third_case",
        description: "老兵退伍汉透露六年前官邸起火那晚，柳青鸢冲进去不是为抢玉佩，是为抢上司桌上烧了一半的手记，出来时左手袖子着火自己拍灭，左手至今有疤（形似烧焦的花）——解释了她写字时左手总拢在袖中的习惯。玩家按老兵策略归还一枚寄存玉佩，柳青鸢收下后首次向玩家透露「上司把家世压在腰带上」，把玉佩戴进领口，六年来第一次收别人的东西。",
        playerHint: "从老兵口中问出六年前官邸起火那晚的真相。",
        completionFlag: "quest_guan1_s3",
        onReach: { exp: 3, favorability: { "柳青鸢": 25, "老兵退伍汉": 20 }, items: [{ name: "旧玉佩", category: "accessory", quality: "绿", desc: "柳青鸢六年来第一次收下的东西，后续她会回赠一卷补充卷宗。" }] },
      },
      {
        id: "s4_fourth_case",
        description: "求药对象是柳青鸢本人——六年前官邸火灾横梁砸断腰椎的旧伤，每年入秋发作，她硬扛不肯歇息。达摩药堂师父透露一段与柳青鸢有关的旧往事——几年前有僧人在锦官城被混混讹诈，都事亲自解围：「她记错了。那年我不是因为不生气才不还口，我是看到她站在巷子口，觉得有人会替我出头。」",
        playerHint: "柳青鸢的旧伤发作了，去达摩药堂替她求药。",
        completionFlag: "quest_guan1_s4",
        onReach: { exp: 3, favorability: { "柳青鸢": 20, "老兵退伍汉": 25, "达摩药堂师父": 20 } },
      },
      {
        id: "s5_fifth_case",
        description: "一名冒名雪山派弟子当街挑衅，处理方式指向柳青鸢：揭穿线触发她私宴，展示「不需要别人替我反驳我是女人这件事」这层不愿被定义、不愿被同情的心态；告知线触发她亲自带雪山派弟子名录（呼延雪手抄，每年锦官城存档一份）去赌坊拆穿冒名者，事后独自把名录翻一遍，「温故知新……我替她们存着，免得以后丢了」。",
        playerHint: "有人冒充雪山派当街挑衅，替柳青鸢揭穿他。",
        completionFlag: ["quest_guan1_s5_expose", "quest_guan1_s5_report"],
        choices: [
          { flag: "quest_guan1_s5_expose", label: "揭穿冒名者", resolve: "none" },
          { flag: "quest_guan1_s5_report", label: "告知柳青鸢，请她亲自处理", resolve: "none" },
        ],
        onReach: {
          exp: 3,
          favorability: { "柳青鸢": 25 },
          byFlag: {
            quest_guan1_s5_expose: { items: [{ name: "柳青鸢的手制咸菜", category: "misc", quality: "白", desc: "都事私宴上少见的家常手艺。" }] },
            quest_guan1_s5_report: { flags: ["lore_liu_qingyuan_archives_xueshanpai"] },
          },
        },
      },
    ],
    rewardText: "五段信任积累完成，柳青鸢愿意在书房单独接见玩家——通往「官2·归途」的门开了。",
  },
"jinguancheng_guan2_guitu": {
    id: "jinguancheng_guan2_guitu",
    type: "QT_TALK",
    title: "官2·归途「凤隐于青」",
    giver: "柳青鸢",
    description: "柳青鸢第一次正式打开书房请玩家入内，墙角挂着旧青布长衫，桌上压着熊曲上游温泉的手绘地图。土司递话威胁「再不表态视为官府放弃介入」，上级也给了最后期限。她说：「我卡在公务和私情之间，卡了六年……你帮我选。不是替我做官——是替我还一笔人情。」",
    requiresQuestCompleted: "jinguancheng_guan1_xinren",
    stages: [
      {
        id: "s1_choice",
        description: "在A线（投靠·还恩）与B线（中立·压制）之间做出选择——这个选择没有回头路，会正式决定锦官城在终局七方博弈里的立场。",
        playerHint: "在投靠还恩与中立压制之间选一条——没有回头路，你定。",
        completionFlag: ["quest_guan2_a", "quest_guan2_b"],
        choices: [
          { flag: "quest_guan2_a", label: "投靠·还恩", resolve: "none" },
          { flag: "quest_guan2_b", label: "中立·压制", resolve: "none" },
        ],
        isCgMoment: true,
        onReach: {
          exp: 5,
          favorabilitySet: { "柳青鸢": 100 },
          items: [{ name: "柳青鸢的手绘地图", category: "misc", quality: "紫", desc: "熊山/贡措海探索揭示隐藏标注点，触发她回忆性独白。" }],
        },
      },
    ],
    rewardText: "此后回锦官城常在都事府偏厅看到她算账，「茶在桌上」。",
    exclusiveGroup: "锦官城归途",
  },
"jinguancheng_guan2a_toukao": {
    id: "jinguancheng_guan2a_toukao",
    type: "QT_TALK",
    exclusiveGroup: "锦官城归途",
    title: "官2-A·投靠·还恩",
    giver: "柳青鸢",
    description: "触发条件：官1五个任务中至少两项选择了对柳青鸢有利的方向，且累积好感≥50。柳青鸢将上司所赠的青布长衫交给玩家：「以后不用还。」",
    stages: [
      {
        id: "s1_handoff",
        description: "她交出六年整理的「土司府灰色收入明细」和上司失踪前托猎户转交的最后一封信（信中写明「若吾不还，将此卷宗交青鸢……勿念」）。她给玩家一道非正式手令，托付终局时保护三名关键女性——梅朵、卓玛、罗琦：「这三个人，都不该为曲措乡的恩怨送命……别跟我商量，我没得商量。」",
        playerHint: "接下柳青鸢交托的卷宗与旧信。",
        completionFlag: "quest_guan2a_s1",
        isCgMoment: true,
        onReach: {
          exp: 5,
          items: [
            { name: "柳青鸢的青布长衫", category: "armor", quality: "橙", desc: "以后不用还。" },
            { name: "都事卷宗", category: "misc", quality: "橙", desc: "土司府灰色收入明细，终局对峙的核心筹码。" },
          ],
          flags: ["title_jinguancheng_tequai_xuncha", "endgame_protect_meiduo_zhuoma_luoqi"],
        },
      },
    ],
    rewardText: "此后她私聊中会用去姓的称呼叫玩家名字。",
  },
"jinguancheng_guan2b_zhongli": {
    id: "jinguancheng_guan2b_zhongli",
    type: "QT_TALK",
    exclusiveGroup: "锦官城归途",
    title: "官2-B·中立·压制",
    giver: "柳青鸢",
    description: "触发条件：持有官1任务4的安息香采购记录、任务7的水源地图底本、任务9的旧玉佩中至少两项，并完成村5衔接线索「熊曲温泉之物」，且锦官城在土司博弈中的立场尚未被主线锁定。",
    stages: [
      {
        id: "s1_pressure",
        description: "玩家摆出证据，柳青鸢逐件翻看却不恼怒，坦言这些东西若给土司够她丢官数次，但「我不怕丢官，我怕的是丢了这层身份就再也查不到他」。她请玩家帮忙「找到他，或找到他留下的东西」，交出一枚私印（印文「青鸢」）作为凭信，指引玩家去天都镇找罗琦对接管家的内应情报——「他的随从，欠的是我的情，不是我收买了他……管家从来不问下面人家里的事」。",
        playerHint: "把证据摆到柳青鸢面前，看她如何回应。",
        completionFlag: "quest_guan2b_s1",
        isCgMoment: true,
        onReach: {
          exp: 5,
          items: [
            { name: "柳青鸢的中立承诺书", category: "misc", quality: "蓝", desc: "土司府对峙阶段可用。" },
            { name: "青鸢私印印信纸", category: "misc", quality: "蓝", desc: "交罗琦解锁情报通道。" },
          ],
          flags: ["intel_guanjia_inside_man", "faction_jinguancheng_neutral", "endgame_meiduo_succession_backed"],
        },
      },
    ],
    rewardText: "终局锦官城全面中立，柳青鸢承诺若土司倒台推动任命梅朵代管曲措乡——「那姑娘跟她爹不是一路人……字如其人。她该有机会自己写自己的名字。」",
  }
} };
