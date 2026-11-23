export default { quest: {
  wuxianjiao_1_zilanwenjing: {
    id: "wuxianjiao_1_zilanwenjing",
    type: "QT_TALK",
    title: "蛊1·紫岚问径",
    giver: "苏小青",
    giverId: "resident_suxiaoqing",
    localOnly: true,
    description: "雅江南麓的毒瘴传闻越传越凶，都说南山里有苗疆妖女放毒害马。可在西城门外的瘴林边缘，你撞见的却是两名峨眉剑庐弟子持剑围住一个采药女。",
    stages: [
      {
        id: "meet",
        giver: null,
        requireLocation: { district: "雅江", inner: "西城门" },
        playerHint: "去雅江西城门外的瘴林边缘看看传闻里的「苗疆妖女」。",
        description: "两名峨眉弟子剑尖指着药篓里的姑娘：「昨日官道两匹商马被毒死，不是你五仙教干的还有谁？」姑娘抱着药篓退到崖边，怀里的小竹蛇吓得钻进袖口。",
        completionFlag: ["quest_wx1_peace", "quest_wx1_fight"],
        choices: [
          { flag: "quest_wx1_peace", label: "理证息争", resolve: "none", narration: "你蹲下查看商马尸体——毒发症状是「赤蜈腐骨散」，可苏小青药篓里只有治蛇伤的草药。峨眉弟子盯着你挑出的疑点半晌，收剑退回锦官城：「若真是有人嫁祸，此事还要查。」" },
          { flag: "quest_wx1_fight", label: "拔刀硬护", resolve: "combat", combatNpc: { name: "峨眉剑庐巡山弟子", levelCap: 3 } },
        ],
        onReach: {
          flags: ["wuxian_invited"],
          favorability: { "苏小青": 20 },
          byFlag: {
            quest_wx1_peace: { factionRep: { 峨眉派: 3 }, favorability: { "龙汐月": 10 } },
            quest_wx1_fight: { factionRep: { 峨眉派: -10, 五仙教: 5 } },
          },
        },
      },
      {
        id: "escort",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "紫岚藤桥" },
        playerHint: "护送受伤的苏小青穿过紫岚毒雾，踏上雾隐寨的紫岚藤桥。",
        description: "苏小青含着腌姜带你穿过毒雾：「别碰两边的藤叶，沾了要痒三天。」她解开襟口一只小香囊递过来——有了这个记号，崖壁里的吹箭就不会对准你了。",
        completionFlag: "quest_wx1_escort",
        onReach: {
          favorability: { "苏小青": 10 },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "五仙灵坛" },
        playerHint: "过紫岚藤桥往北，进五仙灵坛拜见教主龙汐月。",
        description: "青石坪上五根黑木柱盘着蛇蜈蝎蟾守宫。廊下把玩银鞭的少女抬眼一笑：「外头都说苗疆女子心狠——可我的银蛇咬人前，还会先响三声铃铛呢。小青既认你做了救命恩人，这寨子你随便走。」麻九娘在柱影里冷眼旁观，没说话。",
        completionFlag: "quest_wx1_report",
        onReach: {
          money: 80,
          favorability: { "龙汐月": 15 },
          factionRep: { 五仙教: 10 },
          items: [
            { name: "防瘴紫苏囊", fromCatalog: true },
            { name: "清瘴丸", fromCatalog: true },
            { name: "清瘴丸", fromCatalog: true },
            { name: "清瘴丸", fromCatalog: true },
          ],
        },
      },
    ],
    rewardText: "龙汐月赐下防瘴紫苏囊。雾隐寨的内层门户从此为你敞开——百蛊药房和秘珍坊的货色，要看你在五仙教的名声。",
  },  // ── 蛊2·毒典疑影（查案线）──
  wuxianjiao_2_dudianyiying: {
    id: "wuxianjiao_2_dudianyiying",
    type: "QT_TALK",
    title: "蛊2·毒典疑影",
    giver: "龙汐月",
    giverId: "resident_longxiyue",
    localOnly: true,
    requiresQuestCompleted: "wuxianjiao_1_zilanwenjing",
    requiresFactionRep: { 五仙教: 15 },
    description: "五仙灵坛夜里失了窃——《万蛊毒典》抄本少了一册，现场只留下一枚梅花形断针。龙汐月把断针递给你：「外路人，查出来。」",
    stages: [
      {
        id: "case",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "五仙灵坛" },
        playerHint: "去五仙灵坛领龙汐月的查案令。",
        description: "龙汐月指尖转着那半截断针：「针是外路的，手法是内行的。乌婆婆管药房，先去问她——是谁家的毒，逃不过她的鼻子。」",
        completionFlag: "quest_wx2_start",
        onReach: {
          items: [{ name: "梅花断针证物", fromCatalog: true }],
          favorability: { "龙汐月": 10 },
        },
      },
      {
        id: "granny",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "百蛊药房" },
        playerHint: "去百蛊药房请乌婆婆验针。",
        description: "乌婆婆把断针凑到灯下，又蘸了点药粉一闻，脸色变了：「赤蜈腐骨散兑了唐门机括里的引子——麻九娘那一房的手笔。毒窟的铜牌在桑七身上，要进去，先过他这关。」",
        completionFlag: "quest_wx2_granny",
        onReach: { favorability: { "乌婆婆": 10 } },
      },
      {
        id: "badge",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "听虫演武坪" },
        playerHint: "去听虫演武坪，从桑七手里拿下赤蜈铜牌。",
        description: "演武坪上桑七正磨刀，见你亮出断针，狼一样的眼睛眯了起来：「药房的老东西又多嘴。铜牌在我这——有本事，自己来拿。」",
        completionFlag: ["quest_wx2_fight", "quest_wx2_talk"],
        choices: [
          { flag: "quest_wx2_fight", label: "动手拿下桑七", resolve: "combat", combatNpc: { name: "桑七", levelCap: 3 } },
          { flag: "quest_wx2_talk", label: "搬出龙汐月的查案令压他", resolve: "none", narration: "你把教主的银铃令拍在桩上：「教主亲令查案，挡者同罪。」桑七掂量半晌，悻悻解下铜牌丢过来。" },
        ],
        onReach: {
          items: [{ name: "赤蜈铜牌", fromCatalog: true }],
          byFlag: {
            quest_wx2_fight: { favorability: { "桑七": -10 } },
            quest_wx2_talk: { favorability: { "桑七": -5, "龙汐月": 5 } },
          },
        },
      },
      {
        id: "lair",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "赤蜈毒窟" },
        playerHint: "持赤蜈铜牌进赤蜈毒窟，搜毒典与暗账的线索。",
        description: "毒窟深处药味呛喉，暗格里翻出一册誊抄的毒典残页和半本暗账——账上记着毒材出寨的去向，赫然有唐门与土司府的字样。",
        completionFlag: "quest_wx2_lair",
        onReach: {
          factionRep: { 五仙教: 8 },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "五仙灵坛" },
        playerHint: "回五仙灵坛向龙汐月回禀查案所得。",
        description: "毒典残页与暗账摊在灵坛上，麻九娘柱影里的冷笑头一回收了声。龙汐月指尖敲着银鞭：「外路的针，内行的手——这事还没完，但头一桩功是你的。」",
        completionFlag: ["quest_wx2_report", "quest_wx2_mjn"],
        choices: [
          { flag: "quest_wx2_report", label: "如实禀报龙汐月", resolve: "none" },
          { flag: "quest_wx2_mjn", label: "暗中把梅花断针交给麻九娘", resolve: "none", narration: "你在柱影里把断针塞进麻九娘掌心。她五指一合，笑得像条吐信的蛇：「识时务的外路人，往后有你的好处。」龙汐月远远望了你一眼，没说话。" },
        ],
        onReach: {
          money: 120,
          items: [{ name: "蛇胆解毒丹", fromCatalog: true }, { name: "蛇胆解毒丹", fromCatalog: true }],
          factionRep: { 五仙教: 15 },
          byFlag: {
            quest_wx2_report: { favorability: { "龙汐月": 15 } },
            quest_wx2_mjn: { favorability: { "麻九娘": 15, "龙汐月": -10 } },
          },
        },
      },
    ],
    rewardText: "毒典疑案水落一半——暗账指向赤蜈堂，也指向寨子外面的买家。",
  },

  // ── 蛊3·世节旧恨（百花门线）──
  wuxianjiao_3_shijiejiuhen: {
    id: "wuxianjiao_3_shijiejiuhen",
    type: "QT_TALK",
    title: "蛊3·世节旧恨",
    giver: "龙汐月",
    giverId: "resident_longxiyue",
    localOnly: true,
    requiresQuestCompleted: "wuxianjiao_2_dudianyiying",
    requiresFactionRep: { 五仙教: 25 },
    description: "毒典疑案牵出旧账：当年五仙教与百花门决裂，半边是因一桩说不清的下毒案。龙汐月要你上天都镇百花楼——见兰姐，把三十年的结当面问清楚。",
    stages: [
      {
        id: "errand",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "五仙灵坛" },
        playerHint: "去五仙灵坛听龙汐月交代旧怨。",
        description: "龙汐月望着坛上银铃：「百花楼的兰姐，当年是我师姐。带话给她——若还认当年那枝杜鹃，就见她一面。」",
        completionFlag: "quest_wx3_go",
        onReach: {
          items: [{ name: "蜀锦绣帕", fromCatalog: true }],
        },
      },
      {
        id: "lanjie",
        giver: null,
        requireLocation: { district: "天都镇", inner: "百花楼" },
        playerHint: "上天都镇百花楼，以绣帕为信求见兰姐。",
        description: "兰姐摩挲着绣帕上的杜鹃，眼圈红了一瞬：「师妹还留着这个……那桩下毒案，我百花门背了三十年黑锅，她们五仙教何尝不是？」话音未落，楼下传来打斗声——有人不许这趟会面安生。",
        completionFlag: "quest_wx3_meet",
        onReach: { favorability: { "龙汐月": 5 } },
      },
      {
        id: "ambush",
        giver: null,
        requireLocation: { district: "天都镇", inner: "百花楼" },
        playerHint: "拦下冲进百花楼搅局的赤蜈毒使。",
        description: "桑七领着两名毒使撞上楼来，袖中吹箭直取兰姐：「教主有令——五仙的事，轮不到外人嚼舌！」",
        completionFlag: ["quest_wx3_fight", "quest_wx3_betray"],
        choices: [
          { flag: "quest_wx3_fight", label: "出手护下兰姐", resolve: "combat", combatNpc: { name: "赤蜈毒使", levelCap: 3 } },
          { flag: "quest_wx3_betray", label: "趁乱暗算兰姐夺手札", resolve: "combat", requiresFlag: ["quest_wx2_mjn"], combatNpc: { name: "兰姐", levelCap: 4 } },
        ],
        onReach: {
          byFlag: {
            quest_wx3_fight: {
              items: [{ name: "旧金蚕壳", fromCatalog: true }, { name: "百花净毒露", fromCatalog: true }, { name: "百花净毒露", fromCatalog: true }],
              flags: ["wuxian_baihua_reconcile"],
              factionRep: { 五仙教: 20, 百花门: 20, 峨眉派: -3 },
              favorability: { "龙汐月": 20, "麻九娘": -10 },
            },
            quest_wx3_betray: {
              flags: ["wuxian_baihua_feud"],
              factionRep: { 五仙教: 25, 百花门: -50 },
              reputation: -15,
              favorability: { "麻九娘": 15, "龙汐月": -15 },
            },
          },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "五仙灵坛" },
        playerHint: "回五仙灵坛，把兰姐的话与桑七搅局一并带回。",
        description: "灵坛灯火下，龙汐月听你说完百花楼那一夜，指节捏得发白，许久才道：「这一桩，我记下了。」",
        completionFlag: "quest_wx3_report",
        onReach: {
          money: 180,
        },
      },
    ],
    rewardText: "三十年的结松了半扣——五仙与百花休兵，搅局的人也露了形。",
  },

  // ── 蛊4·赤蜈交易（抉择线）──
  wuxianjiao_4_chiwujiaoyi: {
    id: "wuxianjiao_4_chiwujiaoyi",
    type: "QT_TALK",
    title: "蛊4·赤蜈交易",
    giver: "龙汐月",
    giverId: "resident_longxiyue",
    localOnly: true,
    requiresQuestCompleted: "wuxianjiao_3_shijiejiuhen",
    requiresFactionRep: { 五仙教: 40 },
    description: "暗账查明：今夜赤蜈堂要在毒窟与唐门使者交割一批淬毒机括，土司府从中抽成。龙汐月把处置权交到你手里——截账毁毒，还是顺势纵毒？",
    stages: [
      {
        id: "orders",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "五仙灵坛" },
        playerHint: "去五仙灵坛听龙汐月的密令。",
        description: "龙汐月声音压得极低：「今夜毒窟交割，麻九娘的人不敢拦教主的令——可进了窟子怎么做，是你的手。截，还是纵，想好再动。」",
        completionFlag: "quest_wx4_go",
        onReach: { favorability: { "龙汐月": 5 } },
      },
      {
        id: "deal",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "赤蜈毒窟" },
        playerHint: "夜探赤蜈毒窟，撞上唐门交割。",
        description: "毒窟深处火把通明，唐门使者正把一箱淬毒机括推给赤蜈执事，账册摊在石上。两条路摆在你面前——都回不了头。",
        completionFlag: ["quest_wx4_keep", "quest_wx4_poison"],
        choices: [
          { flag: "quest_wx4_keep", label: "截账毁毒·人赃并获", resolve: "combat", combatNpc: { name: "赤蜈押货执事", levelCap: 4 } },
          { flag: "quest_wx4_poison", label: "纵毒放行·吞下好处", resolve: "none", requiresFlag: ["quest_wx2_mjn"], narration: "你收了赤蜈堂递来的血令与一锭黑银，亲眼看着毒车出了寨门。这笔账，记在谁头上，天知地知。" },
        ],
        onReach: {
          byFlag: {
            quest_wx4_keep: {
              items: [{ name: "赤蜈暗账", fromCatalog: true }, { name: "唐门淬毒机括残件", fromCatalog: true }],
              flags: ["wuxian_dudan_exposed"],
              factionRep: { 五仙教: 20, 唐门: 5, 鱼定土司府: -10 },
              reputation: 8,
              favorability: { "麻九娘": -15 },
            },
            quest_wx4_poison: {
              money: 200,
              items: [{ name: "赤蜈血令", fromCatalog: true }],
              flags: ["wuxian_poison_to_tusi"],
              factionRep: { 五仙教: 20, 百花门: -15, 玉泉寨: -8, 鱼定土司府: 10 },
              reputation: -20,
              favorability: { "麻九娘": 15, "乌婆婆": -10 },
            },
          },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "五仙灵坛" },
        playerHint: "回五仙灵坛交差。",
        description: "灵坛灯火下，龙汐月听完你的交代，久久不语。",
        completionFlag: "quest_wx4_report",
        onReach: {
          money: 240,
          favorability: { "龙汐月": 10 },
        },
      },
    ],
    rewardText: "赤蜈堂的暗账见了天——或是顺着暗河流了出去。雾隐寨的天平，从此歪向一边。",
  },

  // ── 蛊5·银冠定坛（终局）──
} };
