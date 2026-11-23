export default { quest: {  wuxianjiao_5_yingguandingtan: {
    id: "wuxianjiao_5_yingguandingtan",
    type: "QT_TALK",
    title: "蛊5·银冠定坛",
    giver: "龙汐月",
    giverId: "resident_longxiyue",
    localOnly: true,
    requiresQuestCompleted: "wuxianjiao_4_chiwujiaoyi",
    requiresFactionRep: { 五仙教: 80 },
    description: "毒典案尘埃落定，五仙教要开十年一度的定坛大典——银冠落谁家，圣盟立不立，今夜见分晓。",
    stages: [
      {
        id: "rite",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "五仙祖灵殿" },
        playerHint: "进五仙祖灵殿，见证定坛大典。",
        description: "祖灵殿百蛊齐鸣，五根黑木柱下的银铃无风自响。龙汐月捧出圣盟银符，麻九娘的赤蜈血令也在暗处发烫——你要捧哪一边？",
        completionFlag: ["quest_wx5_crown", "quest_wx5_crown_full", "quest_wx5_centipede"],
        choices: [
          { flag: "quest_wx5_crown", label: "当众甩出暗账·拥银冠定圣盟", resolve: "combat", requiresFlag: ["quest_wx4_keep"], combatNpc: { name: "麻九娘", levelCap: 4 } },
          { flag: "quest_wx5_crown_full", label: "当众甩出暗账·百蛊倾巢共讨土司", resolve: "combat", requiresFlag: ["quest_wx4_keep"], requiresFactionRep: { 五仙教: 100 }, combatNpc: { name: "麻九娘", levelCap: 4 } },
          { flag: "quest_wx5_centipede", label: "随麻九娘早祭发难·挺赤蜈夺毒冠", resolve: "combat", requiresFlag: ["quest_wx4_poison"], combatNpc: { name: "龙汐月", levelCap: 4 } },
        ],
        onReach: {
          byFlag: {
            quest_wx5_crown: {
              flags: ["wuxian_sanctum", "wuxian_holy_oath", "endgame_ally_wuxian"],
              items: [{ name: "五仙圣盟银符", fromCatalog: true }, { name: "金蚕护心蛊", fromCatalog: true }],
              factionRep: { 五仙教: 35, 百花门: 25, 鱼定土司府: -15, 天龙教: -10 },
              reputation: 15,
              favorability: { "龙汐月": 25 },
            },
            quest_wx5_crown_full: {
              flags: ["wuxian_sanctum", "wuxian_holy_oath", "endgame_ally_wuxian", "endgame_ally_wuxian_full"],
              items: [{ name: "五仙圣盟银符", fromCatalog: true }, { name: "金蚕护心蛊", fromCatalog: true }],
              factionRep: { 五仙教: 35, 百花门: 25, 鱼定土司府: -15, 天龙教: -10 },
              reputation: 15,
              favorability: { "龙汐月": 25 },
            },
            quest_wx5_centipede: {
              flags: ["wuxian_sanctum", "wuxian_chiwu_crowned", "endgame_wuxian_poison_tusi"],
              items: [{ name: "赤蜈毒王冠", fromCatalog: true }],
              factionRep: { 五仙教: 35, 百花门: -40, 峨眉派: -20, 青城派: -10 },
              reputation: -30,
              favorability: { "麻九娘": 20 },
            },
          },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "圣母沉香阁" },
        playerHint: "入圣母沉香阁，听定坛后的最后一句话。",
        description: "沉香阁里檀香沉郁。定坛已毕，无论你捧的是银冠还是蜈冠，这扇只对教主心腹开的门，为你开了。",
        completionFlag: "quest_wx5_end",
        onReach: {
          money: 500,
        },
      },
    ],
    rewardText: "定坛之夜翻过，雾隐寨的后三十年，从这一夜开始算。",
  },

  // ── 蛊支1·蜀锦香囊（跨势力：峨眉缓和线）──
  wuxianjiao_side_1_shujinxiangnang: {
    id: "wuxianjiao_side_1_shujinxiangnang",
    type: "QT_TALK",
    title: "蛊支1·蜀锦香囊",
    giver: "龙汐月",
    giverId: "resident_longxiyue",
    localOnly: true,
    requiresQuestCompleted: "wuxianjiao_1_zilanwenjing",
    requiresFavorability: { "龙汐月": 15 },
    description: "龙汐月把一匹旧蜀锦的花样指给你看：「峨眉剑庐的照微师姐从前最馋这口烟青色。替我跑一趟锦官城——顺便让她们知道，五仙教不记那天的围。」",
    stages: [
      {
        id: "brocade",
        giver: null,
        requireLocation: { district: "锦官城", inner: "云锦成衣铺" },
        playerHint: "去锦官城云锦成衣铺，买下一匹烟雨青蜀锦（九十两）。",
        description: "云锦成衣铺的烟青蜀锦只剩最后一匹，掌柜把算盘打得噼啪响：「九十两，一文不少。」",
        completionFlag: "quest_wxs1_buy",
        choices: [
          { flag: "quest_wxs1_buy", label: "掏九十两买下蜀锦", resolve: "none", requiresMoney: 90, narration: "锦缎入手又滑又沉，雨里看是灰青，灯下看是黛蓝。" },
        ],
        onReach: {
          items: [{ name: "烟雨青蜀锦", fromCatalog: true }],
        },
      },
      {
        id: "emei",
        giver: null,
        requireLocation: { district: "锦官城", inner: "峨眉剑庐" },
        playerHint: "携蜀锦上峨眉剑庐，面呈照微。",
        description: "照微展开烟雨青蜀锦，愣了半晌，转身从架上取下一只绣着银蛇的小香囊：「替我谢你们教主……剑庐与雾隐寨，井水不犯河水，这话我带到。」",
        completionFlag: "quest_wxs1_gift",
        onReach: {
          flags: ["emei_wuxian_truce"],
          factionRep: { 峨眉派: 5 },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "五仙灵坛" },
        playerHint: "回五仙灵坛交差。",
        description: "龙汐月接过银蛇香囊别在襟口，难得真心笑了一回：「剑庐松口，比十车锦缎值钱。」",
        completionFlag: "quest_wxs1_end",
        onReach: {
          money: 120,
          items: [{ name: "烟雨银蛇香囊", fromCatalog: true }],
          factionRep: { 五仙教: 10 },
          favorability: { "龙汐月": 15 },
        },
      },
    ],
    rewardText: "一匹蜀锦换一句休兵——峨眉与雾隐寨之间，多了条不必动刀的路。",
  },

  // ── 蛊支2·雪山寒露（跨势力：喇嘛庙换药）──
  wuxianjiao_side_2_xueshanhanlu: {
    id: "wuxianjiao_side_2_xueshanhanlu",
    type: "QT_TALK",
    title: "蛊支2·雪山寒露",
    giver: "乌婆婆",
    giverId: "resident_wupopo",
    localOnly: true,
    requiresFavorability: { "乌婆婆": 20 },
    description: "乌婆婆把一张旧方子推给你：「教主幼时中过寒毒，年年入冬要犯一回。喇嘛庙的雪莲干蕊是药引——庙里的老活佛认得我这块玉，你替老婆子跑一趟。」",
    stages: [
      {
        id: "lama",
        giver: null,
        requireLocation: { district: "喇嘛庙", inner: "达摩药堂" },
        playerHint: "去喇嘛庙达摩药堂，以百草老玉佩换雪莲干蕊。",
        description: "达摩药堂监院见了乌婆婆的玉佩，双手合十念了声佛号：「故人之物……罢了。」他从药柜深处取出一只蜡封小包，包了双份雪莲干蕊。",
        completionFlag: "quest_wxs2_herb",
        onReach: {
          items: [{ name: "雪莲干蕊", fromCatalog: true }],
          factionRep: { 喇嘛庙: 8 },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "百蛊药房" },
        playerHint: "回百蛊药房，把雪莲干蕊交给乌婆婆。",
        description: "乌婆婆当场起灶煎药，火光映着她松弛下来的眉：「这个冬天，教主能睡个安稳觉了。」她顺手抄起一张方子拍进你手里——赤焰压寒方，你留着用。",
        completionFlag: "quest_wxs2_end",
        onReach: {
          money: 60,
          items: [{ name: "赤焰压寒方", fromCatalog: true }, { name: "百草续命膏", fromCatalog: true }, { name: "百草续命膏", fromCatalog: true }],
          factionRep: { 五仙教: 10 },
          favorability: { "乌婆婆": 20, "龙汐月": 10 },
        },
      },
    ],
    rewardText: "一锅赤焰压寒膏下肚，雾隐寨的冬天少了三分冷。",
  },

  // ── 蛊支3·蚀谷济湖（施药/卖药分支）──
  wuxianjiao_side_3_shigujianghu: {
    id: "wuxianjiao_side_3_shigujianghu",
    type: "QT_TALK",
    title: "蛊支3·蚀谷济湖",
    giver: "阿萝",
    giverId: "resident_aluo",
    localOnly: true,
    requiresQuestCompleted: "wuxianjiao_1_zilanwenjing",
    requiresFactionRep: { 五仙教: 10 },
    description: "玉泉寨方向瘴气翻涌，伤了不少人畜。阿萝把药方拍在演武坪石桌上：「三味药引，湿廊里都有——采来，玉泉寨那边就有救了。」",
    stages: [
      {
        id: "gather",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "百蛊湿廊" },
        playerHint: "去百蛊湿廊采三味药引：碧背蟾涎、紫叶七星草、湿崖白蜈蜕。",
        description: "湿廊水气扑面，你按阿萝画的样图挨个寻：碧背蟾趴在苔石下，七星草贴着背阴崖缝，白蜈蜕在湿风最大的转角打卷。",
        completionFlag: "quest_wxs3_herbs",
        onReach: {
          items: [
            { name: "碧背蟾涎", fromCatalog: true },
            { name: "紫叶七星草", fromCatalog: true },
            { name: "湿崖白蜈蜕", fromCatalog: true },
          ],
        },
      },
      {
        id: "yuquan",
        giver: null,
        requireLocation: { district: "玉泉寨", inner: "寨门" },
        playerHint: "携药到玉泉寨寨门——施药救人，还是卖药挣钱？",
        description: "寨门口躺了一排中了瘴毒的牧人，家眷哭成一团。药篓在怀里沉甸甸的——分文不取施下去，还是开价卖给急得团团转的寨老？",
        completionFlag: ["quest_wxs3_give", "quest_wxs3_sell"],
        choices: [
          { flag: "quest_wxs3_give", label: "分文不取·就地施药", resolve: "none", narration: "你把三味药引煎成大锅药汤挨家灌下去。寨老红着眼要磕头，被你拦住了。" },
          { flag: "quest_wxs3_sell", label: "开价卖药·各取所需", resolve: "none", narration: "寨老咬牙凑了一百五十两。药是救了人，寨里看你的眼神却冷了半截。" },
        ],
        onReach: {
          byFlag: {
            quest_wxs3_give: {
              money: 30,
              items: [{ name: "化瘴清露", fromCatalog: true }, { name: "化瘴清露", fromCatalog: true }, { name: "化瘴清露", fromCatalog: true }],
              factionRep: { 五仙教: 12, 玉泉寨: 8, 鱼定村: 5 },
              favorability: { "阿萝": 15 },
              reputation: 5,
            },
            quest_wxs3_sell: {
              money: 150,
              factionRep: { 五仙教: 5, 玉泉寨: -5 },
              favorability: { "阿萝": -5 },
              reputation: -5,
            },
          },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "听虫演武坪" },
        playerHint: "回演武坪向阿萝交差。",
        description: "阿萝听完玉泉寨的事，把药篓背上肩：「不管是施是卖，药到了人身上就算数。」",
        completionFlag: "quest_wxs3_end",
        onReach: {
          factionRep: { 五仙教: 5 },
        },
      },
    ],
    rewardText: "瘴毒压下去了——五仙教的名声，在玉泉寨那边起了变化。",
  },
} };
