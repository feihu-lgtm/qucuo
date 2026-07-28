// 据点固定驻场NPC：跟 npcPool.js 的"游走/按权重随机出现"是相反的概念——
// 这里登记的NPC只要玩家进了对应据点，就一定会出现在 room.npcs 里，不受
// 任何权重/时间段判定影响。
//
// 【为什么需要这份数据】感叹号任务面板的判定逻辑极其简单：
//   room.npcs?.some(n => n.name === quest.giver)
// 只要这个字符串在当前 room.npcs 里能找到，任务就会被检测到、显示出来。
// 但 qucuoQuests.js 里有7个任务的giver（巴桑/卓央/丹增/兰姐/梵衍那/罗琦/
// 柳青鸢），在 presets/qucuo.js 的初始房间数据、npcPool.js 的游走池里都
// 找不到对应实体——因为 presets/qucuo.js 只给开局据点（鱼定村）配置了
// 初始NPC，玩家走到其他据点，NPC是AI临场生成的，感叹号面板永远检测不到
// 这些具名剧情角色，他们的任务实质上永远不会出现在面板上。
//
// 这份表就是补这个缺口：登记"哪个据点，该固定驻场谁"，MudRPG.jsx 里
// 复用护镖任务"强制注入targetNpc"的同一个模式（见现有 activeEscortTargets
// 那段逻辑），玩家一进这个据点，就把对应固定NPC强制塞进 room.npcs，不用
// AI去猜、也不受随机权重影响。
//
// 【与 innerMap.js residentNpcName 的关系】innerMap.js 里的 residentNpcName
// 只回答"这个人该在哪个内层小房间"，是更细粒度的房间归属信息；这份表
// 回答的是更基础的一层问题："这个人到底存不存在于游戏运行时的NPC列表
// 里"。两者不冲突，配合使用：这份表负责"把人加载出来"，innerMap.js的
// residentNpcName 负责"在内层UI层面过滤展示到具体哪个房间"。
//
// brief/personality 字段跟 npcPool.js 保持同样的结构，供AI叙事时注入。
//
// 【carry 设计原则】每人≥7件：≥1武器+≥1护甲+≥1饰品+杂物若干。
// 武器类型配合武学风格（剑客配剑、掌法配杖/短匕、骑射配弩、寨主多兵器）。
// 具名物优先用 catalog 里有主的（掉出来有来历），缺口从制式通货池补。
// 品质不超 levelCap 对应档（白0/绿1/蓝2/紫3/橙4/红5）。

