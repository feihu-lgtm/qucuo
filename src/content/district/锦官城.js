export default { district: {
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
        x: 0, y: -2,
        desc: "存钱取钱的地方，附带利息。",
        exits: { s: "天下商行", n: "蜀王庄" },
        buildingId: "bank_jingguan",
      },
      蜀王庄: {
        x: 0, y: -3,
        desc: `　　锦官城深处一座三进古庄，传为前朝蜀王旧邸。朱漆大门推开时掉了一片漆，门环是两条衔尾蛇，被摸得溜光。院墙极高，爬满常青藤；门前一对石狮，岁月磨得圆润，狮口里的石球还能转。
　　进门是照壁与天井，青石铺地，四角种着芭蕉，叶上积着去年的枯叶。倒座房辟作大厨房，灶台、蒸笼、案板一应俱全，够摆一桌酒席——只是很久没人用了，灶膛是冷的。`,
        exits: { s: "永盛钱庄", w: "正堂佛堂", e: "后院书房", n: "银杏后院" },
        buildingId: "kitchen_shuwang",
        unlockCondition: { type: "item", itemName: "衔尾蛇门环" },
      },
      正堂佛堂: {
        x: -1, y: -3,
        desc: `　　二进正堂，红木太师椅、条案，中堂挂一幅褪色山水，落款被虫蛀了半个字。阶下一盆兰花，居然还活着。
　　正堂西侧隔出一间小佛堂，供着白瓷观音，香炉里是冷灰。蒲团磨得起了毛边，跪出两个浅坑——前人跪的。`,
        exits: { e: "蜀王庄" },
        unlockCondition: { type: "item", itemName: "衔尾蛇门环" },
      },
      后院书房: {
        x: 1, y: -3,
        desc: `　　一张大书案，文房四宝俱全，镇纸是块青玉。架上摆着诗词与地方志，书脊被日头晒得褪成浅黄。
　　墙边一只紫檀小匣，虽空却精致，锁扣是白铜的。窗下横着一把古琴，保存得极好，七弦俱全，指甲轻轻一勾，声音还是亮的。`,
        exits: { w: "蜀王庄" },
        buildingId: "chest_shuwang",
        unlockCondition: { type: "item", itemName: "衔尾蛇门环" },
      },
      银杏后院: {
        x: 0, y: -4,
        desc: `　　三进后院。一丛翠竹靠着东墙，一棵大银杏立在院心，树身要两人合抱。秋日满地金黄，扫都扫不完，索性不扫。
　　树下一圈松土，前主人种过什么，如今只剩几根枯梗。石阶上晒得到太阳，坐着不冷。`,
        exits: { s: "蜀王庄" },
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
      // 峨眉剑庐 (-1,2)：设计稿原写"从城门往南"，但城门(0,0)的 s 已经是清风茶馆，
      // 稿子自己的审核清单也把这条列成待确认项。改挂在官府告示栏(-1,1)正南，
      // 同属城南一片，坐标 (-1,2) 此前空着，不与任何房间撞位。
      峨眉剑庐: {
        x: -1, y: 2,
        desc: "锦官城南一处三进小院，门口不挂匾，只在墙上凿了个浅龛供着普贤菩萨。院中一株老银杏，落叶没人扫，踩上去沙沙响。正堂剑架靠墙，十几柄剑擦得锃亮，剑格上都缠着素色布条。尼姑和道姑坐在同一张桌上喝茶——峨眉山既是普贤道场，又是道家第七洞天，佛道两家在这院里各占半边，谁也不占上风。",
        exits: { n: "官府告示栏", s: "听竹轩" },
        buildingId: "wuguan_emei",
        residentNpcName: "玄尘师太",
      },
      听竹轩: {
        x: -1, y: 3,
        desc: "剑庐中轴正厅改的拜师堂，廊下修竹半亩，案上供着青玉弟子令与一卷翻旧了的《峨眉清规》。",
        exits: { n: "峨眉剑庐", s: "锻簪坊", w: "慈济佛堂", e: "抄经堂" },
        buildingId: "sect_entry_emei",
      },
      锻簪坊: {
        x: -1, y: 4,
        desc: "竹篱最深处的半间黑瓦炉棚，风箱拉得沉稳，铁砧旁码着数十支形似银簪的精铁冷器，淬火槽冒着细白的汽。",
        exits: { n: "听竹轩", w: "练剑坪" },
        buildingId: "sectshop_emei",
        residentNpcName: "簪娘",
      },
      练剑坪: {
        x: -2, y: 4,
        desc: "剑庐后院一方青石坪，石面被剑尖点出密密麻麻的白痕，西头一座矮土台，老辈人叫它白猿台。",
        exits: { e: "锻簪坊", w: "白猿台" },
        residentNpcName: "照微",
      },
      白猿台: {
        x: -3, y: 4,
        desc: "练剑坪西头的矮土台，台边一棵歪脖子老松，树皮被拳掌拍得发亮。",
        exits: { e: "练剑坪" },
        residentNpcName: "司徒瑛",
      },
      慈济佛堂: {
        x: -2, y: 3,
        desc: "供白衣观音的偏殿，苦药香常年不散，长凳上挤满候诊的城西苦力与曲措流民，医尼低头分药。",
        exits: { e: "听竹轩" },
        buildingId: "hospital_emei_fotang",
        residentNpcName: "了因师太",
      },
      抄经堂: {
        x: 0, y: 3,
        desc: "临窗一排长案沾满墨痕，半壁收佛经医案，半壁藏道书与蜀西江湖杂录。男弟子入门前须在此静心抄经三日。",
        exits: { w: "听竹轩", s: "金顶静室·藏剑阁" },
        buildingId: "library_emei_jingge",
        residentNpcName: "陈九",
      },
      "金顶静室·藏剑阁": {
        x: 0, y: 4,
        desc: "竹屏暗门后是一间极素净的禅房，案头只供半支断掉的青铜发簪与一卷手抄佛道合参，壁龛内悬着三柄包着素麻布的古剑，静得能听见自己心跳。",
        exits: { n: "抄经堂" },
        unlockCondition: { type: "flag", flag: "flag_emei_cangjian_open" },
      },
      官府告示栏: {
        x: -1, y: 1,
        desc: "张贴悬赏的告示栏。",
        exits: { n: "锦官武馆", w: "锦官赌坊", s: "峨眉剑庐" },
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
        exits: { n: "清风茶馆", e: "城南贫民棚" },
        buildingId: "hospital_jingguan",
      },
      城南贫民棚: {
        x: 1, y: 2,
        desc: "城南墙根下一片油毡竹棚，挤着曲措南下的流民，棚口一口老井，井沿结着青黑的苔。",
        exits: { w: "杏林医馆" },
      },
      聚宝当铺: {
        x: 1, y: -1,
        desc: "任务9核心场景，可质押/赎回物品。",
        exits: { s: "官道", w: "金玉行", e: "宝丰拍卖行" },
        buildingId: "pawn_jingguan",
      },
      宝丰拍卖行: {
        x: 3, y: -1,
        desc: "聚宝当铺隔壁一间高门阔厅，门口贴着朱红的拍品告示。厅里一排排条凳，正前方一座小台，台上一张覆着红布的方桌。散场时冷清，开槌时挤得站不下人——死当的、抄家的、来路不明的物件，都在这张桌上过一遍手。",
        exits: { w: "聚宝当铺" },
        buildingId: "auction_jingguan",
      },
      金玉行: {
        x: -2, y: -1,
        desc: "经营金玉珠宝的行铺。",
        exits: { e: "聚宝当铺", s: "铸剑坊" },
        buildingId: "jewelry_jingguan",
      },
      铸剑坊: {
        x: -2, y: 2,
        desc: "打造武器的铸剑坊，可委托订制。",
        exits: { n: "金玉行" },
        buildingId: "forge_jingguan",
      },
      文渊书肆: {
        x: -1, y: -1,
        desc: "欢喜教任务四核心场景，也是各类古籍线索来源。",
        exits: { s: "锦官武馆", w: "云锦成衣铺" },
        buildingId: "library_jingguan",
      },
      云锦成衣铺: {
        x: -3, y: -1,
        desc: "经营成衣布料的铺子。",
        exits: { e: "文渊书肆" },
        buildingId: "cloth_jingguan",
      },
      都事府: {
        x: 2, y: -1,
        desc: "都事柳青鸢的府邸，锦官城任务线核心场景，老兵退伍汉作为随从常驻此处伺候。",
        exits: { w: "天下商行", s: "醉仙楼" },
        residentNpcName: "柳青鸢",
      },
      唐门暗巷: {
        x: 1, y: -2,
        desc: `　　暗巷再往里，光就没了。尽头一扇黑漆门，门上没有招牌，只钉着一枚铜钱大的暗器当门钉——三棱，带血槽。
　　推门进去是唐门的外围铺面。柜台后头架子上分格摆着暗器与瓶罐，标签都是手写的，字很小。这里暗器、毒药、解药都卖，不赊账，也不问你买去做什么。`,
        exits: { s: "暗巷入口", e: "城隍庙旧墙" },
        buildingId: "tangmen_shop",
        residentNpcName: "唐三少",
      },
      城隍庙旧墙: {
        x: 2, y: -2,
        desc: "一堵斑驳旧墙挡住巷内灯火。墙下碎瓦间隐有一条小径，弯弯曲曲通向南门外。",
        exits: { w: "唐门暗巷", e: "南门竹径" },
      },
      南门竹径: {
        x: 3, y: -2,
        desc: "城墙外青竹夹道，车辙绵延。驮货的骡车常在此处歇脚，再往南才是蜀道。",
        exits: { w: "城隍庙旧墙" },
      },
      暗巷入口: {
        x: 1, y: 1,
        desc: "锦官城的暗巷入口，隐秘交易在此进行。",
        exits: { w: "清风茶馆", e: "永丰粮行" , n: "唐门暗巷"},
        buildingId: "blackmarket_jingguan",
      },
      永丰粮行: {
        x: 3, y: 1,
        desc: "经营粮食杂货的行铺。",
        exits: { w: "暗巷入口" },
        buildingId: "grocery2_jingguan",
      },
      锦华戏楼: {
        x: -3, y: 0,
        desc: "锦官城的戏楼，也兼营餐饮。",
        exits: { e: "锦官镖局", w: "城西破庙" },
        buildingId: "theater_jingguan",
      },
      城西破庙: {
        x: -4, y: 0,
        desc: "西城门外一座塌了半边的土地庙，神像断了手，供桌下堆着湿稻草，墙根留着车辙和带泥的药篓印子。",
        exits: { e: "锦华戏楼" },
      },
      醉仙楼: {
        x: 2, y: 1,
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
    },
  }
} };
