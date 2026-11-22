export default { residentGroup: {
大草甸: [
    // ── 血刀门（大草甸·血刀营地·全员敌对）──
    {
      name: "厉天行", id: "resident_litianxing", levelCap: 5,
      brief: "血刀门主，四十岁，瘦，眼窝深陷",
      personality: "笑起来露一嘴黄牙；刀从不擦——「擦了就没味了」",
      carry: [
        { name: "饮血狂刀", category: "weapon", quality: "橙" },
        { name: "黑风寨牛皮重铠", category: "armor", quality: "紫" },
        { name: "虎乳牙", category: "accessory", quality: "蓝" },
        { name: "血刀大法", category: "misc", quality: "橙" },
        { name: "黑风寨土烧", category: "misc", quality: "绿" },
        { name: "金疮药", category: "misc", quality: "白" },
        { name: "风干牦牛肉", category: "misc", quality: "白" },
      ],
    },
    {
      name: "血刀门徒·初七", innerRoom: "血刀营地", id: "resident_xuedao_chuqi", levelCap: 2,
      brief: "血刀门徒，没有名字只有编号",
      personality: "不说话，只看你带没带兵器；带了就笑，不带也笑",
      carry: [
        { name: "黑风断刃", category: "weapon", quality: "绿" },
        { name: "熊皮坎肩", category: "armor", quality: "绿" },
        { name: "黑风寨木牌", category: "accessory", quality: "白" },
        { name: "牦牛骨扳指", category: "accessory", quality: "白" },
        { name: "黑风寨土烧", category: "misc", quality: "绿" },
        { name: "止血散", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
      ],
    },
    {
      name: "血刀门徒·十三", innerRoom: "血刀营地", id: "resident_xuedao_shisan", levelCap: 2,
      brief: "血刀门徒，没有名字只有编号",
      personality: "不说话，只看你带没带兵器；带了就笑，不带也笑",
      carry: [
        { name: "黑风断刃", category: "weapon", quality: "绿" },
        { name: "熊皮坎肩", category: "armor", quality: "绿" },
        { name: "黑风寨木牌", category: "accessory", quality: "白" },
        { name: "牦牛骨扳指", category: "accessory", quality: "白" },
        { name: "黑风寨土烧", category: "misc", quality: "绿" },
        { name: "止血散", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
      ],
    },
    {
      name: "血刀门徒·廿三", innerRoom: "血刀营地", id: "resident_xuedao_niansan", levelCap: 2,
      brief: "血刀门徒，没有名字只有编号",
      personality: "不说话，只看你带没带兵器；带了就笑，不带也笑",
      carry: [
        { name: "黑风断刃", category: "weapon", quality: "绿" },
        { name: "熊皮坎肩", category: "armor", quality: "绿" },
        { name: "黑风寨木牌", category: "accessory", quality: "白" },
        { name: "牦牛骨扳指", category: "accessory", quality: "白" },
        { name: "黑风寨土烧", category: "misc", quality: "绿" },
        { name: "止血散", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
      ],
    },
    {
      name: "虎王", id: "beast_tiger_king", levelCap: 5,
      beast: true, unlearnable: true,
      brief: "熊山温泉一带的吊睛白额巨虎",
      personality: "凶威慑人的山君，虎胆三重门的核心，寻常人近温泉便被逼退",
      guaranteedLoot: [
        { name: "虎胆", category: "misc", quality: "橙" },
        { name: "虎王牙", category: "misc", quality: "蓝" },
        { name: "虎王筋", category: "misc", quality: "蓝" },
      ],
    },
    {
      name: "狼王", id: "beast_wolf_king", levelCap: 4,
      beast: true, unlearnable: true,
      brief: "大草甸深处的银灰独眼巨狼",
      personality: "独眼狡黠、凶戾难驯，正是当年在大草甸咬死管家独子的那头狼王",
      guaranteedLoot: [
        { name: "狼王牙", category: "misc", quality: "蓝" },
      ],
    },
  ]
} };
