// 内层据点箱庭地图（两层地图架构的第二层）
// 对应总纲v3第十章设计。外层 QUCUO_MAP（qucuoMap.js）解决"曲措乡境内从哪
// 到哪"，这一层解决"在某个据点内部具体待在哪个角落"。
//
// 【本轮范围】只实现鱼定村一个据点，作为垂直切片先跑通"数据结构→resolveExit
// 改造→room state改造"这一整条链路，验证无误后再照同样模式铺开到其余13个
// 据点。不要因为看到这里只有一个据点就以为是遗漏——这是有意为之的分阶段策略，
// 见路线图相关讨论。
//
// 【坐标系统】每个据点内部坐标独立，跟外层大地图的(x,y)坐标不是一回事，
// 不能混用、不能直接比较。方向键沿用外层同一套 n/s/e/w/u/d 语义。
//
// 【锚点】district 对象上的 anchor 字段，是玩家从大地图进入这个据点时的
// 默认落脚房间，也是内层向外走回大地图时经过的房间。
//
// 【与建筑系统的关系】这里的房间只是给已有 BUILDING_TYPE 建筑（见
// buildings/qucuoBuildings.js）加一层地图外壳（坐标+出口+解锁条件），
// 不重新定义建筑本身的功能（点菜/住店/购物等仍由原有building数据和
// Screen组件负责）。房间的 buildingId 字段（若有）关联到对应建筑id。
//
// 【隐藏房间】unlockCondition 字段：值为 { type: "questCompleted", questId }
// 或 { type: "flag", flag }。房间锁定时，不出现在其父房间的可选出口列表里
// （不是"存在但打不开"，是"根本不呈现"），避免玩家瞎猜隐藏地名。判定逻辑见
// isInnerExitUnlocked()，复用与外层 unlockCondition 相同的判定语义。

import { invHasItemNamed } from "./safeHouse.js";

