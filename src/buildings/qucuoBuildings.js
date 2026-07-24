// 曲措乡建筑系统：每个据点拥有的固定建筑。
// 建筑不由AI生成，跟地图节点一样是手写的固定拓扑——
// AI负责在建筑框架里描述细节和NPC对话，不负责决定"这个地方有没有铁匠铺"。

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
};

export const BUILDING_TYPE_LABEL = {
  inn: "客栈", wuguan: "武馆", smithy: "铁匠铺", escort: "镖局", antique: "古玩店",
  shop: "商行", medicine: "药堂", gambling: "赌坊", transport: "驿站",
  restaurant: "饭馆", temple: "大殿", library: "藏经阁", bank: "钱庄",
  pawn: "当铺", cloth: "成衣铺", jewelry: "珠宝行", hospital: "医馆",
  forge: "铸剑坊", blackmarket: "黑市", bounty: "告示榜", grocery: "粮行",
  theater: "戏楼", teahouse: "茶馆", sectshop: "门派商坊", gamblestone: "玉石料场",
};

// 各据点建筑清单
// innPrice：普通客房单夜价格
// shopKey：对应 qucuoShops.js 里的 QUCUO_SHOPS 键名
// skillSet：对应 qucuoKungfu.js 里的 SKILL_CATALOG 键名
export const BUILDINGS_BY_LOCATION = {
  // ── 鱼定村（7 种，枢纽村） ──
  鱼定村: [
    {
      id: "inn_yiding", name: "歇马居", type: BUILDING_TYPE.INN, innPrice: 5,
      desc: "三曲交汇的老客栈，门匾褪色，炉火常年不灭，商旅猎人惯于落脚。",
    },
    {
      id: "shop_yiding", name: "鱼定商号", type: BUILDING_TYPE.SHOP, shopKey: "鱼定商号",
      desc: "村里最全的杂货铺，武器杂物一应俱全，掌柜是个寡言的汉子。",
    },
    {
      id: "restaurant_yiding", name: "老孙饭馆", type: BUILDING_TYPE.RESTAURANT, menuKey: "饭馆",
      desc: "村里唯一的饭馆，菜式简单，但牦牛骨汤是一绝，吃了腿脚有劲。",
    },
    {
      id: "transport_yiding", name: "驿站", type: BUILDING_TYPE.TRANSPORT,
      desc: "备有脚力和驾车人，花银两可直接抵达已探索的其他据点，不走山路。",
    },
    {
      id: "escort_yiding", name: "护镖站", type: BUILDING_TYPE.ESCORT, shopKey: "护镖站",
      desc: "接押送任务，货到对方手上结算。途中遭遇的可能性比单独走更高。",
    },
    {
      id: "grocery_yiding", name: "杂货铺", type: BUILDING_TYPE.GROCERY, shopKey: "杂货商人",
      desc: "杂货商人在此驻店，日用杂物、草药糌粑都有，是村里最热闹的角落。",
    },
    {
      id: "gambling_yiding", name: "赌坊", type: BUILDING_TYPE.GAMBLING, maxBet: 200,
      desc: "每日只能赌一次，按气运值决定输赢，也可以直接抽物品，看命。",
    },
  ],

  // ── 喇嘛庙（4 种，宗教重地） ──
  喇嘛庙: [
    {
      id: "restaurant_lama", name: "素斋", type: BUILDING_TYPE.RESTAURANT, menuKey: "素斋",
      hasBasement: true,
      desc: "寺里的素食堂，清淡养生。传闻某处小门通往荤食地下室，寺里讳莫如深。",
    },
    {
      id: "temple_lama", name: "大殿", type: BUILDING_TYPE.TEMPLE, karmaPerPray: 10,
      desc: "庄严的佛殿，花功德拜佛，偶尔会有顿悟感悟，七维属性可能有所增益。",
    },
    {
      id: "library_lama", name: "藏经阁", type: BUILDING_TYPE.LIBRARY,
      desc: "珍藏经卷的阁楼，免费阅读可增长见识，部分秘籍出售，武学亦有收录。",
    },
    {
      id: "medicine_lama", name: "达磨药堂", type: BUILDING_TYPE.MEDICINE, shopKey: "达磨药堂",
      desc: "喇嘛庙西厢的药堂，僧医兼职，以藏药为主，跌打外伤高原草药均有备货。",
    },
  ],

  // ── 天都镇（4 种，最繁华市镇） ──
  天都镇: [
    {
      id: "inn_tiandu", name: "天都行脚楼", type: BUILDING_TYPE.INN, innPrice: 10,
      desc: "天都镇最大的客栈，二层小楼，楼下卖酒，商贩走卒在此歇脚打听消息。",
    },
    {
      id: "smithy_tiandu", name: "孟记铁铺", type: BUILDING_TYPE.SMITHY, shopKey: "孟记铁铺",
      desc: "孟老汉开的铁匠铺，炉火熊熊，武器护甲一律现货，不接私打订单。",
    },
    {
      id: "escort_tiandu", name: "天都镖局", type: BUILDING_TYPE.ESCORT, shopKey: "天都镖局",
      desc: "走商护货的老字号，顺带卖些出行防身的实用器具给过路人。",
    },
    {
      id: "antique_tiandu", name: "玉器轩", type: BUILDING_TYPE.ANTIQUE, shopKey: "玉器轩",
      desc: "专做饰品古玩的买卖，货品良莠不齐，眼力好的人淘得到好东西。",
    },
    {
      id: "gamblestone_tiandu", name: "玉石料场", type: BUILDING_TYPE.GAMBLESTONE,
      desc: "玉器轩后院的赌石坊，堆满未开的原石。花钱进料，开三刀见涨见垮，一群人围着竞价，全凭眼力与胆识。温掌柜在此坐镇。",
    },
  ],

  // ── 玉泉寨（2 种，水路要道） ──
  玉泉寨: [
    {
      id: "inn_yuquan", name: "玉泉小栈", type: BUILDING_TYPE.INN, innPrice: 8,
      desc: "藏寨风格的小客栈，牛毛毡作床，青稞酒管够，朴实无华。",
    },
    {
      id: "wuguan_yuquan", name: "玉泉练武场", type: BUILDING_TYPE.WUGUAN, skillSet: "玉泉",
      desc: "玉泉寨猎人和牧民自发组的练武场，藏地摔跤和步法为主，平时也传外人。",
    },
  ],

  // ── 雪山派（2 种，隐世门派） ──
  雪山派: [
    {
      id: "wuguan_xueshan", name: "雪山练功堂", type: BUILDING_TYPE.WUGUAN, skillSet: "雪山",
      desc: "雪山派对弟子开放的练功场地，外人能进此堂，说明已得门派一定程度的认可。",
    },
    {
      id: "sectshop_xueshan", name: "门派商坊", type: BUILDING_TYPE.SECTSHOP, shopKey: "门派商坊",
      desc: "雪山派弟子才能进的商坊，货物以门派专属为主，不收银两，只认功德。",
    },
  ],

  // ── 锦官城（20 种，乡外门户） ──
  锦官城: [
    {
      id: "inn_jingguan", name: "锦官大车店", type: BUILDING_TYPE.INN, innPrice: 20,
      desc: "官道旁的大型客栈，商队马帮常年进出，服务比乡里好，也贵不少。",
    },
    {
      id: "shop_jingguan", name: "天下商行", type: BUILDING_TYPE.SHOP, shopKey: "天下商行",
      desc: "锦官城最大的综合商号，武器护甲饰品杂物一概备货，价格公道，货源稳定。",
    },
    {
      id: "wuguan_jingguan", name: "锦官武馆", type: BUILDING_TYPE.WUGUAN, skillSet: "锦官",
      desc: "锦官城江湖人汇聚之地，通行招式和内功基础都能在这里买到秘籍，无门槛限制。",
    },
    {
      id: "escort_jingguan", name: "锦官镖局", type: BUILDING_TYPE.ESCORT, shopKey: "锦官镖局",
      desc: "锦官城规模最大的镖局，防身器具和出行必备应有尽有，护镖任务也在此接。",
    },
    {
      id: "gambling_jingguan", name: "锦官赌坊", type: BUILDING_TYPE.GAMBLING, maxBet: 1000,
      desc: "赌注上限比鱼定村高很多，豪赌的人在这里，赢了一夜暴富，输了倾家荡产。",
    },
    {
      id: "transport_jingguan", name: "锦官驿站", type: BUILDING_TYPE.TRANSPORT,
      desc: "城里最大的驿站，车马目的地覆盖全乡所有据点；亦可寄书送礼、购置信鸽，脚程比乡里驿站更快。",
    },
    {
      id: "teahouse_jingguan", name: "清风茶馆", type: BUILDING_TYPE.TEAHOUSE,
      desc: "茶馆消息最灵通，花点银两听掌柜说故事，说不定能听到有用的江湖消息。",
    },
    {
      id: "restaurant_jingguan", name: "醉仙楼", type: BUILDING_TYPE.RESTAURANT, menuKey: "醉仙楼",
      desc: "锦官城最好的酒楼，菜式精细，佐酒话聊，临时战斗加成比村里饭馆更强。",
    },
    {
      id: "bank_jingguan", name: "永盛钱庄", type: BUILDING_TYPE.BANK,
      desc: "存取银两，跨据点余额共享。存款生息，不用把钱都带在身上了。",
    },
    {
      id: "pawn_jingguan", name: "聚宝当铺", type: BUILDING_TYPE.PAWN,
      desc: "质押物品换快钱，比卖价低一些，但还可以赎回，不是永久失去。",
    },
    {
      id: "cloth_jingguan", name: "云锦成衣铺", type: BUILDING_TYPE.CLOTH, shopKey: "云锦成衣铺",
      desc: "买了衣饰装备后魅力有所提升，AI叙述里也会引用你的外貌描述。",
    },
    {
      id: "library_jingguan", name: "文渊书肆", type: BUILDING_TYPE.LIBRARY,
      desc: "武学秘籍和见闻录都能买到，见闻录注入世界知识，秘籍直接入skills。",
    },
    {
      id: "grocery_jingguan", name: "百香斋", type: BUILDING_TYPE.GROCERY, shopKey: "百香斋",
      desc: "专卖香料和点心，作为礼物送给NPC时好感加成比普通物品高。",
    },
    {
      id: "jewelry_jingguan", name: "金玉行", type: BUILDING_TYPE.JEWELRY, shopKey: "金玉行",
      desc: "紫橙品质的饰品，价格昂贵，但穿上后战斗加成可观，也是收藏价值所在。",
    },
    {
      id: "hospital_jingguan", name: "杏林医馆", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
      desc: "直接付银两大幅回血，不需要推时间，比住客栈贵，但快。还能解毒。",
    },
    {
      id: "forge_jingguan", name: "铸剑坊", type: BUILDING_TYPE.FORGE,
      desc: "拿材料加银两定制武器，品质受气运影响，交货需等24时间单位。",
    },
    {
      id: "blackmarket_jingguan", name: "暗巷入口", type: BUILDING_TYPE.BLACKMARKET, shopKey: "暗巷",
      desc: "低调进出，赃物和非常规物品（暗器/毒药）都能买到，功德会减少。",
    },
    {
      id: "bounty_jingguan", name: "官府告示栏", type: BUILDING_TYPE.BOUNTY,
      desc: "悬赏任务在这里接，击败指定目标后回来领赏，官方背景，功德增加。",
    },
    {
      id: "grocery2_jingguan", name: "永丰粮行", type: BUILDING_TYPE.GROCERY, shopKey: "永丰粮行",
      desc: "干粮和高原食材，路上的口粮基础，高原人参是这里的镇店之宝。",
    },
    {
      id: "theater_jingguan", name: "锦华戏楼", type: BUILDING_TYPE.THEATER, menuKey: "戏楼",
      desc: "看戏花钱，魅力可以有所提升，邀NPC同赏还能加深关系。",
    },
  ],
};

// 返回某据点的建筑列表，处理"曲措乡·鱼定村"这类带前缀的地名
export function getBuildingsForLocation(locationName) {
  if (!locationName) return [];
  const key = locationName.includes("·") ? locationName.split("·").pop() : locationName;
  return BUILDINGS_BY_LOCATION[key] || [];
}

// 返回建筑类型对应的中文标签
export function getBuildingTypeLabel(type) {
  return BUILDING_TYPE_LABEL[type] || type;
}
