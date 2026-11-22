// 鱼定土司府任务线（合稿·土司府第 4 节）。土司府不可拜入，玩家是编外客卿：主线 府1~府3 与支线 府支1~3；
// 府4「旧刃问心」牵着雪山派三十年宿怨；府5「斗地主」是终局决战，读各家终局 flag。门槛按 #237 顶层写法，全部 ≤ 100。
// 奖励照合稿原值；土司府涨声誉时黑风寨、玉泉寨、雪山派的联动扣分由 factionRepDeltas 统一结算，这里不手写。
const TS = "鱼定土司府";
const at = (inner, district = "鱼定土司") => ({ district, inner });
const catalog = (name, count = 1) => Array.from({ length: count }, () => ({ name, fromCatalog: true }));

// 府5 读各家终局 flag 的映射表。各家 flag 名不统一（flag_*/endgame_*/*_endgame_*/finale_*/ally_*_confirmed），
// 这里只读不改名。effect 只抄各家章节合稿明写的终局效果；合稿没写效果或效果已被府4前置覆盖的，effect 为 null，府5 不接。
export const TUSI_FINALE_FLAGS = {
  gesangNeutralized: { flag: "flag_gesang_neutralized", faction: TS, effect: "格桑顿珠率八成巡捕营按兵不动，桑杰朵杰失去半数防线（府5 前置）" },
  meiduoRegent: { flag: "flag_meiduo_regent", faction: TS, effect: "战后推举梅朵代管" },
  meiduoBacked: { flag: "endgame_meiduo_succession_backed", faction: "锦官城", effect: "锦官城官府支持梅朵继位/代管" },
  yudingAlly: { flag: "flag_endgame_ally_yuding", faction: "鱼定村", effect: "情报封锁+后勤粮药+暗渡奇袭路线" },
  xueshanAlly: { flag: "xueshan_endgame_ally", faction: "雪山派", effect: "雪山剑阵正面拖住桑杰朵杰，大幅震慑土司府护卫军心" },
  baihuaAlly: { flag: "finale_baihua_joined", faction: "百花门", effect: "粮仓水源下软筋散、放瘴截断骑手，瓦解土司府半数私兵；百花门能解毒" },
  gaibangAlly: { flag: "endgame_ally_gaibang", faction: "丐帮", effect: "打狗阵牵制巡捕营与骑手" },
  gaibangScouts: { flag: "endgame_buff_gaibang_scouts", faction: "丐帮", effect: "全图斥候，提前洞悉伏兵" },
  heifengRaid: { flag: "endgame_buff_heifengzhai_raid_supply_lines", faction: "黑风寨", effect: "袭扰土司府粮道，后勤支援延迟两回合" },
  tangmenAlly: { flag: "ally_tangmen_confirmed", faction: "唐门", effect: "破甲连弩削减精兵三成护甲，取消管家毒弩伏击" },
  tusiCrossbowExposed: { flag: "quest_tss2_hand", faction: TS, effect: "府支2 把暗弩交给格桑顿珠，削弱终局土司府暗器伏兵" },
  wuxianAlly: { flag: "endgame_ally_wuxian", faction: "五仙教", effect: "银冠线：解瘴清风香与软筋麻蛊破毒阵；麻九娘未能卖蛊，战阵无紫瘴" },
  wuxianFull: { flag: "endgame_ally_wuxian_full", faction: "五仙教", effect: null },
  wuxianPoisonTusi: { flag: "endgame_wuxian_poison_tusi", faction: "五仙教", effect: "赤蜈线：土司私兵全员淬毒、战阵弥漫紫瘴（放任不管同样如此）" },
  gaibangFull: { flag: "endgame_ally_gaibang_full", faction: "丐帮", effect: null },
  lamaAlly: { flag: "lama_endgame_ally", faction: "喇嘛庙", effect: null },
  xueshanLone: { flag: "xueshan_endgame_lone", faction: "雪山派", effect: null },
};
const F = Object.fromEntries(Object.entries(TUSI_FINALE_FLAGS).map(([k, v]) => [k, v.flag]));
const FINALE_ROOM = at("议事厅");

