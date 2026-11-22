export default { residentGroup: {
天都镇: [
    {
      name: "赫连铸", id: "resident_helianzhu", levelCap: 2,
      brief: "堵在镇口收过路费的恶汉",
      personality: "欺软怕硬，嘴臭，仗着一身蛮力横行；真被打服了立刻跪地求饶，转头又跟人吹自己是让着对方。",
      fullBio: `赫连铸，天都镇镇口的一号泼皮。膀大腰圆，一柄开山锤从不离手，在镇口那道石牌坊底下一蹲就是三年，
过往商队要交"过路费"，五十两起，给不起就留下包袱。镇上人敢怒不敢言——镖局懒得管这种小事，
官府在锦官城，管不到这儿。
他脖子上常年挂着一把银灰色的钥匙，用一根牛皮绳系着，洗澡都不摘。有人问过那是什么，
他说是三年前一个雷雨夜从天上掉下来的，砸在他脚边，烫了好一会儿才凉。他不识字，看不懂上面的纹路，
只觉得这东西邪门又值钱，便一直挂着当护身符——也当个念想，觉得自己迟早要靠它发一笔横财。
其实他连那钥匙开的是什么门都不知道。`,
      carry: [
        { name: "开山锤", category: "weapon", quality: "蓝" },
        { name: "牛皮护腕", category: "armor", quality: "绿" },
        { name: "牦牛骨扳指", category: "accessory", quality: "白" },
        { name: "过路费钱袋", category: "misc", quality: "绿" },
        { name: "劣质烧刀子", category: "misc", quality: "白" },
        { name: "半张欠条", category: "misc", quality: "白" },
        { name: "缺角骰子", category: "misc", quality: "白" },
        { name: "油腻头巾", category: "misc", quality: "白" },
      ],
      // 必掉：打赢他一定拿到这把钥匙，不看气运。见 MudRPG duelFinishHandler 的
      // guaranteedDrop 分支——寻常战利品是按气运掷骰的随机掉落，钥匙这种"卡住
      // 一整栋安全屋"的关键物件不能交给骰子，否则玩家反复打同一个人刷钥匙，
      // 既难受又莫名其妙。
      guaranteedDrop: { name: "银灰色钥匙", category: "misc", quality: "蓝",
        desc: "从赫连铸脖子上搜出来的。材质不是铜也不是铁，摸上去始终冰凉，表面有极细的纹路，凑近看像某种没见过的文字。他说这是从天上掉下来的。" },
    },
    {
      name: "温掌柜", id: "resident_wenzhanggui", levelCap: 2,
      brief: "玉器轩女掌柜、赌石坊庄家",
      personality: "短发金环、黑蕾丝旗袍，慵懒眯眼笑，笑里藏生意人的精。主持赌石竞价与回收兜底，也是托儿局的安插者。",
      fullBio: `温绾，人称温掌柜，天都镇玉器轩掌柜、赌石坊幕后庄家，三十许人。大理城玉器行东家之女，
及笄那年随商队来天都镇接手分号，一守十余年。玉器轩明面做玉器生意，暗地赌石坊才是真正的营生——
原石买卖、开窗竞价、私下牵线，整个天都镇的玉石流通都跟她沾边。
外貌：短发利落，一对金环耳坠，常年一身黑蕾丝旗袍，倚在铺子后堂的圈椅里慵懒地眯眼笑，
像只晒足了太阳的猫；不戴玉——"卖玉的戴玉，是跟客人抢生意"；指尖养着常年摸玉的薄茧，
一块胚料翻三圈就能说出成色，十次中八九。
性格：谈价时的笑"像猫打呼噜，看着舒服，爪子还醒着"。砣机旁常搁一把小紫砂壶喝黄酒，
"看石头不能太清醒，太清醒了不敢赌"。是苏宛的干姑母，两人在赌石坊与玉器轩之间做局牵线。
职责：赌石竞价的主持与回收兜底人（所有竞价都不满意时可直接卖她，回收价低于市价但从不拒收，
"裂了的料有裂了的用处，天底下没有真废的东西，只有不认账的人"），也是托儿局的安插者。`,
      carry: [
        { name: "天都短匕", category: "weapon", quality: "白" },
        { name: "马帮硬皮褂", category: "armor", quality: "绿" },
        { name: "蜜蜡手串", category: "accessory", quality: "蓝" },
        { name: "参须茶包", category: "misc", quality: "白" },
        { name: "天都桂花酿", category: "misc", quality: "蓝" },
        { name: "核桃糕", category: "misc", quality: "蓝" },
        { name: "假死药", category: "misc", quality: "蓝" },
      ],
    },
    {
      name: "梵衍那", innerRoom: "香行内堂", id: "resident_fanyanna", levelCap: 3,
      brief: "欢喜教教主，天竺流亡王子",
      personality: "六十余岁，温和慈祥，会五种语言，念念不忘攒钱回乡",
      carry: [
        { name: "梵铃杵", category: "weapon", quality: "紫" },
        { name: "欢喜堂内院锦襕", category: "armor", quality: "紫" },
        { name: "鸡足山贝叶经残片", category: "accessory", quality: "紫" },
        { name: "安息香", category: "misc", quality: "绿" },
        { name: "迦南脂", category: "misc", quality: "蓝" },
        { name: "天竺神油", category: "misc", quality: "绿" },
        { name: "梵衍那的芒果酒", category: "misc", quality: "紫" },
      ],
      fullBio: `其人（总纲第五章·欢喜教）：梵衍那不是本名，是天竺故地的地名，
以故乡为号。六十余岁，皮肤黝黑，须发皆白，会说五种语言（含带大理
口音的汉话）。年轻时是天竺某小邦的王子，被叔父篡位后流亡，在大理
住了十年、缅甸住了五年，最后辗转来到曲措乡。选天都镇的表面理由是
"这里气候像大理"，真实理由是——这里没人查他的来历。对外自称香料
商人，天都镇的香料铺"天都香行"实际是他开的。人设核心是"亡国遗老
攒钱回乡"。

组织：梵衍那是欢喜教教主，义女罗琦是圣女兼实际管事。教主年纪大了，
大部分日常决策是罗琦在做，教内年轻一代更听她的。据点两处：明面是
天都香行（正经生意，账目经得起查），暗面是后院欢喜堂（改建的小佛堂，
供一尊天竺旧神像，"欢喜佛的前身"）。信众分三层：外院普通香客（不知
欢喜教存在）、中院供养人（捐钱换轻微上瘾的"特制药香"）、以及更核心
的一层。他对罗琦说过："你是我最利的刀，也是我唯一的软肋。"

站位与线索：欢喜教对百花门井水不犯河水，对喇嘛庙刻意回避，对锦官城
都事高度警惕，对土司府年年送小礼、维持"不值得查"的存在感。关键伏笔
是——梵衍那与都事柳青鸢失踪多年的上司，调查线索存在交集，柳青鸢因此
投鼠忌器、不敢真动欢喜教。他不以拳脚斗人，六十余岁的身手靠的是异域
秘术与摄心之法，紫档的分量在"谋"与"术"，不在力。`,
    },
    {
      name: "罗琦", id: "resident_luoqi", levelCap: 4,
      brief: "欢喜教圣女，梵衍那义女",
      personality: "外表明艳，实际管事精明，对教众有真心的关照",
      carry: [
        { name: "锦官精铁剑", category: "weapon", quality: "蓝" },
        { name: "百香纱衣", category: "armor", quality: "蓝" },
        { name: "旧铜镜", category: "accessory", quality: "紫" },
        { name: "云锦香囊", category: "accessory", quality: "蓝" },
        { name: "鸡足山贝叶露", category: "misc", quality: "蓝" },
        { name: "大理白药", category: "misc", quality: "绿" },
        { name: "蜜渍青梅", category: "misc", quality: "绿" },
        { name: "罗琦的陈皮红豆沙", category: "misc", quality: "蓝" },
      ],
      fullBio: `其人（总纲第五章·欢喜教）：罗琦这名字是梵衍那给起的，意为"光明"。
她是梵衍那的义女，二十出头，母亲是天竺人和大理白族的混血。梵衍那在
大理收养了她，教她读书、经商、识人。十四岁能替梵衍那谈香料生意，
十六岁开始打理天都镇香堂的日常事务。如今她是欢喜教圣女兼实际管事，
权力范围远超一个"义女"该有的——大部分日常决策都是她在做。

手段：梵衍那说她"是我最利的刀，也是我唯一的软肋"。罗琦从不当面回应
这句话，但每次有人来香堂闹事，她都会在对方茶里下药，剂量刚好让人
忘记自己为什么来，却不会让人忘记回家的路——分寸感极准。她手里有一
份中院供养人的名单，记录着每个人的把柄。她的橙档实力不在硬桥硬马，
而在这一手不着痕迹的用药与拿捏。

重要区分（总纲特别提示）：罗琦与百花门"兰姐"是完全独立的两个角色，
容易因为都在天都镇、都是地下秩序头目而被误认成同一人——罗琦是欢喜教
圣女、天竺与大理混血；兰姐是百花门主、苗族出身。外貌、势力、情感线
全部各自独立，不要混淆。

情感线：罗琦是跑马大会女伴候选之一，含 30／60 档的情感线（五个
"深入了解"任务 + 四选一结局分支），与梅朵、呼延雪等同级别对待。`,
    },
    {
      name: "老何", innerRoom: "香行内堂", id: "resident_laohe", levelCap: 2,
      brief: "欢喜教内院弟子，大理摆渡人出身",
      personality: "沉默寡言，把梵衍那当再生父母，说话实诚",
      carry: [
        { name: "天都短匕", category: "weapon", quality: "白" },
        { name: "脚夫护肩", category: "armor", quality: "白" },
        { name: "脚夫铜牌", category: "accessory", quality: "白" },
        { name: "马帮干粮包", category: "misc", quality: "白" },
        { name: "马帮醒神油", category: "misc", quality: "绿" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "甘草解毒汤", category: "misc", quality: "白" },
      ],
    },
    {
      name: "阿雅", innerRoom: "香行内堂", id: "resident_ayabuddhist", levelCap: 1,
      brief: "欢喜教内院弟子，缅甸出身",
      personality: "机灵懂事，念着梵衍那的赎身之恩，对罗琦亲近",
      carry: [
        { name: "天都短匕", category: "weapon", quality: "白" },
        { name: "乡勇布甲", category: "armor", quality: "白" },
        { name: "村社护佑结", category: "accessory", quality: "白" },
        { name: "薄荷醒神叶", category: "misc", quality: "白" },
        { name: "冰片", category: "misc", quality: "白" },
        { name: "蛇药", category: "misc", quality: "绿" },
        { name: "青稞饼", category: "misc", quality: "白" },
      ],
    },
    {
      name: "桑杰", innerRoom: "香行内堂", id: "resident_sangjie_neiyuan", levelCap: 1,
      brief: "欢喜教内院弟子，玉泉寨出身",
      personality: "曾被诬陷打成半死，念着梵衍那的救命之恩，沉默中带着感激",
      carry: [
        { name: "狼曲短猎矛", category: "weapon", quality: "白" },
        { name: "氆氇藏袍", category: "armor", quality: "绿" },
        { name: "村社护佑结", category: "accessory", quality: "白" },
        { name: "牦牛骨髓粉", category: "misc", quality: "白" },
        { name: "风干牦牛肉", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "止血散", category: "misc", quality: "白" },
      ],
    },
    {
      name: "李掌柜", id: "resident_lizhanggui", levelCap: 2,
      brief: "天都香行掌柜，茶叶商，见谁都认识",
      personality: "健谈爱八卦，见人说人话见鬼说鬼话，但心地不坏；嘴上什么都说，真要紧的事一个字不漏。",
      carry: [
        { name: "金珠算盘", category: "weapon", quality: "蓝" },
        { name: "天竺棉布缠头", category: "armor", quality: "白" },
        { name: "铜钱压襟", category: "accessory", quality: "白" },
        { name: "马帮路引", category: "accessory", quality: "绿" },
        { name: "安息香", category: "misc", quality: "绿" },
        { name: "天竺粗香饼", category: "misc", quality: "白" },
        { name: "参须茶包", category: "misc", quality: "白" },
        { name: "白族三道茶", category: "misc", quality: "绿" },
      ],
      fullBio: `李掌柜，天都香行的掌柜。早年跑锦官城到天都镇的茶叶生意，三条官道上的茶馆、
客栈、镖局都混了个脸熟，后来被梵衍那请来坐柜台——香行明面上的账、来往的生客、
镇上的闲话，都从他这里过一遍。
他知道后院欢喜堂的存在，也知道什么人该往里引、什么人该挡在门外。对生人他话多，
多到让人以为他什么都肯说；真问到内堂和后院，他就笑着把话头岔回茶叶上。
欢喜教的第一条线头由他放出去：看中的人，他会压低声音指一条路——去行脚楼要
地字号房，夜里听听隔壁后墙的动静。`,
    },
  ]
} };