export const INNER_MAP = {
  鱼定村: {
    anchor: "村口",
    rooms: {
      村口: {
        x: 0, y: 0,
        desc: "村口立着一块褪色的界石，写着'曲措乡'三个字。熊曲、鹰曲、狼曲三条溪流在此交汇，水声潺潺。",
        // 村口本该连6个房间，东南西北四个方向装不下，把村长府/猎户小屋
        // 分流到新增的过渡房间"村口·广场"（见下方），村口只保留文档
        // 原文明确写的4条锚点直连。
        exits: { e: "歇马居", s: "鱼定商号", n: "老孙饭馆", w: "杂货铺摊位" },
        buildingId: "pigeon_coop_yiding", // 鸽子笼就挂在村口本身，进村口就能看到、不用另走
      },
      "村口·广场": {
        x: -1, y: 1,
        desc: "鱼定商号旁一小片开阔地，村里闲人爱在此坐坐，也是通往村长府和猎户小屋的必经之地。",
        exits: { s: "猎户小屋", w: "村长府", e: "鱼定商号", n: "溪边小屋" },
      },
      溪边小屋: {
        x: -1, y: 2,
        desc: `【外观】熊曲溪畔一间单层石砌小屋，屋顶铺着青灰瓦，瓦缝里长着狗尾草。门前一块巴掌大的菜畦，篱笆上爬满野蔷薇。篱笆上钉着个歪歪扭扭的木牌：「乞丐与老7滚勿入」。溪水从屋后绕过，日夜不停。
【起居】推门是一间通铺式的起居室：靠墙一张木板床，铺着藏青粗布被褥；对面是灶台，铁锅铜壶齐整，灶膛里还有余烬。墙角一只水缸，缸沿搁着木瓢。床底一只铁皮包角的旧木箱。
【卧处】床铺干净，枕头下压着一只干花荷包。床头钉着一枚铁钉，可以挂东西。
【灶间】灶台旁一只小碗柜，碗筷两人份。窗台上晒着一把干辣椒。灶台后头一个半地下的石窖入口，阴凉潮湿——酒窖。
【鸽笼】屋檐下钉着一只竹编鸽笼，里头两只灰鸽咕咕叫，脚环上刻着编号。
【菜畦】屋前种着葱蒜和几株蜀葵，篱笆边的野蔷薇春夏会开满一面墙。
【用处】家园系统已开放：箱子存物、烹饪台做饭、鸽子笼放信、酒窖酿酒、菜畦种植。顶栏🏠按钮进入。`,
        exits: { s: "村口·广场" },
        unlockCondition: { type: "item", itemName: "溪边小屋钥匙" },
      },
      歇马居: {
        x: 1, y: 0,
        desc: "村里的客栈，往来行商、走镖的、赶考的都在此落脚。",
        exits: { w: "村口", e: "马车行", n: "护镖站", s: "大娘家" },
        buildingId: "inn_yiding",
      },
      鱼定商号: {
        x: 0, y: 1,
        desc: "村里唯一的正经商号，日常货品都能在此置办。",
        exits: { n: "村口", s: "赌坊", w: "村口·广场" },
        buildingId: "shop_yiding",
      },
      老孙饭馆: {
        x: 0, y: -1,
        desc: "村里的饭馆，几张油亮的木桌，灶上永远飘着糌粑和酥油茶的味道。",
        exits: { s: "村口", n: "才旦家" },
        buildingId: "restaurant_yiding",
      },
      杂货铺摊位: {
        x: -1, y: 0,
        desc: "杂货商人常年在此摆摊，日用杂物、草药糌粑都有，是村里最热闹的角落。",
        exits: { e: "村口", w: "西头药铺" },
        buildingId: "grocery_yiding",
        // residentNpcName：这个房间常驻的固定NPC名字（对应 presets/qucuo.js
        // 里 room.npcs 数组中那个初始具名NPC）。有了这个字段，渲染层才能
        // 真正按"当前站在哪个内层房间"过滤 room.npcs 展示哪些人，而不是
        // 不管站在鱼定村哪个角落，都把整个据点的NPC列表铺一遍——这是这次
        // 补的关键缺口，之前只在文档/desc文字里写了"某某常驻此处"，没有
        // 变成代码能读的结构化数据。
        residentNpcName: "杂货商人",
      },
      才旦家: {
        x: 0, y: -2,
        desc: "才旦家的小院，屋里堆着几本泛黄的旧账册，是这家人平日不太愿意提起的地方。",
        exits: { s: "老孙饭馆" },
      },
      村长府: {
        x: -1, y: 3,
        desc: "前村长的旧宅，如今冷清了不少，堂屋里还挂着几件遗物没舍得挪动。",
        exits: { e: "村口·广场" },
      },
      护镖站: {
        x: 1, y: 1,
        desc: "接押送任务的地方，墙上挂着几副磨得发亮的镖旗。",
        exits: { s: "歇马居" },
        buildingId: "escort_yiding",
      },
      马车行: {
        x: 2, y: 0,
        desc: "备着脚力和驾车人，花银两可直接抵达已探索的其他据点。",
        exits: { w: "歇马居", n: "铁匠铺" },
        buildingId: "transport_yiding",
      },
      赌坊: {
        x: 0, y: 2,
        desc: "村里的赌坊，进出的人大多面色复杂。",
        exits: { n: "鱼定商号" },
        buildingId: "gambling_yiding",
      },
      西头药铺: {
        x: -2, y: 0,
        desc: "管家小舅子开的药材铺子，药柜锁得比别家都严实。",
        exits: { e: "杂货铺摊位" },
      },
      猎户小屋: {
        x: 0, y: 4,
        desc: "靠近熊山方向的一间木屋，屋外挂着风干的兽皮和陷阱工具，老猎户常年住在此处。",
        exits: { n: "村口·广场" },
        residentNpcName: "老猎户",
      },
      大娘家: {
        x: 1, y: -1,
        desc: "鱼定大娘的家，屋前常年支着一口熬糌粑的大锅，是全村消息最灵通的地方之一。",
        exits: { n: "歇马居" },
        residentNpcName: "鱼定大娘",
      },
      铁匠铺: {
        x: 2, y: 1,
        desc: "村东头一间冒着黑烟的铁匠铺，炉火昼夜不熄，叮当的打铁声隔着半条街都听得见。老铁匠祖上三代打铁，也接客人拿料定制的活计。",
        exits: { s: "马车行" },
        buildingId: "forge_yiding",
      },
    },
  },

  // ── 第三新东京市（终章一次性据点，只有一间）──
  // 刻意只做一间房、不做可探索的内层：这一段是"见证"不是"探索"，
  // 玩家进来就该看完那段话然后被送走。做成迷宫反而稀释了它。
  第三新东京市: {
    anchor: "海边的堤",
    rooms: {
      "海边的堤": {
        x: 0, y: 0,
        desc: `一道很长的堤，底下是海。海是红的，不知道为什么。天蓝得过分。
身后是一座正在重新长起来的城：脚手架、新翻的土、晒在阳台上的被子。
有小孩在堤上跑过去，回头看了你们一眼，又跑了。
风是暖的。这里没有雪。`,
        exits: {},
      },
    },
  },

  // ── 心灵之海（旁白个人线专属箱庭）──
  // 永远日落。四间半：浅滩(锚点)/白色别墅/地下室/椰林/沙滩尽头。
  // 地下室锁着，等个人线推到"传送门"那一步才开。
  心灵之海: {
    anchor: "浅滩",
    rooms: {
      浅滩: {
        x: 0, y: 0,
        desc: `金色的光铺满一切。太阳永远卡在地平线上，不落。
脚下是细白的沙，海水是温的，浅得只没过脚踝。远处有一栋白色别墅，亮着灯。
左边是一片椰林，右边沙滩一直延伸向看不见的地方。
空气里有盐味，还有一点很淡的、说不清的清苦气味。没有风，没有鸟。只有海浪声，很慢，像谁在呼吸。`,
        exits: { n: "白色别墅", w: "椰林", e: "沙滩尽头" },
      },
      白色别墅: {
        x: 0, y: -1,
        desc: `一栋两层的白房子。白墙，一整面落地的窗，门没锁。
一楼是客厅：白色布面的沙发，玻璃几子，一台黑色的方匣子（不亮，看不出做什么用的）。
墙上挂着一幅画——一具红色的巨人立在海边。
厨房是开着的，冰柜里永远有冰水和几瓶没有标签的药。
二楼卧房：一张单人床，白床单。床头搁着一只布偶猴子。
墙角一只药柜，几瓶药，标签上是不认得的外文。
厨房地板下面有个入口，一扇铁门，锁着。`,
        exits: { s: "浅滩", d: "地下室" },
      },
      地下室: {
        x: 0, y: -2,
        desc: `铁梯子下去，尽头是一面混凝土墙。
墙上有一道裂缝，裂缝里透出蓝色的光。空气里有铁锈味——不，是血的味道。
把手贴上去，能觉出墙的另一边有东西在呼吸。`,
        exits: { u: "白色别墅" },
        unlockCondition: { type: "flag", flag: "传送门已开" },
      },
      椰林: {
        x: -1, y: 0,
        desc: `一片椰子树。树影在金光里拉得很长。
树下挂着一张吊床，一条旧毛毯叠在上面。地上散着几只椰子，有一只寄居蟹在沙上爬。
这里很静，适合躺着，什么都不想。`,
        exits: { e: "浅滩" },
      },
      沙滩尽头: {
        x: 1, y: 0,
        desc: `沙滩往右延伸，走了很久，到这儿就没了。
尽头是一块礁石。坐上去能看见整片海，日落的光把海面染成橘红。
礁石背面有人用指甲刻过字——看不清了，被盐风磨平了。
这里适合坐着，看海，等一个人来。`,
        exits: { w: "浅滩" },
      },
    },
  },

  鱼定土司: {
    anchor: "府门",
    rooms: {
      府门: {
        x: 0, y: 0,
        desc: "土司府的正门，高台宅院，檐角挂着风铃，门前守卫神情肃穆。",
        exits: { n: "前厅", e: "护卫厅" },
      },
      护卫厅: {
        x: 1, y: 0,
        desc: "统领骑手三十人与巡捕营二十人的日常操练与值守调度之地，兵器架上刀枪林立。",
        exits: { w: "府门" },
        residentNpcName: "格桑顿珠",
      },
      前厅: {
        x: 0, y: -1,
        desc: "日常接待场所，陈设规整，是土司府对外交涉的第一道门面。",
        exits: { s: "府门", n: "议事厅", e: "管家值房", w: "梅朵闺房" },
      },
      管家值房: {
        x: 1, y: -1,
        desc: "管家私人办公处，桌上常年堆着账册，村2/山5\"税册\"相关剧情可能涉及。",
        exits: { w: "前厅" },
        residentNpcName: "管家·陆福生",
      },
      梅朵闺房: {
        x: -1, y: -1,
        desc: "梅朵的私人空间，陈设不算奢华，却处处透着一股不服管束的随性。",
        exits: { e: "前厅" },
        residentNpcName: "梅朵",
      },
      议事厅: {
        x: 0, y: -2,
        desc: "土司理政处，正中一张长案，两侧是历年账簿和地契的存放架。",
        exits: { s: "前厅", n: "桑杰朵杰书房", w: "库房" },
      },
      库房: {
        x: -1, y: -2,
        desc: "存放贵重物什的库房，门上挂着一把沉甸甸的铜锁，虎胆三重门\"夜闯偷虎胆\"场景发生地。",
        exits: { e: "议事厅" },
      },
      桑杰朵杰书房: {
        x: 0, y: -3,
        desc: "土司私人空间，案头摆着几卷父亲留下的旧物，终局相关剧情预留。",
        exits: { s: "议事厅" },
        residentNpcName: "桑杰朵杰",
      },
    },
  },

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
  },

  白塔: {
    anchor: "塔基",
    rooms: {
      塔基: {
        x: 0, y: 0,
        desc: "半山孤立的古塔遗迹入口，塔身斑驳，藏传佛教的机关痕迹隐约可见。",
        exits: { n: "塔身檐廊", s: "白塔地宫" },
      },
      塔身檐廊: {
        x: 0, y: -1,
        desc: "沿塔而建的檐廊，任务8\"听雨悟剑\"的场景发生地。",
        exits: { s: "塔基", n: "塔顶" },
      },
      塔顶: {
        x: 0, y: -2,
        desc: "塔的最高处，眺望全乡视野点，风声呼啸。",
        exits: { s: "塔身檐廊" },
      },
      白塔地宫: {
        x: 0, y: 1,
        desc: "塔基地下的隐秘空间，守塔僧团驻守，任务16\"分赃规矩\"、守宫砂辅料收集地。",
        exits: { n: "塔基" },
        unlockCondition: { type: "flag", flag: "white_pagoda_crypt_clue" },
      },
    },
  },

  后山平台: {
    anchor: "平台入口",
    rooms: {
      平台入口: {
        x: 0, y: 0,
        desc: "雪山派对外的天然屏障和瞭望台，视野开阔，兼雪山派唯一对外通道。",
        exits: { n: "跑马场" },
      },
      跑马场: {
        x: 0, y: -1,
        desc: "每年在此举办跑马会，比武/射箭/集市均在此。",
        exits: { s: "平台入口", e: "集市外围" },
      },
      集市外围: {
        x: 1, y: -1,
        desc: "跑马大会集市摊位区，锦官商号/土特产/小礼物等摊位林立。",
        exits: { w: "跑马场" },
      },
    },
  },

  雪山派: {
    anchor: "山门",
    rooms: {
      山门: {
        x: 0, y: 0,
        desc: "深山隐世的武学门派入口，门内清幽，弟子往来皆是练武修行的痕迹。",
        exits: { n: "雪山练功堂" },
      },
      雪山练功堂: {
        x: 0, y: -1,
        desc: "门派日常练功之地，兵器架、桩靶一应俱全。",
        exits: { s: "山门", w: "门派商坊", n: "内堂" },
        buildingId: "wuguan_xueshan",
      },
      门派商坊: {
        x: -1, y: -1,
        desc: "门派对外经营的商坊，出售寻常武学入门物件。",
        exits: { e: "雪山练功堂" },
        buildingId: "sectshop_xueshan",
      },
      内堂: {
        x: 0, y: -2,
        desc: "何雨谢病中场景、掌门相关叙事发生地，陈设温馨但透着一丝忧虑。",
        exits: { s: "雪山练功堂", w: "呼延雪居所", n: "弟子别院", e: "后山温泉" },
        residentNpcName: "何雨谢",
        buildingId: "sectentry_xueshan",
      },
      后山温泉: {
        x: 1, y: -2,
        desc: `内堂东侧一道石阶下去，是雪山派后山的一眼天然温泉。三面雪壁围着，一面朝东开着口，望得见云海。
水是热的，常年冒着白汽，汽一升到雪线就凝成霜，落回水面。岸边几块青石被踩得溜光，石缝里长着不怕冷的地衣。
门派弟子偶尔来泡一泡，但这地方太静了，静得人不太敢待久——水面上一点声都没有，连自己的呼吸都听得见。
近来常有个白衣女子在此，不知是哪一辈的师姐，也没人说得清她是几时来的。`,
        exits: { w: "内堂" },
        residentNpcName: "玄女",
      },
      弟子别院: {
        x: 0, y: -3,
        desc: `【外观】内堂后一处独立小院，青砖围墙，一道月洞门。院中一株老梅，冬日开满白花。墙根堆着几根练功用的木桩。门楣上挂着雪山派的令牌锁——正式弟子才开得。
【院中】一进院是练功地：木桩、石锁、一柄挂在墙上的练习木枪。正房三间，中为堂屋，东厢卧房，西厢书房。
【卧处】东厢一张硬板床，棉被叠得方方正正。床头一只小木箱可放私物。墙上挂着一件备用弟子服。
【书房】西厢一张书案，笔墨纸砚齐备。书架上几本门派入门心法与杂书。窗下一张琴桌，琴弦断了没人修。
【灶间】堂屋后一间小灶房，够一个人做饭。水缸、米缸、一只小铁锅。
【花坛】老梅树下一圈花坛，种着耐寒的格桑花和几株雪莲幼苗。
【用处】可歇息、可练功（另有潜能进益）、可做饭、可存放行囊。`,
        exits: { s: "内堂" },
        unlockCondition: { type: "item", itemName: "雪山派令牌钥匙" },
      },
      呼延雪居所: {
        x: -1, y: -2,
        desc: "呼延雪的居所，简朴清净，一如她本人的性子。",
        exits: { e: "内堂" },
        residentNpcName: "呼延雪",
      },
    },
  },

  山洞: {
    anchor: "洞口",
    rooms: {
      洞口: {
        x: 0, y: 0,
        desc: "贯通雪山派与顶峰的隐秘甬道入口，幽深潮湿。",
        exits: { n: "甬道" },
      },
      甬道: {
        x: 0, y: -1,
        desc: "机关兽出没的区域，任务13\"机关偃甲\"场景发生地。",
        exits: { s: "洞口", n: "深处" },
      },
      深处: {
        x: 0, y: -2,
        desc: "线二呼延雪发现遗书的具体场景，幽暗深处藏着不为人知的旧物。",
        exits: { s: "甬道" },
      },
    },
  },

  顶峰: {
    anchor: "峰道入口",
    rooms: {
      峰道入口: {
        x: 0, y: 0,
        desc: "通往绝顶的山道入口。",
        exits: { n: "绝顶" },
      },
      绝顶: {
        x: 0, y: -1,
        desc: "雪山之巅，终年积雪覆顶，全乡地势最高、也最少人至的极境，风声呼啸，视野可及乡境全貌。",
        exits: { s: "峰道入口", e: "雪山崖底" },
        // 跳崖交互：不走常规exits机制（不是普通方向移动），由MudRPG.jsx
        // 专门判定——外功≥85或内功≥85才能存活并解锁雪山崖底，双双不满足
        // 则判定为重伤/濒死，不触发下方隐藏剧情。跳崖后单纯"能看"，没有
        // 额外物证/奖励结算（按讨论过的简化版处理）。
      },
      雪山崖底: {
        x: 1, y: -1,
        desc: "呼延大侠殒命处，崖底一池深水（暗河潭），与贡措海无关，是雪山崖底自身的地理细节。一头通体雪白的老猿踞在崖石上，警惕地盯着来客。",
        residentNpcName: "白猿", // 通灵白猿常驻此处（不能说话，可投喂养好感）
        exits: { w: "绝顶" },
        // 属性门：外功≥100 才能从绝顶跳崖存活并进入。地图上可见按钮，
        // 点击时判定属性，不够则提示"强行破门"失败。
        unlockCondition: { type: "stat", stat: "waigong", threshold: 100 },
      },
    },
  },

  天都镇: {
    anchor: "镇口",
    rooms: {
      镇口: {
        x: 0, y: 0,
        desc: "鹰曲下游的市镇入口，商贩往来，市声嘈杂。石牌坊底下常年蹲着个膀大腰圆的汉子，过往商队见了他都绕着走。",
        exits: { e: "天都行脚楼", n: "孟记铁铺", s: "百花楼", w: "天都镖局" },
        residentNpcName: "赫连铸",
      },
      天都行脚楼: {
        x: 1, y: 0,
        desc: "兼作草甸边缘的补给与歇脚之地。",
        exits: { w: "镇口", e: "百香斋" },
        buildingId: "inn_tiandu",
      },
      孟记铁铺: {
        x: 0, y: 1,
        desc: "孟老汉开的铁匠铺，炉火熊熊，武器护甲一律现货，不接私打订单。",
        exits: { s: "镇口", n: "后山小径" },
        buildingId: "smithy_tiandu",
      },
      后山小径: {
        x: 0, y: 2,
        desc: "孟记铁铺后一条碎石小径，蜿蜒上山。松涛阵阵，空气里松脂味很重。走到尽头，能看见一栋不该出现在这里的建筑。",
        exits: { s: "孟记铁铺", n: "山间别墅" },
      },
      山间别墅: {
        x: 0, y: 3,
        desc: `【外观】山腰一栋两层独栋别墅，白墙灰瓦，一整面落地大窗，外头围一圈木栅栏院子。和周遭所有藏式石楼都格格不入——像是从很远很远的地方整个搬来的。院门口一棵老松，树下一张石桌两个石凳。
【厅堂】一楼开放式客厅：壁炉没生火，一组布艺沙发，一张矮几，靠窗一张书桌。木楼梯通二楼，踩上去会响。
【卧处】二楼主卧一张双人床，白色床单，床头两盏油灯。衣柜空着。窗子正对山谷，早晨能看见云海。
【灶间】客厅后头是厨房，灶台比寻常人家大三倍，调料架、案板、一口铜锅、一只烤炉俱全。角落里一只很奇怪的铁柜子，摸上去冰凉，不知作何用。
【院子】木栅栏围出的小院，石桌石凳，一棵松树。院角一小块空地，可以种点什么。
【用处】可歇息、可做饭、可存放行囊；石桌处打坐另有进益。`,
        exits: { s: "后山小径" },
        unlockCondition: { type: "item", itemName: "银灰色钥匙" },
      },
      天都镖局: {
        x: -1, y: 0,
        desc: "天都镇的镖局，接押送任务。",
        exits: { e: "镇口", w: "玉器轩" },
        buildingId: "escort_tiandu",
      },
      玉器轩: {
        x: -1, y: -1,
        desc: "经营玉器古玩的铺子。后院另有一处赌石料场。",
        // 原设计从镇口s方向引出，但s已被百花楼占用，改由天都镖局引出，
        // 保持"从镇口出发一定能走到玉器轩"这条路径不断
        exits: { e: "天都镖局", n: "玉石料场" },
        buildingId: "antique_tiandu",
      },
      玉石料场: {
        x: -1, y: -2,
        desc: "玉器轩后院的赌石坊，堆满未开的原石。温掌柜在此坐镇，赌客围着解玉台起哄竞价。",
        exits: { s: "玉器轩" },
        buildingId: "gamblestone_tiandu",
        residentNpcName: "温掌柜",
      },
      百香斋: {
        x: 1, y: 1,
        desc: "欢喜教明面据点，看着是寻常香料铺子，梵衍那/罗琦常在此接待外客。",
        exits: { w: "天都行脚楼", e: "欢喜堂" },
        residentNpcName: "罗琦",
      },
      欢喜堂: {
        x: 2, y: 1,
        desc: "欢喜教暗面据点，欢喜教任务线核心场景，老何/阿雅/桑杰三名内院弟子常在此处。",
        exits: { w: "百香斋" },
        unlockCondition: { type: "questCompleted", questId: "huanxijiao_1_xiangzhongyi" },
      },
      百花楼: {
        x: 0, y: -2,
        desc: "百花门核心据点，明面上是酒楼，暗地里养蛊炼香，兰姐常驻于此。",
        exits: { n: "镇口" },
        residentNpcName: "兰姐",
      },
    },
  },

  玉泉寨: {
    anchor: "狼曲河谷",
    rooms: {
      狼曲河谷: {
        x: 0, y: 1,
        desc: "大草甸↔玉泉寨之间的路途，黑风寨山1-山5、虎1/虎3全部发生在这里。",
        exits: { s: "寨门" },
      },
      寨门: {
        x: 0, y: 0,
        desc: "玉泉寨真正的村寨入口，藏寨牧民聚落。",
        exits: { n: "狼曲河谷", s: "玉泉小栈", w: "扎西/卓玛家", e: "寨口牧场" },
      },
      玉泉小栈: {
        x: 0, y: -1,
        desc: "寨里的客栈，李若由常驻此处经营。",
        exits: { n: "寨门", e: "玉泉练武场", w: "丹增蒙古包" },
        buildingId: "inn_yuquan",
        residentNpcName: "李若由",
      },
      玉泉练武场: {
        x: 1, y: -1,
        desc: "寨里练武切磋的场地。",
        exits: { w: "玉泉小栈" },
        buildingId: "wuguan_yuquan",
      },
      "扎西/卓玛家": {
        x: -1, y: 0,
        desc: "扎西与卓玛父女同住的家，卓玛支线核心场景。",
        exits: { e: "寨门" },
        residentNpcName: "扎西",
      },
      丹增蒙古包: {
        x: -1, y: -1,
        desc: "玉泉寨村长丹增的蒙古包，哈那墙上挂着他的旧马鞭。",
        exits: { e: "玉泉小栈" },
        residentNpcName: "丹增",
      },
      寨口牧场: {
        x: 1, y: 0,
        desc: "小牧童阿索常在此处放牧，紧邻寨门。",
        exits: { w: "寨门" },
      },
    },
  },

  贡措海: {
    anchor: "湖畔",
    rooms: {
      湖畔: {
        x: 0, y: 0,
        desc: "乡境最远处的水晶湖泊，湖面倒映雪山与林海，宁静而肃穆。",
        exits: { n: "前辈墓地" },
      },
      前辈墓地: {
        x: 0, y: -1,
        desc: "湖畔的前辈墓地，是曲措乡地理意义上的终点。",
        exits: { s: "湖畔", n: "贡措海密室", e: "令狐冲墓" },
      },
      令狐冲墓: {
        x: 1, y: -1,
        desc: `【外观】墓地东侧一处孤坟，墓碑上刻着「华山令狐冲之墓」，字迹已被风雨磨浅。坟前插着一柄锈透的长剑，剑柄上缠的布条烂了大半。
【墓壁】绕到碑后，青石墓壁上密密麻麻刻着蝇头小字——不是墓志铭，是剑诀。九组剑式，每组数十变，笔锋凌厉，刻痕深入石面三分。最末一行刻着：「无招胜有招，悟者自得。」
【用处】参悟墓壁剑刻可习得独孤九剑（需外功≥80）。`,
        exits: { w: "前辈墓地" },
        buildingId: "dugu_tomb",
      },
      贡措海密室: {
        x: 0, y: -2,
        desc: "桑杰大侠殒命处，伪造地契藏匿处，与线二\"藏地契\"共用同一物理空间。",
        exits: { s: "前辈墓地" },
        // 属性门：内功≥100 才能强行破门进入。地图上可见按钮，
        // 点击时判定属性，不够则提示失败。
        unlockCondition: { type: "stat", stat: "neigong", threshold: 100 },
      },
    },
  },

  大草甸: {
    anchor: "草甸边缘",
    rooms: {
      草甸边缘: {
        x: 0, y: 0,
        desc: "夹在鹰曲与狼曲之间的莽莽荒野入口，地貌开阔、视线通透。",
        exits: { n: "熊山口", s: "草甸深处" },
      },
      草甸深处: {
        x: 0, y: -1,
        desc: "生态遭遇最密集区域，村1/村4/玉泉寨任务二均在此路段。莽草深处伏着一头银灰独眼的巨狼。",
        residentNpcName: "狼王", // 咬死管家独子的那头独眼狼王盘踞于此
        exits: { n: "草甸边缘" },
      },
      熊山口: {
        x: -1, y: 1,
        desc: "鱼定村通往大草甸的岔路口，土司府管家常设卡处。",
        exits: { s: "草甸边缘", n: "温泉" },
      },
      温泉: {
        x: -1, y: 2,
        desc: "熊山温泉，吊睛虎王刷新点，虎胆三重门核心场景。",
        residentNpcName: "虎王", // 吊睛白额虎王镇守温泉
        exits: { s: "熊山口" },
        // 双 flag 任一即解锁：村5「老猎户给熊山手绘地图」设 unlock_xiongshan_wenquan，
        // 后续弓胎任务设 hunter_hand_drawn_map。此前房间只认后者，导致拿了地图却没做
        // 弓胎任务的玩家温泉永远锁着（弓胎任务文案自己都写"熊山手绘地图已解锁此隐藏房间"，
        // 设计意图本就是地图解锁）。改认任意一个，兼容两种存档。
        unlockCondition: { type: "anyFlag", flags: ["unlock_xiongshan_wenquan", "hunter_hand_drawn_map"] },
      },
    },
  },

  黑风寨: {
    anchor: "寨门",
    rooms: {
      寨门: {
        x: 0, y: 0,
        desc: "灌木遮蔽的羊肠小道尽头，寨门不显眼，山3任务里少年在此引路。",
        exits: { n: "寨内公共区", w: "卓央家" },
      },
      卓央家: {
        x: -1, y: 0,
        desc: "巴桑之妹卓央的家，靠寨门边缘，方便巴桑送东西不进寨。",
        exits: { e: "寨门" },
        residentNpcName: "卓央",
      },
      寨内公共区: {
        x: 0, y: -1,
        desc: "山坳里的木寨，老人晒草药、妇人纳鞋底，寨规刻在岩壁上——不像匪窝，像村子。",
        exits: { s: "寨门", n: "寨后岩洞", w: "后山草坡" },
      },
      后山草坡: {
        x: -1, y: -1,
        desc: "嘎则与雪团常在此处玩耍，虎1\"迷途\"/虎2\"下山\"/虎3\"不还\"的日常起点。",
        exits: { e: "寨内公共区" },
        residentNpcName: "嘎则",
      },
      寨后岩洞: {
        x: 0, y: -2,
        desc: "巴桑见玩家的地方，只一块青石板摊着狼曲地形图，山3.5/山4/山5均在此发生。",
        exits: { s: "寨内公共区" },
        residentNpcName: "巴桑",
      },
    },
  },

  锦官城: {
    anchor: "城门",
    rooms: {
      城门: {
        x: 0, y: 0,
        desc: "曲措乡以外的门户，官道在此汇入更大的天下，往来行商、差役川流不息。",
        exits: { e: "官道", n: "天下商行", w: "锦官武馆", s: "清风茶馆" },
      },
      官道: {
        x: 1, y: 0,
        desc: "单纯的乡外道路，与狼曲无关，欢喜教任务四\"锦官城的暗线\"等镖师/密信类任务的路途场景。",
        exits: { w: "城门", e: "锦官大车店", n: "聚宝当铺" },
      },
      锦官大车店: {
        x: 2, y: 0,
        desc: "锦官城的客栈。",
        exits: { w: "官道", e: "马行" },
        buildingId: "inn_jingguan",
      },
      天下商行: {
        x: 0, y: -1,
        desc: "锦官城的正经商号。",
        exits: { s: "城门", n: "永盛钱庄", e: "都事府" },
        buildingId: "shop_jingguan",
      },
      永盛钱庄: {
        x: 0, y: -3,
        desc: "存钱取钱的地方，附带利息。",
        exits: { s: "天下商行", n: "蜀王庄" },
        buildingId: "bank_jingguan",
      },
      蜀王庄: {
        x: 0, y: -4,
        desc: `【外观】锦官城深处一座三进古庄，传为前朝蜀王旧邸。朱漆大门，门环是两条衔尾蛇。院墙极高，爬满常青藤。门前一对石狮，被岁月磨得圆润。
【一进】照壁与天井，青石铺地，四角种着芭蕉。倒座房有一间大厨房，灶台、蒸笼、案板一应俱全，够摆一桌酒席——只是很久没人用，灶膛是冷的。
【二进】正堂：红木太师椅、条案，中堂挂一幅褪色山水。阶下一盆兰花。
【三进】内宅。东厢卧房一张拔步床，帐幔是旧锦缎，梳妆台上铜镜已经花了，床头一只紫檀小匣，空的。西厢书房一张大书案，文房四宝俱全，书架上多是诗词集与地方志，另有一把古琴，保存得比雪山派那把好。正中一间小佛堂，供着白瓷观音，香炉里的灰是冷的。
【后院】墙角一丛翠竹，一棵很大的银杏，秋日满地金黄。
【用处】可歇息、可做饭、可存放行囊；佛堂打坐另有气血进益，书房读书另有悟性进益。`,
        exits: { s: "永盛钱庄" },
        unlockCondition: { type: "item", itemName: "衔尾蛇门环" },
      },
      锦官武馆: {
        x: -1, y: 0,
        desc: "锦官城的武馆。",
        exits: { e: "城门", w: "锦官镖局", s: "官府告示栏", n: "文渊书肆" },
        buildingId: "wuguan_jingguan",
      },
      锦官镖局: {
        x: -2, y: 0,
        desc: "锦官城的镖局，接押送任务。",
        exits: { e: "锦官武馆", w: "锦华戏楼" },
        buildingId: "escort_jingguan",
      },
      官府告示栏: {
        x: -1, y: 1,
        desc: "张贴悬赏的告示栏。",
        exits: { n: "锦官武馆", w: "锦官赌坊" },
        buildingId: "bounty_jingguan",
      },
      清风茶馆: {
        x: 0, y: 1,
        desc: "茶馆消息最灵通，花点银两听掌柜说故事，任务7线索来源。",
        exits: { n: "城门", s: "杏林医馆", e: "暗巷入口" },
        buildingId: "teahouse_jingguan",
      },
      杏林医馆: {
        x: 0, y: 2,
        desc: "锦官城的医馆。",
        exits: { n: "清风茶馆" },
        buildingId: "hospital_jingguan",
      },
      聚宝当铺: {
        x: 1, y: -1,
        desc: "任务9核心场景，可质押/赎回物品。",
        exits: { s: "官道", w: "金玉行", e: "宝丰拍卖行" },
        buildingId: "pawn_jingguan",
      },
      宝丰拍卖行: {
        x: 2, y: -1,
        desc: "聚宝当铺隔壁一间高门阔厅，门口贴着朱红的拍品告示。厅里一排排条凳，正前方一座小台，台上一张覆着红布的方桌。散场时冷清，开槌时挤得站不下人——死当的、抄家的、来路不明的物件，都在这张桌上过一遍手。",
        exits: { w: "聚宝当铺" },
        buildingId: "auction_jingguan",
      },
      金玉行: {
        x: 1, y: -2,
        desc: "经营金玉珠宝的行铺。",
        exits: { e: "聚宝当铺", s: "铸剑坊" },
        buildingId: "jewelry_jingguan",
      },
      铸剑坊: {
        x: 1, y: -1,
        desc: "打造武器的铸剑坊，可委托订制。",
        exits: { n: "金玉行", e: "锦官城百香斋" },
        buildingId: "forge_jingguan",
      },
      文渊书肆: {
        x: -1, y: -1,
        desc: "欢喜教任务四核心场景，也是各类古籍线索来源。",
        exits: { s: "锦官武馆", w: "云锦成衣铺" },
        buildingId: "library_jingguan",
      },
      云锦成衣铺: {
        x: -2, y: -1,
        desc: "经营成衣布料的铺子。",
        exits: { e: "文渊书肆" },
        buildingId: "cloth_jingguan",
      },
      都事府: {
        x: 1, y: -1,
        desc: "都事柳青鸢的府邸，锦官城任务线核心场景，老兵退伍汉作为随从常驻此处伺候。",
        exits: { w: "天下商行", s: "醉仙楼" },
        residentNpcName: "都事·柳青鸢",
      },
      暗巷入口: {
        x: 1, y: 1,
        desc: "锦官城的暗巷入口，隐秘交易在此进行。",
        exits: { w: "清风茶馆", e: "永丰粮行" },
        buildingId: "blackmarket_jingguan",
      },
      永丰粮行: {
        x: 2, y: 1,
        desc: "经营粮食杂货的行铺。",
        exits: { w: "暗巷入口" },
        buildingId: "grocery2_jingguan",
      },
      锦华戏楼: {
        x: -3, y: 0,
        desc: "锦官城的戏楼，也兼营餐饮。",
        exits: { e: "锦官镖局" },
        buildingId: "theater_jingguan",
      },
      醉仙楼: {
        x: 1, y: 0,
        desc: "锦官城的酒楼饭馆。",
        exits: { n: "都事府" },
        buildingId: "restaurant_jingguan",
      },
      锦官赌坊: {
        x: -2, y: 1,
        desc: "锦官城的赌坊。",
        exits: { e: "官府告示栏" },
        buildingId: "gambling_jingguan",
      },
      马行: {
        x: 3, y: 0,
        desc: "备着脚力和驾车人，可直接抵达已探索的其他据点。",
        exits: { w: "锦官大车店" },
        buildingId: "transport_jingguan",
      },
      // 注意：这个建筑id在qucuoBuildings.js里注册的name也叫"百香斋"，
      // 跟天都镇欢喜教据点"百香斋"完全撞名——两者是两个毫不相干的地方
      // （这里是锦官城一家普通的粮油铺子，天都镇那个是欢喜教明面据点），
      // 纯粹是建筑数据里的命名巧合，不是同一个场景，未来维护者需注意
      // 区分，不要因为同名而误连两处剧情。
      锦官城百香斋: {
        x: 3, y: -1,
        desc: "锦官城一家寻常的粮油铺子，跟天都镇欢喜教据点同名，纯属巧合。",
        exits: { w: "铸剑坊" },
        buildingId: "grocery_jingguan",
      },
    },
  },
};


