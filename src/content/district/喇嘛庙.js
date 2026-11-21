export default { district: {
喇嘛庙: {
    anchor: "山门",
    rooms: {
      山门: {
        x: 0, y: 0,
        desc: "依熊曲而建的宗教重地入口，殿宇间常有诵经声传出。",
        exits: { n: "大殿" },
      },
      大殿: {
        x: 0, y: -1,
        desc: "庄严的佛殿，花功德拜佛，偶尔会有顿悟感悟。",
        exits: { s: "山门", w: "藏经阁", e: "达摩药堂", n: "西厢僧舍" },
        buildingId: "temple_lama",
      },
      藏经阁: {
        x: -1, y: -1,
        desc: "存放经卷典籍之处，也收着些寻常买不到的杂书。",
        exits: { e: "大殿" },
        buildingId: "library_lama",
      },
      达摩药堂: {
        x: 1, y: -1,
        desc: "寺里的药堂，师父常年坐堂问诊，任务11相关的虎胆线索也从这里传出。",
        exits: { w: "大殿", s: "素斋" },
        buildingId: "medicine_lama",
        residentNpcName: "达摩药堂师父",
      },
      素斋: {
        x: 1, y: 0,
        desc: "寺里的素食堂，清淡养生。传闻某处小门通往荤食地下室，寺里讳莫如深。",
        exits: { n: "达摩药堂", s: "荤食地下室" },
        buildingId: "restaurant_lama",
      },
      荤食地下室: {
        x: 1, y: 1,
        desc: "嗯……这里和楼上大不一样。香气扑鼻，烛光昏黄，不问来路，不问因由。",
        exits: { n: "素斋" },
        // 复用既有 hasBasement 建筑设定的解锁触发，不新造判定逻辑
        unlockCondition: { type: "flag", flag: "unlocked_lama_basement" },
      },
      西厢僧舍: {
        x: 0, y: -2,
        desc: "住持的居所，清幽寂静，三十年的秘密就藏在这方寸之间。",
        exits: { s: "大殿" },
        residentNpcName: "喇嘛庙住持",
      },
    },
  }
} };
