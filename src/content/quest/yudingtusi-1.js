// 鱼定土司府任务线（合稿·土司府第 4 节）。土司府不可拜入，玩家是编外客卿：主线 府1~府3 与支线 府支1~3；
// 府4「旧刃问心」牵着雪山派三十年宿怨和终局，等终局接线再做。门槛按 #237 顶层写法，全部 ≤ 100。
// 奖励照合稿原值；土司府涨声誉时黑风寨、玉泉寨、雪山派的联动扣分由 factionRepDeltas 统一结算，这里不手写。
const TS = "鱼定土司府";
const at = (inner, district = "鱼定土司") => ({ district, inner });
const catalog = (name, count = 1) => Array.from({ length: count }, () => ({ name, fromCatalog: true }));

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
            quest_ts1_pay: { factionRep: { [TS]: 10, 鱼定村: 8, 玉泉寨: 5 }, money: -50, items: catalog("土司府云雷铜牌"), reputation: 3 },
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
            quest_ts2_evidence: { factionRep: { [TS]: 12 }, favorability: { 格桑顿珠: 20 }, items: catalog("藏红花活血膏", 2) },
            quest_ts2_burn: { factionRep: { [TS]: -35, 天龙教: -20, 黑风寨: 25, 玉泉寨: 10, 青城派: 10 }, reputation: 8 },
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
            quest_ts3_copy: { factionRep: { 鱼定村: 15, 玉泉寨: 15, 锦官城: 10 }, favorability: { 洛桑平措: 15 } },
            quest_ts3_present: { factionRep: { [TS]: -40, 鱼定村: 20, 玉泉寨: 20 }, favorability: { 桑杰朵杰: 10, 梅朵: 15 }, reputation: 5 },
            quest_ts3_burn: { factionRep: { [TS]: 35, 鱼定村: -20 }, money: 120, items: catalog("镇边虎纹玉佩") },
          },
        },
      },
    ],
    rewardText: "旧契的事了结了一半。桑杰朵杰书房后那道窄门，你如今知道怎么进了。",
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
} };
