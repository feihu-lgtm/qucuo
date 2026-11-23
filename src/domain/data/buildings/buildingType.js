export const BUILDING_TYPE = {
  INN: "inn",           // 客栈：住宿回血
  WUGUAN: "wuguan",     // 武馆：购技/突破
  SMITHY: "smithy",     // 铁匠铺：武器护甲
  ESCORT: "escort",     // 镖局：护镖任务+防身器
  ANTIQUE: "antique",   // 古玩店：饰品
  SHOP: "shop",         // 综合商店
  MEDICINE: "medicine", // 药堂
  GAMBLING: "gambling", // 赌坊
  TRANSPORT: "transport", // 马车传送
  RESTAURANT: "restaurant", // 饭馆/酒楼
  TEMPLE: "temple",     // 神殿/大殿
  LIBRARY: "library",   // 藏经阁/书肆
  BANK: "bank",         // 钱庄
  PAWN: "pawn",         // 当铺
  CLOTH: "cloth",       // 成衣铺
  JEWELRY: "jewelry",   // 珠宝行
  HOSPITAL: "hospital", // 医馆（直接回血不推时间）
  FORGE: "forge",       // 铸剑坊
  BLACKMARKET: "blackmarket", // 黑市
  BOUNTY: "bounty",     // 官府/悬赏榜
  GROCERY: "grocery",   // 粮行/杂货
  THEATER: "theater",   // 戏楼
  TEAHOUSE: "teahouse", // 茶馆（情报）
  SECTSHOP: "sectshop", // 门派商坊（karma货币）
  GAMBLESTONE: "gamblestone", // 赌石料场
  PIGEON_COOP: "pigeon_coop", // 鸽子笼：每日免费领信鸽
  SECT_ENTRY: "sect_entry",   // 拜师堂：拜入门派，发弟子令牌
  AUCTION: "auction",         // 拍卖行：竞价拍品（有托儿抬价）
  KITCHEN: "kitchen",         // 烹饪台：六格槽位（料×4+技法+炊具）自炊出 buff
  CHEST: "chest",             // 库房木箱：存取物件（开局预填全套食材+调味料）
  FESTIVAL: "festival",       // 盛会会场：跑马大会赛程/下注/同游/夜话/子夜之变
  DUNGEON: "dungeon",         // 地宫探险：多层级节点探索与守卫切磋
};

export const BUILDING_TYPE_LABEL = {
  inn: "客栈", wuguan: "武馆", smithy: "铁匠铺", escort: "镖局", antique: "古玩店",
  shop: "商行", medicine: "药堂", gambling: "赌坊", transport: "驿站",
  restaurant: "饭馆", temple: "大殿", library: "藏经阁", bank: "钱庄",
  pawn: "当铺", cloth: "成衣铺", jewelry: "珠宝行", hospital: "医馆",
  forge: "铸剑坊", blackmarket: "黑市", bounty: "告示榜", grocery: "粮行",
  theater: "戏楼", teahouse: "茶馆", sectshop: "门派商坊", gamblestone: "玉石料场",
  pigeon_coop: "鸽子笼",
  sect_entry: "拜师堂", auction: "拍卖行", kitchen: "烹饪台", chest: "库房",
  festival: "盛会", dungeon: "地宫",
};

// 各据点建筑清单
// innPrice：普通客房单夜价格
// shopKey：对应 qucuoShops.js 里的 QUCUO_SHOPS 键名
