export default { quest: {
  tangmen_1_anxianglaike: {
    id: "tangmen_1_anxianglaike",
    type: "QT_TALK",
    title: "唐1·暗巷来客",
    giver: "唐三少",
    giverId: "resident_tangsanshao",
    localOnly: true,
    description: "锦官城暗巷的唐门铺面不问来路，只认银货。但有一批打着三瓣竹印的货，从未走过柜上的账。",
    stages: [
      {
        id: "ask",
        requireLocation: { district: "锦官城", inner: "唐门暗巷" },
        requiresShopSpendOrItem: { shopKey: "唐门暗器", amount: 50, itemId: "tangmen_evidence_poison_arrow" },
        playerHint: "在唐门暗器铺消费满五十两，或带鱼定土司护卫厅的毒箭残簇找唐三少。",
        description: "唐三少听你问起曲措暗器，冷着脸说认不得。等最后一位客人出门，他以算盘压住一张纸条，推到你手边：城隍庙旧墙后见。",
        completionFlag: "quest_tang1_meeting",
      },
      {
        id: "meet",
        giver: null,
        requireLocation: { district: "锦官城", inner: "城隍庙旧墙" },
        playerHint: "去暗巷旁的城隍庙旧墙赴约。",
        description: "唐三少从旧墙阴影里走出：「三瓣竹印确是我唐家的，可柜上没有这笔账。南门有车茶砖要走，你翻翻箱底，别只看封皮。」",
        completionFlag: "quest_tang1_tip",
      },
      {
        id: "intercept",
        giver: null,
        requireLocation: { district: "锦官城", inner: "南门竹径" },
        playerHint: "去南门竹径截查茶砖骡车。",
        description: "车旁的押车人把缰绳缠在腕上。雨水冲淡了货签，箱底仍看得出「唐堡二房」的私戳，收货一栏只写「陆记」。",
        completionFlag: ["quest_tang1_stealth", "quest_tang1_fight"],
        choices: [
          { flag: "quest_tang1_stealth", label: "暗查取证", resolve: "none", narration: "你等押车人转身牵骡，把箱底私戳和「陆记」抄入袖中的纸上。车照常出了南门，没人发觉。" },
          { flag: "quest_tang1_fight", label: "硬闯截货", resolve: "combat", combatNpc: { name: "蒙面押车头领", levelCap: 4 } },
        ],
        onReach: {
          items: [{ name: "茶砖货单抄录", category: "misc", quality: "白", desc: "抄有唐堡二房私戳，收货人写作「陆记」。" }],
          byFlag: {
            quest_tang1_fight: { money: 30, items: Array.from({ length: 2 }, () => ({ name: "毒蝎粉", fromCatalog: true })) },
          },
        },
      },
      {
        id: "report",
        requireLocation: { district: "锦官城", inner: "唐门暗巷" },
        playerHint: "回唐门暗器铺，把骡车货单交给唐三少。",
        description: "唐三少盯着「陆记」沉默许久，才取纸磨墨：「我只能送你走到桥头。这信给老太太，到了堡里，先听她问。」",
        completionFlag: "quest_tang1_report",
        onReach: {
          money: 120,
          favorability: { 唐三少: 15 },
          flags: ["tangmen_invited"],
          items: [{ name: "蜀南竹径引荐信", category: "misc", quality: "白", desc: "唐三少亲笔所写，信封上按着三瓣竹印。" }],
        },
      },
    ],
    rewardText: "唐三少写了引荐信。沿锦官城南行可到蜀南唐堡，进竹影正堂拜见唐老太。",
  },
} };