// 反查：给定据点名+房间名，返回房间完整数据；不存在则返回 null
export function getInnerRoom(districtName, roomName) {
  const district = INNER_MAP[districtName];
  if (!district) return null;
  return district.rooms[roomName] || null;
}

// 给定据点名+NPC名字，返回这个NPC被登记为常驻的内层房间名；如果这个NPC
// 没有在任何内层房间被登记为 residentNpcName（游走NPC、或者这个据点根本
// 没有内层数据），返回 null。渲染层用这个函数判断"当前该不该显示这个
// NPC"——只有明确绑定了某个房间的NPC，才需要按"玩家是否站在那个房间"
// 过滤；没有绑定的NPC（游走NPC池那批、或者剧情临时加入的NPC）在整个
// 据点范围内都可能出现，不受内层房间切换影响。
export function getResidentRoomForNpc(districtName, npcName) {
  const district = INNER_MAP[districtName];
  if (!district) return null;
  for (const [roomName, roomData] of Object.entries(district.rooms)) {
    if (roomData.residentNpcName === npcName) return roomName;
  }
  return null;
}

// 返回某据点的锚点房间名；据点没有内层数据则返回 null（调用方应据此判断
// 这个据点是否已经完成内层箱庭改造，未改造的据点继续走原有单房间逻辑）
export function getDistrictAnchor(districtName) {
  return INNER_MAP[districtName]?.anchor || null;
}

