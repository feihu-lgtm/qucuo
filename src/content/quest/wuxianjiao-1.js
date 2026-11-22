export default { quest: {
  wuxianjiao_1_zilanwenjing: {
    id: "wuxianjiao_1_zilanwenjing",
    type: "QT_TALK",
    title: "蛊1·紫岚问径",
    giver: "苏小青",
    giverId: "resident_suxiaoqing",
    localOnly: true,
    description: "雅江南麓的毒瘴传闻越传越凶，都说南山里有苗疆妖女放毒害马。可在西城门外的瘴林边缘，你撞见的却是两名峨眉剑庐弟子持剑围住一个采药女。",
    stages: [
      {
        id: "meet",
        giver: null,
        requireLocation: { district: "雅江", inner: "西城门" },
        playerHint: "去雅江西城门外的瘴林边缘看看传闻里的「苗疆妖女」。",
        description: "两名峨眉弟子剑尖指着药篓里的姑娘：「昨日官道两匹商马被毒死，不是你五仙教干的还有谁？」姑娘抱着药篓退到崖边，怀里的小竹蛇吓得钻进袖口。",
        completionFlag: ["quest_wx1_peace", "quest_wx1_fight"],
        choices: [
          { flag: "quest_wx1_peace", label: "理证息争", resolve: "none", narration: "你蹲下查看商马尸体——毒发症状是「赤蜈腐骨散」，可苏小青药篓里只有治蛇伤的草药。峨眉弟子盯着你挑出的疑点半晌，收剑退回锦官城：「若真是有人嫁祸，此事还要查。」" },
          { flag: "quest_wx1_fight", label: "拔刀硬护", resolve: "combat", combatNpc: { name: "峨眉剑庐巡山弟子", levelCap: 7 } },
        ],
        onReach: {
          flags: ["wuxian_invited"],
          favorability: { "苏小青": 20 },
          byFlag: {
            quest_wx1_peace: { factionRep: { 峨眉派: 3 }, favorability: { "龙汐月": 10 } },
            quest_wx1_fight: { factionRep: { 峨眉派: -10, 五仙教: 5 } },
          },
        },
      },
      {
        id: "escort",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "紫岚藤桥" },
        playerHint: "护送受伤的苏小青穿过紫岚毒雾，踏上雾隐寨的紫岚藤桥。",
        description: "苏小青含着腌姜带你穿过毒雾：「别碰两边的藤叶，沾了要痒三天。」她解开襟口一只小香囊递过来——有了这个记号，崖壁里的吹箭就不会对准你了。",
        completionFlag: "quest_wx1_escort",
        onReach: {
          favorability: { "苏小青": 10 },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "五仙灵坛" },
        playerHint: "过紫岚藤桥往北，进五仙灵坛拜见教主龙汐月。",
        description: "青石坪上五根黑木柱盘着蛇蜈蝎蟾守宫。廊下把玩银鞭的少女抬眼一笑：「外头都说苗疆女子心狠——可我的银蛇咬人前，还会先响三声铃铛呢。小青既认你做了救命恩人，这寨子你随便走。」麻九娘在柱影里冷眼旁观，没说话。",
        completionFlag: "quest_wx1_report",
        onReach: {
          money: 80,
          favorability: { "龙汐月": 15 },
          factionRep: { 五仙教: 10 },
          items: [
            { name: "防瘴紫苏囊", fromCatalog: true },
            { name: "清瘴丸", fromCatalog: true },
            { name: "清瘴丸", fromCatalog: true },
            { name: "清瘴丸", fromCatalog: true },
          ],
        },
      },
    ],
    rewardText: "龙汐月赐下防瘴紫苏囊。雾隐寨的内层门户从此为你敞开——百蛊药房和秘珍坊的货色，要看你在五仙教的名声。",
  },
} };
