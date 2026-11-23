import { BUILDING_TYPE } from "../buildingType.js";

  // ── 广汉·丐帮三星分舵（合稿·丐帮 2.3）+ 广汉镇中立驿站（合稿·丐帮修订建议 2） ──
export const guanghan = [
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
    // ── 广汉·三星派古蜀青铜神树墟（合稿·三星派 2.3） ──
    {
      id: "sanxing_tree_altar", name: "青铜神树台", type: BUILDING_TYPE.TEMPLE, karmaPerPray: 10,
      desc: "三丈青铜神树下的夯土祭台，九枝九鸟在雾里若隐若现。在这里焚香静坐，听铜枝里的风声一层层沉下去，偶有所悟。",
    },
    {
      id: "sanxing_sword_pit", name: "碎铜剑坪", type: BUILDING_TYPE.WUGUAN, skillSet: "三星",
      desc: "祭祀坑底踩得发亮的碎铜坪，满地是断裂的古剑与面具碎片。三名青铜面人轮流守坪，外人要学古墟剑法，先得在这里过他们一剑。",
    },
    {
      id: "sanxing_sect_shop", name: "古墟秘藏阁", type: BUILDING_TYPE.SECTSHOP, shopKey: "三星秘藏",
      desc: "祭祀坑西侧凿进土崖的石室，架上摆着樊枯新铸的铜剑、古麻衣袍和墟中秘药。姜泠管账，外客凭交情才能看到里面几层。",
    },
    {
      id: "sanxing_bronze_forge", name: "赤炉铸铜坊", type: BUILDING_TYPE.FORGE,
      desc: "地窖深处一座常年不熄的赤炉，樊枯在这里补神树铜枝，也替信得过的人浇铸兵刃。炉壁烤得发红，站近了眉毛都要卷。",
    },
    {
      id: "sanxing_stele_pavilion", name: "古蜀碑廊", type: BUILDING_TYPE.LIBRARY,
      desc: "一条刻满古蜀图符的石廊，纵目人面、鱼凫与神鸟层层叠叠。三星派弟子在这里拓碑读谱，外客得了门人点头才能进来看。",
    },
    {
      id: "sanxing_mask_hall", name: "授面坛", type: BUILDING_TYPE.SECT_ENTRY, sect: "三星派",
      desc: "石案上整齐码着未开眼的青铜面具与刻刀，旁侧燃着一盆艾草炭火。凡愿入墟为徒者，须亲手磨亮自己的面具，再向神树递上三记问心剑。",
    },
    {
      id: "sanxing_vault_chest", name: "青铜地窖库", type: BUILDING_TYPE.CHEST, house: "三星派青铜地窖库", emptyStock: true,
      desc: "嵌在石壁里的厚重青铜大箱，锁孔做成神鸟衔环的模样，防潮防蛀。三星派门人可将多余的剑器、药草与残片暂存于此，等需要时再来取用。",
    },
    {
      id: "sect_gaibang_entry", name: "三星分舵·聚义堂", type: BUILDING_TYPE.SECT_ENTRY, sect: "丐帮三星分舵",
      desc: "破庙正殿改成的分舵议事处，供桌上不烧高香只摆烈酒。想入丐帮不看家世高低，只看你敢不敢端起严九斤那碗混着雨水与江湖气的入门酒。",
    },
    {
      id: "transport_guanghan", name: "广汉镇驿站", type: BUILDING_TYPE.TRANSPORT,
      desc: "镇口客栈旁拴着几匹川马，驾车的老把式不问来路。花银两可直接抵达已探索的其他据点，省得从川西尽头一步步走回去。",
    },
];
