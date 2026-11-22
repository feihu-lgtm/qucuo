export default { quest: {
  emei_1_xichengshiyao: {
    id: "emei_1_xichengshiyao",
    type: "QT_TALK",
    title: "峨1·西城施药",
    giver: "了因师太",
    giverId: "resident_liaoyin",
    localOnly: true,
    description: "慈济佛堂抬进来两个昏迷的人：一个是从曲措逃税南下的老牧民，一个是护送流民途中中了冷箭的丐帮三星分舵报信弟子。",
    stages: [
      {
        id: "vigil",
        requireLocation: { district: "锦官城", inner: "慈济佛堂" },
        playerHint: "在慈济佛堂找了因师太，帮她熬药守夜。",
        description: "你守着药炉熬到后半夜，发现新送来的一篓解毒草药里混着西域曼陀粉，闻多了人要昏厥。药篓底沾着城西的黄泥。",
        completionFlag: "quest_emei1_vigil",
      },
      {
        id: "temple",
        giver: null,
        requireLocation: { district: "锦官城", inner: "城西破庙" },
        playerHint: "循着药篓上的泥痕，去城西破庙。",
        description: "破庙里两个乔装车夫正往稻草堆里摸，要灭口躲在神像后的丐帮弟子。见你进门，两人抽出腰间短刀。",
        completionFlag: "quest_emei1_fight",
        choices: [
          { flag: "quest_emei1_fight", label: "击退眼线", resolve: "combat", combatNpc: { name: "天龙教外围眼线", levelCap: 7 } },
        ],
        onReach: {
          items: [{ name: "曲措旧田契残页", category: "misc", quality: "绿", desc: "半张从老牧民贴身毡片里取出的田契，带着退墨药水的异味。" }],
        },
      },
      {
        id: "report",
        requireLocation: { district: "锦官城", inner: "慈济佛堂" },
        playerHint: "回慈济佛堂，把田契残页交给了因师太，并决定怎么处置被擒的眼线。",
        description: "眼线招认是奉大草甸血刀部之命，截杀带出曲措消息的逃民。了因师太对着灯看那半张残页，问你被擒的人怎么办。",
        completionFlag: ["quest_emei1_official", "quest_emei1_cripple"],
        choices: [
          { flag: "quest_emei1_official", label: "交官府法办", resolve: "none", narration: "你押着眼线去官府告示栏交给柳青鸢。了因师太合掌：「守法亦是慈悲。」" },
          { flag: "quest_emei1_cripple", label: "废武逐出城", resolve: "none", narration: "你依江湖规矩废了眼线的武功，赶出西城门。虚白道姑和铁莲和尚听说了，都赞你果决护民。" },
        ],
        onReach: {
          money: 80,
          items: Array.from({ length: 3 }, () => ({ name: "清心避瘴散", fromCatalog: true })),
          factionRep: { 峨眉派: 15, 青城派: 3, 丐帮三星分舵: 3, 天龙教: -8 },
          byFlag: {
            quest_emei1_official: { factionRep: { 锦官城: 5 }, favorability: { 了因师太: 10 }, flags: ["flag_emei_tusi_deed_hint"] },
            quest_emei1_cripple: { reputation: 3, favorability: { 虚白道姑: 10, 铁莲和尚: 10 } },
          },
        },
      },
    ],
    rewardText: "了因师太收下田契残页，说要请玄尘师太过目。峨眉剑庐上下从此记得你在西城的这一夜。",
  },
} };
