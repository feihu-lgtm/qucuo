export default { district: {
黑风寨: {
    anchor: "寨门",
    rooms: {
      寨门: {
        x: 0, y: 0,
        desc: "灌木遮蔽的羊肠小道尽头，寨门不显眼，山3任务里少年在此引路。",
        exits: { n: "寨内公共区", w: "卓央家", e: "伙房" },
      },
      卓央家: {
        x: -1, y: 0,
        desc: "巴桑之妹卓央的家，靠寨门边缘，方便巴桑送东西不进寨。",
        exits: { e: "寨门" },
        residentNpcName: "卓央",
      },
      伙房: {
        x: 1, y: 0,
        desc: "露天大灶炊烟不断，老阿雅婶掌勺；出征前一席饭全员同吃是寨规。",
        exits: { w: "寨门" },
        buildingId: "kitchen_heifeng",
        residentNpcName: "老阿雅婶",
      },
      寨内公共区: {
        x: 0, y: -1,
        desc: "山坳里的木寨，老人晒草药、妇人纳鞋底，寨规刻在岩壁上——不像匪窝，像村子。",
        exits: { s: "寨门", n: "寨后岩洞", w: "后山草坡", e: "山寨货栈" },
      },
      山寨货栈: {
        x: 1, y: -1,
        desc: "岩壁下凿出的石仓，码着下山得的正经货和寨里自酿的土烧；仓头按寨规做买卖。",
        exits: { w: "寨内公共区" },
        buildingId: "sectshop_heifeng",
      },
      后山草坡: {
        x: -1, y: -1,
        desc: "嘎则与雪团常在此处玩耍，虎1\"迷途\"/虎2\"下山\"/虎3\"不还\"的日常起点。",
        exits: { e: "寨内公共区", w: "后山演武坪" },
        residentNpcName: "嘎则",
      },
      后山演武坪: {
        x: -2, y: -1,
        desc: "碎石坪上兵器架着几杆红缨枪，寨里刀口在此对练；彭措管场子，不许下黑手。",
        exits: { e: "后山草坡" },
        buildingId: "wuguan_heifeng",
        residentNpcName: "彭措",
      },
      寨后岩洞: {
        x: 0, y: -2,
        desc: "巴桑见玩家的地方，只一块青石板摊着狼曲地形图，山3.5/山4/山5均在此发生。",
        exits: { s: "寨内公共区" },
        buildingId: "sect_entry_heifeng",
        residentNpcName: "巴桑",
      },
    },
  }
} };