// 判断某据点是否已经有内层箱庭数据（用于新旧两套逻辑并存期间的判断分支）
export function hasInnerMap(districtName) {
  return !!INNER_MAP[districtName];
}

// 返回某据点某内层房间关联的建筑 id（房间数据里的 buildingId 字段）；没有则 null。
// 建筑按内层房间过滤的依据：站在"歇马居"就只显示 inn_yiding，站在"村口广场"这种
// 没有 buildingId 的房间就没有建筑。
export function getBuildingIdForInnerRoom(districtName, roomName) {
  return INNER_MAP[districtName]?.rooms?.[roomName]?.buildingId || null;
}

// 判断一个 NPC 此刻是否应当在"当前内层房间"显示。规则（本轮改版）：
//   1. 驻场NPC（被某房间登记为 residentNpcName）→ 只在其绑定房间显示。
//   2. 游走/临时NPC（对象上带 innerRoom 字段，每天随机落点固化）→ 只在 innerRoom 显示。
//   3. 都没有的（既非驻场、也没落点，比如剧情涌现刚加入还没分配）→ 兜底在锚点房间显示，
//      避免"哪个房间都不显示"导致人间蒸发。
// districtName 无内层数据时一律返回 true（老逻辑：整据点即一间房，不过滤）。
export function isNpcVisibleInInnerRoom(districtName, innerRoomName, npc) {
  if (!hasInnerMap(districtName)) return true;
  if (!innerRoomName) return true;
  const bound = getResidentRoomForNpc(districtName, npc.name);
  if (bound) return bound === innerRoomName;
  if (npc.innerRoom) return npc.innerRoom === innerRoomName;
  return innerRoomName === getDistrictAnchor(districtName);
}

