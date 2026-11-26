// 二十二位原创武侠 OC 炫彩冒险者池（第一批：12 改名 + 10 新增，照 docs/设定_OC冒险者_改名随从武学商店.md 落地）。
// 既会按日随机游走刷新于世界各地据点，也会在地宫深处与玩家狭路相逢（可帮、可不管、可能反水抢宝）。
// carry/stealables.equipment 名目全部取自 CATALOG_INDEX 真实词条（文档虚构名目已换近义实物，品阶以词条为准）。

import { QUCUO_MAP } from "../map/qucuoMap.js";
import { seededRand } from "../../../utils/seededRandom.js";
import { random } from "../../../utils/rng.js";

const EXCLUDED_DISTRICTS = new Set([
  "心灵之海", "第三新东京市", "白塔", "山洞", "顶峰",
]);

export const ADVENTURER_POOL = Object.freeze([
{
      "id": "adv_yan_wanyan",
      "name": "燕绾烟",
      "title": "梁上偷香",
      "archetype": "opportunist",
      "archetypeLabel": "狡黠",
      "rainbow": true,
      "rainbowStyle": "sunset",
      "stealBias": 0.85,
      "levelCap": 4,
      "gender": "女",
      "faction": "百花门",
      "brief": "百花丛里滑手女贼，盗宝亦盗心",
      "personality": "眼波流转，满嘴甜言蜜语却无半分真心，行事利落干脆，见好就收绝不恋战。",
      "lifeHistory": "天都镇百花门弃徒，幼时学得一身轻功与媚术。因盗走锦官城古道会钱眼的压库密匙，被黑白两道悬赏，索性混入曲措乡茶马古道，专挑下墓客下手，截胡现成明器。",
      "fullBio": "天都镇百花门弃徒，幼时学得一身轻功与媚术。因盗走锦官城古道会钱眼的压库密匙，被黑白两道悬赏，索性混入曲措乡茶马古道，专挑下墓客下手，截胡现成明器。",
      "likes": "独爱裹厚糖霜的山楂糖葫芦，忌吃苦味汤药与生冷牛羊肉。　　**癖好**：把玩偷来的贴身玉佩，在通缉画像上给自己画花钿。　　**交易风格**：漫天要价，坐地还钱，看对眼可用俊俏皮囊抵三成银钱。",
      "hobby": "把玩偷来的贴身玉佩，在通缉画像上给自己画花钿。　　**交易风格**：漫天要价，坐地还钱，看对眼可用俊俏皮囊抵三成银钱。",
      "tradeStyle": "漫天要价，坐地还钱，看对眼可用俊俏皮囊抵三成银钱。",
      "nsfw": "媚骨天成的狐狸脸，眼尾微挑；双乳丰润饱满，乳尖殷红挺翘；柳腰软若无骨，盈盈一握；臀瓣浑圆紧翘，摇曳生波；桃源光洁粉嫩，两片软肉紧窄多汁；双足纤细雪白，足弓高挑，脚趾圆润如玉珠。 耳后、腰窝与阴蒂最为敏感。指腹轻捻便通体酥麻，媚眼如丝，双腿死死缠住对方腰身，主动吞吐索取。",
      "follower": { "type": "兽", "name": "胭脂贼", "desc": "通体雪白的玉面灵猫，专钻墓道暗孔替主人摸金探路。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "百花门",
        "moves": [
          { "name": "百花拂穴手", "effect": "封敌气海并顺走其随身物品" },
          { "name": "飞燕掠影步", "effect": "大幅提升闪避并脱离当前战圈" },
          { "name": "牵丝引蛊针", "effect": "暗藏百花春毒，令敌神志恍惚" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "紫岚织锦甲", "quality": "紫", "desc": "刀剑难伤的百花门护体软绸", "slot": "equipment" },
          { "name": "百花刺", "quality": "蓝", "desc": "专破机关暗锁的袖中机括爪", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "钱眼半块铁券", "desc": "锦官城古道会钱眼失窃的地下金库凭证", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "绾烟黑市摊",
        "goods": [
          { "name": "迷魂百花露", "desc": "百花门秘药，闻之全身酥软" },
          { "name": "梁上君子钩", "desc": "百炼精钢飞爪，过涧攀岩必备" },
          { "name": "假造通关文牒", "desc": "可瞒过土司府哨卡的精仿路引" }
        ]
      },
      "carry": [
        { "name": "百花刺", "category": "weapon", "quality": "蓝", "slot": "equipment" },
        { "name": "紫岚织锦甲", "category": "armor", "quality": "紫", "slot": "equipment" },
        { "name": "糖油果子", "category": "misc", "quality": "白", "slot": "bag" }
      ]
    },
{
      "id": "adv_lu_zhuochen",
      "name": "陆濯尘",
      "title": "孤鸿照雪",
      "archetype": "chivalrous",
      "archetypeLabel": "侠义",
      "rainbow": true,
      "rainbowStyle": "prism",
      "stealBias": 0.05,
      "levelCap": 4,
      "gender": "男",
      "faction": "独孤",
      "brief": "十步一剑的雪山孤客，冷冽如霜",
      "personality": "清冷孤傲，惜字如金，有重度洁癖，拔剑只为分生死，绝不与宵小多费唇舌。",
      "lifeHistory": "原是江南清贵世家子，家道中落入独孤剑冢守剑七年。为寻三星堆纵目剑一脉失落的上古残剑，孤身西行至曲措乡，常年游走于雪山古墓之间，只求一柄能承其剑意的神兵。",
      "fullBio": "原是江南清贵世家子，家道中落入独孤剑冢守剑七年。为寻三星堆纵目剑一脉失落的上古残剑，孤身西行至曲措乡，常年游走于雪山古墓之间，只求一柄能承其剑意的神兵。",
      "likes": "只饮雪水烹的峨眉春茶與清淡素面，忌一切重油辛辣与内脏。　　**癖好**：用鹿皮反复擦拭剑身，在雪夜独坐听风辨位。　　**交易风格**：一口价，不喜讨价还价，若遇上好剑穗或磨剑石愿倒贴换取。",
      "hobby": "用鹿皮反复擦拭剑身，在雪夜独坐听风辨位。　　**交易风格**：一口价，不喜讨价还价，若遇上好剑穗或磨剑石愿倒贴换取。",
      "tradeStyle": "一口价，不喜讨价还价，若遇上好剑穗或磨剑石愿倒贴换取。",
      "nsfw": "(无·男性不写)",
      "follower": { "type": "剑灵", "name": "霜魄", "desc": "寄宿于古剑残片中的幽蓝剑灵，遇强敌则清鸣示警。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "独孤",
        "moves": [
          { "name": "破刃式", "effect": "精准击碎敌方兵器并造成重创" },
          { "name": "离群孤鸿剑", "effect": "极速突刺，无视敌方三成内家护体" },
          { "name": "雪满空山", "effect": "剑气化霜，封冻周身三尺内敌影" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "青霜", "quality": "橙", "desc": "独孤剑冢取寒铁所铸的镇身名剑", "slot": "equipment" },
          { "name": "蓝田玉镯", "quality": "蓝", "desc": "温养神思的世家旧物", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "纵目残剑拓片", "desc": "绘有三星堆守陵古剑纹路的泛黄宣纸", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "拭剑轩",
        "goods": [
          { "name": "寒泉磨剑石", "desc": "产自雪山极寒处的天然砥石" },
          { "name": "剑冢断刃", "desc": "虽已残缺但仍带独孤剑意的铁片" },
          { "name": "清心雪莲散", "desc": "可瞬间平复走火入魔的峨眉灵药" }
        ]
      },
      "carry": [
        { "name": "青霜", "category": "weapon", "quality": "橙", "slot": "equipment" },
        { "name": "流云剑穗袍", "category": "armor", "quality": "蓝", "slot": "equipment" },
        { "name": "蓝田玉镯", "category": "accessory", "quality": "蓝", "slot": "equipment" }
      ]
    },
{
      "id": "adv_gu_kuanglan",
      "name": "顾狂澜",
      "title": "醉斩春风",
      "archetype": "greedy",
      "archetypeLabel": "贪财",
      "rainbow": true,
      "rainbowStyle": "aurora",
      "stealBias": 0.65,
      "levelCap": 3,
      "gender": "男",
      "faction": "血刀",
      "brief": "散金赌刀的浪客，酒壶见底人头落",
      "personality": "狂放不羁，好勇斗狠，视钱财如流水，输急了连裤子都当，杀起人来却粗中有细。",
      "lifeHistory": "曾是血刀门最受宠的狂徒，因在玉泉寨赌坊一夜输光门派采买物资，又一刀劈了放印子钱的土司府管事，被逐出师门。如今在茶马古道靠替人趟雷下墓换取酒资赌本。",
      "fullBio": "曾是血刀门最受宠的狂徒，因在玉泉寨赌坊一夜输光门派采买物资，又一刀劈了放印子钱的土司府管事，被逐出师门。如今在茶马古道靠替人趟雷下墓换取酒资赌本。",
      "likes": "嗜饮烈性青稞烧刀子，大口吃红汤牦牛肉，忌甜食与无酒之席。　　**癖好**：掷骰子赌大小，酒后在墓碑上刻字与死人称兄道弟。　　**交易风格**：喜欢以赌代买，掷骰定输赢，赢了半价拿走，输了翻倍付银。",
      "hobby": "掷骰子赌大小，酒后在墓碑上刻字与死人称兄道弟。　　**交易风格**：喜欢以赌代买，掷骰定输赢，赢了半价拿走，输了翻倍付银。",
      "tradeStyle": "喜欢以赌代买，掷骰定输赢，赢了半价拿走，输了翻倍付银。",
      "nsfw": "(无·男性不写)",
      "follower": { "type": "人", "name": "阿赌", "desc": "玉泉寨输给他的哑巴小书童，背着装满骨骰的巨大酒葫芦。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "血刀",
        "moves": [
          { "name": "饮血狂刀", "effect": "伤敌越重自身气血恢复越快" },
          { "name": "孤注一掷斩", "effect": "自损三成气血，换取翻倍暴击刀芒" },
          { "name": "赤地千里", "effect": "横扫千军，令周围敌群陷入流血不止" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "古铜重剑", "quality": "紫", "desc": "饮过百人血的凶戾长刀，煞气逼人", "slot": "equipment" },
          { "name": "缀玉皮护腕", "quality": "绿", "desc": "赌坊赢来的暴发户护具", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "铅心灌水骰", "desc": "欢喜教赌局流出的出千秘宝，逢掷必豹子", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "狂澜酒肆赌摊",
        "goods": [
          { "name": "陈年烧刀子", "desc": "喝下后刀法威力大增但眼神发飘" },
          { "name": "带血金叶子", "desc": "从死人怀里摸出来的西康赤金" },
          { "name": "血刀门止血散", "desc": "霸道外伤药，敷上剧痛但立刻止血" }
        ]
      },
      "carry": [
        { "name": "古铜重剑", "category": "weapon", "quality": "紫", "slot": "equipment" },
        { "name": "缀玉皮护腕", "category": "armor", "quality": "绿", "slot": "equipment" },
        { "name": "包浆双龙核桃", "category": "accessory", "quality": "蓝", "slot": "equipment" }
      ]
    },
{
      "id": "adv_shen_nongshu",
      "name": "沈弄枢",
      "title": "鬼手裁骨",
      "archetype": "eccentric",
      "archetypeLabel": "怪杰",
      "rainbow": true,
      "rainbowStyle": "jade",
      "stealBias": 0.5,
      "levelCap": 4,
      "gender": "女",
      "faction": "唐门",
      "brief": "拆骨改偶的诡异匠师，视活人如木偶",
      "personality": "喜怒无常，眼神病态痴迷，看活人如同看零件，上一秒巧笑倩兮，下一秒便要拆人骨节。",
      "lifeHistory": "唐门机括房百年难遇的怪才，因私自将五仙教毒尸与唐门木偶缝合炼制活傀，被长老会视为异端追杀。逃亡至曲措乡后，专挑三星堆与古墓中的机关守陵人下手，搜集失传机括图谱。",
      "fullBio": "唐门机括房百年难遇的怪才，因私自将五仙教毒尸与唐门木偶缝合炼制活傀，被长老会视为异端追杀。逃亡至曲措乡后，专挑三星堆与古墓中的机关守陵人下手，搜集失传机括图谱。",
      "likes": "爱吃酥脆易碎的核桃酥与烤骨髓，忌食粘牙软糯的汤圆年糕。　　**癖好**：拆解古墓机关锁，给死人化妆并装上提线木偶关节。　　**交易风格**：不要寻常金银，只收罕见金属齿轮、异兽骨骼或活体试药人。",
      "hobby": "拆解古墓机关锁，给死人化妆并装上提线木偶关节。　　**交易风格**：不要寻常金银，只收罕见金属齿轮、异兽骨骼或活体试药人。",
      "tradeStyle": "不要寻常金银，只收罕见金属齿轮、异兽骨骼或活体试药人。",
      "nsfw": "苍白清隽的病态脸庞，神色痴迷；胸乳娇小玲珑，乳晕浅淡；腰肢纤细单薄，肋骨隐现；臀部小巧紧实，弧度青涩；私处白虎无毛，嫩穴粉白紧致，宛如精密机括；双足瘦削冰凉，青筋微显，趾尖泛粉。 指尖关节、侧腰与G点极为敏感。被触碰时会像失控的傀儡般剧烈痉挛，喉间溢出破碎喘息，痴迷地观察交合部位。",
      "follower": { "type": "机关人偶", "name": "破军傀", "desc": "以寒铁与白骨拼凑的半人高木偶，关节藏有剧毒暴雨梨花针。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "唐门",
        "moves": [
          { "name": "千机引线", "effect": "操控傀儡替身承受致命一击" },
          { "name": "暴雨梨花钉", "effect": "漫天暗器覆盖，附带见血封喉奇毒" },
          { "name": "拆骨卸甲手", "effect": "瞬间卸掉敌方防具关节使其防御归零" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "七星绣针匣", "quality": "橙", "desc": "唐门镇身机括匣，内藏三百六十道暗器", "slot": "equipment" },
          { "name": "百面易容匣", "quality": "紫", "desc": "可当刃可扣弦的精钢护指", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "三星堆青铜齿轮", "desc": "从守陵机关兽胸口硬生生挖出的核心零件", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "弄枢残骸铺",
        "goods": [
          { "name": "发条自走蜘蛛", "desc": "可探查墓道毒气并引爆的机关兽" },
          { "name": "透骨穿心钉", "desc": "淬有五仙教尸毒的唐门歹毒暗器" },
          { "name": "傀儡关节油", "desc": "涂抹后身法敏捷如鬼魅的秘制尸油" }
        ]
      },
      "carry": [
        { "name": "七星绣针匣", "category": "weapon", "quality": "橙", "slot": "equipment" },
        { "name": "百面易容匣", "category": "accessory", "quality": "紫", "slot": "equipment" },
        { "name": "老猎户陷阱绳", "category": "misc", "quality": "白", "slot": "bag" }
      ]
    },
{
      "id": "adv_xiao_chenji",
      "name": "萧沉戟",
      "title": "铁衣镇岳",
      "archetype": "chivalrous",
      "archetypeLabel": "侠义",
      "rainbow": true,
      "rainbowStyle": "jade",
      "stealBias": 0,
      "levelCap": 3,
      "gender": "男",
      "faction": "锦官城",
      "brief": "旧甲未脱的军魂旧将，一诺千金",
      "personality": "沉默寡言，面冷心热，重诺守信，行事带有浓重的军旅铁血作风，绝不抛下同伴。",
      "lifeHistory": "曾是锦官城官府戍边骁骑营校尉，因拒绝执行屠杀玉泉寨无辜牧民的军令，自削兵籍沦为通缉逃犯。为筹集抚恤金赡养死难同袍遗孤，隐姓埋名在曲措乡接最凶险的护镖与探墓活计。",
      "fullBio": "曾是锦官城官府戍边骁骑营校尉，因拒绝执行屠杀玉泉寨无辜牧民的军令，自削兵籍沦为通缉逃犯。为筹集抚恤金赡养死难同袍遗孤，隐姓埋名在曲措乡接最凶险的护镖与探墓活计。",
      "likes": "习惯吃耐饿的硬面锅盔与腌腊肉，滴酒不沾以防误事。　　**癖好**：修补破损的旧铁甲，用刻刀在木牌上刻战死袍泽的姓名。　　**交易风格**：童叟无欺，按劳取酬，若买主是穷苦边民或义匪常半卖半送。",
      "hobby": "修补破损的旧铁甲，用刻刀在木牌上刻战死袍泽的姓名。　　**交易风格**：童叟无欺，按劳取酬，若买主是穷苦边民或义匪常半卖半送。",
      "tradeStyle": "童叟无欺，按劳取酬，若买主是穷苦边民或义匪常半卖半送。",
      "nsfw": "(无·男性不写)",
      "follower": { "type": "兽", "name": "黑云踏雪", "desc": "随他从死人堆里爬出来的独眼军犬，咬合力惊人，忠心护主。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "天龙",
        "moves": [
          { "name": "金戈铁马枪", "effect": "大开大合，震退前方一列敌军" },
          { "name": "不动明王势", "effect": "盘马弯弓，替同列队友分担五成伤害" },
          { "name": "破阵一击", "effect": "凝聚全身罡气，贯穿敌方最厚重盾甲" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "精钢乌木长矛", "quality": "蓝", "desc": "军中制式重枪改铸，枪缨染满黑血", "slot": "equipment" },
          { "name": "黑铁札片重甲", "quality": "紫", "desc": "磨去官府印记的边军统领重铠", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "染血的兵符残片", "desc": "当年锦官城冤案的唯一铁证，被贴身死守", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "沉戟军需摊",
        "goods": [
          { "name": "边军行军散", "desc": "赶路下墓抗疲劳的军中秘药" },
          { "name": "精铁护心镜", "desc": "可抵挡一次致命暗器偷袭的铁镜" },
          { "name": "强弓破甲簇", "desc": "专破古墓铜甲尸的特制重箭箭头" }
        ]
      },
      "carry": [
        { "name": "精钢乌木长矛", "category": "weapon", "quality": "蓝", "slot": "equipment" },
        { "name": "黑铁札片重甲", "category": "armor", "quality": "紫", "slot": "equipment" },
        { "name": "无字木牌", "category": "misc", "quality": "白", "slot": "bag" }
      ]
    },
{
      "id": "adv_pei_chiye",
      "name": "裴炽野",
      "title": "焚天赤拳",
      "archetype": "chivalrous",
      "archetypeLabel": "侠义",
      "rainbow": true,
      "rainbowStyle": "sunset",
      "stealBias": 0.1,
      "levelCap": 3,
      "gender": "男",
      "faction": "黑风寨",
      "brief": "嫉恶如仇的热血拳客，专打不平事",
      "personality": "嫉恶如仇，性烈如火，一点就着，说话直来直去，对邪魔外道从不讲江湖规矩直接轰杀。",
      "lifeHistory": "鱼定村铁匠之子，全村被欢喜教妖人血洗炼药，唯他被黑风寨义匪救下。后偶得喇嘛庙密宗苦行僧传授刚猛拳法，为彻底铲除欢喜教地宫分舵并寻找被掳走的青梅竹马，日夜闯荡曲措乡凶墓。",
      "fullBio": "鱼定村铁匠之子，全村被欢喜教妖人血洗炼药，唯他被黑风寨义匪救下。后偶得喇嘛庙密宗苦行僧传授刚猛拳法，为彻底铲除欢喜教地宫分舵并寻找被掳走的青梅竹马，日夜闯荡曲措乡凶墓。",
      "likes": "无辣不欢，爱吃滚烫的红油毛血旺，忌吃腥臭怪异的虫蛊料理。　　**癖好**：赤膊在雪山瀑布下练拳，找黑风寨壮汉扳手腕。　　**交易风格**：看人下菜碟，正道侠客好商量，若见欢喜教或五仙教徒直接掀摊动手。",
      "hobby": "赤膊在雪山瀑布下练拳，找黑风寨壮汉扳手腕。　　**交易风格**：看人下菜碟，正道侠客好商量，若见欢喜教或五仙教徒直接掀摊动手。",
      "tradeStyle": "看人下菜碟，正道侠客好商量，若见欢喜教或五仙教徒直接掀摊动手。",
      "nsfw": "(无·男性不写)",
      "follower": { "type": "兽", "name": "赤练金雕", "desc": "黑风寨养大的猛禽，双爪如铁，专啄欢喜教徒的眼珠。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "喇嘛庙",
        "moves": [
          { "name": "大日焚魔拳", "effect": "拳风带火，对邪教与阴尸造成双倍伤害" },
          { "name": "金刚怒目吼", "effect": "震慑全场，打断敌方正在蓄力的毒咒" },
          { "name": "烈火燎原崩", "effect": "双拳砸地，引发气浪震飞周身敌群" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "熟铜双铁尺", "quality": "蓝", "desc": "融合密宗真言铁环的沉重拳套", "slot": "equipment" },
          { "name": "防火厚牛皮围裙甲", "quality": "绿", "desc": "水火不侵的西域异布腰带", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "鱼定村平安锁", "desc": "被火烧得半融的长命银锁，刻着失踪少女小字", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "黑风义卖铺",
        "goods": [
          { "name": "密宗驱邪火折", "desc": "吹之即燃，可烧尽古墓瘴气与尸毒" },
          { "name": "虎骨壮筋膏", "desc": "黑风寨秘制，贴上后拳脚力道暴涨" },
          { "name": "土司府劫镖银", "desc": "黑风寨劫富济贫截获的官银锭" }
        ]
      },
      "carry": [
        { "name": "熟铜双铁尺", "category": "weapon", "quality": "蓝", "slot": "equipment" },
        { "name": "防火厚牛皮围裙甲", "category": "armor", "quality": "绿", "slot": "equipment" },
        { "name": "豆种玉平安扣", "category": "accessory", "quality": "白", "slot": "equipment" }
      ]
    },
{
      "id": "adv_shen_zhuoqing",
      "name": "沈濯清",
      "title": "渡厄青囊",
      "archetype": "chivalrous",
      "archetypeLabel": "侠义",
      "rainbow": true,
      "rainbowStyle": "jade",
      "stealBias": 0.05,
      "levelCap": 3,
      "gender": "男",
      "faction": "峨眉",
      "brief": "悬壶济世的儒医，遇穷苦分文不取",
      "personality": "温润如玉，悲天悯人，对底层牧民极尽耐心，唯独对欢喜教妖人冷酷无情。",
      "lifeHistory": "出身锦官城杏林世家，年轻时拜入峨眉修习内家金针渡穴之术。后逢曲措乡大疫，土司府封山不救，他散尽家财入山施药，却因药材枯竭眼睁睁看着玉泉寨百余妇孺死于怀中。听闻古墓中生有可解百毒的九死还魂草与前朝医典，遂背起药篓只身下墓。",
      "fullBio": "出身锦官城杏林世家，年轻时拜入峨眉修习内家金针渡穴之术。后逢曲措乡大疫，土司府封山不救，他散尽家财入山施药，却因药材枯竭眼睁睁看着玉泉寨百余妇孺死于怀中。听闻古墓中生有可解百毒的九死还魂草与前朝医典，遂背起药篓只身下墓。",
      "likes": "喜食清淡药膳、雪山融水泡的苦荞茶；忌油腻荤腥与烈酒。　　**癖好**：夜雨时分抄录残缺医书，用银针刺穴替自己解乏。　　**交易风格**：穷人看病分文不取，富商求医须以珍稀药材或古籍抵账。",
      "hobby": "夜雨时分抄录残缺医书，用银针刺穴替自己解乏。　　**交易风格**：穷人看病分文不取，富商求医须以珍稀药材或古籍抵账。",
      "tradeStyle": "穷人看病分文不取，富商求医须以珍稀药材或古籍抵账。",
      "nsfw": "(无·男性不写)",
      "follower": { "type": "兽", "name": "白术", "desc": "通体雪白的峨眉灵猿，懂分拣草药，会替主人背负青竹药篓。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "峨眉",
        "moves": [
          { "name": "金针渡劫", "effect": "封敌大穴使其两回合内无法运功" },
          { "name": "慈航普度", "effect": "催动峨眉内力恢复己方气血" },
          { "name": "拂穴手", "effect": "点破敌方护体罡气并附带内伤" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "紫电", "quality": "橙", "desc": "镇身之宝，百穴皆可渡生死的金针", "slot": "equipment" },
          { "name": "玉真青囊针盒", "quality": "蓝", "desc": "趁手医家玉佩，常年浸染药香", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "玉泉寨万民伞布片", "desc": "染血的残布，记录着当年未能救活的牧民名字", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "济世药摊",
        "goods": [
          { "name": "九花玉露丸", "desc": "峨眉秘药，瞬间恢复大量气血" },
          { "name": "清心散", "desc": "解除寻常蛊毒与瘴气侵害" },
          { "name": "续骨膏", "desc": "黑玉断续膏仿品，可治跌打重伤" }
        ]
      },
      "carry": [
        { "name": "紫电", "category": "weapon", "quality": "橙", "slot": "equipment" },
        { "name": "素白僧衣", "category": "armor", "quality": "绿", "slot": "equipment" },
        { "name": "玉真青囊针盒", "category": "accessory", "quality": "蓝", "slot": "equipment" },
        { "name": "手抄止戈经", "category": "misc", "quality": "白", "slot": "bag", "sellable": false, "cherish": 80 }
      ]
    },
{
      "id": "adv_pei_jingzhe",
      "name": "裴惊蛰",
      "title": "碧落蛇君",
      "archetype": "eccentric",
      "archetypeLabel": "怪杰",
      "rainbow": true,
      "rainbowStyle": "aurora",
      "stealBias": 0.65,
      "levelCap": 4,
      "gender": "男",
      "faction": "五仙教",
      "brief": "饲蛇炼毒的怪医，救杀全凭心意",
      "personality": "乖张阴鸷，喜怒无常，厌恶世俗礼法，觉得人心比蛇毒更脏，唯对毒物痴迷。",
      "lifeHistory": "五仙教弃徒。原本是教中百年难遇的毒理奇才，因偷拿教主饲养的千年碧玉蟾去喂自己的本命蛇蛊，被全教追杀。逃入西康边地后隐居鱼定村外，以替茶马古道上的亡命徒拔毒换取活人试药。此次下墓，是为了寻找古墓阴脉中蜕皮的尸王蛇蜕。",
      "fullBio": "五仙教弃徒。原本是教中百年难遇的毒理奇才，因偷拿教主饲养的千年碧玉蟾去喂自己的本命蛇蛊，被全教追杀。逃入西康边地后隐居鱼定村外，以替茶马古道上的亡命徒拔毒换取活人试药。此次下墓，是为了寻找古墓阴脉中蜕皮的尸王蛇蜕。",
      "likes": "喜食生鲜蛇胆、五毒泡制的烈酒；忌甜食与一切熟透的肉类。　　**癖好**：将活捉的恶徒泡在药瓮里观察毒发反应，听蛇群蜕皮的沙沙声。　　**交易风格**：看心情开价，顺眼者收一枚铜板，逆眼者须断一指或试毒三日。",
      "hobby": "将活捉的恶徒泡在药瓮里观察毒发反应，听蛇群蜕皮的沙沙声。　　**交易风格**：看心情开价，顺眼者收一枚铜板，逆眼者须断一指或试毒三日。",
      "tradeStyle": "看心情开价，顺眼者收一枚铜板，逆眼者须断一指或试毒三日。",
      "nsfw": "(无·男性不写)",
      "follower": { "type": "兽", "name": "胭脂扣", "desc": "盘在手腕上的剧毒赤练蛇，通体如红玉，吐信间可喷吐致幻毒雾。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "五仙教",
        "moves": [
          { "name": "万蛇噬心", "effect": "引动群蛇虚影啃噬敌方并叠加强毒" },
          { "name": "赤练缠丝手", "effect": "柔若无骨锁住敌方咽喉并吸取内力" },
          { "name": "碧血化尸功", "effect": "引爆敌方体内毒素造成巨额内伤" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "银鳞圣母鞭", "quality": "橙", "desc": "镇身蛇杖，杖头暗藏五仙教奇毒", "slot": "equipment" },
          { "name": "烟雨银蛇香囊", "quality": "蓝", "desc": "趁手轻靴，踏雪无痕且避百虫", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "半截干枯蛇蜕", "desc": "散发异香，似乎是某种远古异种留下的线索", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "百毒暗铺",
        "goods": [
          { "name": "腐骨穿心散", "desc": "触之即溃，专破名门正派护体硬功" },
          { "name": "三日断魂丸", "desc": "服下后功力大增，三日后经脉剧痛" },
          { "name": "雄黄避水珠", "desc": "墓中水路防虫蛇噬咬的必备奇物" }
        ]
      },
      "carry": [
        { "name": "银鳞圣母鞭", "category": "weapon", "quality": "橙", "slot": "equipment" },
        { "name": "赤纹毒蚕袍", "category": "armor", "quality": "紫", "slot": "equipment" },
        { "name": "烟雨银蛇香囊", "category": "accessory", "quality": "蓝", "slot": "equipment" },
        { "name": "蛇药", "category": "misc", "quality": "绿", "slot": "bag" }
      ]
    },
{
      "id": "adv_cui_shiyin",
      "name": "崔市隐",
      "title": "铁算阎罗",
      "archetype": "greedy",
      "archetypeLabel": "贪财",
      "rainbow": true,
      "rainbowStyle": "sunset",
      "stealBias": 0.85,
      "levelCap": 3,
      "gender": "男",
      "faction": "锦官城",
      "brief": "笑里藏刀的算账高手，买路钱都要算清",
      "personality": "满脸和气生财的假笑，实则锱铢必较、冷血刻薄，万事万物皆可在心中折算成银两。",
      "lifeHistory": "锦官城“古道会”派驻曲措乡的大掌柜，垄断茶马古道上的印子钱（高利贷）。曾靠一张借据逼得黑风寨数名好汉家破人亡。因土司府一位世子欠下古道会十万两巨债后死于古墓，他为了连本带利收回账目，亲自带着算盘与死契下墓“向死人讨债”。",
      "fullBio": "锦官城“古道会”派驻曲措乡的大掌柜，垄断茶马古道上的印子钱（高利贷）。曾靠一张借据逼得黑风寨数名好汉家破人亡。因土司府一位世子欠下古道会十万两巨债后死于古墓，他为了连本带利收回账目，亲自带着算盘与死契下墓“向死人讨债”。",
      "likes": "喜食锦官城空运来的精制酒酿圆子、极品毛峰；忌粗粮与发酸的马奶酒。　　**癖好**：夜深人静时用鹿皮擦拭金算盘，核对欠债人的家谱与软肋。　　**交易风格**：先签死契再交货，支持墓中分期付款，但利息按时辰翻倍计算。",
      "hobby": "夜深人静时用鹿皮擦拭金算盘，核对欠债人的家谱与软肋。　　**交易风格**：先签死契再交货，支持墓中分期付款，但利息按时辰翻倍计算。",
      "tradeStyle": "先签死契再交货，支持墓中分期付款，但利息按时辰翻倍计算。",
      "nsfw": "(无·男性不写)",
      "follower": { "type": "机关人偶", "name": "招财童子", "desc": "向唐门重金定制的背账木偶，腹内暗藏机括，专替主人挡刀收钱。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "唐门",
        "moves": [
          { "name": "漫天撒金钱", "effect": "将淬毒铜钱尽数甩出攻击全体敌人" },
          { "name": "铁算盘打穴", "effect": "算盘珠弹射而出精准封锁敌方气海" },
          { "name": "阎王催命帖", "effect": "掷出暗器飞刀，对流血目标伤害翻倍" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "金珠算盘", "quality": "蓝", "desc": "镇身凶器，纯金打造且内藏唐门机括", "slot": "equipment" },
          { "name": "冰种翡翠扳指", "quality": "蓝", "desc": "趁手护指，拨打暗器时可增三分力道", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "染血的空白死契", "desc": "盖着锦官城官印与古道会私章，填名即生效", "slot": "bag" },
          { "name": "土司府世子欠条", "desc": "记载着十万两雪花银与一处秘境地图的抵押契", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "古道钱庄分号",
        "goods": [
          { "name": "买命金叶子", "desc": "可在墓中贿赂部分贪财守墓人" },
          { "name": "唐门暴雨梨花钉仿品", "desc": "虽是次品，但足以瞬间重创强敌" },
          { "name": "缩骨卸甲油", "desc": "涂抹全身可轻易钻过墓中狭窄盗洞" }
        ]
      },
      "carry": [
        { "name": "金珠算盘", "category": "weapon", "quality": "蓝", "slot": "equipment" },
        { "name": "狼裘大氅", "category": "armor", "quality": "蓝", "slot": "equipment" },
        { "name": "冰种翡翠扳指", "category": "accessory", "quality": "蓝", "slot": "equipment" },
        { "name": "赤蜈暗账", "category": "misc", "quality": "紫", "slot": "bag" }
      ]
    },
{
      "id": "adv_su_shang",
      "name": "素商",
      "title": "踏月无痕",
      "archetype": "opportunist",
      "archetypeLabel": "狡黠",
      "rainbow": true,
      "rainbowStyle": "prism",
      "stealBias": 0.45,
      "levelCap": 4,
      "gender": "女",
      "faction": "三星堆",
      "brief": "古蜀守陵夜行者，人狠话少的孤影",
      "personality": "沉默寡言，警惕性极高，习惯躲在阴影里观察猎物，一旦出手必见血封喉。",
      "lifeHistory": "三星堆守陵一族的末裔“影侍”，自幼在不见天日的地下青铜祭坛中长大，被割去痛觉神经以修习古蜀刺杀术。因欢喜教妖人勾结外贼盗走族中镇陵圣物“青铜神树枝”，她奉族长密令首次踏入曲措乡红尘，潜入各方势力下墓的队伍中伺机夺回圣物。",
      "fullBio": "三星堆守陵一族的末裔“影侍”，自幼在不见天日的地下青铜祭坛中长大，被割去痛觉神经以修习古蜀刺杀术。因欢喜教妖人勾结外贼盗走族中镇陵圣物“青铜神树枝”，她奉族长密令首次踏入曲措乡红尘，潜入各方势力下墓的队伍中伺机夺回圣物。",
      "likes": "喜食风干牦牛肉、冰冷的山泉水；忌葱蒜等一切会让身体留下气味的食物。　　**癖好**：倒挂在房梁或古树阴影中闭目养神，用舌尖舔舐匕首上的血槽。　　**交易风格**：从不开口讨价还价，把看中的东西拿走，留下自认为等值的金银或情报。",
      "hobby": "倒挂在房梁或古树阴影中闭目养神，用舌尖舔舐匕首上的血槽。　　**交易风格**：从不开口讨价还价，把看中的东西拿走，留下自认为等值的金银或情报。",
      "tradeStyle": "从不开口讨价还价，把看中的东西拿走，留下自认为等值的金银或情报。",
      "nsfw": "因痛觉迟钝而追求极致的窒息感与束缚，喜被伴侣用玄铁链反绑双手掐住脖颈后入狠干，在濒死的缺氧晕眩中夹紧花穴痉挛泄身。",
      "follower": { "type": "剑灵", "name": "青鸟", "desc": "寄宿在古蜀青铜短剑中的幽绿残魂，能在黑暗中为主人指引生路。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "三星堆",
        "moves": [
          { "name": "纵目千里刺", "effect": "于暗影中暴起突刺，无视敌方护甲" },
          { "name": "青铜鬼面舞", "effect": "身法诡谲如鬼魅，大幅提升闪避率" },
          { "name": "古蜀血祭斩", "effect": "损耗自身气血，换取一击必杀的暴击" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "神鸟金纹剑", "quality": "橙", "desc": "镇身古蜀短剑，饮血无数且削铁如泥", "slot": "equipment" },
          { "name": "玄纱罗刹衣", "quality": "紫", "desc": "融于夜色的紧身软甲，可敛去呼吸声", "slot": "equipment" },
          { "name": "青铜纵目面具", "quality": "紫", "desc": "趁手半截面具，看破墓中幻术障眼法", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "断裂的青铜神树枝", "desc": "刻满古蜀神秘铭文，靠近墓穴深处会微微发烫", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "暗影鬼市",
        "goods": [
          { "name": "古蜀尸油灯", "desc": "点燃后墓中阴魂邪祟不敢近身" },
          { "name": "无声飞爪", "desc": "绑着天蚕丝的利爪，可攀爬绝壁断崖" },
          { "name": "龟息假死丸", "desc": "服下后心跳全无，可瞒过强大的守墓兽" }
        ]
      },
      "carry": [
        { "name": "神鸟金纹剑", "category": "weapon", "quality": "橙", "slot": "equipment" },
        { "name": "玄纱罗刹衣", "category": "armor", "quality": "紫", "slot": "equipment" },
        { "name": "青铜纵目面具", "category": "accessory", "quality": "紫", "slot": "equipment" },
        { "name": "青铜残片", "category": "misc", "quality": "绿", "slot": "bag" }
      ]
    },
{
      "id": "adv_li_cangshan",
      "name": "厉苍山",
      "title": "折戟镇岳",
      "archetype": "chivalrous",
      "archetypeLabel": "侠义",
      "rainbow": true,
      "rainbowStyle": "sunset",
      "stealBias": 0.1,
      "levelCap": 3,
      "gender": "男",
      "faction": "黑风寨",
      "brief": "规矩大于天的老教头，外粗内细",
      "personality": "作风硬朗，重信守诺，极讲究行伍规矩与长幼尊卑，看似莽撞实则心细如发。",
      "lifeHistory": "曾是锦官城官军中的八十万禁军枪棒副教头，因看不惯上官克扣边军粮饷、杀良冒功，一怒之下打断督军双腿，逃往西康落草于黑风寨。在寨中负责操练义匪步战阵法。此次下墓，是为了替当年死在雪山役中的老部下们寻找一笔被贪墨埋藏的抚恤军饷。",
      "fullBio": "曾是锦官城官军中的八十万禁军枪棒副教头，因看不惯上官克扣边军粮饷、杀良冒功，一怒之下打断督军双腿，逃往西康落草于黑风寨。在寨中负责操练义匪步战阵法。此次下墓，是为了替当年死在雪山役中的老部下们寻找一笔被贪墨埋藏的抚恤军饷。",
      "likes": "喜食大块卤牛肉、曲措乡最烈的青稞烧刀子；忌精细却吃不饱的花巧点心。　　**癖好**：每日寅时雷打不动起身打熬筋骨，用猪油仔细擦拭枪杆与旧铁甲。　　**交易风格**：一口唾沫一个钉，从不漫天要价，但若买主出尔反尔定会挨上一顿老拳。",
      "hobby": "每日寅时雷打不动起身打熬筋骨，用猪油仔细擦拭枪杆与旧铁甲。　　**交易风格**：一口唾沫一个钉，从不漫天要价，但若买主出尔反尔定会挨上一顿老拳。",
      "tradeStyle": "一口唾沫一个钉，从不漫天要价，但若买主出尔反尔定会挨上一顿老拳。",
      "nsfw": "(无·男性不写)",
      "follower": { "type": "人", "name": "铁牛", "desc": "黑风寨收留的哑巴孤儿，天生神力，替教头背负重盾与备用的熟铜棍。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "天龙",
        "moves": [
          { "name": "六脉破军枪", "effect": "将天龙气劲灌注枪尖，刺穿一列敌人" },
          { "name": "不动明王垒", "effect": "横枪立马，替全队承担下回合大部分伤害" },
          { "name": "回马碎岳棍", "effect": "枪杆当棍使，重击敌方胸口使其眩晕" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "土司府仪卫戟", "quality": "橙", "desc": "镇身重枪，枪头由独孤剑冢废铁重铸", "slot": "equipment" },
          { "name": "锦官坊标兵甲", "quality": "蓝", "desc": "趁手旧军甲，满是刀痕却依旧坚固", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "缺角的禁军腰牌", "desc": "正面刻着“锦官折冲府”，背面刻着数十个死人名字", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "军需私库",
        "goods": [
          { "name": "黑风寨行军散", "desc": "立刻消除疲劳并恢复一定体力" },
          { "name": "精钢破甲锥", "desc": "专破墓中重甲机关俑的军中利器" },
          { "name": "牛皮水囊装烧刀子", "desc": "烈酒入喉，大幅驱散雪山古墓寒气" }
        ]
      },
      "carry": [
        { "name": "土司府仪卫戟", "category": "weapon", "quality": "橙", "slot": "equipment" },
        { "name": "锦官坊标兵甲", "category": "armor", "quality": "蓝", "slot": "equipment" },
        { "name": "寒铁护腕", "category": "accessory", "quality": "绿", "slot": "equipment" },
        { "name": "贝叶抄经纸", "category": "misc", "quality": "白", "slot": "bag" }
      ]
    },
{
      "id": "adv_yu_zhaoye",
      "name": "虞照夜",
      "title": "绛唇听风",
      "archetype": "opportunist",
      "archetypeLabel": "狡黠",
      "rainbow": true,
      "rainbowStyle": "prism",
      "stealBias": 0.7,
      "levelCap": 3,
      "gender": "女",
      "faction": "百花门",
      "brief": "八面玲珑的绝代歌伶，琵琶知人意",
      "personality": "巧笑倩兮，八面玲珑，极擅察言观色与挑拨离间，表面娇弱柔顺，实则心如坚铁。",
      "lifeHistory": "天都镇地下秩序“百花门”培养的头牌歌伶，长年周旋于土司府贵人、喇嘛庙破戒僧与茶马古道豪商之间，以琵琶曲与枕边风套取机密。因年华渐长不愿沦为门中饲育母蛊的肉鼎，她暗中用情蛊控制了一名摸金校尉，套出曲措乡大墓中藏有能令人驻颜换命的秘宝，遂乔装入局。",
      "fullBio": "天都镇地下秩序“百花门”培养的头牌歌伶，长年周旋于土司府贵人、喇嘛庙破戒僧与茶马古道豪商之间，以琵琶曲与枕边风套取机密。因年华渐长不愿沦为门中饲育母蛊的肉鼎，她暗中用情蛊控制了一名摸金校尉，套出曲措乡大墓中藏有能令人驻颜换命的秘宝，遂乔装入局。",
      "likes": "喜食雪山燕窝、蜜渍红梅与百花酿；忌大蒜、羊肉等膻味重之物及苦药。　　**癖好**：对镜描眉点绛唇，收集各路江湖豪客送她的定情信物并标价嘲弄。　　**交易风格**：交易前必先调情奉承，让人在骨头酥软间不知不觉签下吃亏的买卖。",
      "hobby": "对镜描眉点绛唇，收集各路江湖豪客送她的定情信物并标价嘲弄。　　**交易风格**：交易前必先调情奉承，让人在骨头酥软间不知不觉签下吃亏的买卖。",
      "tradeStyle": "交易前必先调情奉承，让人在骨头酥软间不知不觉签下吃亏的买卖。",
      "nsfw": "体内种有百花门春情蛊，交合时花穴滚烫且会如小嘴般规律吸吮肉棒，极擅用丰乳夹弄与深喉吞吐，在男人射精瞬间吸干其部分元阳。",
      "follower": { "type": "兽", "name": "醉仙蝶", "desc": "停在发髻上的紫翼蛊蝶，振翅间洒下让人吐露真言的迷幻香粉。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "百花门",
        "moves": [
          { "name": "十面埋伏曲", "effect": "琵琶弦音化刃，扰乱全体敌方心神" },
          { "name": "百花缭乱袖", "effect": "水袖翻飞间洒出同心蛊，令敌自相残杀" },
          { "name": "玉指拨春弦", "effect": "魅惑一名男性敌人使其为你作战一回合" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "乾达婆琵琶", "quality": "紫", "desc": "镇身乐器，天蚕丝为弦，藏有暗器机括", "slot": "equipment" },
          { "name": "黛青蜀锦银缕裙", "quality": "紫", "desc": "百花门秘制软纱裙，刀剑难伤且带异香", "slot": "equipment" },
          { "name": "象牙骨簪", "quality": "蓝", "desc": "趁手发饰，拔下即可作淬毒刺针使用", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "百花门胭脂密信", "desc": "用唇印留在丝帕上的情报，记录着曲措乡大人物的丑事", "slot": "bag" },
          { "name": "干瘪的相思蛊虫尸", "desc": "证明曾有一位痴情高手为她断肠而亡", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "红袖添香阁",
        "goods": [
          { "name": "百花迷魂香", "desc": "点燃后可令墓中人型怪物陷入沉睡" },
          { "name": "同心子母蛊", "desc": "种下后可强行与队友平摊所受伤害" },
          { "name": "驻颜凝露丸", "desc": "恢复气血并清除一切面部诅咒与瘴气" }
        ]
      },
      "carry": [
        { "name": "乾达婆琵琶", "category": "weapon", "quality": "紫", "slot": "equipment" },
        { "name": "黛青蜀锦银缕裙", "category": "armor", "quality": "紫", "slot": "equipment" },
        { "name": "象牙骨簪", "category": "accessory", "quality": "蓝", "slot": "equipment" },
        { "name": "云南沉水香块", "category": "misc", "quality": "绿", "slot": "bag" }
      ]
    },
{
      "id": "adv_bai_ranshuang",
      "name": "白染霜",
      "title": "碎雪辞幽",
      "archetype": "eccentric",
      "archetypeLabel": "孤僻绝尘",
      "rainbow": true,
      "rainbowStyle": "aurora",
      "stealBias": 0.2,
      "levelCap": 4,
      "gender": "女",
      "faction": "天山派",
      "brief": "踏雪无痕的冰山女侠，生人勿近",
      "personality": "性格清冷孤傲，视世俗礼教如无物。极度讨厌喧闹，但对极具武学天赋之人会流露出一丝惜才之意。",
      "lifeHistory": "奉师命追杀叛门师叔至西康地界，迷失于曲措乡的暴风雪中，索性在此暂居，借此地严寒磨砺天山心法。",
      "fullBio": "奉师命追杀叛门师叔至西康地界，迷失于曲措乡的暴风雪中，索性在此暂居，借此地严寒磨砺天山心法。",
      "likes": "偏爱冰镇之物与清淡素食，极其嗜酸，厌恶辛辣油腻。　　**癖好**：喜欢在深夜的雪峰上抚琴，或收集形态各异的冰晶。　　**交易风格**：态度冷漠，绝不讨价还价，看中便买，不卖即走。",
      "hobby": "喜欢在深夜的雪峰上抚琴，或收集形态各异的冰晶。　　**交易风格**：态度冷漠，绝不讨价还价，看中便买，不卖即走。",
      "tradeStyle": "态度冷漠，绝不讨价还价，看中便买，不卖即走。",
      "nsfw": "清冷绝俗的冰雪玉容不苟言笑，常年习武令她那对雪乳丰挺且极具弹性；盈盈一握的柳腰不堪一击般纤细，其下却连着浑圆紧致、饱满微翘的雪臀；修长双腿间，一处幽穴花唇粉嫩紧闭，透着冷香；足衣褪去后，一双玉足骨肉匀称，足趾如剥壳水红菱般晶莹剔透。 看似冰冷不可侵犯，实则耳廓与颈侧极不耐热气撩拨。腰眼处的敏感神经一旦被温热掌心反复摩挲，便会双腿发软；幽壶极浅，受不得重碾猛捣，稍有大动作便会失神痉挛，吐出大股寒气与蜜液。",
      "follower": {
        "type": "剑灵",
        "name": "寒魄",
        "desc": "寄宿于天山寒铁剑中的一缕幽魂，平日化作一只半透明的冰蓝雪貂盘于她肩头。", "slot": "mount", "sellable": false, "cherish": 100 },
      "kungfu": {
        "school": "天山武学",
        "moves": [
          { "name": "天山折梅手", "effect": "化解目标一次物理攻击并反震伤害" },
          { "name": "三分剑术", "effect": "连刺三剑，附带冰冻减速效果" },
          { "name": "八荒六合功", "effect": "气血越低，内力回复与闪避率越高" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "冰种翡翠珠串", "quality": "紫", "desc": "以天山冰蚕丝织就的护腕，触手冰凉，百毒不侵。", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "雪莲玉露", "desc": "天山秘制伤药，散发着淡淡清香。", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "飞雪行囊",
        "goods": [
          { "name": "百年雪莲", "desc": "" },
          { "name": "寒铁飞镖", "desc": "" },
          { "name": "天山雪水", "desc": "" }
        ]
      },
      "carry": [
        { "name": "雪山练功服", "category": "armor", "quality": "白", "slot": "equipment" },
        { "name": "冰蚕护腕", "category": "accessory", "quality": "蓝", "slot": "equipment" },
        { "name": "三城脚夫铜腰牌", "category": "accessory", "quality": "蓝", "slot": "equipment" }
      ]
    },
{
      "id": "adv_yun_jiwei",
      "name": "云霁微", "intimacy": {  threshold: 35, style: "清冷矜持" },
      "title": "暮雨撩云",
      "archetype": "opportunist",
      "archetypeLabel": "见风使舵",
      "rainbow": true,
      "rainbowStyle": "sunset",
      "stealBias": 0.8,
      "levelCap": 3,
      "gender": "女",
      "faction": "巫山派",
      "brief": "眼波带算计的娇媚掌柜，长袖善舞",
      "personality": "八面玲珑，见人说人话。极度利己且擅长利用自身美貌谋取利益，但绝不轻易让人真正占到便宜。",
      "lifeHistory": "原是巫山派弃徒，顺着茶马古道流落西康，看中了曲措乡三教九流汇聚的商机，欲借此地搜刮异宝重返中原。",
      "fullBio": "原是巫山派弃徒，顺着茶马古道流落西康，看中了曲措乡三教九流汇聚的商机，欲借此地搜刮异宝重返中原。",
      "likes": "嗜甜如命，喜爱各种精巧的南方糕点，爱饮浓烈的果酒。　　**癖好**：喜欢把玩品鉴各式男子的随身玉佩，以此评估对方身价。　　**交易风格**：媚眼如丝地推销，暗中疯狂抬价，专宰被她迷得神魂颠倒的冤大头。",
      "hobby": "喜欢把玩品鉴各式男子的随身玉佩，以此评估对方身价。　　**交易风格**：媚眼如丝地推销，暗中疯狂抬价，专宰被她迷得神魂颠倒的冤大头。",
      "tradeStyle": "媚眼如丝地推销，暗中疯狂抬价，专宰被她迷得神魂颠倒的冤大头。",
      "nsfw": "生着一张眼含春水的狐媚脸，唇如饱满丹霞；胸前一对豪乳沉甸甸地呼之欲出，被轻纱勒出惊心动魄的深沟；水蛇腰妖娆扭动，丰腴熟透的磨盘大屁股走起路来肉波荡漾；裙摆下微露的幽穴水光潋滟，两片熟红肥唇微张；常年赤踩的玉足足底带着诱人的软肉，脚趾涂着蔻丹。 最受不住对足底的把玩与轻舔，一旦脚趾被含弄便会情难自禁地流水。丰满的胸肉对揉捏极为渴望，乳尖遇冷或受刺便会硬如石子；大腿内侧的软肉是绝对的弱点，轻轻一刮便会令她娇喘连连，媚态尽显。",
      "follower": { "type": "人", "name": "阿铁", "desc": "高壮如牛的哑巴面具力士，浑身刀疤，对她唯命是从，兼具肉盾与挑夫之职。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "巫山神女功",
        "moves": [
          { "name": "朝云暮雨", "effect": "群体魅惑，降低敌方全体命中与防御" },
          { "name": "巫山断肠掌", "effect": "阴毒掌力，附带持续内力流失" },
          { "name": "流风回雪步", "effect": "大幅度提升闪避，脱离近战纠缠" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "香云纱舞衣", "quality": "蓝", "desc": "轻薄如雾的纱裙，能惑人心智，防御平平但极具风情。", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "神仙欢", "desc": "巫山派特制的催情香料，无色无味。", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "云雨香闺",
        "goods": [
          { "name": "迷魂散", "desc": "" },
          { "name": "合欢春宫图", "desc": "" },
          { "name": "纯金算盘", "desc": "" }
        ]
      },
      "carry": [
        { "name": "云锦香囊", "category": "accessory", "quality": "蓝", "slot": "equipment" },
        { "name": "云南沉水香块", "category": "misc", "quality": "绿", "slot": "bag" },
        { "name": "半张欠条", "category": "misc", "quality": "白", "slot": "bag" },
        { "name": "素银易容粉盒", "category": "accessory", "quality": "蓝", "slot": "equipment" }
      ]
    },
{
      "id": "adv_ye_qingya",
      "name": "叶轻崖",
      "title": "剑动流岚",
      "archetype": "chivalrous",
      "archetypeLabel": "行侠仗义",
      "rainbow": true,
      "rainbowStyle": "prism",
      "stealBias": 0.1,
      "levelCap": 4,
      "gender": "女",
      "faction": "点苍派",
      "brief": "嫉恶如仇的飒爽剑客，出剑如风",
      "personality": "豪迈爽朗，极具正义感。性子略显急躁，能用剑解决的事情绝不多费口舌，但心思单纯极易被骗。",
      "lifeHistory": "点苍派年轻一代的翘楚，听闻西康一带常有马匪劫掠商队，便单骑负剑来到曲措乡，誓要荡平此地贼寇。",
      "fullBio": "点苍派年轻一代的翘楚，听闻西康一带常有马匪劫掠商队，便单骑负剑来到曲措乡，誓要荡平此地贼寇。",
      "likes": "爱吃大块烤肉，无辣不欢，喝烈酒必须用海碗。　　**癖好**：保养宝剑，以及在空旷的草场上纵马狂飙。　　**交易风格**：爽快利落，最烦弯弯绕绕，只要价钱公道直接给钱拿货。",
      "hobby": "保养宝剑，以及在空旷的草场上纵马狂飙。　　**交易风格**：爽快利落，最烦弯弯绕绕，只要价钱公道直接给钱拿货。",
      "tradeStyle": "爽快利落，最烦弯弯绕绕，只要价钱公道直接给钱拿货。",
      "nsfw": "英气勃勃的俊俏脸庞不施粉黛，因常年练武，胸部紧实挺拔而不坠；柔韧有力的劲腰没有一丝赘肉，隐隐可见马甲线；结实紧翘的臀部包裹在侠客劲装下，双腿修长笔挺；神秘的幽穴因未经人事而紧致粉红，穴口平整；双足骨肉匀称，脚背因为练轻功而有着优美的足弓。 看似英朗，实则身体极其敏感。后颈的棘突被指腹按压时会引得全身轻颤；腹部平坦的肌肉在被温热呼吸喷洒时会本能地紧绷，花壶内壁敏锐异常，些许的深浅摩擦便会让她卸去全部剑意，只能无助地夹紧双腿。",
      "follower": { "type": "兽", "name": "踏云", "desc": "一匹神骏异常的大理苍山马，极通人性，能在危急时刻踢飞敌人。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "点苍剑派",
        "moves": [
          { "name": "回风舞柳剑", "effect": "连续四次快剑连击，必定暴击" },
          { "name": "点苍双绝", "effect": "剑气与指力齐发，无视部分防御" },
          { "name": "苍山游云", "effect": "解除自身控制状态并提高移动速度" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "杭绸软银护心袍", "quality": "紫", "desc": "点苍秘传的贴身内甲，刀枪不入，轻若无物。", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "苍山剑谱残页", "desc": "记载着点苍剑法要义的羊皮纸。", "slot": "bag", "sellable": false, "cherish": 80 }
        ]
      },
      "shop": {
        "name": "剑客的马背",
        "goods": [
          { "name": "精钢长剑", "desc": "" },
          { "name": "上等马料", "desc": "" },
          { "name": "云南白药", "desc": "" }
        ]
      },
      "carry": [
        { "name": "七星桩磨剑石", "category": "misc", "quality": "蓝", "slot": "bag" },
        { "name": "紫皮闷倒驴葫芦", "category": "accessory", "quality": "紫", "slot": "equipment" },
        { "name": "风干牦牛肉", "category": "misc", "quality": "白", "slot": "bag" }
      ]
    },
{
      "id": "adv_qu_youzhu",
      "name": "曲幽竹",
      "title": "碧影盘丝",
      "archetype": "greedy",
      "archetypeLabel": "贪得无厌",
      "rainbow": true,
      "rainbowStyle": "jade",
      "stealBias": 0.9,
      "levelCap": 3,
      "gender": "女",
      "faction": "五毒教",
      "brief": "满身带毒的苗疆妖女，贪财难测",
      "personality": "极其护食且贪图财宝，看到闪闪发亮的东西就想据为己有。看似天真烂漫，实则心狠手辣，视人命如草芥。",
      "lifeHistory": "为了寻找传说中隐藏在西康雪山深处的“冰火蟾蜍”，脱离了苗疆五毒教，潜伏在曲措乡靠黑吃黑敛财。",
      "fullBio": "为了寻找传说中隐藏在西康雪山深处的“冰火蟾蜍”，脱离了苗疆五毒教，潜伏在曲措乡靠黑吃黑敛财。",
      "likes": "喜欢食用各种毒虫异兽烹饪的黑暗料理，口味极其辛辣猎奇。　　**癖好**：饲养和解剖各种剧毒生物，或者把金币铺在床上打滚。　　**交易风格**：雁过拔毛，不仅要压价，还常常在交易物品上暗中下毒以图后续敲诈。",
      "hobby": "饲养和解剖各种剧毒生物，或者把金币铺在床上打滚。　　**交易风格**：雁过拔毛，不仅要压价，还常常在交易物品上暗中下毒以图后续敲诈。",
      "tradeStyle": "雁过拔毛，不仅要压价，还常常在交易物品上暗中下毒以图后续敲诈。",
      "nsfw": "异域风情的精巧小脸画着妖异紫妆，胸前双峰娇小却坚挺，点缀着银饰；不盈一握的楚腰上纹着青色毒蛇刺青，翘臀在苗族短裙下若隐若现；双腿间紧窄的蜜穴带着淡淡的草药异香，唇瓣殷红如血；赤裸的双足常年佩戴银铃，脚趾娇小圆润，白皙娇嫩得仿佛一掐就出水。 最受不了对腰间蛇形刺青的舔舐，那是她运毒的经脉交汇处，一碰就会浑身酸软；敏感的脚趾只要被含入口中吸吮，便会引得深处花液决堤；阴阜处极为娇嫩，轻微的揉捻都会让她咬破嘴唇才能忍住甜腻的娇啼。",
      "follower": { "type": "兽", "name": "紫玉", "desc": "一条成年男子大腿粗细的紫鳞巨蟒，平时盘绕在她腰间伪装成一条粗腰带。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "五毒秘传",
        "moves": [
          { "name": "千蛛万毒手", "effect": "造成伤害并附加三层剧毒状态" },
          { "name": "金蚕蛊毒", "effect": "种下蛊毒，数回合后爆发巨额伤害" },
          { "name": "天蛛网", "effect": "束缚目标，使其无法行动并降低抗性" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "官眷诰命簪", "quality": "橙", "desc": "浸泡过百种剧毒的玉簪，既是首饰也是致命暗器。", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "天山冰蟾蜍", "desc": "极为罕见的毒物，晶莹剔透。", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "幽竹毒窠",
        "goods": [
          { "name": "五毒散", "desc": "" },
          { "name": "引虫香", "desc": "" },
          { "name": "成色极差的金条", "desc": "" }
        ]
      },
      "carry": [
        { "name": "纳兰银铃", "category": "accessory", "quality": "蓝", "slot": "equipment" },
        { "name": "百花蛊香囊", "category": "misc", "quality": "蓝", "slot": "bag" },
        { "name": "缠丝玛瑙牌", "category": "accessory", "quality": "绿", "slot": "equipment" },
        { "name": "甘草解毒汤", "category": "misc", "quality": "白", "slot": "bag" }
      ]
    },
{
      "id": "adv_qu_lingxi",
      "name": "曲灵犀", "intimacy": {  threshold: 30, style: "灵巧狡黠" },
      "title": "幻海幽昙",
      "archetype": "opportunist",
      "archetypeLabel": "诡谲难测",
      "rainbow": true,
      "rainbowStyle": "prism",
      "stealBias": 0.8,
      "levelCap": 3,
      "gender": "女",
      "faction": "五毒教",
      "brief": "五毒教圣女候选人，体带异香步步生毒",
      "personality": "娇媚入骨，巧笑倩兮间暗藏杀机。极度利己，擅长利用美色与毒术将男人玩弄于股掌，对忠诚嗤之以鼻。",
      "lifeHistory": "在五毒教内斗中暂时避退，流窜至曲措乡。看中此地独特的瘴气与丰富的毒虫资源，企图在这里炼制出传说中的“万蛊之王”。",
      "fullBio": "在五毒教内斗中暂时避退，流窜至曲措乡。看中此地独特的瘴气与丰富的毒虫资源，企图在这里炼制出传说中的“万蛊之王”。",
      "likes": "偏爱甜腻至极的食物与浓烈的花蜜，尤其喜欢在食物中添加微量致幻的毒蕈。　　**癖好**：把玩色彩斑斓的毒蛇，以及看着猎物在致幻剂中露出丑态。　　**交易风格**：漫天要价，喜欢用充满诱惑的言语扰乱买家心智，常常在交易中搭售带有隐患的药粉。",
      "hobby": "把玩色彩斑斓的毒蛇，以及看着猎物在致幻剂中露出丑态。　　**交易风格**：漫天要价，喜欢用充满诱惑的言语扰乱买家心智，常常在交易中搭售带有隐患的药粉。",
      "tradeStyle": "漫天要价，喜欢用充满诱惑的言语扰乱买家心智，常常在交易中搭售带有隐患的药粉。",
      "nsfw": "长着一张妖冶魅惑的狐媚脸，眼角挑着殷红的胭脂；身穿苗疆短衫，胸前那一对丰乳硕大沉甸，走动时宛如水球般晃动，深褐色的乳头时常顶起衣料；水蛇般的纤腰纹着一只妖异的紫蝎；胯骨极宽，丰乳肥臀；腿根处的阴阜微凸，黑色的耻毛修剪得整整齐齐，肥厚的阴唇湿滑多汁，常年泥泞不堪；双足不着罗袜，脚趾涂着凤仙花汁，脚踝戴着银铃。 她极其敏感的地方是耳垂和肚脐。只要轻轻舔舐她的耳垂，她便会发出甜腻的娇喘；若用手指在她的肚脐处画圈按揉，淫水便会瞬间决堤。",
      "follower": { "type": "机关人偶", "name": "阿呆", "desc": "被蛊毒与金属改造的魁梧毒人，没有痛觉，绝对服从。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "五毒秘传",
        "moves": [
          { "name": "千蛛万毒手", "effect": "近身缠斗，每次攻击叠加剧毒层数" },
          { "name": "软红蛛索", "effect": "抛出毒丝束缚敌人，使其无法闪避" },
          { "name": "引蛊诀", "effect": "引爆敌人体内的毒素，造成大量爆发伤害" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "铃铛", "quality": "蓝", "desc": "系在脚踝的银铃，走动时能发出迷人心智的魔音。", "slot": "equipment" },
          { "name": "翡翠毒液扳指", "quality": "紫", "desc": "佩戴在手腕的奇门兵器，暗藏见血封喉的毒刺。", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "情花蛊", "desc": "散发着异香的活体蛊虫。", "slot": "bag" },
          { "name": "迷魂香", "desc": "无色无味的粉末，令人短暂失忆。", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "幽昙毒铺",
        "goods": [
          { "name": "五毒散", "desc": "" },
          { "name": "引路蜂", "desc": "" },
          { "name": "解瘴丸", "desc": "" }
        ]
      },
      "carry": [
        { "name": "太阳神鸟小铜镜", "category": "accessory", "quality": "蓝", "slot": "equipment" },
        { "name": "竹叶青蛇胆", "category": "misc", "quality": "蓝", "slot": "bag" },
        { "name": "乾达婆香囊", "category": "accessory", "quality": "蓝", "slot": "equipment" },
        { "name": "苗银花簪刺", "category": "weapon", "quality": "绿", "slot": "equipment" }
      ]
    },
{
      "id": "adv_yan_lie",
      "name": "燕烈",
      "title": "焚天红莲",
      "archetype": "chivalrous",
      "archetypeLabel": "嫉恶如仇",
      "rainbow": true,
      "rainbowStyle": "sunset",
      "stealBias": 0.1,
      "levelCap": 4,
      "gender": "女",
      "faction": "明教",
      "brief": "明教烈火旗掌旗使，红衣烈性难惹",
      "personality": "豪放不羁，性格火爆直爽，最见不得恃强凌弱。言语粗犷且带着西域口音，重情重义，一旦认定朋友便可两肋插刀。",
      "lifeHistory": "奉教主之命追杀一名携带明教密卷叛逃的高层。一路追踪其足迹穿过大漠来到西康边陲的曲措乡，誓要将叛徒斩于刀下。",
      "fullBio": "奉教主之命追杀一名携带明教密卷叛逃的高层。一路追踪其足迹穿过大漠来到西康边陲的曲措乡，誓要将叛徒斩于刀下。",
      "likes": "无肉不欢，最爱大块烤羊肉配以辛辣的西域烈酒，吃法极为豪迈。　　**癖好**：擦拭自己的弯刀，以及在篝火旁唱粗犷的西域战歌。　　**交易风格**：痛快爽利，不屑于讨价还价，遇到看顺眼的人甚至会半买半送，对奸商则会拔刀相向。",
      "hobby": "擦拭自己的弯刀，以及在篝火旁唱粗犷的西域战歌。　　**交易风格**：痛快爽利，不屑于讨价还价，遇到看顺眼的人甚至会半买半送，对奸商则会拔刀相向。",
      "tradeStyle": "痛快爽利，不屑于讨价还价，遇到看顺眼的人甚至会半买半送，对奸商则会拔刀相向。",
      "nsfw": "五官深邃英挺，带着异域风情，小麦色的肌肤紧致充满野性；长期练武使得她的双乳呈现出水滴状的健美，乳肉结实弹性极佳，挺立的红梅宛如熟透的浆果；马甲线清晰可见的窄腰充满了爆发力；臀大肌紧实上翘，如同母豹般充满张力；阴户紧致结实，花瓣呈现健康的肉粉色，内里肉壁褶皱极多，夹绞力惊人；常年奔波的双足略带薄茧，脚型却匀称修长，透着一股健康的力量美。 她的敏感点在锁骨下方与尾椎骨。每当被抚摸这两处，她英气的脸上便会泛起难耐的红晕，强健的双腿会不由自主地夹紧，发出压抑的闷哼。",
      "follower": { "type": "兽", "name": "赤羽", "desc": "一只凶悍的西域猎隼，视野极广，能从高空俯冲啄瞎敌人双眼。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "明教武学",
        "moves": [
          { "name": "圣火令神功", "effect": "招式怪异难测，大幅提升闪避与暴击率" },
          { "name": "烈火刀法", "effect": "大开大合的群体刀法，附带灼烧效果" },
          { "name": "大九天手", "effect": "凝聚纯阳内力的重击，击退并眩晕单体目标" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "止戈玉令", "quality": "橙", "desc": "非金非木的令牌，明教高层的信物，蕴含奇异热力。", "slot": "equipment" },
          { "name": "百炼苗刀", "quality": "紫", "desc": "刀刃呈现暗红色的波浪纹理，极其锋利。", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "西域火石", "desc": "极易点燃，遇水不灭。", "slot": "bag" },
          { "name": "烈火旗名册", "desc": "记录了部分明教暗桩的羊皮卷。", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "红莲马帮",
        "goods": [
          { "name": "西域烈酒", "desc": "" },
          { "name": "上等烤肉", "desc": "" },
          { "name": "伤药金疮药", "desc": "" }
        ]
      },
      "carry": [
        { "name": "苞谷酒", "category": "misc", "quality": "白", "slot": "bag" },
        { "name": "孟记铁铺淬火油", "category": "misc", "quality": "白", "slot": "bag" },
        { "name": "熊山手绘地图", "category": "accessory", "quality": "白", "slot": "equipment" },
        { "name": "红线", "category": "accessory", "quality": "白", "slot": "equipment" }
      ]
    },
{
      "id": "adv_bai_lingshuang",
      "name": "白凌霜",
      "title": "飞雪落梅",
      "archetype": "eccentric",
      "archetypeLabel": "孤高冷傲",
      "rainbow": true,
      "rainbowStyle": "aurora",
      "stealBias": 0.2,
      "levelCap": 4,
      "gender": "女",
      "faction": "天山派",
      "brief": "千里寻莲的天山剑客，剑法孤清",
      "personality": "性格清冷孤傲，不苟言笑。视世俗礼法如无物，行事全凭自身喜恶，对弱者有不易察觉的怜悯。",
      "lifeHistory": "自幼长于天山绝顶，修习寒冰真气。听闻曲措乡深处有千年雪莲踪迹，遂孤身入康巴，剑挑数路宵小。",
      "fullBio": "自幼长于天山绝顶，修习寒冰真气。听闻曲措乡深处有千年雪莲踪迹，遂孤身入康巴，剑挑数路宵小。",
      "likes": "偏爱冰镇之物与清淡素食，不喜油腻辛辣。　　**癖好**：独坐高处听风雪声，或是擦拭随身佩剑。　　**交易风格**：极不耐烦，价格合适便扔钱拿货，多说一句都会拔剑。",
      "hobby": "独坐高处听风雪声，或是擦拭随身佩剑。　　**交易风格**：极不耐烦，价格合适便扔钱拿货，多说一句都会拔剑。",
      "tradeStyle": "极不耐烦，价格合适便扔钱拿货，多说一句都会拔剑。",
      "nsfw": "生着一张清冷出尘的瓜子脸，双峰在白衣下挺拔傲立、轮廓优美。盈盈一握的楚腰没有一丝赘肉，臀部紧实而圆润。花穴色泽宛如雪中绽放的粉梅，干净且紧致，双足更是晶莹剔透，连脚趾都如玉雕般完美无瑕。 最受不得别人呼出的热气喷洒在敏感的耳垂上；大腿内侧的软肉一旦被轻轻摩挲，便会双腿发软；玉趾对碰触极为敏感，揉捏脚心能让她瞬间破防喘息。",
      "follower": { "type": "兽", "name": "霜影", "desc": "一头通体雪白、唯有尾尖带黑的极地雪豹，步履轻盈，目光锐利。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "天山剑法",
        "moves": [
          { "name": "冰河倒悬", "effect": "群体冰冻伤害，降低目标速度" },
          { "name": "折梅手", "effect": "单体缴械，反制物理攻击" },
          { "name": "天山融雪功", "effect": "消耗内力恢复自身气血，解除中毒状态" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "听雪素玉佩", "quality": "紫", "desc": "刀枪不入，附带冰寒之气的掌法加成。", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "天山雪蛤膏", "desc": "疗伤圣药，敷之祛疤生肌。", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "冷梅剑匣",
        "goods": [
          { "name": "百年冰魄", "desc": "" },
          { "name": "雪貂皮裘", "desc": "" },
          { "name": "天山清心丸", "desc": "" }
        ]
      },
      "carry": [
        { "name": "寒铁细剑", "category": "weapon", "quality": "蓝", "slot": "equipment" },
        { "name": "誊抄的话本残页", "category": "misc", "quality": "绿", "slot": "bag" },
        { "name": "铜钱串", "category": "accessory", "quality": "白", "slot": "equipment" },
        { "name": "驼绒防风氅", "category": "armor", "quality": "绿", "slot": "equipment" }
      ]
    },
{
      "id": "adv_qu_yansi",
      "name": "曲艳丝", "intimacy": {  threshold: 25, style: "冶艳撩人" },
      "title": "蛊影千幻",
      "archetype": "opportunist",
      "archetypeLabel": "见风使舵",
      "rainbow": true,
      "rainbowStyle": "jade",
      "stealBias": 0.8,
      "levelCap": 3,
      "gender": "女",
      "faction": "五毒教",
      "brief": "游走黑白两道的炼蛊毒女，行踪飘忽",
      "personality": "极其圆滑世故，眼波流转间尽是算计。表面千娇百媚、姐姐长妹妹短，实则吃人不吐骨头。",
      "lifeHistory": "苗疆五毒教出身，因门派内斗来到西康。发现此地毒瘴与苗疆大不相同，大喜过望，决定在此长期抓人试毒。",
      "fullBio": "苗疆五毒教出身，因门派内斗来到西康。发现此地毒瘴与苗疆大不相同，大喜过望，决定在此长期抓人试毒。",
      "likes": "极度嗜辣，喜食各种奇珍野味、毒虫蛇蚁入药的膳食。　　**癖好**：调戏正派少侠看他们脸红，或在深夜调制散发异香的毒粉。　　**交易风格**：软语温存地讨价还价，经常用迷魂香气试图让卖家打骨折。",
      "hobby": "调戏正派少侠看他们脸红，或在深夜调制散发异香的毒粉。　　**交易风格**：软语温存地讨价还价，经常用迷魂香气试图让卖家打骨折。",
      "tradeStyle": "软语温存地讨价还价，经常用迷魂香气试图让卖家打骨折。",
      "nsfw": "长着一双勾魂摄魄的妖艳狐狸眼，双乳丰满硕大犹如熟透的蜜桃，水蛇腰柔软无骨扭动生姿，丰臀肥美宽大极具肉感。蜜穴常年湿润，汁水丰沛且肉唇微微外翻，玉足小巧，脚趾涂着鲜艳的丹蔻，极具苗疆风情。 最为敏感的是后腰处的腰窝，只需手指轻轻打圈便能让她春水泛滥；双乳的乳尖挺立，稍加揉捏便会发出娇媚入骨的呻吟；精致的锁骨也是她动情的开关。",
      "follower": { "type": "兽", "name": "红鳞", "desc": "缠绕在小臂上的剧毒赤练蛇，鳞片艳丽，吐信无声。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "五毒秘传",
        "moves": [
          { "name": "千蛛万毒手", "effect": "单体高额毒伤，附带持续掉血" },
          { "name": "引蛊迷心", "effect": "魅惑单体目标，使其攻击友军" },
          { "name": "天罗地网势", "effect": "释放毒雾，降低全体敌人命中率" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "银鳞缠丝鞭", "quality": "紫", "desc": "浸泡过百毒的软鞭，中者皮开肉绽且毒气攻心。", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "绝情断肠蛊", "desc": "装在玉盒里的异种蛊虫，见血封喉。", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "万毒香囊",
        "goods": [
          { "name": "化尸粉", "desc": "" },
          { "name": "五毒神仙丸", "desc": "" },
          { "name": "苗疆风情银饰", "desc": "" }
        ]
      },
      "carry": [
        { "name": "碧竹吹箭", "category": "weapon", "quality": "绿", "slot": "equipment" },
        { "name": "红绳铜铃脚环", "category": "accessory", "quality": "白", "slot": "equipment" },
        { "name": "药囊", "category": "misc", "quality": "绿", "slot": "bag" },
        { "name": "人皮易容薄胎", "category": "accessory", "quality": "蓝", "slot": "equipment" }
      ]
    },
{
      "id": "adv_nie_qiuhong",
      "name": "聂秋红",
      "title": "惊雷掠日",
      "archetype": "chivalrous",
      "archetypeLabel": "豪侠仗义",
      "rainbow": true,
      "rainbowStyle": "sunset",
      "stealBias": 0.1,
      "levelCap": 4,
      "gender": "女",
      "faction": "昆仑派",
      "brief": "千里追叛徒的烈火女侠，性急刚烈",
      "personality": "嫉恶如仇，脾气火爆但心思坦荡。路见不平必拔刀相助，是个不拘小节、大碗喝酒的江湖儿女。",
      "lifeHistory": "昆仑派年轻一代翘楚，师傅被叛徒暗算。她提着重剑横跨中原万里追凶，誓要将叛徒在曲措乡风干成肉干。",
      "fullBio": "昆仑派年轻一代翘楚，师傅被叛徒暗算。她提着重剑横跨中原万里追凶，誓要将叛徒在曲措乡风干成肉干。",
      "likes": "大块烤肉，烈性烧酒，对精致小巧的糕点嗤之以鼻。　　**癖好**：找人切磋武艺，或者坐在篝火旁痛饮烈酒。　　**交易风格**：爽快直接，不屑于讨价还价，只要看对眼了甚至愿意倒贴。",
      "hobby": "找人切磋武艺，或者坐在篝火旁痛饮烈酒。　　**交易风格**：爽快直接，不屑于讨价还价，只要看对眼了甚至愿意倒贴。",
      "tradeStyle": "爽快直接，不屑于讨价还价，只要看对眼了甚至愿意倒贴。",
      "nsfw": "生着英气勃勃的剑眉星目，胸脯结实饱满充满弹性，腰腹间有清晰紧致的马甲线，长腿丰臀充满武人的爆发力与肉感。私处紧致，毛发修剪得很短，双足足弓高挑，肌肉线条匀称有力，充满了健康野性的美感。 颈侧的动脉处一旦被亲吻舔舐，会让她浑身战栗失去力气；膝盖后侧的腘窝异常敏感，被抚摸时大腿会下意识地夹紧；粗糙的指腹摩擦她平坦结实的肚脐周围也会引发强烈的喘息。",
      "follower": { "type": "剑灵", "name": "断雷", "desc": "依附在昆仑重剑上的上古剑灵，化作一团若隐若现的赤色雷光。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "昆仑烈阳功",
        "moves": [
          { "name": "迅雷剑法", "effect": "极快的三连击，概率暴击" },
          { "name": "烈火燎原", "effect": "群体真气伤害，燃烧效果" },
          { "name": "昆仑罡气", "effect": "大幅提升自身防御，免疫控制一回合" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "紫阳松纹剑", "quality": "橙", "desc": "剑身暗红，挥舞时伴随风雷之声的绝世重剑。", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "昆仑烈阳丹", "desc": "补充大量内力，驱除极寒。", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "豪客剑袋",
        "goods": [
          { "name": "西域烈酒", "desc": "" },
          { "name": "上等磨刀石", "desc": "" },
          { "name": "昆仑玄铁", "desc": "" }
        ]
      },
      "carry": [
        { "name": "鹰曲长剑", "category": "weapon", "quality": "蓝", "slot": "equipment" },
        { "name": "青稞酒", "category": "misc", "quality": "白", "slot": "bag" },
        { "name": "沉甸甸的碎银荷包", "category": "accessory", "quality": "绿", "slot": "equipment" }
      ]
    },
{
      "id": "adv_yin_ruyue",
      "name": "殷如月",
      "title": "焚天圣女",
      "archetype": "greedy",
      "archetypeLabel": "贪得无厌",
      "rainbow": true,
      "rainbowStyle": "prism",
      "stealBias": 0.9,
      "levelCap": 3,
      "gender": "女",
      "faction": "明教",
      "brief": "兜帽遮面的明教特使，潜入西康寻宝",
      "personality": "充满神秘感，对财富和武功秘籍有着异乎寻常的狂热。善于利用美貌与幻术达成目的，极度自私。",
      "lifeHistory": "拥有四分之一波斯血统，在明教中步步钻营爬上圣女之位。听闻曲措乡藏有波斯摩尼教遗物，悄然潜入。",
      "fullBio": "拥有四分之一波斯血统，在明教中步步钻营爬上圣女之位。听闻曲措乡藏有波斯摩尼教遗物，悄然潜入。",
      "likes": "波斯香料烤制的肉类，喜欢吃极甜的西域蜜饯。　　**癖好**：深夜清点自己搜刮来的金银珠宝与古籍，欣赏宝石的反光。　　**交易风格**：极其吝啬，最爱空手套白狼，交易时总想把对方底裤都骗走。",
      "hobby": "深夜清点自己搜刮来的金银珠宝与古籍，欣赏宝石的反光。　　**交易风格**：极其吝啬，最爱空手套白狼，交易时总想把对方底裤都骗走。",
      "tradeStyle": "极其吝啬，最爱空手套白狼，交易时总想把对方底裤都骗走。",
      "nsfw": "面罩下隐藏着异域深邃的五官，双乳白皙浑圆，在薄纱下若隐若现。腰肢纤细且点缀着一颗红宝石脐环，蜜桃臀微翘，走动间惹火至极。幽谷紧致粉嫩泛着诱人的水光，纤纤玉足套着金丝脚链，铃铛随着步伐叮当响。 最受不了对肚脐四周以及那颗脐环的拨弄把玩；深邃立体的耳廓若是被含弄，她会娇软地求饶；大腿根部的细嫩肌肤被轻拢慢捻时，常常让她立刻湿透。",
      "follower": { "type": "机关人偶", "name": "阿萨辛", "desc": "高大的波斯机关傀儡，精钢打造，沉默而致命的护卫。", "slot": "mount", "sellable": false, "cherish": 100 , "intimacy": { "forbidden": true } },
      "kungfu": {
        "school": "圣火心法",
        "moves": [
          { "name": "大明尊印", "effect": "单体高额精神打击，造成混乱" },
          { "name": "圣火焚躯", "effect": "牺牲自身少量气血，对敌方全体造成烈焰伤害" },
          { "name": "暗影迷踪", "effect": "闪避率提升至极高，持续两回合" }
        ]
      },
      "stealables": {
        "equipment": [
          { "name": "圣女素银莲簪", "quality": "紫", "desc": "带有惑人心神异香的丝质面纱。", "slot": "equipment" }
        ],
        "sundries": [
          { "name": "圣火令拓本", "desc": "记载着诡异武功的羊皮纸卷。", "slot": "bag" }
        ]
      },
      "shop": {
        "name": "幻海奇珍",
        "goods": [
          { "name": "波斯猫眼石", "desc": "" },
          { "name": "西域迷幻香", "desc": "" },
          { "name": "明教引火折", "desc": "" }
        ]
      },
      "carry": [
        { "name": "金丝软银鞭", "category": "weapon", "quality": "紫", "slot": "equipment" },
        { "name": "染血的香行凭据（抄本）", "category": "misc", "quality": "紫", "slot": "bag", "sellable": false, "cherish": 80 },
        { "name": "滇南醒神香", "category": "misc", "quality": "绿", "slot": "bag" },
        { "name": "苗银暗器囊", "category": "accessory", "quality": "蓝", "slot": "equipment" }
      ]
    }
]);

export const ADVENTURER_BY_NAME = Object.freeze(
  Object.fromEntries(ADVENTURER_POOL.map((adv) => [adv.name, adv])),
);

export function isAdventurerName(name) {
  return Boolean(name && ADVENTURER_BY_NAME[name]);
}

function getActiveWorldDistricts() {
  return Object.keys(QUCUO_MAP).filter((name) => !EXCLUDED_DISTRICTS.has(name));
}

// 每天把 22 位冒险者按确定性种子分布到世界各地据点（同一天每人只落在一个据点，跨天自动换城）。
export function getWorldAdventurers(districtName, time = 0) {
  if (!districtName || EXCLUDED_DISTRICTS.has(districtName) || !QUCUO_MAP[districtName]) return [];
  const districts = getActiveWorldDistricts();
  if (!districts.length) return [];

  const dayIdx = Math.floor((time ?? 0) / 24);
  const matched = [];
  for (const adv of ADVENTURER_POOL) {
    const rng = seededRand(dayIdx, `world_adv_${adv.id}`);
    const targetDistrict = districts[Math.floor(rng() * districts.length) % districts.length];
    if (targetDistrict === districtName) {
      matched.push({
        ...adv,
        adventurer: true,
        adventurerDay: dayIdx,
      });
    }
  }
  return matched;
}

// 供地宫内随机遭遇抽取一名冒险者（尽量避开本趟已遇过的角色）。
export function pickDungeonAdventurer(excludeIds = []) {
  const excluded = new Set(excludeIds);
  const candidates = ADVENTURER_POOL.filter((adv) => !excluded.has(adv.id));
  const pool = candidates.length ? candidates : ADVENTURER_POOL;
  return pool[Math.floor(random() * pool.length) % pool.length];
}
