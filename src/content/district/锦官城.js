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
        exits: { e: "城门", w: "锦官镖局", s: "官府告示栏", n: "文渊书肆", nw: "巡检校场·锦官武馆后院" },
        buildingId: "wuguan_jingguan",
      },
      "巡检校场·锦官武馆后院": {
        x: -2, y: -2,
        desc: "夯土校场边插着一排包铁木桩与八十斤石锁，练武汉子的号子混着隔壁清风茶馆飘来的茉莉花茶香，一通歇鼓刚落，满地都是汗渍与木屑。北巡检司的捕快在这里操练。",
        exits: { se: "锦官武馆" },
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
        exits: { w: "听竹轩", s: "金顶静室·藏剑阁", e: "玄清道院" },
        buildingId: "library_emei_jingge",
        residentNpcName: "陈九",
      },
      玄清道院: {
        x: 1, y: 3,
        desc: "绕过月洞门便换了气象，院中种着两株老银杏，青砖地上用白灰画着十二庄站桩方位，空气里混着淡檀香与晒干的陈艾味。",
        exits: { w: "抄经堂" },
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
        desc: "都事柳青鸢的府邸，锦官城任务线核心场景，老兵退伍汉作为随从常驻此处伺候。前院值房收投效当差的帖子，公事公办。",
        exits: { w: "天下商行", s: "醉仙楼", ne: "刑名东厢·卷宗库房", e: "府衙花厅·青鸢书房" },
        buildingId: "sect_entry_guan",
        residentNpcName: "柳青鸢",
      },
      "府衙花厅·青鸢书房": {
        x: 4, y: -1,
        desc: "窗外几竿瘦竹映在素色窗纸上，案头摆着一只未放出的月白河灯与半碟冷掉的椒盐酥，书架最顶层压着几封落款「望贵府查收附件」的复写信稿。",
        exits: { w: "都事府", n: "书房暗格·青囊密档室" },
        unlockCondition: { type: "any", of: [
          { type: "factionRep", faction: "锦官城", min: 15 },
          { type: "questStarted", questId: "jinguancheng_guan1_xinren" },
        ] },
      },
      "书房暗格·青囊密档室": {
        x: 4, y: -2,
        desc: "拨动书架后那只无字的青铜镇纸，木壁无声滑开，逼仄石室里只亮着一盏豆大油灯，墙上用红线密密麻麻连起了曲措乡、白塔、天都香行与六年前一桩失踪案的全部线索。",
        exits: { s: "府衙花厅·青鸢书房" },
        unlockCondition: { type: "all", of: [
          { type: "questCompleted", questId: "jinguancheng_guan1_xinren" },
          { type: "favor", npc: "柳青鸢", min: 60 },
          { type: "factionRep", faction: "锦官城", min: 40 },
        ] },
      },
      "刑名东厢·卷宗库房": {
        x: 3, y: -3,
        desc: "顶天立地的樟木架挤满泛黄册籍，樟脑丸与陈年霉墨的气味扑鼻而来，角落那张旧案桌上堆着从三十年前积灰至今的边地鱼鳞图册。",
        exits: { sw: "都事府" },
        unlockCondition: { type: "any", of: [
          { type: "factionRep", faction: "锦官城", min: 40 },
          { type: "questStarted", questId: "jinguancheng_zhi3_hongmotuming" },
        ] },
      },
      唐门暗巷: {
        x: 1, y: -2,
        desc: `　　暗巷再往里，光就没了。尽头一扇黑漆门，门上没有招牌，只钉着一枚铜钱大的暗器当门钉——三棱，带血槽。
　　推门进去是唐门的外围铺面。柜台后头架子上分格摆着暗器与瓶罐，标签都是手写的，字很小。这里暗器、毒药、解药都卖，不赊账，也不问你买去做什么。`,
        exits: { s: "暗巷入口", e: "城隍庙旧墙", ne: "暗巷隔间·验货室" },
        buildingId: "tangmen_shop",
        residentNpcName: "唐三少",
      },
      "暗巷隔间·验货室": {
        x: 2, y: -3,
        desc: "柜台后暗门推开是间无窗砖室，墙角堆着标有“茶砖”字样的黑木箱，箱缝里隐约渗出苗疆紫烟草的腥香。",
        exits: { sw: "唐门暗巷" },
        unlockCondition: { type: "any", of: [
          { type: "factionRep", faction: "唐门", min: 15 },
          { type: "questStarted", questId: "tangmen_1_anxianglaike" },
        ] },
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
        exits: { w: "锦官大车店", e: "城东营房" },
        buildingId: "transport_jingguan",
      },
      城东营房: {
        x: 4, y: 0,
        desc: "城东一溜青砖营房，都事府的差役在此歇脚操练，檐下挂着梆子与水火棍。后墙库房归班头侯敢看管——制式兵备与罚没物件都在册子上。",
        exits: { w: "马行", s: "北衙地底·铁栅暗牢" },
        buildingId: "sectshop_guan",
        residentNpcName: "侯敢",
      },
      "北衙地底·铁栅暗牢": {
        x: 4, y: 1,
        desc: "湿冷的青砖甬道向下盘旋十二级，尽头是三间玄铁铸栏的死囚室，油灯晃动间能听见水滴砸在铁镣上的脆响，专关不能见光的江湖要犯与敌派细作。",
        exits: { n: "城东营房" },
        unlockCondition: { type: "all", of: [
          { type: "factionRep", faction: "锦官城", min: 40 },
          { type: "any", of: [
            { type: "questStarted", questId: "jinguancheng_zhi2_tianduanxian" },
            { type: "questStarted", questId: "jinguancheng_guan2_guitu" },
          ] },
        ] },
        buildingId: "jingguan_iron_dungeon",
      },
    },
  }
} };