// 列出某据点内所有小地点（内层房间）名；没有内层数据则返回空数组。供调试传送等场景枚举。
export function getInnerRoomNames(districtName) {
  return Object.keys(INNER_MAP[districtName]?.rooms || {});
}

// 检查某据点内某房间的某方向是否有效出口，返回目的房间名或 null。
// 注意：这里只做纯查表，不做 unlockCondition 判定——跟外层 resolveExit 保持
// 同样的职责划分（查表 vs 业务判断分离），解锁判定交给下面的
// isInnerExitUnlocked 单独处理，调用方组合使用。
export function resolveInnerExit(districtName, roomName, dir) {
  const room = getInnerRoom(districtName, roomName);
  if (!room) return null;
  return room.exits[dir] || null;
}

// 返回某房间当前实际"可见"的出口方向列表（过滤掉未解锁的隐藏房间方向）。
// questProgress/flags 由调用方（MudRPG.jsx）传入当前游戏状态。
// stat 类型的房间不过滤——它们在地图上始终可见（按钮可点），由移动判定拦截。
export function visibleInnerExits(districtName, roomName, { questProgress, flags, inv, char } = {}) {
  const room = getInnerRoom(districtName, roomName);
  if (!room) return {};
  const result = {};
  for (const [dir, destName] of Object.entries(room.exits)) {
    const destRoom = getInnerRoom(districtName, destName);
    if (destRoom?.unlockCondition && destRoom.unlockCondition.type !== "stat" && !isInnerExitUnlocked(destRoom.unlockCondition, { questProgress, flags, inv, char })) {
      continue; // 未解锁的隐藏房间：根本不出现在出口列表里
    }
    result[dir] = destName;
  }
  return result;
}