export default { quest: {
  yudingtusi_1_xunshan_cuiliang: {
    id: "yudingtusi_1_xunshan_cuiliang",
    type: "QT_TALK",
    title: "府1·巡山催粮",
    giver: "白玛次仁",
    giverId: "resident_baimaciren",
    localOnly: true,
    description: "秋粮入库前，巡捕营副统领白玛次仁要带人下鱼定村催缴欠粮。他缺个面生的帮手，许你一块土司府腰牌。",
    stages: [
      {
        id: "brief",
        requireLocation: at("军需司"),
        playerHint: "在军需司听白玛次仁交代催粮的差事。",
        description: "白玛次仁把一本卷了角的欠粮册拍在柜台上：「才旦家欠三石，大娘家欠两石，今天不交，明年地就别种了。」",
        completionFlag: "quest_ts1_brief",
      },
      {
        id: "collect",
        giver: null,
        requireLocation: at("村口·广场", "鱼定村"),
        playerHint: "在鱼定村广场催粮：铁腕催缴、自掏五十两垫付，或护着村民跟差役翻脸。",
        description: "差役把才旦家的粮仓门踹开，仓里只剩半袋发霉的青稞。才旦的老母亲跪在地上，白玛次仁的鞭子已经扬了起来。",
        completionFlag: ["quest_ts1_iron", "quest_ts1_pay", "quest_ts1_protect"],
        choices: [
          { flag: "quest_ts1_iron", label: "铁腕催缴", resolve: "none",
            narration: "你一把扛起那半袋青稞扔上粮车，又让差役去下一家。身后哭声一片，白玛次仁拍着你的肩膀大笑。" },
          { flag: "quest_ts1_pay", label: "自掏五十两垫付", resolve: "none", requiresMoney: 50,
            narration: "你把五十两银子塞进白玛次仁手里：「账我替他们平了。」白玛次仁掂了掂，收鞭走人；才旦家的人红着眼冲你磕头。" },
          { flag: "quest_ts1_protect", label: "护民抗差", resolve: "combat", combatNpc: { name: "巡捕营差役", levelCap: 2 } },
        ],
        onReach: {
          byFlag: {
            quest_ts1_iron: { factionRep: { [TS]: 18, 鱼定村: -12 }, money: 30, items: catalog("土司府云雷铜牌"), favorability: { 白玛次仁: 15 } },
            quest_ts1_pay: { factionRep: { [TS]: 10, 鱼定村: 8, 玉泉寨: 5 }, money: -50, items: [...catalog("土司府云雷铜牌"), ...catalog("双份税单抄本")], flags: ["flag_tusi_tax_discrepancy"], reputation: 3 },
            quest_ts1_protect: { factionRep: { [TS]: -20, 鱼定村: 18, 玉泉寨: 12, 黑风寨: 6 }, favorability: { 白玛次仁: -20, 梅朵: 10 }, reputation: 5 },
          },
        },
      },
    ],
    rewardText: "这一趟催粮，鱼定村和土司府都记住了你的脸。",
  },

  yudingtusi_2_caodian_anliang: {
    id: "yudingtusi_2_caodian_anliang",
    type: "QT_TALK",
    title: "府2·草甸暗粮",
    giver: "格桑顿珠",
    giverId: "resident_gesangdunzhu",
    localOnly: true,
    requiresQuestCompleted: "yudingtusi_1_xunshan_cuiliang",
    requiresFactionRep: { [TS]: 15 },
    description: "催上来的秋粮少了三成。格桑顿珠查到有一批粮夜里被运去了大草甸深处，他怀疑府里有人在私通天龙教。",
    stages: [
      {
        id: "brief",
        requireLocation: at("护卫厅"),
        playerHint: "在护卫厅听格桑顿珠说暗粮的事。",
        description: "格桑顿珠压低声音：「运粮的车辙一路往西，到草甸深处就没了。我的人去了太扎眼，你替我走一趟。」",
        completionFlag: "quest_ts2_brief",
      },
      {
        id: "cache",
        giver: null,
        requireLocation: at("草甸深处", "大草甸"),
        playerHint: "在大草甸深处找到暗粮：收下封口费同流合污、留证潜伏，或一把火烧了。",
        description: "土坡后藏着十几辆粮车，看守的是红巾刀客。领头的认出你腰间的土司府铜牌，笑着抛来一袋银子：「管家的人？自己人。」",
        completionFlag: ["quest_ts2_join", "quest_ts2_evidence", "quest_ts2_burn"],
        choices: [
          { flag: "quest_ts2_join", label: "收下封口费", resolve: "none",
            narration: "你接住银袋揣进怀里，替他们把车辙扫平。回府的路上，你想好了该怎么跟格桑顿珠交差。" },
          { flag: "quest_ts2_evidence", label: "留证潜伏", resolve: "none",
            narration: "你装作收下银子，趁夜抄下粮车上的封条字号和押运人的名字，原封不动带回护卫厅。" },
          { flag: "quest_ts2_burn", label: "火烧暗粮", resolve: "combat", combatNpc: { name: "红巾刀客", levelCap: 3 } },
        ],
        onReach: {
          byFlag: {
            quest_ts2_join: { factionRep: { [TS]: 25, 天龙教: 12, 青城派: -8 }, money: 80 },
            quest_ts2_evidence: { factionRep: { [TS]: 12 }, favorability: { 格桑顿珠: 20 }, items: [...catalog("藏红花活血膏", 2), ...catalog("唐门退墨药水"), ...catalog("血刀暗粮密信"), ...catalog("唐伯渊货单")] },
            quest_ts2_burn: { factionRep: { [TS]: -35, 天龙教: -20, 黑风寨: 25, 玉泉寨: 10, 青城派: 10 }, reputation: 8, items: [...catalog("血刀断刃"), ...catalog("唐伯渊货单")] },
          },
        },
      },
    ],
    rewardText: "暗粮的去向，格桑顿珠心里有了数；府里那位管家，从此看你的眼神也不一样了。",
  },

  yudingtusi_3_jiuqi_canyin: {
    id: "yudingtusi_3_jiuqi_canyin",
    type: "QT_TALK",
    title: "府3·旧契残印",
    giver: "洛桑平措",
    giverId: "resident_luosangpingcuo",
    localOnly: true,
    requiresQuestCompleted: "yudingtusi_2_caodian_anliang",
    requiresFactionRep: { [TS]: 40 },
    description: "主簿洛桑平措夜里叫住你：三十年前老土司留下的一张地契原件就压在库房，鱼定村和玉泉寨的地权全系在它上面。",
    stages: [
      {
        id: "brief",
        requireLocation: at("档册文书房"),
        playerHint: "在档册文书房听洛桑平措说旧地契的事。",
        description: "洛桑平措把酥油灯拨暗：「那张契是假的，老土司当年就知道。原件在库房第三口铁箱底下，钥匙我有。」",
        completionFlag: "quest_ts3_brief",
      },
      {
        id: "vault",
        giver: null,
        requireLocation: at("库房"),
        playerHint: "去库房第三口铁箱里取出旧地契。",
        description: "铁箱底垫着一层油布，油布里裹着半张被火燎过的地契，落款处的朱印缺了一角，纸背有一行老土司的小字。",
        completionFlag: "quest_ts3_found",
        onReach: { items: catalog("旧地契残页") },
      },
      {
        id: "decide",
        requireLocation: at("档册文书房"),
        playerHint: "把残契带回档册文书房：抄录两份分给村寨、呈送桑杰朵杰，或当场销毁。",
        description: "洛桑平措盯着那行小字，手在发抖：「老土司当年……是想自己撕了它。」他把残契推回给你，「怎么处置，你定。」",
        completionFlag: ["quest_ts3_copy", "quest_ts3_present", "quest_ts3_burn"],
        choices: [
          { flag: "quest_ts3_copy", label: "抄录双份", resolve: "none",
            narration: "你和洛桑平措连夜誊了两份，一份托人送去鱼定村长府，一份送去玉泉寨。原件放回铁箱，谁也没惊动。" },
          { flag: "quest_ts3_present", label: "呈送桑杰朵杰", resolve: "none",
            narration: "你把残契放上桑杰朵杰的书案。他盯着父亲的字看了很久，最后只说了一句：「你出去。」书架后那道窄门，却没再上锁。" },
          { flag: "quest_ts3_burn", label: "销毁原契", resolve: "none",
            narration: "你把残契凑到酥油灯上。火苗舔过朱印，三十年的旧账化成一缕青烟。洛桑平措别过脸去。" },
        ],
        onReach: {
          flags: ["tusi_secret_room"],
          byFlag: {
            quest_ts3_copy: { factionRep: { 鱼定村: 15, 玉泉寨: 15, 锦官城: 10 }, favorability: { 洛桑平措: 15 }, flags: ["flag_fake_deed_proved"], items: [...catalog("三十年原始地契拓本"), ...catalog("半角血书")] },
            quest_ts3_present: { factionRep: { [TS]: -40, 鱼定村: 20, 玉泉寨: 20 }, favorability: { 桑杰朵杰: 10, 梅朵: 15 }, reputation: 5, flags: ["flag_fake_deed_proved"], items: catalog("三十年原始地契拓本") },
            quest_ts3_burn: { factionRep: { [TS]: 35, 鱼定村: -20 }, money: 120, items: catalog("镇边虎纹玉佩") },
          },
        },
      },
    ],
    rewardText: "旧契的事了结了一半。桑杰朵杰书房后那道窄门，你如今知道怎么进了。",
  },

  yudingtusi_4_gushu_wenxin: {
    id: "yudingtusi_4_gushu_wenxin",
    type: "QT_TALK",
    title: "府4·旧刃问心",
    giver: "格桑顿珠",
    giverId: "resident_gesangdunzhu",
    localOnly: true,
    requiresQuestCompleted: "yudingtusi_3_jiuqi_canyin",
    requiresFavor: { 格桑顿珠: 40 },
    description: "大战前夜，风雪漫天。格桑顿珠托人传话：巡捕营的矛头究竟朝外还是朝内，今夜得有个交代。",
    stages: [
      {
        id: "summon",
        requireLocation: at("护卫厅"),
        playerHint: "到护卫厅赴格桑顿珠的约，把三十年前的旧事摊开。",
        description: "格桑顿珠独自擦着长矛，火盆里的牛粪饼噼啪作响：「老土司死在雪山崖底那天，我就在山下。你手里那张残契，给我看看。」",
        completionFlag: "quest_ts4_summon",
      },
      {
        id: "ambush",
        requireLocation: at("护卫厅"),
        playerHint: "白玛次仁带弓弩手围了校场：并肩击退他，或替桑杰朵杰拿下格桑顿珠。",
        description: "校场四角亮起火把，白玛次仁奉陆福生密令率弓弩手围了上来：「格桑顿珠勾结外人、图谋不轨，拿下！」格桑顿珠把矛横在身前，看了你一眼。",
        completionFlag: ["quest_ts4_truth", "quest_ts4_regent", "quest_ts4_purge"],
        choices: [
          { flag: "quest_ts4_truth", label: "并肩击退白玛次仁", resolve: "combat", combatNpc: { name: "白玛次仁", levelCap: 4 } },
          { flag: "quest_ts4_regent", label: "击退白玛次仁·推举梅朵代管", resolve: "combat", requiresFavor: { 梅朵: 60 },
            combatNpc: { name: "白玛次仁", levelCap: 4 } },
          { flag: "quest_ts4_purge", label: "铁腕清营·拿下格桑顿珠", resolve: "combat",
            requiresFlag: ["quest_ts3_burn"], requiresFactionRep: { [TS]: 80 }, combatNpc: { name: "格桑顿珠", levelCap: 5 } },
        ],
        onReach: {
          byFlag: {
            quest_ts4_truth: {
              money: 400, items: catalog("点钢乌木镇边矛"), reputation: 20,
              factionRep: { [TS]: -40, 雪山派: 15, 喇嘛庙: 15, 玉泉寨: 15, 鱼定村: 15 },
              favorability: { 格桑顿珠: 30 }, flags: ["tusi_gesang_true_heir", "flag_gesang_neutralized"],
            },
            quest_ts4_regent: {
              money: 400, items: catalog("点钢乌木镇边矛"), reputation: 20,
              factionRep: { [TS]: -40, 雪山派: 15, 喇嘛庙: 15, 玉泉寨: 15, 鱼定村: 15 },
              favorability: { 格桑顿珠: 30, 梅朵: 10 }, flags: ["tusi_gesang_true_heir", "flag_gesang_neutralized", "flag_meiduo_regent"],
            },
            quest_ts4_purge: {
              money: 1200, items: catalog("巡边行走金印"), reputation: -25,
              factionRep: { [TS]: 40, 雪山派: -20, 黑风寨: -20, 玉泉寨: -20, 锦官城: -12 },
              favorability: { 桑杰朵杰: 20 },
            },
          },
        },
      },
    ],
    rewardText: "雪夜校场的火盆熄了。巡捕营的矛头朝哪儿，终局那天自见分晓。",
  },

  yudingtusi_side1_paoma_yishi: {
    id: "yudingtusi_side1_paoma_yishi",
    type: "QT_TALK",
    title: "府支1·跑马仪事",
    giver: "桑杰朵杰",
    giverId: "resident_sangjieduojie",
    localOnly: true,
    requiresQuestCompleted: "yudingtusi_1_xunshan_cuiliang",
    description: "跑马大会在即，锦官城的使者要来观礼。桑杰朵杰要你替他拟一份大会仪程：给锦官城看太平，给百姓看宽厚。",
    stages: [
      {
        id: "plan",
        requireLocation: at("桑杰朵杰书房"),
        playerHint: "在桑杰朵杰书房拟跑马大会的仪程：粉饰太平，或暗中给村寨留点余地。",
        description: "桑杰朵杰把一张白纸推过来：「去年的赏银少了，百姓有怨言。今年你看着办，体面要紧。」",
        completionFlag: ["quest_tss1_polish", "quest_tss1_leeway"],
        choices: [
          { flag: "quest_tss1_polish", label: "粉饰太平", resolve: "none",
            narration: "你把彩头、歌舞、锦官城使者的座次排得滴水不漏，欠粮的事一个字不提。桑杰朵杰看完，满意地盖了印。" },
          { flag: "quest_tss1_leeway", label: "暗留余地", resolve: "none",
            narration: "你在仪程末尾添了一条「赛马得胜者可替本村减免一成秋粮」。桑杰朵杰皱了皱眉，还是盖了印。" },
        ],
        onReach: {
          byFlag: {
            quest_tss1_polish: { factionRep: { [TS]: 18 }, money: 40, favorability: { 桑杰朵杰: 10 } },
            quest_tss1_leeway: { factionRep: { [TS]: 8, 鱼定村: 10, 玉泉寨: 10, 欢喜教: 12, 黑风寨: 8 }, favorability: { 梅朵: 10 } },
          },
        },
      },
    ],
    rewardText: "跑马大会的仪程定了下来。",
  },

  yudingtusi_side2_anu_xunyuan: {
    id: "yudingtusi_side2_anu_xunyuan",
    type: "QT_TALK",
    title: "府支2·暗弩寻源",
    giver: "格桑顿珠",
    giverId: "resident_gesangdunzhu",
    localOnly: true,
    requiresFactionRep: { [TS]: 15 },
    description: "草甸边缘的马匪最近用上了连发暗弩，射伤了巡捕营两个骑手。格桑顿珠要你缴一把回来，看看是谁卖给他们的。",
    stages: [
      {
        id: "raid",
        giver: null,
        requireLocation: at("草甸边缘", "大草甸"),
        playerHint: "去大草甸边缘打退马匪，缴一把暗弩。",
        description: "马匪藏在草丘后放冷箭，箭镞带着倒钩，一看就不是山里铁匠打得出来的。",
        completionFlag: "quest_tss2_raid",
        choices: [
          { flag: "quest_tss2_raid", label: "打退马匪", resolve: "combat", combatNpc: { name: "草甸马匪", levelCap: 2 } },
        ],
        onReach: { items: catalog("军械暗弩") },
      },
      {
        id: "report",
        requireLocation: at("护卫厅"),
        playerHint: "把暗弩带回护卫厅：交给格桑顿珠追查，或拿去敲陆福生一笔。",
        description: "弩臂内侧的标记被锉掉了，可机括的做法分明是唐门的手艺。经手军械采买的，只有管家陆福生。",
        completionFlag: ["quest_tss2_hand", "quest_tss2_blackmail"],
        choices: [
          { flag: "quest_tss2_hand", label: "交给格桑顿珠", resolve: "none",
            narration: "格桑顿珠翻来覆去看了半天，把弩锁进兵器架：「唐门那边，我会写信去问。这事你别声张。」" },
          { flag: "quest_tss2_blackmail", label: "敲诈陆福生", resolve: "none",
            narration: "你把暗弩往管家值房的账桌上一放。陆福生的脸白了又红，最后从抽屉里数出一摞银票，还替你在土司跟前美言了几句。" },
        ],
        onReach: {
          byFlag: {
            quest_tss2_hand: { factionRep: { 唐门: 15, 青城派: 6 }, favorability: { 格桑顿珠: 15 } },
            quest_tss2_blackmail: { factionRep: { [TS]: 10, 唐门: -15 }, money: 100, favorability: { "管家·陆福生": -10 } },
          },
        },
      },
    ],
    rewardText: "暗弩的来路查到了唐门头上。",
  },

  yudingtusi_side3_qiangwai_qingke: {
    id: "yudingtusi_side3_qiangwai_qingke",
    type: "QT_TALK",
    title: "府支3·墙外青稞",
    giver: "梅朵",
    giverId: "resident_meiduo",
    localOnly: true,
    description: "梅朵瞒着父亲，从府里粮仓匀出两袋青稞，要你趁夜送去玉泉寨。她说：「阿爸收得太狠了，总得有人还回去一点。」",
    stages: [
      {
        id: "deliver",
        giver: null,
        requireLocation: at("寨门", "玉泉寨"),
        playerHint: "把梅朵的青稞送到玉泉寨寨门：悄悄交给寨里，或掉头去跟土司府告密。",
        description: "寨门的火把下，守夜的汉子盯着你背上的粮袋，手按在刀柄上。",
        completionFlag: ["quest_tss3_deliver", "quest_tss3_report"],
        choices: [
          { flag: "quest_tss3_deliver", label: "暗渡陈仓", resolve: "none",
            narration: "你把粮袋卸在寨门边，只说是一位不肯留名的朋友送的。守夜的汉子愣了半晌，冲你抱了抱拳。" },
          { flag: "quest_tss3_report", label: "回府告密", resolve: "none",
            narration: "你没进寨门，掉头把这事报给了管家陆福生。第二天梅朵被禁足在闺房，两袋青稞原样回了粮仓。" },
        ],
        onReach: {
          byFlag: {
            quest_tss3_deliver: { factionRep: { 玉泉寨: 15 }, favorability: { 梅朵: 20 } },
            quest_tss3_report: { factionRep: { [TS]: 15 }, money: 40, favorability: { 梅朵: -30, "管家·陆福生": 10 } },
          },
        },
      },
    ],
    rewardText: "两袋青稞的去向，梅朵很快就会知道。",
  },

  yudingtusi_5_dou_dizhu: {
    id: "yudingtusi_5_dou_dizhu",
    type: "QT_TALK",
    title: "府5·斗地主",
    giver: "格桑顿珠",
    giverId: "resident_gesangdunzhu",
    localOnly: true,
    requiresQuestCompleted: "yudingtusi_4_gushu_wenxin",
    requiresFlags: [F.gesangNeutralized],
    description: "巡捕营奉命守门、按兵不动。三十年的旧账，今夜在议事厅当着桑杰朵杰的面算清。",
    stages: [
      {
        id: "open",
        requireLocation: FINALE_ROOM,
        playerHint: "到议事厅，与桑杰朵杰当面摊牌。",
        description: "议事厅烛火通明，桑杰朵杰端坐虎皮椅上，身后只剩一半护卫。格桑顿珠的骑手在府门外勒马不动。桑杰朵杰慢慢放下酒碗：「格桑也不站在我这边了。好，那就看看你们凑了多少人来。」",
        completionFlag: "quest_ts5_open",
      },
      {
        id: "miasma",
        requireLocation: FINALE_ROOM,
        playerHint: "五仙教若未站到你这边，土司私兵带着毒蛊冲进来；有百花门解毒能轻松些。",
        description: "厅外忽然腾起一股紫雾。",
        completionFlag: ["quest_ts5_miasma_clear", "quest_ts5_miasma", "quest_ts5_miasma_cured"],
        choices: [
          { flag: "quest_ts5_miasma_clear", label: "银冠毒使放解瘴清风香，紫瘴散尽", resolve: "none", requiresFlag: [F.wuxianAlly],
            narration: "龙汐月的毒使在檐下点起解瘴清风香，紫雾还没漫过门槛就散了，几个淬毒私兵被软筋麻蛊放倒在台阶上。" },
          { flag: "quest_ts5_miasma", label: "冒着紫瘴迎击淬毒私兵", resolve: "combat", blockedByFlags: [F.wuxianAlly],
            combatNpc: { name: "淬毒土司私兵", levelCap: 5 } },
          { flag: "quest_ts5_miasma_cured", label: "服百花门解药，迎击淬毒私兵", resolve: "combat", blockedByFlags: [F.wuxianAlly],
            requiresFlag: [F.baihuaAlly], combatNpc: { name: "淬毒土司私兵", levelCap: 3 } },
        ],
      },
      {
        id: "ambush",
        requireLocation: FINALE_ROOM,
        playerHint: "管家陆福生的毒弩伏兵藏在梁上；唐门站到你这边就没有伏兵。",
        description: "陆福生缩到柱后，抬手一挥。",
        completionFlag: ["quest_ts5_ambush_none", "quest_ts5_ambush", "quest_ts5_ambush_spotted"],
        choices: [
          { flag: "quest_ts5_ambush_none", label: "唐门断了毒弩，梁上无人", resolve: "none", requiresFlag: [F.tangmenAlly],
            narration: "陆福生挥了三次手，梁上没有一支弩箭落下来。唐门早就断了他的货，伏兵连机括都没装上。" },
          { flag: "quest_ts5_ambush", label: "迎击千机毒弩伏兵", resolve: "combat", blockedByFlags: [F.tangmenAlly],
            combatNpc: { name: "千机毒弩伏兵", levelCap: 4 } },
          { flag: "quest_ts5_ambush_spotted", label: "伏兵早被看破，先拔弩手", resolve: "combat", blockedByFlags: [F.tangmenAlly],
            requiresFlagAny: [F.gaibangScouts, F.tusiCrossbowExposed], combatNpc: { name: "千机毒弩伏兵", levelCap: 3 } },
        ],
      },
      {
        id: "guard",
        requireLocation: FINALE_ROOM,
        playerHint: "中院亲兵护着桑杰朵杰；各家援军能削弱他们，鱼定村的暗道能绕开他们。",
        description: "中院亲兵举盾围成一圈，把桑杰朵杰护在中间。",
        completionFlag: ["quest_ts5_guard", "quest_ts5_guard_gaibang", "quest_ts5_guard_heifeng", "quest_ts5_guard_tangmen",
          "quest_ts5_guard_xueshan", "quest_ts5_guard_baihua", "quest_ts5_guard_yuding"],
        choices: [
          { flag: "quest_ts5_guard", label: "正面冲破中院亲兵", resolve: "combat", combatNpc: { name: "土司府中院亲兵", levelCap: 4 } },
          { flag: "quest_ts5_guard_gaibang", label: "丐帮打狗阵牵住巡捕营与骑手", resolve: "combat", requiresFlag: [F.gaibangAlly],
            combatNpc: { name: "土司府中院亲兵", levelCap: 3 } },
          { flag: "quest_ts5_guard_heifeng", label: "黑风寨断了粮道，亲兵等不来后援", resolve: "combat", requiresFlag: [F.heifengRaid],
            combatNpc: { name: "土司府中院亲兵", levelCap: 3 } },
          { flag: "quest_ts5_guard_tangmen", label: "唐门破甲连弩先射穿亲兵护甲", resolve: "combat", requiresFlag: [F.tangmenAlly],
            combatNpc: { name: "土司府中院亲兵", levelCap: 3 } },
          { flag: "quest_ts5_guard_xueshan", label: "雪山剑阵压阵，亲兵军心大乱", resolve: "combat", requiresFlag: [F.xueshanAlly],
            combatNpc: { name: "土司府中院亲兵", levelCap: 3 } },
          { flag: "quest_ts5_guard_baihua", label: "百花软筋散已下，半数亲兵手脚发软", resolve: "combat", requiresFlag: [F.baihuaAlly],
            combatNpc: { name: "土司府中院亲兵", levelCap: 2 } },
          { flag: "quest_ts5_guard_yuding", label: "随鱼定村猎户走暗渡奇袭路线绕过中院", resolve: "none", requiresFlag: [F.yudingAlly],
            narration: "鱼定村的人领你从后墙的旧水道摸进来，亲兵还朝着正门列阵，你已经站到了桑杰朵杰身后。" },
        ],
      },
      {
        id: "boss",
        requireLocation: FINALE_ROOM,
        playerHint: "与桑杰朵杰决战。",
        description: "桑杰朵杰终于站起来，解下锦袍搭在椅背上：「这把椅子，我坐了三十年。想要，自己来拿。」",
        completionFlag: "quest_ts5_boss",
        choices: [
          { flag: "quest_ts5_boss", label: "与桑杰朵杰决战", resolve: "combat", combatNpc: { name: "桑杰朵杰", levelCap: 5 } },
        ],
      },
      {
        id: "aftermath",
        requireLocation: FINALE_ROOM,
        playerHint: "桑杰朵杰倒下了，议事厅里等你定曲措乡往后怎么办。",
        description: "虎皮椅空了。梅朵站在厅口，格桑顿珠把长矛插在地上，满厅的人都在看你。",
        completionFlag: ["quest_ts5_regent", "quest_ts5_settle"],
        choices: [
          { flag: "quest_ts5_regent", label: "推举梅朵代管曲措乡，重丈田界", resolve: "none", requiresFlagAny: [F.meiduoRegent, F.meiduoBacked],
            narration: "梅朵接过土司印信，第一道令就是把三十年前的地契全部摊在议事厅，请各村头人来重新丈量田界。" },
          { flag: "quest_ts5_settle", label: "收缴印信，交格桑顿珠暂守土司府", resolve: "none",
            narration: "你把土司印信交到格桑顿珠手里。他接过来，没说话，只把印信揣进了怀里。" },
        ],
        onReach: {
          flags: ["tusi_finale_won"],
          byFlag: {
            quest_ts5_regent: { flags: ["tusi_meiduo_regency"] },
          },
        },
      },
    ],
  },
} };
