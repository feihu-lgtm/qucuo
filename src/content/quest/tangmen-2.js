// 唐门主线唐2～唐5与支线唐支1～唐支3（合稿「唐门·五」）。
// 唐3 选与唐伯渊交易即落 flag_tangmen_dark_line，唐4/唐5 就此锁死，终局走唐门向土司府卖毒弩的恶线。
// 清理门户类奖励里写明 青城派: 0，是为挡住 factionRepDeltas 对唐门死对头的自动联动。
// 合稿里「对某 NPC 好感 ≥ N」「无伤通关」这类条件引擎还没有对应判定，只按唐门声誉与前置任务卡。
const c = (name, count = 1) => Array.from({ length: count }, () => ({ name, fromCatalog: true }));

export default { quest: {
  tangmen_2_tuimoqingjiang: {
    id: "tangmen_2_tuimoqingjiang",
    type: "QT_TALK",
    localOnly: true,
    title: "唐2·褪墨旧账",
    giver: "唐老太",
    giverId: "resident_tanglaotai",
    requiresQuestCompleted: "tangmen_1_anxianglaike",
    requiresFactionRep: { 唐门: 15 },
    description: "唐老太看完唐三少的引荐信，笑眯眯地说：三十年前那瓶褪墨青浆卖给了谁，宗谱铁室里有账，你去翻翻。",
    stages: [
      {
        id: "s1_audience",
        requireLocation: { district: "蜀南唐堡", inner: "竹影正堂" },
        playerHint: "进竹影正堂拜见唐老太，把三瓣竹印的事说清楚。",
        description: "唐老太把绣花针别回鬓边：「宗谱铁室的钥匙在仲衡身上。你去，他会开门。」",
        completionFlag: "quest_tang2_s1",
      },
      {
        id: "s2_ledger",
        giver: null,
        requireLocation: { district: "蜀南唐堡", inner: "宗谱铁室" },
        playerHint: "随唐仲衡下宗谱机密楼底层铁室，翻出三十年前的旧账。",
        description: "账页早已泛黄：曲措土司府账房陆福生亲笔按印，购走褪墨青浆三瓶。近五年又有五瓶，批条落款是唐伯渊。",
        completionFlag: "quest_tang2_s2",
        onReach: { items: c("三十年前褪墨旧账抄本") },
      },
      {
        id: "s3_report",
        requireLocation: { district: "蜀南唐堡", inner: "竹影正堂" },
        playerHint: "回竹影正堂：账本只呈唐老太，还是誊副本给才旦或柳青鸢作土司府罪证，你定。",
        description: "账本摊在唐老太膝头，她半晌没笑。",
        completionFlag: ["quest_tang2_a", "quest_tang2_b"],
        choices: [
          { flag: "quest_tang2_a", label: "账本只呈唐老太，家丑不外扬", resolve: "none" },
          { flag: "quest_tang2_b", label: "誊一份副本交给才旦或柳青鸢作罪证", resolve: "none" },
        ],
        onReach: {
          money: 200,
          factionRep: { 唐门: 20, 鱼定土司府: -10, 青城派: 0 },
          byFlag: {
            quest_tang2_a: { factionRep: { 唐门: 5 }, favorability: { 唐老太: 10 } },
            quest_tang2_b: { factionRep: { 鱼定村: 10, 锦官城: 8 }, flags: ["flag_tangmen_ink_proof"] },
          },
        },
      },
    ],
    rewardText: "得 200 两、旧账抄本，唐门声誉 +20、鱼定土司府 -10；只呈唐老太再 +5 唐门，交出副本则鱼定村 +10、锦官城 +8。",
  },

  tangmen_3_zhulintingfeng: {
    id: "tangmen_3_zhulintingfeng",
    type: "QT_TALK",
    localOnly: true,
    title: "唐3·竹林听风",
    giver: "唐听竹",
    giverId: "resident_tangtingzhu",
    requiresQuestCompleted: "tangmen_2_tuimoqingjiang",
    requiresFactionRep: { 唐门: 35 },
    description: "唐听竹在演武坪边压低嗓子：二房今夜要从吊桥暗渠口运出一批图纸，押送的是唐伯渊养的死士。",
    stages: [
      {
        id: "s1_ambush",
        giver: null,
        requireLocation: { district: "蜀南唐堡", inner: "吊桥暗渠口" },
        playerHint: "夜里去吊桥暗渠口截下运图纸的死士。",
        description: "竹影一晃，三枚透骨钉擦着你耳边钉进桥柱。",
        completionFlag: "quest_tang3_ambush",
        choices: [
          { flag: "quest_tang3_ambush", label: "截下押图死士", resolve: "combat", combatNpc: { name: "二房死士", levelCap: 4, hostile: true } },
        ],
        onReach: { items: c("铁莲子", 2) },
      },
      {
        id: "s2_verdict",
        giver: null,
        requireLocation: { district: "蜀南唐堡", inner: "竹影正堂" },
        playerHint: "图纸在手：当堂呈给唐老太揭穿二房，还是私下交还唐伯渊换他的封口重金，你定。",
        description: "唐伯渊摇着折扇候在正堂廊下，似乎早知道你会来。",
        completionFlag: ["quest_tang3_a", "quest_tang3_b"],
        choices: [
          { flag: "quest_tang3_a", label: "当堂呈图，帮唐三少揭穿二房", resolve: "none" },
          { flag: "quest_tang3_b", label: "私下交还图纸，收唐伯渊的封口钱", resolve: "none" },
        ],
        onReach: {
          byFlag: {
            quest_tang3_a: { money: 250, factionRep: { 唐门: 20, 青城派: 0 }, favorability: { 唐听竹: 20, 唐三少: 10 } },
            quest_tang3_b: { money: 800, items: c("鎏金机关折扇（仿品）"), factionRep: { 唐门: 15, 青城派: -8 }, favorability: { 唐三少: -40, 唐伯渊: 20 }, flags: ["flag_tangmen_dark_line", "flag_tangmen_sells_tusi"] },
          },
        },
      },
    ],
    rewardText: "当堂呈图得 250 两，唐门声誉 +20，唐听竹好感 +20；与唐伯渊交易得 800 两和仿制折扇，唐门 +15、青城派 -8、唐三少好感 -40，此后唐4、唐5 关闭，终局唐门向土司府出售毒弩。",
  },

  tangmen_4_wuxianhuohuan: {
    id: "tangmen_4_wuxianhuohuan",
    type: "QT_TALK",
    localOnly: true,
    title: "唐4·蛊器暗流",
    giver: "唐老太",
    giverId: "resident_tanglaotai",
    requiresQuestCompleted: "tangmen_3_zhulintingfeng",
    requiresFactionRep: { 唐门: 55 },
    blockedByFlags: ["flag_tangmen_dark_line"],
    description: "唐老太递来一枚玄竹密令：伯渊和五仙教叛党麻九娘在换东西，一边是蛊，一边是唐门的机括。截下来。",
    stages: [
      {
        id: "s1_order",
        requireLocation: { district: "蜀南唐堡", inner: "竹影正堂" },
        playerHint: "在竹影正堂领唐老太的玄竹密令。",
        description: "唐老太把密令塞进你掌心：「试毒暗阁给你开着，进去前先吃药。」",
        completionFlag: "quest_tang4_s1",
        onReach: { items: c("玄竹密令") },
      },
      {
        id: "s2_trade",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "银铃吊脚集" },
        playerHint: "去雾隐寨银铃吊脚集截下唐伯渊和麻九娘交割的蛊盒。",
        description: "吊脚集背街的竹楼下，麻九娘的毒使正把一只紫铜蛊盒递出去，接货的人腰间挂着三瓣竹印。",
        completionFlag: "quest_tang4_trade",
        choices: [
          { flag: "quest_tang4_trade", label: "截下交割的毒使", resolve: "combat", combatNpc: { name: "麻九娘的毒使", levelCap: 4, hostile: true } },
        ],
        onReach: { items: c("紫铜蛊盒") },
      },
      {
        id: "s3_box",
        giver: null,
        requiresItems: ["紫铜蛊盒"],
        playerHint: "蛊盒交给龙汐月或兰姐当场销毁，还是带回唐堡给唐老太研究，你定。",
        description: "盒盖上压着两枚私章，一枚是麻九娘的，一枚是唐伯渊的。",
        completionFlag: ["quest_tang4_a", "quest_tang4_b"],
        choices: [
          { flag: "quest_tang4_a", label: "交给龙汐月或兰姐当场销毁", resolve: "none" },
          { flag: "quest_tang4_b", label: "带回唐堡给唐老太研究", resolve: "none" },
        ],
        onReach: {
          consumeItems: ["紫铜蛊盒"],
          money: 350,
          items: c("百花净毒露", 2),
          factionRep: { 唐门: 25, 青城派: 0 },
          byFlag: {
            quest_tang4_a: { factionRep: { 百花门: 15, 五仙教: 15 } },
            quest_tang4_b: { items: c("冰魄解蛊散", 2), factionRep: { 唐门: 10, 五仙教: -5 } },
          },
        },
      },
    ],
    rewardText: "得 350 两、百花净毒露×2，唐门声誉 +25；销毁蛊盒则百花门、五仙教各 +15，带回研究再得冰魄解蛊散×2、唐门 +10、五仙教 -5。",
  },

  tangmen_5_jiaguichujian: {
    id: "tangmen_5_jiaguichujian",
    type: "QT_TALK",
    localOnly: true,
    title: "唐5·家法断机",
    giver: "唐老太",
    giverId: "resident_tanglaotai",
    requiresQuestCompleted: "tangmen_4_wuxianhuohuan",
    requiresFactionRep: { 唐门: 80 },
    blockedByFlags: ["flag_tangmen_dark_line"],
    description: "罪证齐了。唐老太召集各房，要当着宗祠开家法。唐伯渊却把唐堡吊桥机关锁死了。",
    stages: [
      {
        id: "s1_vent",
        giver: null,
        requireLocation: { district: "蜀南唐堡", inner: "外姓竹坞" },
        playerHint: "随陈默从外姓竹坞的淬火排烟暗道绕进内院。",
        description: "陈默在炉灰里比划了一张图：排烟暗道直通正堂后廊。",
        completionFlag: "quest_tang5_vent",
      },
      {
        id: "s2_duel",
        requireLocation: { district: "蜀南唐堡", inner: "竹影正堂" },
        playerHint: "冲进竹影正堂，当着各房拿下唐伯渊。",
        description: "唐伯渊合扇一点，十二枚牛毛针朝你面门罩来。",
        completionFlag: "quest_tang5_duel",
        choices: [
          { flag: "quest_tang5_duel", label: "当堂拿下唐伯渊", resolve: "combat", combatNpc: { name: "唐伯渊", levelCap: 4, hostile: true } },
        ],
      },
      {
        id: "s3_law",
        requireLocation: { district: "蜀南唐堡", inner: "竹影正堂" },
        playerHint: "家法怎么开，你定：当众处决唐伯渊，或废去武功囚禁铁室。",
        description: "唐老太把绣花针递到你手边：「门里的事，这回你说了算。」",
        completionFlag: ["quest_tang5_a", "quest_tang5_b"],
        choices: [
          { flag: "quest_tang5_a", label: "当众处决唐伯渊", resolve: "none" },
          { flag: "quest_tang5_b", label: "废去武功，囚禁宗谱铁室", resolve: "none" },
        ],
        onReach: {
          money: 600,
          items: c("破甲连弩信物"),
          factionRep: { 唐门: 35, 鱼定土司府: -20, 青城派: 5 },
          flags: ["ally_tangmen_confirmed"],
          byFlag: {
            quest_tang5_a: { favorability: { 唐老太: 10 } },
            quest_tang5_b: { favorability: { 唐三少: 10, 唐仲衡: 10 } },
          },
        },
      },
    ],
    rewardText: "得 600 两、破甲连弩信物，唐门声誉 +35、鱼定土司府 -20、青城派 +5；唐门终局结盟，届时派破甲连弩队助阵。",
  },

  tangmen_s1_yajiangtieyin: {
    id: "tangmen_s1_yajiangtieyin",
    type: "QT_TALK",
    localOnly: true,
    title: "唐支1·哑匠的铁印",
    giver: "陈默",
    giverId: "resident_chenmo",
    requiresQuestCompleted: "tangmen_1_anxianglaike",
    requiresFactionRep: { 唐门: 15 },
    description: "陈默在木牌上写：我打的毒针胚，被本家子弟刻上自己的字号去领赏。",
    stages: [
      {
        id: "s1_proof",
        requireLocation: { district: "蜀南唐堡", inner: "外姓竹坞" },
        playerHint: "在外姓竹坞的废料堆里翻出陈默的铁印胚模作证。",
        description: "炉灰底下压着一块胚模，背面是外姓工坊的暗记，正面被人磨去了一半。",
        completionFlag: "quest_tangs1_proof",
      },
      {
        id: "s2_settle",
        giver: null,
        requireLocation: { district: "蜀南唐堡" },
        playerHint: "拿胚模找唐仲衡按宗规申诉，还是直接找那几个本家子弟教训一顿，你定。",
        description: "陈默把木牌翻过来，上面只写了两个字：公道。",
        completionFlag: ["quest_tangs1_a", "quest_tangs1_b"],
        choices: [
          { flag: "quest_tangs1_a", label: "找唐仲衡按宗规申诉", resolve: "none" },
          { flag: "quest_tangs1_b", label: "找冒功的本家子弟教训一顿", resolve: "combat", combatNpc: { name: "冒功的本家子弟", levelCap: 2 } },
        ],
        onReach: {
          money: 100,
          factionRep: { 唐门: 10, 青城派: 0 },
          favorability: { 陈默: 25 },
          byFlag: {
            quest_tangs1_a: { favorability: { 唐仲衡: 15 } },
            quest_tangs1_b: { money: 30, favorability: { 唐伯渊: -15 } },
          },
        },
      },
    ],
    rewardText: "得 100 两，唐门声誉 +10，陈默好感 +25；按宗规申诉唐仲衡好感 +15，动手教训再得 30 两、唐伯渊好感 -15。",
  },

  tangmen_s2_duanertingji: {
    id: "tangmen_s2_duanertingji",
    type: "QT_TALK",
    localOnly: true,
    title: "唐支2·断耳听机",
    giver: "唐听竹",
    giverId: "resident_tangtingzhu",
    requiresQuestCompleted: "tangmen_1_anxianglaike",
    requiresFactionRep: { 唐门: 25 },
    description: "唐听竹改了一具千机木人，自己听不见机簧响，要人进去替她试一回。",
    stages: [
      {
        id: "s1_trial",
        requireLocation: { district: "蜀南唐堡", inner: "千机演武坪" },
        playerHint: "去千机演武坪闯唐听竹改的千机木人阵。",
        description: "木人关节咔咔作响，袖底一排小孔对准了你。",
        completionFlag: "quest_tangs2_trial",
        choices: [
          { flag: "quest_tangs2_trial", label: "闯千机木人阵", resolve: "combat", combatNpc: { name: "千机木人", levelCap: 3 } },
        ],
        onReach: {
          money: 150,
          items: c("淬竹袖箭"),
          factionRep: { 唐门: 15, 青城派: 0 },
          favorability: { 唐听竹: 25 },
        },
      },
    ],
    rewardText: "得 150 两、淬竹袖箭，唐门声誉 +15，唐听竹好感 +25。",
  },

  tangmen_s3_qingchengjiuzhen: {
    id: "tangmen_s3_qingchengjiuzhen",
    type: "QT_TALK",
    localOnly: true,
    title: "唐支3·青城旧针",
    giver: "唐老太",
    giverId: "resident_tanglaotai",
    requiresQuestCompleted: "tangmen_2_tuimoqingjiang",
    requiresFactionRep: { 唐门: 40, 青城派: 0 },
    description: "青城药圃有弟子中了倒钩青针，那针三十年前就停用了。唐老太配了解药，要你送去，顺便查是谁还留着旧针。",
    stages: [
      {
        id: "s1_cure",
        giver: null,
        requireLocation: { district: "雅江", inner: "药圃" },
        playerHint: "带唐老太配的解药去青城药圃救人。",
        description: "中针的青城弟子嘴唇乌青，见了唐门的药匣还想挣起来拔剑。",
        completionFlag: "quest_tangs3_cure",
        onReach: { items: c("三转青霜散") },
      },
      {
        id: "s2_traitor",
        giver: null,
        playerHint: "循着倒钩青针的来路，拿下当年叛出唐门的余党。",
        description: "那人怀里揣着半册毒经，封皮上还有唐门的三瓣竹印。",
        completionFlag: "quest_tangs3_traitor",
        choices: [
          { flag: "quest_tangs3_traitor", label: "拿下叛门余党", resolve: "combat", combatNpc: { name: "叛门余党", levelCap: 3, hostile: true } },
        ],
      },
      {
        id: "s3_book",
        giver: null,
        playerHint: "半册毒经交还唐老太，还是交给玉真子作青城的凭据，你定。",
        description: "两派三百年的旧账，就看这半册书落到谁手里。",
        completionFlag: ["quest_tangs3_a", "quest_tangs3_b"],
        choices: [
          { flag: "quest_tangs3_a", label: "毒经交还唐老太", resolve: "none" },
          { flag: "quest_tangs3_b", label: "毒经交给玉真子", resolve: "none" },
        ],
        onReach: {
          money: 220,
          items: [...c("熊胆解毒丸", 3), ...c("青城与唐门停战书简")],
          byFlag: {
            quest_tangs3_a: { factionRep: { 唐门: 15, 青城派: 10 } },
            quest_tangs3_b: { factionRep: { 青城派: 20, 唐门: 5 } },
          },
        },
      },
    ],
    rewardText: "得 220 两、熊胆解毒丸×3、停战书简；毒经交还唐老太则唐门 +15、青城派 +10，交给玉真子则青城派 +20、唐门 +5。",
  },
} };
