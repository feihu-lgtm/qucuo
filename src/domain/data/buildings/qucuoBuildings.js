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
  PIGEON_COOP: "pigeon_coop", // 鸽子笼：每日免费领信鸽
  SECT_ENTRY: "sect_entry",   // 拜师堂：拜入门派，发弟子令牌
  AUCTION: "auction",         // 拍卖行：竞价拍品（有托儿抬价）
  KITCHEN: "kitchen",         // 烹饪台：六格槽位（料×4+技法+炊具）自炊出 buff
  CHEST: "chest",             // 库房木箱：存取物件（开局预填全套食材+调味料）
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
};

// 各据点建筑清单
// innPrice：普通客房单夜价格
// shopKey：对应 qucuoShops.js 里的 QUCUO_SHOPS 键名
// skillSet：对应 qucuoKungfu.js 里的 SKILL_CATALOG 键名
export const BUILDINGS_BY_LOCATION = {
  蜀南唐堡: [
    {
      id: "wuguan_tangmen", name: "千机演武坪", type: BUILDING_TYPE.WUGUAN, skillSet: "唐门",
      desc: "满地机关暗桩与会转身的铁皮假人，练的不是堂堂正正的招架，是在别人眨眼的半息里把暗器送进缝隙的本事。",
    },
    {
      id: "sectshop_tangmen", name: "唐堡内库", type: BUILDING_TYPE.SECTSHOP, shopKey: "唐门暗器",
      desc: "不对生客开放的石砌货房，凡本门弟子与信重客卿凭令牌入内，方能取到暗巷铺面绝不外摆的精巧机弩与高阶解毒秘药。",
    },
    {
      id: "hospital_tangmen", name: "试毒药庐", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
      desc: "既是练毒的灶，也是救命的堂；世上最狠的毒往往和最灵的解药同出一炉，只要出得起银子，断气前总能拉回来半口。",
    },
  ],
  // ── 广汉·丐帮三星分舵（合稿·丐帮 2.3；拜师堂等拜入接线后再开） ──
  广汉: [
    {
      id: "teahouse_gaibang_chashi", name: "察世茶棚", type: BUILDING_TYPE.TEAHOUSE,
      desc: "镇口老槐树下搭的一顶破油布棚，粗瓷大碗盛着三分茶叶七分沫的川北老荫茶。茶不值两文钱，但花点碎银聊上几句，雅江到雪山的马蹄声都能听个七七八八。",
    },
    {
      id: "wuguan_gaibang_zhuping", name: "破庙竹坪", type: BUILDING_TYPE.WUGUAN, skillSet: "丐帮",
      desc: "庙前一块踩得比石板还硬的黄土坪，立着几排缺口累累的青竹桩。铁拐胡三天天拄着铁拐在坪边骂人，说叫花子的功夫不在好看，只在挨了打还能把对方绊个狗吃屎。",
    },
    {
      id: "sectshop_gaibang", name: "分舵义坊", type: BUILDING_TYPE.SECTSHOP, shopKey: "三星分舵商坊",
      desc: "藏在粥棚后耳房里的门派杂货柜，由白婶拿把缺齿铁算盘守着。卖的都是叫花子走南闯北攒下的实在物件，外客按规矩给钱，自己人凭交情能折。",
    },
    {
      id: "pigeon_gaibang", name: "三星鸽舍", type: BUILDING_TYPE.PIGEON_COOP, dailyPigeons: 1,
      desc: "搭在西厢房梁上的三层竹笼，养着川西飞得最稳的灰背山鸽。鸽爪上的小竹筒跑过雪山风雪，也穿过血刀部的刀林。",
    },
    {
      id: "kitchen_gaibang_zhoupeng", name: "破庙大灶", type: BUILDING_TYPE.KITCHEN,
      desc: "三口生铁大锅连灶而砌，常年飘着糙米粥与叫化土鸡的焦泥香。白婶嘴上嫌你费柴，真要借灶台炖锅肉汤，她反手就往你手里塞一把干花椒。",
    },
    {
      id: "inn_gaibang_xiedian", name: "荒庙草铺", type: BUILDING_TYPE.INN, innPrice: 10,
      desc: "东厢房里铺满晒干的新稻草，窗纸糊着泛黄的旧告示，夜里漏风却胜在干净安全。严九斤说出门在外讲究个落脚舒心，连血刀贼都不敢摸到这儿来。",
    },
  ],
  // ── 鱼定村（7 种，枢纽村） ──
  鱼定村: [
    {
      id: "pigeon_coop_xibian", name: "鸽子笼", type: BUILDING_TYPE.PIGEON_COOP, dailyPigeons: 2,
      desc: "溪边小屋屋檐下钉着的一只竹编鸽笼，两只灰鸽咕咕地叫，脚环上刻着编号。原先它只是家园面板里的一个图标，现在挂回屋檐底下——站在院子里才够得着。",
    },
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
    {
      id: "pigeon_coop_yiding", name: "鸽子笼", type: BUILDING_TYPE.PIGEON_COOP, dailyPigeons: 3,
      desc: "村口老槐树下支着几间竹编鸽笼，看笼的老汉每日清晨放三只信鸽出来，任由往来客商领去，图的是曲措乡这条邮路越走越熟。",
    },
    {
      id: "forge_yiding", name: "铁匠铺", type: BUILDING_TYPE.FORGE,
      desc: "村东头一间冒着黑烟的铁匠铺，老铁匠祖上三代打铁，寻常农具兵器都能打，也接客人拿料定制的活计。",
    },
    {
      id: "kitchen_xibian", name: "溪边小屋·灶房", type: BUILDING_TYPE.KITCHEN,
      desc: "灶台上铁锅铜壶齐整，灶膛余烬未冷。溪边小屋的灶房，一口旧铁锅炖炒皆可。有食材就能开火，自炊出 buff。",
    },
    {
      id: "chest_xibian", name: "溪边小屋·库房", type: BUILDING_TYPE.CHEST, house: "溪边小屋",
      desc: "起居室床底那只铁皮包角的旧木箱。开张时里头已备下一套食材调味料——是这屋子原先的主人留下的家底。",
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
      id: "grocery_tiandu", name: "天都香行", type: BUILDING_TYPE.GROCERY, shopKey: "天都香行",
      desc: "欢喜教的明面铺子，专卖香料和点心，作为礼物送给NPC时好感加成比普通物品高。",
    },
    {
      id: "smithy_tiandu", name: "孟记铁铺", type: BUILDING_TYPE.SMITHY, shopKey: "孟记铁铺", craft: "forge",
      desc: "孟老汉开的铁匠铺，炉火熊熊，武器护甲现货齐全，也接拿料定制的活计。",
    },
    {
      id: "escort_tiandu", name: "天都镖局", type: BUILDING_TYPE.ESCORT, shopKey: "天都镖局",
      desc: "走商护货的老字号，顺带卖些出行防身的实用器具给过路人。",
    },
    {
      id: "antique_tiandu", name: "玉器轩", type: BUILDING_TYPE.ANTIQUE, shopKey: "玉器轩", craft: "jade",
      desc: "专做饰品古玩的买卖，货品良莠不齐，眼力好的人淘得到好东西。也接玉器定制，拿料来便能雕。",
    },
    {
      id: "gamblestone_tiandu", name: "玉石料场", type: BUILDING_TYPE.GAMBLESTONE,
      desc: "玉器轩后院的赌石坊，堆满未开的原石。花钱进料，开三刀见涨见垮，一群人围着竞价，全凭眼力与胆识。温掌柜在此坐镇。",
    },
    {
      id: "kitchen_shanbie", name: "山间别墅·大厨房", type: BUILDING_TYPE.KITCHEN,
      desc: "灶台比寻常人家大三倍，调料架、烤炉俱全。山间别墅的大厨房，能烹高级料理。",
    },
    {
      id: "chest_shanbie", name: "山间别墅·库房", type: BUILDING_TYPE.CHEST, house: "山间别墅",
      desc: "二楼主卧那只大衣柜，空得很，正好放东西。柜底也备着一套食材家底。",
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
      desc: "沈既白打理的石木杂轩，架上除了寒铁兵器与雪山药膏，还替门人备着从鱼定村背上来的粗盐和酥油茶。外客只按规矩买卖，门墙中人方能见识里柜的真货。",
    },
    {
      id: "sectentry_xueshan", name: "拜师堂", type: BUILDING_TYPE.SECT_ENTRY,
      desc: "内堂正中，何雨谢坐镇处。掌门不在山上这些年，收不收徒都是她一句话。入了门便是雪山派弟子，领一枚令牌——那令牌也是弟子别院的钥匙。",
    },
    {
      id: "kitchen_bieyuan", name: "弟子别院·灶房", type: BUILDING_TYPE.KITCHEN,
      desc: "弟子别院西厢的小灶，何雨谢偶尔在此给弟子炖雪鸡汤。灶膛里松柴火常年不熄。",
    },
    {
      id: "chest_bieyuan", name: "弟子别院·库房", type: BUILDING_TYPE.CHEST, house: "弟子别院",
      desc: "东厢卧房床头那只小木箱，放私物刚好。箱底也有一份食材家底。",
    },
    {
      id: "inn_xueshan", name: "雪山客舍", type: BUILDING_TYPE.INN, innPrice: 15,
      desc: "贴着山门东侧砌出的四间避风石舍，炕底连着地龙火道，被褥带着松针晒过的干爽气。若遇大雪封道，山门也绝不把赶路人关在风雪外头。",
    },
    {
      id: "hospital_xueshan_wenquan", name: "后山温泉", type: BUILDING_TYPE.HOSPITAL,
      desc: "雪崖裂隙间涌出的滚烫硫磺热泉，白雾终年不散，浸入半炷香便能逼出深骨寒毒与内外暗伤。何雨谢立了规矩：一炷香便得起身，再泡下去补的是懒，不是气。",
    },
    {
      id: "library_xueshan", name: "寒玉旧剑阁", type: BUILDING_TYPE.LIBRARY,
      desc: "深藏内堂后壁的寒玉暗阁，木架上封存着雪山百年剑论、川西正道旧函与三十年前的未完手札。落灰极厚，却处处擦拭得没有半点潮霉。",
    },
  ],

  // ── 锦官城（20 种，乡外门户） ──
  锦官城: [
    {
      id: "tangmen_shop", name: "唐门暗器铺", type: BUILDING_TYPE.BLACKMARKET, shopKey: "唐门暗器",
      desc: "暗巷尽头一扇黑漆门，门上没招牌，只钉着一枚三棱带血槽的暗器当门钉。门后是唐门的外围铺面：暗器、毒药、解药都卖，不赊账，不问用途。",
    },
    {
      id: "sect_entry_emei", name: "听竹轩·拜师堂", type: BUILDING_TYPE.SECT_ENTRY, sect: "峨眉派",
      desc: "设在剑庐中轴正厅的入门堂口，案上供着青玉弟子令与一卷《峨眉清规》。",
    },
    {
      id: "sectshop_emei", name: "剑庐库房·锻簪坊", type: BUILDING_TYPE.SECTSHOP, shopKey: "峨眉坊",
      desc: "后院铁棚与库房合设的门派商坊，由簪娘与知客尼共同打理。",
    },
    {
      id: "hospital_emei_fotang", name: "慈济佛堂·施药棚", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
      desc: "了因师太坐镇的济世医堂，药炉终日不熄，连城中老郎中也常来讨教针法。",
    },
    {
      id: "library_emei_jingge", name: "抄经堂·藏经阁", type: BUILDING_TYPE.LIBRARY,
      desc: "临窗一排长案沾满墨痕，半壁收佛经医案，半壁藏道书与蜀西江湖杂录。",
    },
    {
      id: "wuguan_emei", name: "峨眉剑庐", type: BUILDING_TYPE.WUGUAN, skillSet: "峨眉",
      desc: "锦官城南三进小院，院中一株老银杏。正堂供普贤菩萨，剑架靠墙十几柄剑擦得锃亮。尼姑和道姑坐一张桌上喝茶——峨眉佛道双修，不拘形迹。男弟子入门先抄三个月经，「心不静，剑不稳」。",
    },
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
      id: "auction_jingguan", name: "宝丰拍卖行", type: BUILDING_TYPE.AUCTION,
      desc: "聚宝当铺隔壁。死当的、抄家的、来路不明的物件都在这张红布桌上过一遍手。行里养着托儿，价抬得起来——但抬到一个数就收手，真把客人挤走了他们一分不赚。",
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
    {
      id: "kitchen_shuwang", name: "蜀王庄·大厨房", type: BUILDING_TYPE.KITCHEN,
      desc: "倒座房的大厨房，灶台蒸笼案板俱全，够摆一桌酒席。蜀王庄的厨房，可烹宴席。",
    },
    {
      id: "chest_shuwang", name: "蜀王庄·库房", type: BUILDING_TYPE.CHEST, house: "蜀王庄",
      desc: "后院书房那只紫檀小匣，虽空却精致。匣底也压着一份食材家底。",
    },
  ],

  // ── 贡措海（1 种，令狐冲墓） ──
  贡措海: [
    {
      // 【原来是 TEMPLE·独孤九剑根本学不了】它挂着 skillSet:"独孤"，但 TEMPLE 类型
      // 渲染的是拜祭殿（求karma），压根不读 skillSet——描述里承诺的「外功≥80可参悟
      // 习得」从来没有落地过，两门独孤武学（独孤九剑/剑冢独坐）在全图无处可学。
      // 改成 WUGUAN 才走得到授业界面。它不卖钱，走"参悟"路径：price 0 + 门槛。
      id: "dugu_tomb", name: "令狐冲墓", type: BUILDING_TYPE.WUGUAN, skillSet: "独孤",
      desc: "华山令狐冲之墓。墓壁刻有独孤九剑剑诀，笔锋斩石三分。剑诀不授不卖，只看你自己看不看得懂——外功够了，站在壁前自然就懂了。",
    },
  ],

  // ── 雅江（6 种，雨城竹海·青城派） ──
  雅江: [
    {
      id: "restaurant_yajiang", name: "青衣楼", type: BUILDING_TYPE.RESTAURANT, menuKey: "冷锅鱼",
      desc: "江门街最大的冷锅鱼老字号。冷锅底料铺上七分熟江团鱼片，不开火先吃鱼，一锅两吃。雅江人待客必点。",
    },
    {
      id: "shop_yajiang", name: "雅纸铺", type: BUILDING_TYPE.SHOP, shopKey: "雅纸铺",
      desc: "青衣江竹子做的纸，薄而韧，墨迹存百年不褪。兼营竹编器物、日用杂货。",
    },
    {
      id: "transport_yajiang", name: "西城门驿站", type: BUILDING_TYPE.TRANSPORT,
      desc: "驿道尽头界碑「曲措乡界」。骡马夫专做最后一段路的生意——再往里走官道没了。",
    },
    {
      id: "temple_yajiang", name: "伏龙观", type: BUILDING_TYPE.TEMPLE, karmaPerPray: 10,
      desc: "离堆顶上供奉李冰父子。最后一进悬在崖边，推窗即是奔腾岷江。老道士说这是李冰在下面翻身。",
    },
    {
      id: "wuguan_yajiang", name: "青城派·三清殿", type: BUILDING_TYPE.WUGUAN, skillSet: "青城",
      desc: "青城派正殿。入门先站桩——站在宝瓶口江边，水没脚踝，站半日。站住了才教剑。",
    },
    {
      id: "hospital_qingcheng_yaopu", name: "青城药圃", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
      desc: "玉真子坐镇的后山草药庐，给药不给方子。雅江的郎中求不来的药，在这里一帖帖配好。",
    },
    {
      id: "sectshop_yajiang", name: "三清玄阁", type: BUILDING_TYPE.SECTSHOP, shopKey: "青城商坊",
      desc: "设在三清殿偏庑的门内库房，由持堂道人兼管账目，只认青城声誉与门中功劳，寻常银两买不走里头的紫阳丹与松纹剑。",
    },
    {
      id: "sect_entry_yajiang", name: "青城山山门", type: BUILDING_TYPE.SECT_ENTRY, sect: "青城派",
      desc: "石砌牌坊额书青城二字。不收富贵子弟捐纳——想入门，先去江边站桩，站住了再说。",
    },
  ],
  // ── 雾隐寨（8 种，苗疆秘宗·五仙教北坛） ──
  雾隐寨: [
    {
      id: "inn_wuyinzhai", name: "避瘴吊脚楼", type: BUILDING_TYPE.INN, innPrice: 18,
      desc: "悬在溪涧上方的两层竹楼，床帐里缝着驱虫晒干的艾草与菖蒲。外乡人头一回住总嫌湿气重，睡到半夜听见竹柱底下虫爬，反倒不敢下床乱跑。",
    },
    {
      id: "sect_entry_wuxian", name: "五仙拜师坛", type: BUILDING_TYPE.SECT_ENTRY, sect: "五仙教",
      desc: "五根灵柱正中摆着一只盛满清酒的黑陶碗，碗底沉着一枚银蛇牌。想入五仙教不用磕响头，先把碗里掺了微毒的酒喝干，站得稳才算过关。",
    },
    {
      id: "wuguan_wuxian", name: "听虫演武坪", type: BUILDING_TYPE.WUGUAN, skillSet: "五仙",
      desc: "青石坪缝里长满滑脚的青苔，教中弟子练功专挑雨雾最浓的辰光。龙汐月常坐廊下甩鞭子，说外人练拳靠眼睛，苗疆功夫靠耳朵听草动。",
    },
    {
      id: "medicine_wuxian", name: "百蛊药房", type: BUILDING_TYPE.MEDICINE, shopKey: "五仙百蛊房",
      desc: "柜台后头百十个药抽屉没贴一张纸签，全靠掌柜阿萝闻味儿抓药。解瘴丹、断肠散和治跌打的草膏挨着放，外乡人买错了她多半会笑眯眯提醒你一句——看心情。",
    },
    {
      id: "sectshop_wuxian", name: "五仙秘珍坊", type: BUILDING_TYPE.SECTSHOP, shopKey: "五仙秘珍坊",
      desc: "只认教中功勋与门墙情面的小竹阁，寻常散银买不走里头半片蛇蜕。案几上摆着淬过三道秘毒的苗银兵刃与活虫玉匣，外客连门槛都跨不进来。",
    },
    {
      id: "temple_wuxian", name: "五仙祖灵殿", type: BUILDING_TYPE.TEMPLE,
      desc: "供奉着历代圣母牌位与五灵石像的幽暗石殿，终年点着松明火把。乌婆婆每天清晨来扫落叶，常在殿角晒些外头见不着的冷僻草根。",
    },
    {
      id: "teahouse_wuxian", name: "藤花茶棚", type: BUILDING_TYPE.TEAHOUSE,
      desc: "搭在紫岚藤桥内侧的半敞竹棚，卖粗碗烤茶和凉拌折耳根。往来雅江采药客、天都镇脚夫和教中巡山女都在这儿歇脚，雾里藏不住的风声多半先落在这张桌子上。",
    },
    {
      id: "kitchen_wuxian", name: "酸汤竹灶", type: BUILDING_TYPE.KITCHEN,
      desc: "用湿泥糊成的苗家地灶，吊锅里常年咕嘟着红亮酸汤，墙上挂满腊肉、山椒与野菌。寨里人说，进了毒瘴谷要想不烂肠子，每天得吃三口滚烫酸辣。",
    },
  ],
  // ── 黑风寨（4 种，义匪山寨·狼曲响马） ──
  黑风寨: [
    {
      id: "sect_entry_heifeng", name: "聚义岩洞", type: BUILDING_TYPE.SECT_ENTRY, sect: "黑风寨",
      desc: "寨后岩洞深处只摊着一张狼曲地形图和几把旧刀，没有虎皮大椅。巴桑在这儿见客、收投名状——入伙不磕头，只问一句寨规守不守得住。",
    },
    {
      id: "wuguan_heifeng", name: "后山演武坪", type: BUILDING_TYPE.WUGUAN, skillSet: "黑风",
      desc: "后山草坡往里的一片碎石坪，寨里的刀口在这对练。彭措管着场子，外人想搭手先过他这关——不许下黑手，不许淬毒。",
    },
    {
      id: "sectshop_heifeng", name: "山寨货栈", type: BUILDING_TYPE.SECTSHOP, shopKey: "黑风货栈",
      desc: "岩壁下凿出的石仓，码着下山得的正经货和寨里自酿的土烧。仓头按寨规做买卖：玉泉寨的乡亲按本钱算，官家的货加价，外人看巴桑的面子。",
    },
    {
      id: "kitchen_heifeng", name: "伙房大灶", type: BUILDING_TYPE.KITCHEN,
      desc: "寨门东侧的露天大灶，老阿雅婶掌勺。出征前一席饭全员同吃是寨规，铁锅底结着十几年的锅巴，熬出来的牦牛肉汤格外厚。",
    },
  ],
  // ── 大草甸：血刀磨刀坪挂在已有的血刀营地内层房间 ──
  大草甸: [
    {
      id: "wuguan_xuedao", name: "血刀磨刀坪", type: BUILDING_TYPE.WUGUAN, skillSet: "血刀",
      desc: "营地正中一片踩得发亮的磨刀坪，刀口磨出火星，血腥味混着铁屑味。血刀部的路数不问出身，想学先把手伸出来让刀认一认。",
    },
  ],
  // ── 天龙营（西风隘）：玄甲军与白衣旧部隔谷对峙的连营 ──
  天龙营: [
    {
      id: "sect_entry_tianlong", name: "天龙点将台", type: BUILDING_TYPE.SECT_ENTRY, sect: "天龙教",
      desc: "黑石高台，牛皮大鼓裂了口。台下插着一圈断刀——接不住三招的，刀留下，人下山。石重岳在此收人，只看拳头与办差。",
    },
    {
      id: "wuguan_tianlong", name: "西风演武场", type: BUILDING_TYPE.WUGUAN, skillSet: "天龙",
      desc: "玄甲军操练的夯土大坪，号子声压过风声。外来的拳师想挣一声服气，先得上坪里走几招。",
    },
    {
      id: "sectshop_tianlong", name: "天龙军需坊", type: BUILDING_TYPE.SECTSHOP, shopKey: "天龙军需坊",
      desc: "半敞的皮顶货棚，弯刀皮甲止血散一应俱全。军需官记账先看你脸——在天龙教挣的声名，在这里直接抵银子。",
    },
    {
      id: "forge_xifeng", name: "西域铁砧炉", type: BUILDING_TYPE.FORGE,
      desc: "依岩壁砌的两座炭炉，火色不熄。砧上打的不是农具——弯刀、马镫、玄甲的铆片。",
    },
    {
      id: "hospital_xigu", name: "西谷草药棚", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
      desc: "白衣旧部的药庐，檐下挂满晾着的草药，苦味顺谷口往外飘。贺兰昭的火候比军营规矩还硬。",
    },
    {
      id: "inn_xifeng", name: "风沙客帐", type: BUILDING_TYPE.INN, innPrice: 25,
      desc: "避风坡上几顶驼毛毡帐，火塘边常备酽茶烤饼，专收过路商旅与说不上来路的人。",
    },
    {
      id: "library_tianlong", name: "止戈经帐", type: BUILDING_TYPE.LIBRARY,
      desc: "安静得不像军营的经帐，毡壁上挂着褪色的白帆，案上摊着写满经文的羊皮卷。",
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
