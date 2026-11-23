import { BUILDING_TYPE } from "../buildingType.js";

  // ── 天都镇（4 种，最繁华市镇） ──
export const tiandu = [
    {
      id: "inn_tiandu", name: "天都行脚楼", type: BUILDING_TYPE.INN, innPrice: 10,
      desc: "天都镇最大的客栈，二层小楼，楼下卖酒，商贩走卒在此歇脚打听消息。",
    },
    {
      id: "grocery_tiandu", name: "天都香行", type: BUILDING_TYPE.GROCERY, shopKey: "天都香行",
      desc: "西市排面最大的香料商号，明面专卖大理沉香与滇南药材，账本干干净净经得起官府查验；熟客报出暗号，掌柜便领你掀帘进后间挑几样「安神好货」。",
    },
    // ── 天都镇·欢喜教据点（合稿·欢喜教 2.3）──
    {
      id: "teahouse_pinxiangya", name: "品香雅座", type: BUILDING_TYPE.TEAHOUSE,
      desc: "香行东厢的半敞茶室，一壶大理烤茶配半截甜香，常有土司府管事与过境驼商在此酒后吐真言。只要你听得懂话外音，天都镇一半的暗账都在这几张竹帘后头。",
    },
    {
      id: "wuguan_huanxitang", name: "欢喜堂·演武坪", type: BUILDING_TYPE.WUGUAN, skillSet: "欢喜",
      desc: "藏在晒香天井之后的青砖小校场，四周种满能遮去声响的高竹。内院弟子白日捣香粉，入夜便在此演练天竺转手与迷香身法，外人难窥分毫。",
    },
    {
      id: "sect_entry_huanxi", name: "坛城香案", type: BUILDING_TYPE.SECT_ENTRY, sect: "欢喜教",
      desc: "设于欢喜堂偏厅的拜师香案，案上只摆一尊铜钵与三柱无烟红香。过得了圣女的眼、敬得起教主的茶，方能领一块「莲纹铜牌」，自此算入了欢喜教内院门墙。",
    },
    {
      id: "temple_huanxifo", name: "伽罗旧神殿", type: BUILDING_TYPE.TEMPLE, karmaPerPray: 10,
      desc: "欢喜堂正殿主龛，供奉着梵衍那从天竺一路背来的黑铜旧神。罗琦私下说这不过是教主小时候拜惯了的家神，可在酥油灯影里静坐一炷香，倒真能平复几分心头躁火。",
    },
    {
      id: "chest_xianghangkufang", name: "欢喜堂库房", type: BUILDING_TYPE.CHEST, house: "欢喜堂库房", emptyStock: true,
      desc: "后院角门边的干燥木屋，终年飘着辛辣的防虫樟脑味，专供内院弟子存放私物与换洗行囊。",
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
    // ── 百花门（东街百花楼，合稿·建筑列表 2.2） ──
    {
      id: "rest_baihualou", name: "百花楼·前厅酒肆", type: BUILDING_TYPE.RESTAURANT, menuKey: "饭馆",
      desc: "东街最热闹的销金窟，一碗玫瑰酿配半碟卤山鸡，既能暖胃解乏，也能听见半个天都镇醉汉吐出来的真话。",
    },
    {
      id: "tea_baihua_tingfeng", name: "听风雅阁", type: BUILDING_TYPE.TEAHOUSE,
      desc: "二楼垂着细竹帘的清静茶座，茶水比别处贵上三倍，买的却不是茶叶，而是大草甸商队、土司府官差与雾隐寨毒使的最新动向。",
    },
    {
      id: "med_baihua_ange", name: "百花暗阁", type: BUILDING_TYPE.MEDICINE, shopKey: "百花暗阁",
      desc: "藏在暖棚拐角的一间无匾药铺，货架上摆着祛瘴花露、苗银细针与做旧药水，掌柜花婆只认银子与熟面孔，不问来客买毒给谁吃。",
    },
    {
      id: "hosp_baihua_qudu", name: "花医静室", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
      desc: "暖棚东侧的净室，燃着驱虫艾草，花婆坐堂施针拔毒；伤重或中了奇毒的江湖客在此调理片刻便能立见起色。",
    },
    {
      id: "wuguan_baihua_huapeng", name: "百花暖棚·传艺地", type: BUILDING_TYPE.WUGUAN, skillSet: "百花",
      desc: "毒花丛里辟出的一方青石空地，白日里看像是姑娘们晒药的院子，入夜后兰姐与阿芷会在此指点楼中记名客卿淬毒、使鞭与穿花步法。",
    },
    {
      id: "pigeon_baihua_caique", name: "彩雀暗檐", type: BUILDING_TYPE.PIGEON_COOP, dailyPigeons: 1,
      desc: "屋脊阴面搭着一排刷了桐油的竹笼，养着几十只滇南驯化的绿背彩雀，每日可免费领走一只传书，比官驿快马更难被截杀。",
    },
];