export const RESIDENT_NPCS = {
  鱼定村: [
    {
      name: "才旦", id: "resident_caidan", levelCap: 1,
      brief: "村长之女，账算得滴水不漏",
      personality: "工于心计说话不留破绽，卸下防备才露出年纪相符的脆弱",
      carry: [
        { name: "鱼定猎刀", category: "weapon", quality: "白" },
        { name: "鱼定粗布短打", category: "armor", quality: "白" },
        { name: "村社护佑结", category: "accessory", quality: "白" },
        { name: "才旦的薄荷脑", category: "misc", quality: "白" },
        { name: "酥油炒面", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "止血散", category: "misc", quality: "白" },
      ],
    },
    {
      name: "老孙", id: "resident_laosun", levelCap: 1,
      brief: "老孙饭馆的掌柜",
      personality: "实在憨厚，藏着当年被岳父嫌弃的心结，嘴上不饶人心里认账",
      carry: [
        { name: "市集杀猪刀", category: "weapon", quality: "白" },
        { name: "熊皮坎肩", category: "armor", quality: "绿" },
        { name: "脚夫铜牌", category: "accessory", quality: "白" },
        { name: "老孙饭馆的糌粑", category: "misc", quality: "白" },
        { name: "熊曲鱼汤面", category: "misc", quality: "绿" },
        { name: "青稞酒", category: "misc", quality: "白" },
        { name: "牦牛粪饼", category: "misc", quality: "白" },
      ],
    },
    {
      name: "鱼定大娘", id: "resident_yudingdaniang", levelCap: 1,
      brief: "村里的厨娘，热心肠，谁上山都塞一包炒面",
      personality: "爽利豪快爱张罗，主张藏汉不分家（「水都不分家，人分什么家」），儿子小孙与张商人之女私定终身，正为两家老人不点头发愁",
      carry: [
        { name: "熊山柴斧", category: "weapon", quality: "白" },
        { name: "乡勇布甲", category: "armor", quality: "白" },
        { name: "村社护佑结", category: "accessory", quality: "白" },
        { name: "艾草止血贴", category: "misc", quality: "白" },
        { name: "酥油炒面", category: "misc", quality: "白" },
        { name: "甜奶茶", category: "misc", quality: "白" },
        { name: "牦牛骨髓粉", category: "misc", quality: "白" },
      ],
    },
    {
      name: "大公鸡", id: "resident_dagongji", levelCap: 0,
      beast: true, respawn: true, cannotSpeak: true,
      brief: "村口一只油亮好斗的大公鸡",
      personality: "扑棱着翅膀满地乱窜，见人就啄，偏偏又打不过就跑、跑两步又回头挑衅",
      carry: [
        { name: "乡勇木棓", category: "weapon", quality: "白" },
        { name: "乡勇布甲", category: "armor", quality: "白" },
        { name: "村社护佑结", category: "accessory", quality: "白" },
        { name: "金蛋", category: "misc", quality: "绿" },
        { name: "牦牛粪饼", category: "misc", quality: "白" },
        { name: "熊山松茸", category: "misc", quality: "白" },
        { name: "狼曲冷水鱼", category: "misc", quality: "白" },
      ],
    },
    {
      name: "雪豹", id: "resident_snow_leopard", levelCap: 2,
      beast: true, cannotSpeak: true, companionCandidate: true,
      brief: "通体雪白的灵兽，眼神沉静，只安安静静卧在村口一角",
      personality: "不惧生人也不主动亲近，只是静静看着，仿佛在等一个自己认准的人",
      fullBio: `归属与命定（重要·纠正旧误传）：这头通体雪白的雪豹，并非嘎则或任何人的
兽——嘎则养的是白虎雪团，与它无关。它无主，自雪线之上而来，长长久久卧在村口
那块青石上，不亲近谁，也不归谁所有，只静静等着一个它自己认准的人。那个人是
玩家，且只能是玩家。它与玩家之间是命定的羁绊，前世便结下的缘分，一旦认主便
忠贞无二，此生只随玩家一人，旁人再不能使它低头。它不通人言，喜怒哀乐全凭动作、
眼神、姿态传达——以额抵掌、绕身而行、伏低臣服，都是它不必开口的情意。

兽形之貌：通体雪白不带一丝杂色，唯耳尖尾梢缀着几枚墨斑，金瞳沉静如琥珀，
粗长的尾巴随呼吸轻轻起伏。卧时像一尊雪塑的兽像，动时却快得只剩一道白影。

化形之伏笔：乡间有极老的传闻，说雪线之上的灵兽若与认主之人情深至此，便能褪去
兽身、化为人形相伴——但那要等情意攒到极深才成，眼下它仍是一头安静的兽，卧在
玩家脚边，把这份没说出口的认定，一寸寸攒着。（化形后的形貌与私密性情，待情意
足够时方显，此处不表。）`,
    },
    {
      name: "珍珠", id: "resident_pearl", levelCap: 2,
      beast: true, cannotSpeak: true, companionCandidate: true, affectionable: true,
      brief: "村口一匹通体雪白的小白马，睫毛长长，丰神俊朗，此刻正低着头专心啃草",
      personality: "志不在驰骋，平生最爱干饭与躺平，看着惫懒，认主后却忠心无二、脚力惊人",
      carry: [
        { name: "珍珠的缰绳", category: "accessory", quality: "蓝" },
        { name: "藏纹小马鞍", category: "armor", quality: "绿" },
        { name: "一袋青稞精料", category: "misc", quality: "绿" },
        { name: "晒干的苜蓿草", category: "misc", quality: "白" },
      ],
      fullBio: `长相与名字：珍珠是一匹通体雪白的小白马，名字正来源于这一身珍珠似的白毛。
它长得颇为俊美，睫毛长长的，丰神俊朗，是那种一眼就让人想多看两眼的马。可它
原本有个浪漫的藏语名字，叫"哈瓦夏日"，译过来是"灰色的梅花鹿"——跟它这身白
完全不搭，像是谁随口起的，又像是它骨子里那点不肯随俗的劲儿。

反差萌的性子：与旁人"赛马王子"的想象相反，珍珠对比赛毫无兴趣。它平生两大爱好——
专心干饭，就地躺平。你骑它，它走两步就要低头啃草；你催它，它甩甩尾巴当没听见。
村里人都说它志不在夺冠，更适合当个无忧无虑的宠物。可真正认了主、真要护主的时候，
这匹马撒开四蹄快得像一道白影，脚力强健得吓人——那份惫懒底下，藏着的是不肯轻易
示人的真本事。

坐骑之身：它此刻是被人骑着的坐骑，温顺地立在村口，由着人上下，只是眼神里总带着
一点"快点结束我好去吃饭"的淡定。它认主，且只认一个——一旦认准了，便忠心无二，
驮着那人走再远的路也不抱怨（顶多路上多啃两口草）。它不会说话，喜怒哀乐全凭嘶鸣、
甩尾、低头蹭人传达，是一匹把情意都放在四蹄上的马。`,
    },
  ],
  鱼定土司: [
    {
      name: "梅朵", id: "resident_meiduo", levelCap: 3,
      brief: "鱼定土司之女，外向直接",
      personality: "敢说敢做，讨厌拐弯抹角，对父亲的一些做法不满，仗义护友",
      carry: [
        { name: "马帮护商弩", category: "weapon", quality: "绿" },
        { name: "马帮硬皮褂", category: "armor", quality: "绿" },
        { name: "梅朵的马鞭", category: "accessory", quality: "蓝" },
        { name: "马帮路引", category: "accessory", quality: "绿" },
        { name: "手抓羊肉", category: "misc", quality: "绿" },
        { name: "青稞酒", category: "misc", quality: "白" },
        { name: "马帮干粮包", category: "misc", quality: "白" },
      ],
      fullBio: `设计定位（总纲1.1节·父女道德对照组）：梅朵是土司桑杰朵杰的女儿，
她与父亲构成一组刻意保留的"父女道德对照"——父亲是被三十年旧怨扭曲的
制度性剥削者，女儿则外向、直接、见不得不义。她对父亲的一些做法明确
不满，敢说敢做，讨厌拐弯抹角，仗义护友。

几件事看她的性子（总纲第二章）：管家独子被狼王咬死、土司求雪山派下山
报仇被拒时，梅朵看不下去，瞒着父亲自己跑去大草甸找狼王——因为她心里
清楚，自己欠管家的不是恩、是歉：小时候她落水，是管家的儿子救了她，
这份歉她从来不提。锦官城要在鱼定村设收税点，土司还没回复，梅朵已经
把那封渗透信当场撕了。听说锦官城的人上了后山平台，她二话不说骑马
直冲上去——她不管失踪的官差是谁，她只认一条："跑马会是她的地方，
谁也不能在那里撒野。"

其武（紫档）：她是骑射出身的巾帼，招式直率刚猛、认准就上，跟她"讨厌
拐弯抹角"的性子一路——不玩阴的，靠的是一股护着身后人一步不退的
硬气。

关联与结局：她是跑马大会女伴候选之一，含 30／60 档情感线；也曾乔装
顶替怯懦书生上生死擂台（任务"真假大侠"里主角的对手竟是乔装的她）。
终局若柳青鸢推动中立线，梅朵会被任命代管曲措乡——这条线让"父女
对照"最终落在"女儿收拾父亲留下的烂摊子"上。`,
    },
    {
      name: "桑杰朵杰", id: "resident_sangjieduojie",
      brief: "鱼定土司本人，四十多岁，深藏不露",
      personality: "温和随和的表象下是习惯性的自我合理化，账要算清楚也要留人情；一身真本事传自其父桑杰大侠，对外始终维持'我战力不高、事事仰仗护卫头子'的姿态，是刻意维持的烟幕",
      fullBio: `设计原则（总纲1.1节）：桑杰朵杰本人不需要、也不应该被写成脸谱化
反派——"父女道德对照组"这条设定必须保留。他的不义应该始终以"合理化的
制度性剥削"呈现（税赋、地权、官府渗透），而不是搞破坏式的纯粹恶。真正
让玩家共情愤怒的应该是管家这类"忠实执行不义制度"的具体个体。跑马大会
是他唯一一次"扮演明君"的年度表演，既要向锦官城展示"治理有方"，又要
向百姓展示宽容大度——大会的热闹程度本身就是一面测量土司权力盛衰的
仪表盘。

黑化根源（三十年前死斗真相，总纲第二章）：三十年前，雪山派掌门呼延
大侠与鱼定土司桑杰大侠（现任土司之父，"桑杰朵杰"这个名字正是老土司
留给儿子的烙印）曾在雪山之巅有过一场决定性的死斗。桑杰大侠当年是治乡
宽厚、人人称颂的真正好人，发现府上一份地契是被前人伪造的罪证，本意
不是隐瞒，而是想借跑马会之机把呼延大侠引出来，当面撕毁假地契自证
清白——但呼延大侠已风闻地契之事，认定桑杰家治乡不仁不义，两人意气
之争演变成死斗，双双殒命。桑杰大侠死在贡措海底密室，呼延大侠重伤
坠入雪山崖底。现任桑杰朵杰是这场悲剧的遗孤，年幼丧父，继承的土司之位
背后是一段被刻意模糊、始终没有真相的血案。他不知道（或不愿相信）父亲
当年的本意其实是体面的自证清白，只知道父亲死在了雪山派手上、死在了
一场说不清道不明的纠纷里——这份没有得到解释的丧父之痛，加上土司之位
带来的绝对权力，共同催生了他今天的横征暴敛。他不是天生的恶人，是被
"父亲死因始终没有真相"这件事扭曲了三十年的第二代。

深藏不露的真实实力（本轮修正设定）：桑杰朵杰的真实武学传承自其父
桑杰大侠。他继位后，对外始终维持"我战力不高、事事仰仗护卫头子"的
姿态，这是刻意为之的烟幕——他习惯让别人以为拿捏得住他，实际上无论
权术还是身手，都留着没有示人的底牌。这份深藏不露跟他"温和外表下习惯性
自我合理化"的性格互为表里，核心都是"从不让人看清他真正的底线在哪里"。
支线场景（如夜闯偷虎胆）里他不会亲自出手拦截玩家，是刻意维持中等
难度、避免支线过早暴露终局底牌的安排，不代表打不过，真正实力保留到
终局对抗才揭示。

与柳青鸢的关系（都事档案原文）：对土司，柳青鸢礼数周全，信尾每次加
一句"望贵府查收附件"，附件是什么从不写、桑杰朵杰也从不问——两个
聪明人之间的默契，她知道土司怕她，土司知道她不怕他。

终局定位：真相大白之后，桑杰朵杰得知自己父亲当年的真实死因和本意
（或选择继续掩盖真相、狗急跳墙），矛盾正式激化为一场对抗现任土司的
终局战，玩家需要团结曲措乡境内七方势力共同对抗他。`,
      carry: [
        { name: "官铸镇仓槊", category: "weapon", quality: "红" },
        { name: "官铸镇边重铠", category: "armor", quality: "红" },
        { name: "土司印信", category: "accessory", quality: "紫" },
        { name: "戍边税册抄本", category: "misc", quality: "蓝" },
        { name: "土司府宴客席", category: "misc", quality: "紫" },
        { name: "锦官烧刀子", category: "misc", quality: "蓝" },
        { name: "七十味珍珠丸", category: "misc", quality: "紫" },
      ],
      levelCap: 5,
    },
    {
      name: "管家·陆福生", id: "resident_luofusheng", levelCap: 2,
      brief: "土司府总管家，账房出身",
      personality: "文官做派，精于算账，丧子之后行事再不留余地",
      carry: [
        { name: "锦官巡街棍", category: "weapon", quality: "白" },
        { name: "巡捕营皂隶衣", category: "armor", quality: "绿" },
        { name: "巡捕营腰牌", category: "accessory", quality: "绿" },
        { name: "参须茶包", category: "misc", quality: "白" },
        { name: "忘忧散", category: "misc", quality: "绿" },
        { name: "冰片", category: "misc", quality: "白" },
        { name: "甘草解毒汤", category: "misc", quality: "白" },
      ],
    },
    {
      name: "格桑顿珠", id: "resident_gesangdunzhu",
      brief: "土司府护卫头子，统领骑手与巡捕营",
      personality: "对桑杰朵杰是私人知遇之恩而非对土司身份效忠，讲究干净",
      levelCap: 4,
      carry: [
        { name: "土司府仪卫戟", category: "weapon", quality: "橙" },
        { name: "土司府仪卫明光铠", category: "armor", quality: "橙" },
        { name: "土司府门客玉扣", category: "accessory", quality: "紫" },
        { name: "马帮干粮包", category: "misc", quality: "白" },
        { name: "熊山续骨膏", category: "misc", quality: "绿" },
        { name: "天都大力丸", category: "misc", quality: "蓝" },
        { name: "手抓羊肉", category: "misc", quality: "绿" },
      ],
    },
  ],
  雪山派: [
    {
      name: "呼延雪", id: "resident_huyanxue", levelCap: 3,
      brief: "雪山派小师妹，好静不好动",
      personality: "话少，情绪波动很小，习惯用沉默代替回应，认定的人会异常依赖",
      carry: [
        { name: "雪山松纹剑", category: "weapon", quality: "蓝" },
        { name: "雪山练功服", category: "armor", quality: "白" },
        { name: "雪山问心珠", category: "accessory", quality: "蓝" },
        { name: "呼延雪的剑穗", category: "accessory", quality: "白" },
        { name: "松子糖", category: "misc", quality: "白" },
        { name: "雪山接骨膏", category: "misc", quality: "蓝" },
        { name: "薄荷醒神叶", category: "misc", quality: "白" },
      ],
    },
    {
      name: "玄女", id: "resident_xuannu", levelCap: 4,
      brief: "后山温泉边的白衣女子，红瞳，话极少",
      personality: "安静，微倦，不摆架子也不亲近人。说话极少，一句是一句，从不解释。看人时是直看进去的，不带评判，也不闪躲。",
      fullBio: `雪山派后山温泉边常年有个白衣女子，短发，颜色是淡到发灰的青蓝，一双眼睛却是红的。
门里没人说得清她是几时来的、是哪一辈的师姐。何雨谢说她来的时候自己还没接掌门派；呼延雪说
自己打小就见她在那儿。问她姓名，她说人称玄女，再问就不答了。
她不练武，不管事，不与人往来，多数时候只是坐在温泉边的青石上，看着水汽升上雪线。有弟子撞见过
她整宿不动，第二天霜落了她一身，她也只是拂一拂就走了。
她身上有一件事全门派都觉得古怪：她能看见别人看不见的东西。不是装神弄鬼那种看见——她只是偶尔
会对着某个空处多看两眼，然后说一句没头没尾的话，说完就不再提。被她那么看过的人，事后回想起来
总觉得后颈发凉。
【关键设定·仅供叙事参考，不可主动向玩家挑明】她确实看得见旁白。她是这个世界里唯一意识到"主角
身边一直跟着一个不属于此地的存在"的人。但她不解释、不点破、也不认为这有什么好惊讶的——在她看来
那只是又一件寻常事。她对旁白没有敌意也没有兴趣，只是恰好看得见，且觉得那位一直在等什么。`,
      carry: [
        { name: "雪山松纹剑", category: "weapon", quality: "蓝" },
        { name: "白狐裘披风", category: "armor", quality: "紫" },
        { name: "素银项圈", category: "accessory", quality: "蓝" },
        { name: "雪山冰蚕丝", category: "misc", quality: "橙" },
        { name: "温泉边的青石子", category: "misc", quality: "白" },
        { name: "冻不化的霜花", category: "misc", quality: "蓝" },
        { name: "无字木牌", category: "misc", quality: "白" },
        { name: "雪莲幼苗", category: "misc", quality: "绿" },
      ],
    },
    {
      name: "何雨谢", id: "resident_heyuxie", levelCap: 4,
      brief: "雪山派掌门师母",
      personality: "温和操持门派内外事务，对晚辈有天然关怀，偶尔流露疲惫",
      carry: [
        { name: "雪山派传习剑", category: "weapon", quality: "紫" },
        { name: "雪豹裘", category: "armor", quality: "紫" },
        { name: "雪山问心珠", category: "accessory", quality: "蓝" },
        { name: "雪山冰蚕丝", category: "misc", quality: "橙" },
        { name: "雪鸡炖松茸", category: "misc", quality: "紫" },
        { name: "雪山接骨膏", category: "misc", quality: "蓝" },
        { name: "七十味珍珠丸", category: "misc", quality: "紫" },
      ],
    },
  ],
  喇嘛庙: [
    {
      name: "喇嘛庙住持", id: "resident_lama_abbot",
      brief: "三十年前死斗的唯一目击者",
      personality: "表面超然物外，实际背负着三十年不敢面对的恐惧",
      levelCap: 4,
      carry: [
        { name: "降魔杵", category: "weapon", quality: "紫" },
        { name: "喇嘛庙绛红袈裟", category: "armor", quality: "绿" },
        { name: "藏银经轮", category: "accessory", quality: "紫" },
        { name: "安魂香", category: "misc", quality: "蓝" },
        { name: "藏经阁线香", category: "misc", quality: "蓝" },
        { name: "七十味珍珠丸", category: "misc", quality: "紫" },
        { name: "酥油茶", category: "misc", quality: "白" },
      ],
    },
    {
      name: "达摩药堂师父", id: "resident_yaotang_shifu",
      brief: "达摩药堂坐堂问诊的师父",
      personality: "医者仁心，虎胆传闻的线索人，问诊时话不多但句句实在",
      levelCap: 4,
      carry: [
        { name: "古藤杖", category: "weapon", quality: "白" },
        { name: "守塔僧袍", category: "armor", quality: "绿" },
        { name: "达摩药堂念珠", category: "accessory", quality: "绿" },
        { name: "七十味珍珠丸", category: "misc", quality: "紫" },
        { name: "雪山当归丸", category: "misc", quality: "蓝" },
        { name: "天麻提气散", category: "misc", quality: "绿" },
        { name: "达摩清心丸", category: "misc", quality: "蓝" },
        { name: "虫草炖雪鸡汤", category: "misc", quality: "蓝" },
      ],
    },
  ],
  黑风寨: [
    {
      name: "巴桑", id: "resident_basang", levelCap: 4,
      brief: "黑风寨首领，脸上有道旧疤",
      personality: "沉稳克制，寨规立得严，对手下心软，对土司府旧账耿耿于怀",
      carry: [
        { name: "黑风断刃", category: "weapon", quality: "绿" },
        { name: "红缨枪", category: "weapon", quality: "绿" },
        { name: "黑风寨分发刀", category: "weapon", quality: "蓝" },
        { name: "马帮硬皮褂", category: "armor", quality: "绿" },
        { name: "黑风令", category: "accessory", quality: "白" },
        { name: "黑风寨土烧", category: "misc", quality: "绿" },
        { name: "风干牦牛肉", category: "misc", quality: "白" },
        { name: "熊山续骨膏", category: "misc", quality: "绿" },
      ],
      fullBio: `出身与旧账（总纲第五章·黑风寨）：巴桑原本是玉泉寨一户普通牧民家的
次子。那年家里的牦牛被土司府差役牵走抵税，父亲当场气病，不到半年过世。
巴桑没有走告官、也没有忍气吞声，他上了山，纠集了七八个跟他一样被逼到
绝境的人。第一次下山"借"回来的东西，只够全寨人吃三个月的糌粑。这笔
十年前戍边税逼死父亲的旧账，是他与土司府（尤其是管家）不共戴天的
根子。

其人（本轮完整设计）：三十出头，脸上有一道被土司府巡捕营砍的旧疤——
十年前上山那晚留下的。说话不多，做决定很快，从不虐杀。他有一条不成文
的寨规："不抢救命的口粮，不伤妇孺，不碰玉泉寨的人"（黑风寨从不打劫
自己的老乡）。真正的目标是土司府的税粮车队、锦官城的官家货运，以及
个别民愤极大的富商；玉泉寨、鱼定村这些普通百姓的商队，反而是黑风寨
"顺手"护送的对象——不收护送费，只是路过顺路，但商队主人心知肚明是
黑风寨罩着才平安过路。这是"义匪式"经营，不是典型山贼。

寨众与家人：黑风寨如今约四十余人，三分之一是当年一起上山的老人，
其余是陆续投奔来的（还不上税的、被管家手下打断腿赶出村的、也有个别
图财的江湖亡命徒——巴桑不喜欢这类人，赶不走，只能压着他们别做太过）。
内部有核心决策层（五六个老兄弟）、眼线、"刀口"（约二十名青壮），
还有跟着上山的老弱妇孺负责后勤。他有个妹妹卓央，没跟他上山，留在
玉泉寨嫁了人；巴桑每年托手下悄悄送东西，从不现身，卓央知道是谁送的，
从不声张也从不拒收。

对外关系：不共戴天于土司府，克制守护玉泉寨，与锦官城／都事保持
"雷声大雨点小"的默契。`,
    },
    {
      name: "卓央", id: "resident_zhuoyang", levelCap: 1,
      brief: "巴桑之妹，嫁在寨子边缘",
      personality: "话不多，惦记着哥哥，怕给他惹麻烦，收东西时手会抖",
      carry: [
        { name: "鱼定猎刀", category: "weapon", quality: "白" },
        { name: "百褶皮围", category: "armor", quality: "白" },
        { name: "村社护佑结", category: "accessory", quality: "白" },
        { name: "格桑花籽", category: "misc", quality: "白" },
        { name: "牦牛骨髓粉", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "老阿雅婶的止咳散", category: "misc", quality: "绿" },
      ],
    },
    {
      name: "嘎则", id: "resident_gaze",
      brief: "养着一只白虎的少女",
      personality: "天真直接，跟雪团寸步不离，对外人先戒备后依赖",
      levelCap: 3,
      carry: [
        { name: "大草甸套索", category: "weapon", quality: "白" },
        { name: "格桑花染布衣", category: "armor", quality: "绿" },
        { name: "格桑铃", category: "accessory", quality: "蓝" },
        { name: "虎乳牙", category: "accessory", quality: "蓝" },
        { name: "桂花糖", category: "misc", quality: "白" },
        { name: "格桑花籽", category: "misc", quality: "白" },
        { name: "虎糖草", category: "misc", quality: "绿" },
        { name: "狼曲冷水鱼", category: "misc", quality: "白" },
      ],
    },
  ],
  玉泉寨: [
    {
      name: "丹增", id: "resident_danzeng", levelCap: 2,
      brief: "玉泉寨村长，断了三根手指",
      personality: "不信佛信公道，话少但句句实在，对卓玛疼爱又无力庇护",
      carry: [
        { name: "狼曲短猎矛", category: "weapon", quality: "白" },
        { name: "丹增旧骑装", category: "armor", quality: "绿" },
        { name: "马帮路引", category: "accessory", quality: "绿" },
        { name: "高原红景天", category: "misc", quality: "绿" },
        { name: "风干牦牛肉", category: "misc", quality: "白" },
        { name: "青稞酒", category: "misc", quality: "白" },
        { name: "牦牛骨髓粉", category: "misc", quality: "白" },
      ],
    },
    {
      name: "李若由", id: "resident_liruoyou", levelCap: 1,
      brief: "玉泉小栈的经营者，商人之女",
      personality: "初见只谈价格，语气精明现实，相处久了才露出重情重义的一面",
      carry: [
        { name: "藏银护手钩", category: "weapon", quality: "绿" },
        { name: "氆氇藏袍", category: "armor", quality: "绿" },
        { name: "锦官验讫牙牌", category: "accessory", quality: "蓝" },
        { name: "参须茶包", category: "misc", quality: "白" },
        { name: "核桃糕", category: "misc", quality: "蓝" },
        { name: "酥油曲奇", category: "misc", quality: "绿" },
        { name: "忘忧散", category: "misc", quality: "绿" },
      ],
    },
    {
      name: "扎西", id: "resident_zhaxi",
      brief: "卓玛之父，玉泉寨老牧民",
      personality: "木讷少言，进过熊山猎虎，对女儿的婚事既盼又怕",
      levelCap: 2,
      carry: [
        { name: "狼曲旧猎叉", category: "weapon", quality: "白" },
        { name: "氆氇藏袍", category: "armor", quality: "绿" },
        { name: "马帮路引", category: "accessory", quality: "绿" },
        { name: "老猎户陷阱绳", category: "misc", quality: "白" },
        { name: "风干牦牛肉", category: "misc", quality: "白" },
        { name: "牦牛骨髓粉", category: "misc", quality: "白" },
        { name: "熊山松茸", category: "misc", quality: "白" },
      ],
    },
    {
      name: "卓玛", id: "resident_zhuoma", levelCap: 1,
      brief: "扎西之女，梳单马尾",
      personality: "直爽大方却不轻易求人，对外来人先戒备后交心",
      carry: [
        { name: "狼曲短猎矛", category: "weapon", quality: "白" },
        { name: "氆氇藏袍", category: "armor", quality: "绿" },
        { name: "藏银耳坠", category: "accessory", quality: "白" },
        { name: "牦牛奶酪", category: "misc", quality: "绿" },
        { name: "卓玛的狼骨糖", category: "misc", quality: "蓝" },
        { name: "青稞酒", category: "misc", quality: "白" },
        { name: "酥油茶", category: "misc", quality: "白" },
      ],
    },
  ],
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
      name: "梵衍那", id: "resident_fanyanna", levelCap: 3,
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
商人，天都镇的香料铺"百香斋"实际是他开的。人设核心是"亡国遗老
攒钱回乡"。

组织：梵衍那是欢喜教教主，义女罗琦是圣女兼实际管事。教主年纪大了，
大部分日常决策是罗琦在做，教内年轻一代更听她的。据点两处：明面是
百香斋（正经生意，账目经得起查），暗面是后院欢喜堂（改建的小佛堂，
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
      name: "老何", id: "resident_laohe", levelCap: 2,
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
      name: "阿雅", id: "resident_ayabuddhist", levelCap: 1,
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
      name: "桑杰", id: "resident_sangjie_neiyuan", levelCap: 1,
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
  ],
  // ── 雅江（青城派·雨城竹海）──
  // 【为什么这一整块是补上来的】雅江据点落地时，外层节点、内层14房、6建筑、青城武学
  // 4门、NPC专属招式、特产食品、主题配色、地上陈设物全都写了，**只有这份常驻NPC表
  // 被跳过**。后果是整座城一个人都没有：
  //   · innerMap.js 里七个房间都写好了 residentNpcName（一清道长/松鹤道长/玉真子/
  //     老道士/青衣楼老板娘/骡马夫/护谷弟子），但那个字段只管「这人该显示在哪间房」，
  //     不负责把人加载出来（见本文件开头对两者分工的说明）——房间指名道姓地要人，
  //     这边却没人可给。
  //   · npcSignatureMoves.js 已经给一清道长/松鹤道长/玉真子写好了四招专属招式，
  //     全是挂在空气上的死数据。
  //   · 物品描述里点名了青衣楼老板娘（熊山花椒断货）、玉真子（竹叶青蛇胆）、
  //     一清道长与松鹤道长（青城老酒）、护谷弟子（熊猫笋）——按契诃夫之枪的铁律，
  //     被点名的人必须存在，否则玩家问起来只能靠AI现编。
  // levelCap 取 npcSignatureMoves.js 分节注释里标的档位（一清5/松鹤4/玉真子3），
  // 其余四位按身份给低档。carry 一律≥7件、含武器/护甲/饰品各≥1，品质不超本档。
  雅江: [
    {
      name: "一清道长", id: "resident_yiqing", levelCap: 5,
      brief: "青城派掌门，白眉，一根青竹杖",
      personality: "话极少且慢，后发制人，从不先出手；弟子犯错他只看一眼，被看的人自己就认了",
      carry: [
        { name: "青竹杖", category: "weapon", quality: "紫" },
        { name: "青城道袍", category: "armor", quality: "蓝" },
        { name: "离堆水则牌", category: "accessory", quality: "蓝" },
        { name: "青城符箓袋", category: "accessory", quality: "绿" },
        { name: "青城老酒", category: "misc", quality: "绿" },
        { name: "竹青宣", category: "misc", quality: "蓝" },
        { name: "薄荷醒神叶", category: "misc", quality: "白" },
      ],
    },
    {
      name: "青霞子", id: "resident_qingxiazi", levelCap: 5,
      brief: "青城前代掌门，隐在练功堂不问事",
      personality: "看人比看剑久，说话总在你开口之前就答了；不收徒也不指点，只在你练错时轻轻咳一声",
      carry: [
        // 一柄很旧的蓝档剑——红档的人不靠剑，这是他自己的说法
        { name: "松纹剑", category: "weapon", quality: "蓝" },
        { name: "青城道袍", category: "armor", quality: "蓝" },
        { name: "离堆水则牌", category: "accessory", quality: "蓝" },
        { name: "青城符箓袋", category: "accessory", quality: "绿" },
        { name: "青城老酒", category: "misc", quality: "绿" },
        { name: "竹青宣", category: "misc", quality: "蓝" },
        { name: "薄荷醒神叶", category: "misc", quality: "白" },
      ],
    },
    {
      name: "持堂道人", id: "resident_chitang", levelCap: 1,
      brief: "管练功堂钥匙和七星桩的杂务道人",
      personality: "话少记性好，记得每个弟子上次练到第几式、香灰上的脚印有多深；从不评价，只报数",
      carry: [
        { name: "古藤杖", category: "weapon", quality: "白" },
        { name: "青城练气服", category: "armor", quality: "绿" },
        { name: "青城符箓袋", category: "accessory", quality: "绿" },
        { name: "桃木平安牌", category: "accessory", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "酥油茶", category: "misc", quality: "白" },
        { name: "止血散", category: "misc", quality: "白" },
      ],
    },
    {
      name: "青玄", id: "resident_qingxuan", levelCap: 2,
      brief: "剑坪上练得最狠的女弟子，输给松鹤道长四十七次",
      personality: "话冲，不服输，被打翻了自己爬起来接着来；第四十八次之前谁劝都没用",
      carry: [
        { name: "松纹剑", category: "weapon", quality: "蓝" },
        { name: "青城练气服", category: "armor", quality: "绿" },
        { name: "青城符箓袋", category: "accessory", quality: "绿" },
        { name: "熊山续骨膏", category: "misc", quality: "绿" },
        { name: "金疮药", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "熊猫笋", category: "misc", quality: "白" },
      ],
    },
    {
      name: "挂单道人", id: "resident_guadan", levelCap: 0,
      brief: "在安澜索桥上蹭住的野道士",
      personality: "自称在武当学过十年，其实连青城剑法十二式都使不利索；被拆穿就笑，笑完接着吹",
      carry: [
        { name: "乡勇木棓", category: "weapon", quality: "白" },
        { name: "乡勇布甲", category: "armor", quality: "白" },
        { name: "桃木平安牌", category: "accessory", quality: "白" },
        { name: "牦牛骨扳指", category: "accessory", quality: "白" },
        { name: "青稞酒", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "酥油炒面", category: "misc", quality: "白" },
      ],
    },
    {
      name: "松鹤道长", id: "resident_songhe", levelCap: 4,
      brief: "青城派剑坪教习，性烈如火",
      personality: "嗓门大脾气急，一剑把弟子拍翻再拉起来，接着问「知道为什么摔吗」；骂得凶护得也凶",
      carry: [
        { name: "鹤鸣剑", category: "weapon", quality: "紫" },
        { name: "青城练气服", category: "armor", quality: "绿" },
        { name: "青城道袍", category: "armor", quality: "蓝" },
        { name: "青城符箓袋", category: "accessory", quality: "绿" },
        { name: "青城老酒", category: "misc", quality: "绿" },
        { name: "熊山续骨膏", category: "misc", quality: "绿" },
        { name: "止血散", category: "misc", quality: "白" },
      ],
    },
    {
      name: "玉真子", id: "resident_yuzhenzi", levelCap: 3,
      brief: "青城派药圃主事，管剑叫针",
      personality: "斯文慢条斯理，给药不给方子；出手比松鹤还快，但从不说自己快",
      carry: [
        { name: "十三针囊", category: "weapon", quality: "蓝" },
        { name: "青城道袍", category: "armor", quality: "蓝" },
        { name: "青城符箓袋", category: "accessory", quality: "绿" },
        { name: "竹叶青蛇胆", category: "misc", quality: "蓝" },
        { name: "熊山参片", category: "misc", quality: "绿" },
        { name: "大理白药", category: "misc", quality: "绿" },
        { name: "蛇药", category: "misc", quality: "绿" },
      ],
    },
    {
      name: "老道士", id: "resident_laodaoshi", levelCap: 1,
      brief: "伏龙观看门的老道，扫了四十年台阶",
      personality: "耳背，答话总慢半拍且经常答错，但李冰治水的碑文能一字不差背下来",
      carry: [
        { name: "青城练气服", category: "armor", quality: "绿" },
        { name: "狼骨匕", category: "weapon", quality: "绿" },
        { name: "桃木平安牌", category: "accessory", quality: "白" },
        { name: "青城符箓袋", category: "accessory", quality: "绿" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "酥油茶", category: "misc", quality: "白" },
        { name: "薄荷醒神叶", category: "misc", quality: "白" },
      ],
    },
    {
      name: "青衣楼老板娘", id: "resident_qingyilou_laobanniang", levelCap: 1,
      brief: "江门街冷锅鱼老字号的当家",
      personality: "嘴快手更快，一边骂人一边给你添菜；最近为花椒断货急得在街上来回走",
      carry: [
        { name: "点苍茶刀", category: "weapon", quality: "绿" },
        { name: "百褶皮围", category: "armor", quality: "白" },
        { name: "铜钱压襟", category: "accessory", quality: "白" },
        { name: "冷锅鱼", category: "misc", quality: "绿" },
        { name: "熊山花椒", category: "misc", quality: "绿" },
        { name: "青城老酒", category: "misc", quality: "绿" },
        { name: "甜奶茶", category: "misc", quality: "白" },
      ],
    },
    {
      name: "骡马夫", id: "resident_luomafu", levelCap: 0,
      brief: "西城门驿站赶骡子的",
      personality: "话密，一开口就是路上见闻，真假掺着说；给钱就带路，不给钱也说三句",
      carry: [
        { name: "市集杀猪刀", category: "weapon", quality: "白" },
        { name: "马帮油布斗篷", category: "armor", quality: "白" },
        { name: "脚夫护肩", category: "armor", quality: "白" },
        { name: "牦牛骨扳指", category: "accessory", quality: "白" },
        { name: "青稞酒", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "酥油炒面", category: "misc", quality: "白" },
      ],
    },
    {
      name: "护谷弟子", id: "resident_huguidizi", levelCap: 2,
      brief: "熊猫谷值守的青城弟子",
      personality: "见人先讲规矩：别喂、别追、别捡它挑剩的笋；讲完自己蹲下来看熊猫看半个时辰",
      carry: [
        { name: "青城练气服", category: "armor", quality: "绿" },
        { name: "松纹剑", category: "weapon", quality: "蓝" },
        { name: "青城符箓袋", category: "accessory", quality: "绿" },
        { name: "熊猫笋", category: "misc", quality: "白" },
        { name: "竹叶青蛇胆", category: "misc", quality: "蓝" },
        { name: "金疮药", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
      ],
    },
  ],
  锦官城: [
    {
      name: "柳青鸢", id: "resident_liuqingyuan", levelCap: 5,
      brief: "锦官城都事，官府代理人",
      personality: "手腕圆滑，对各方势力都留一手分寸，私下藏着一桩未破的执念",
      carry: [
        { name: "青鸢", category: "weapon", quality: "橙" },
        { name: "青鸢尾", category: "weapon", quality: "橙" },
        { name: "青布长衫", category: "armor", quality: "橙" },
        { name: "青鸢私印", category: "accessory", quality: "蓝" },
        { name: "官眷诰命簪", category: "accessory", quality: "橙" },
        { name: "柳青鸢的菊花茶", category: "misc", quality: "绿" },
        { name: "锦官续命丹", category: "misc", quality: "紫" },
        { name: "锦官烧刀子", category: "misc", quality: "蓝" },
      ],
      fullBio: `身份与站位（总纲第一章·锦官城）：柳青鸢是锦官城的都事，乡外官方
秩序在曲措乡的代理人。她借土司府的把柄谋求渗透（在鱼定村一带设收税
点），但对土司、喇嘛庙、雪山派、欢喜教各有一套不主动撕破脸的分寸——
雷声大、雨点小，凡事留有余地。全篇论情感厚度，锦官城这一方仅次于
雪山派，排第二。

真实目的（线三·雪山之劫）：柳青鸢的公务身份之下，藏着一桩六年未破的
私人执念——她的上司在六年前失踪，最后一条可靠线索，指向后山平台的
那年跑马会，而雪山派也有人参加过。她在锦官城等了五年，终于等到消息，
才派人摸上后山平台。不是来打，是来找人。她对身边的老兵退伍汉说过
一句话："我不是来收税的，我是来接人回家的。"官府代理人的收税渗透
只是表壳，寻人才是她真正的动机——这也是她对欢喜教（教主梵衍那与
失踪上司的调查线索有交集）投鼠忌器、不敢真动的原因。

与土司的博弈（都事档案原文）：对土司，柳青鸢礼数周全，信尾每次加一句
"望贵府查收附件"，附件是什么从不写，桑杰朵杰也从不问——两个聪明人
之间的默契，她知道土司怕她，土司知道她不怕他。这份"土司怕她"是她
红档实力的来路：一个深藏不露的红袍土司都要忌惮三分的官场高手，权术
与身手都不显山露水，真正的底牌从不轻易示人。

终局定位：官2终局任务"归途·凤隐于青"有二选一分支（投靠官府／保持
中立）。若被说服保持中立，官府不再浑水摸鱼；若选中立线，柳青鸢会
推动终局之后任命梅朵代管曲措乡。`,
    },
  ],

  顶峰: [
    {
      name: "白猿", id: "beast_white_ape", levelCap: 4,
      beast: true, unlearnable: true, cannotSpeak: true, affectionable: true,
      brief: "雪山崖底一头通体雪白的老猿",
      personality: "通人性却不能言语，据守呼延大侠殒命的崖底深潭，对来客戒备，投喂日久却会渐生亲近",
      fullBio: `白猿踞守雪山崖底（呼延大侠殒命的暗河潭畔），这是全乡地势最高、
最少人至的极境，唯有从绝顶跳崖（外功或内功≥85 方能生还）才能抵达。它通体
雪白、通灵性，却不能言语——你无法与它对话，只能以行动示意。它对闯入者极为
戒备，动辄以崖石掷人、长臂攫击；但若你不加害、屡屡投喂（赠食即可涨好感度），
日久它会渐渐亲近，甚至引你去看崖底那些无人知晓的旧物。它守着呼延大侠的死处
多年，仿佛也在替谁看着这片崖底——这一层留白，交给玩家自己去体味。`,
    },
  ],
  大草甸: [
    {
      name: "虎王", id: "beast_tiger_king", levelCap: 5,
      beast: true, unlearnable: true,
      brief: "熊山温泉一带的吊睛白额巨虎",
      personality: "凶威慑人的山君，虎胆三重门的核心，寻常人近温泉便被逼退",
      guaranteedLoot: [
        { name: "虎胆", category: "misc", quality: "橙" },
        { name: "虎王牙", category: "misc", quality: "蓝" },
        { name: "虎王筋", category: "misc", quality: "蓝" },
      ],
    },
    {
      name: "狼王", id: "beast_wolf_king", levelCap: 4,
      beast: true, unlearnable: true,
      brief: "大草甸深处的银灰独眼巨狼",
      personality: "独眼狡黠、凶戾难驯，正是当年在大草甸咬死管家独子的那头狼王",
      guaranteedLoot: [
        { name: "狼王牙", category: "misc", quality: "蓝" },
      ],
    },
  ],
};

export function getResidentNpcs(districtName) {
  return RESIDENT_NPCS[districtName] || [];
}

export function getAllResidentNpcLore() {
  const result = [];
  for (const npcs of Object.values(RESIDENT_NPCS)) {
    for (const npc of npcs) {
      const bioText = npc.fullBio || npc.personality || npc.brief || "";
      result.push({
        name: npc.name,
        entry: `- ${npc.name}（${npc.brief || ""}）：${bioText}`,
      });
    }
  }
  return result;
}

let _allResidentNames = null;
export function getAllResidentNpcNames() {
  if (!_allResidentNames) {
    _allResidentNames = new Set();
    for (const npcs of Object.values(RESIDENT_NPCS)) {
      for (const npc of npcs) _allResidentNames.add(npc.name);
    }
  }
  return _allResidentNames;
}