// 解锁条件判定。不新造一套判定逻辑——questCompleted 直接对应
// questEngine.js 里 questProgress 的真实字段（status === "completed"，
// 不是 completed 布尔），跟外层 qucuoMap.js 黑风寨的 unlockCondition
// 判定语义保持完全一致，将来 resolveExit 补判定时可以共用同一个函数。
// 本轮鱼定村切片没有隐藏房间用到这个函数，先按总纲10.3节的约定写好，
// 供后续白塔地宫/贡措海密室等据点接入时直接复用。
export function isInnerExitUnlocked(unlockCondition, { questProgress, flags, inv, char } = {}) {
  if (!unlockCondition) return true;
  if (unlockCondition.type === "questCompleted") {
    return questProgress?.[unlockCondition.questId]?.status === "completed";
  }
  if (unlockCondition.type === "flag") {
    return (flags || []).includes(unlockCondition.flag);
  }
  if (unlockCondition.type === "anyFlag") {
    return (unlockCondition.flags || []).some(f => (flags || []).includes(f));
  }
  // 钥匙锁（安全屋四栋用）：按物品**名字**匹配，不是 id。
  // 背包里物品的 id 是入袋那一刻拼的（`${name}_${Date.now()}`），同一把钥匙
  // 每次拿到 id 都不同，拿 id 比对永远为假。name 才是全项目物品的稳定标识
  // （百物录 CATALOG_INDEX 也按 name 索引）。背包条目可能是字符串也可能是
  // 对象，两种都要认。
  if (unlockCondition.type === "item") {
    return invHasItemNamed(inv, unlockCondition.itemName);
  }
  if (unlockCondition.type === "stat") {
    const val = unlockCondition.stat === "waigong" ? char?.waigong : char?.neigong;
    return (val || 0) >= unlockCondition.threshold;
  }
  return true;
}

// 把 unlockCondition 翻成给玩家看的一句话（走到锁着的门前时提示用）。
// 只说"缺什么"，不泄露门后是什么——跟"隐藏房间根本不呈现"的原则一致：
// 玩家已经站到门口了才会看到这句，此时告知缺物是必要反馈，但仍不剧透里面。
export function describeInnerLock(unlockCondition) {
  if (!unlockCondition) return "";
  if (unlockCondition.type === "item") return `门锁着，你没有「${unlockCondition.itemName}」。`;
  if (unlockCondition.type === "flag") return "门锁着，此刻还进不去。";
  if (unlockCondition.type === "questCompleted") return "门锁着，似乎还有事没了结。";
  if (unlockCondition.type === "stat") {
    const label = unlockCondition.stat === "waigong" ? "外功" : "内功";
    return `${label}不足${unlockCondition.threshold}，强行闯入只会摔个半死。`;
  }
  return "门锁着。";
}
