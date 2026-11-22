export default { district: {
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
        exits: { w: "镇口", e: "天都香行" },
        buildingId: "inn_tiandu",
      },
      孟记铁铺: {
        x: 0, y: -1,
        desc: "孟老汉开的铁匠铺，炉火熊熊，武器护甲一律现货，不接私打订单。",
        exits: { s: "镇口", n: "后山小径" },
        buildingId: "smithy_tiandu",
      },
      后山小径: {
        x: 0, y: -2,
        desc: "孟记铁铺后一条碎石小径，蜿蜒上山。松涛阵阵，空气里松脂味很重。走到尽头，能看见一栋不该出现在这里的建筑。",
        exits: { s: "孟记铁铺", n: "山间别墅" },
      },
      山间别墅: {
        x: 0, y: -3,
        desc: `　　山腰一栋两层独栋，白墙灰瓦，一整面落地大窗，外头围一圈木栅栏院子。跟周遭所有藏式石楼都格格不入——像是从很远很远的地方，整个搬过来的。
　　院门口一棵老松，树下一张石桌两个石凳，石面被雨水冲出浅浅的纹。院角一小块空地，土翻过，还没种上东西。
　　推开落地窗是一楼客厅，木楼梯通二楼，踩上去会响。`,
        exits: { s: "后山小径", n: "一楼客厅" },
        unlockCondition: { type: "item", itemName: "银灰色钥匙" },
      },
      一楼客厅: {
        x: 0, y: -4,
        desc: `　　开放式的一间大厅。壁炉没生火，炉膛里堆着上一任主人烧剩的炭灰；壁炉架上落了一层细灰，用指头一划就是一道。一组布艺沙发，垫子拍一拍能扬起半尺高的尘。
　　靠窗一张书桌。厨房连着客厅，灶台比寻常人家大三倍，调料架、烤炉一应俱全。墙边立着那只铁柜子，还是冰的——始终没人搞得懂它靠什么冷着。`,
        exits: { s: "山间别墅", n: "二楼主卧" },
        buildingId: "kitchen_shanbie",
        unlockCondition: { type: "item", itemName: "银灰色钥匙" },
      },
      二楼主卧: {
        x: 0, y: -5,
        desc: `　　一张双人床，白色床单绷得很平。床头两盏油灯，灯罩上有烧焦的小点。衣柜空着，拉开时里头一股干木头味。
　　窗子正对山谷，早晨能看见云海压在半山腰上。窗台架着一只铜制望远镜，镜筒磨得发亮，正对着谷口那条路。`,
        exits: { s: "一楼客厅" },
        buildingId: "chest_shanbie",
        unlockCondition: { type: "item", itemName: "银灰色钥匙" },
      },
      天都镖局: {
        x: -1, y: 0,
        desc: "天都镇的镖局，接押送任务。",
        exits: { e: "镇口", w: "玉器轩" },
        buildingId: "escort_tiandu",
      },
      玉器轩: {
        x: -2, y: 0,
        desc: "经营玉器古玩的铺子。后院另有一处赌石料场。",
        // 原设计从镇口s方向引出，但s已被百花楼占用，改由天都镖局引出，
        // 保持"从镇口出发一定能走到玉器轩"这条路径不断
        exits: { e: "天都镖局", n: "玉石料场" },
        buildingId: "antique_tiandu",
      },
      玉石料场: {
        x: -2, y: -1,
        desc: "玉器轩后院的赌石坊，堆满未开的原石。温掌柜在此坐镇，赌客围着解玉台起哄竞价。",
        exits: { s: "玉器轩" },
        buildingId: "gamblestone_tiandu",
        residentNpcName: "温掌柜",
      },
      天都香行: {
        x: 2, y: 0,
        desc: "欢喜教明面据点，三丈高的紫檀博古架码满青瓷香罐，檀香、龙脑与云南沉水香的气味混在一起，柜台后李掌柜拨着算盘招呼生客。",
        exits: { w: "天都行脚楼", e: "香行内堂", n: "品香雅座" },
        buildingId: "grocery_tiandu",
        residentNpcName: "李掌柜",
      },
      品香雅座: {
        x: 2, y: -1,
        desc: "竹帘低垂的四张矮榻间雾气氤氲，铜炉里燃着令人浑身发懒的淡甜熏香，几名遮着面纱的熟客低声交耳，茶杯底下压着银票。",
        exits: { s: "天都香行" },
        buildingId: "teahouse_pinxiangya",
      },
      香行内堂: {
        x: 3, y: 0,
        desc: "香行柜台后一道竹帘隔出的内堂，香气比前头浓得多。罗琦常在此接待外客。",
        exits: { w: "天都香行", e: "欢喜堂", s: "晒香天井" },
        residentNpcName: "罗琦",
      },
      晒香天井: {
        x: 3, y: 1,
        desc: "青石板天井摆满数十只竹匾，晾晒着暗红的藏红花与碾碎的草根。影壁后一块青砖小校场四周种满高竹，内院弟子入夜便在此演练天竺转手与迷香身法。",
        exits: { n: "香行内堂", s: "调香药房" },
        buildingId: "wuguan_huanxitang",
        residentNpcName: "老何",
      },
      调香药房: {
        x: 3, y: 2,
        desc: "满屋都是石臼、铜蒸馏甑与贴着天竺文标签的琉璃瓶，甜腻的药气里藏着一丝极淡的苦杏仁味，案头摊着未晒干的香泥。阿雅收各地送来的珍稀药材。",
        exits: { n: "晒香天井" },
        residentNpcName: "阿雅",
        unlockCondition: { type: "any", of: [
          { type: "questCompleted", questId: "huanxijiao_1_xiangzhongyi" },
          { type: "rep", faction: "欢喜教", min: 15 },
        ] },
      },
      欢喜堂: {
        x: 4, y: 0,
        desc: "由旧仓库改建的暗沉佛堂，不设窗棂，仅点十二盏酥油长明灯，正中供着一尊半人高的黑铜天竺旧神像。偏厅设坛城香案，梵衍那在此收徒。",
        exits: { w: "香行内堂", s: "莲花廊", n: "伽罗秘龛", e: "伽罗旧神殿" },
        buildingId: "sect_entry_huanxi",
        residentNpcName: "梵衍那",
        // 香2 第三步罗琦领人进正殿见梵衍那，所以请过茶（s2）就开门。
        unlockCondition: { type: "any", of: [
          { type: "questCompleted", questId: "huanxijiao_2_biwuzhaoxian" },
          { type: "flag", flag: "quest_huanxijiao2_s2" },
        ] },
      },
      伽罗旧神殿: {
        x: 5, y: 0,
        desc: "欢喜堂正殿主龛，供奉着梵衍那从天竺一路背来的黑铜旧神。酥油灯影摇曳，在这里静坐一炷香，倒真能平复几分心头躁火。",
        exits: { w: "欢喜堂" },
        buildingId: "temple_huanxifo",
        unlockCondition: { type: "questCompleted", questId: "huanxijiao_2_biwuzhaoxian" },
      },
      莲花廊: {
        x: 4, y: 1,
        desc: "青瓦连廊下晾着粗布工装与几把擦得雪亮的短弯刀，院角老槐树下摆着石桌茶壶，偶尔能听见大理调子的小曲和玉泉牧歌混在一处。",
        exits: { n: "欢喜堂" },
        buildingId: "chest_xianghangkufang",
        residentNpcName: "桑杰",
        unlockCondition: { type: "any", of: [
          { type: "flag", flag: "欢喜教弟子" },
          { type: "rep", faction: "欢喜教", min: 40 },
        ] },
      },
      伽罗秘龛: {
        x: 4, y: -1,
        desc: "顺着神像背后湿冷的石阶下行三丈，狭小石室里堆着七口铁皮箱——半数装着沉甸甸的私铸银锭与天竺舆图，另一只檀木匣里压着一本沾血的官府公文。",
        exits: { s: "欢喜堂" },
        unlockCondition: { type: "questCompleted", questId: "huanxijiao_4_jinguanchengdeanxian" },
      },
      百花楼: {
        x: 0, y: 1,
        desc: "百花门核心据点，明面上是酒楼，暗地里养蛊炼香，兰姐常驻于此。",
        exits: { n: "镇口", e: "听风雅阁", s: "百花暖棚", w: "昆明阁" },
        buildingId: "rest_baihualou",
        residentNpcName: "兰姐",
      },
      听风雅阁: {
        x: 1, y: 1,
        desc: "雕花隔扇后立着整面墙的账册与客商名帖，苏折柳伏在案前轻拨算盘，半开的支摘窗斜斜对着西市天都香行的后墙角。",
        exits: { w: "百花楼", e: "彩雀暗檐" },
        buildingId: "tea_baihua_tingfeng",
        residentNpcName: "苏折柳",
      },
      彩雀暗檐: {
        x: 2, y: 1,
        desc: "屋脊阴面搭着一排刷了桐油的竹笼，养着几十只滇南驯化的绿背彩雀，每日可免费领走一只传书。",
        exits: { w: "听风雅阁" },
        buildingId: "pigeon_baihua_caique",
        residentNpcName: "小蝉",
      },
      昆明阁: {
        x: -1, y: 1,
        desc: "屋子窄得只摆得下一张竹榻、半架古琴和一幅泛黄的滇南山川图，案头供着一块无字樟木牌。",
        exits: { e: "百花楼" },
        unlockCondition: { type: "questCompleted", questId: "lanjie_line" },
      },
      百花暖棚: {
        x: 0, y: 2,
        desc: "几重抹了桐油的厚纸天窗兜住高原难得的暖气，紫花蔓陀罗与普通月季挨挤着疯长，青石空地白日晒药、入夜传艺。",
        exits: { n: "百花楼", e: "花医静室", w: "百花暗阁", s: "地窖养蛊房" },
        buildingId: "wuguan_baihua_huapeng",
        residentNpcName: "花婆",
      },
      花医静室: {
        x: 1, y: 2,
        desc: "暖棚东侧的净室，燃着驱虫艾草，花婆坐堂施针拔毒；伤重或中了奇毒的江湖客在此调理片刻便能立见起色。",
        exits: { w: "百花暖棚" },
        buildingId: "hosp_baihua_qudu",
      },
      百花暗阁: {
        x: -1, y: 2,
        desc: "藏在暖棚拐角的一间无匾药铺，货架上摆着祛瘴花露、苗银细针与做旧药水，掌柜只认银子与熟面孔。",
        exits: { e: "百花暖棚" },
        buildingId: "med_baihua_ange",
      },
      地窖养蛊房: {
        x: 0, y: 3,
        desc: "顺着暖棚水井旁的活板门拾级而下，阴冷石壁上密密麻麻嵌着百余只黑陶蛊坛，豆大油灯晃过，映得阿芷腕间那条金蚕泛起一丝幽蓝冷光。",
        exits: { n: "百花暖棚" },
        unlockCondition: { type: "flag", flag: "baihua_cellar_unlocked" },
        residentNpcName: "阿芷",
      },
    },
  }
} };
