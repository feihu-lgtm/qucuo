import { BUILDING_TYPE } from "../buildingType.js";

  // ── 锦官城（20 种，乡外门户） ──
export const jinguan = [
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
    {
      id: "sect_entry_guan", name: "都事府值房", type: BUILDING_TYPE.SECT_ENTRY, sect: "锦官城",
      desc: "都事府前院值房，案上一摞待批的卷宗和一盏没喝完的菊花茶。想投效当差的都在这儿回话——柳青鸢的规矩是公事公办，先办事，再谈名分。",
    },
    {
      id: "sectshop_guan", name: "都事府兵备库", type: BUILDING_TYPE.SECTSHOP, shopKey: "锦官兵备",
      desc: "城东营房后墙一溜库房，制式腰刀、皂隶衣、罚没来路的物件码得整整齐齐，班头侯敢按着登记册发卖——官仓的货，比市集便宜，但要讲资格。",
    },
];
