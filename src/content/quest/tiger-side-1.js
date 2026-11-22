// 线四·虎胆三重门 配套支线（总纲 v3 任务16–20）。
// 均为路途/场景触发型支线，requireLocation 或 at 锚定真实内层房间。
// 各留一件可延续到主线后续节点的道具/情报/flag（总纲设计说明要求）。
export default { quest: {

"tigerside_16_fenzang": {
    id: "tigerside_16_fenzang",
    type: "QT_COLLECT",
    title: "白塔地宫的分赃规矩",
    giver: null,
    description: "为兰姐收集「白塔地宫守宫砂」辅料期间，玩家在白塔地宫里与一名同样在寻宝的盗墓贼狭路相逢——机关在前，两人索性临时组队。",
    stages: [
      {
        id: "s1_teamup",
        description: "白塔地宫深处，一道上了年头的机关挡在藏宝室前。阴影里转出个盗墓贼，短刀在指尖转了一圈：「同道？那就搭把手——规矩你懂，见者有份。」两人合力解了三道机关，石室开启，一批旧物与一盒守宫砂就在眼前。",
        playerHint: "白塔地宫里有同路人，组队或独行随你。",
        completionFlag: "quest_tigerside16_s1",
        requireLocation: { district: "白塔", inner: "白塔地宫" },
        onReach: { exp: 2 },
      },
      {
        id: "s2_split",
        description: "分赃的时候到了。盗墓贼斜眼看着守宫砂：「这玩意儿一人一半，还是……」二选一：A.按江湖规矩平分——队友爽快交出守宫砂份额，临别抱拳「下次地宫里再见，算我欠你一顿酒」；B.见财起意黑吃黑——狭小石室里一场搏杀，胜者独吞全部。",
        playerHint: "宝物到手，怎么分由你定。",
        completionFlag: ["quest_tigerside16_s2_fair", "quest_tigerside16_s2_greedy"],
        onReach: {
          exp: 3,
          items: [{ name: "白塔地宫守宫砂", category: "misc", quality: "蓝", tags: ["辅料", "虎胆", "任务"], desc: "百花门主线三样辅料之一，兰姐炼蛊要用。" }],
          byFlag: {
            quest_tigerside16_s2_fair: { reputation: 3, flags: ["tigerside_tomb_friend"] },
            quest_tigerside16_s2_greedy: { reputation: -2, flags: ["tigerside_tomb_enemy"] },
          },
        },
      },
    ],
    rewardText: "守宫砂到手——分赃的选择决定了这名盗墓贼日后会不会成为你的消息来源。",
  },

"tigerside_17_qinshi": {
    id: "tigerside_17_qinshi",
    type: "QT_LEARN_SKILL",
    title: "达摩药堂外的琴师",
    giver: null,
    description: "前往达摩药堂寻虎胆药引期间，喇嘛庙附近一座破庙里传出琴声。弹琴的是个不明来历的高冷琴师，似乎在等一个能听懂琴音的人。",
    stages: [
      {
        id: "s1_rhythm",
        description: "喇嘛庙山门外不远处，残破的偏殿里坐着个抱琴的灰衣人，琴音疏淡如水。见玩家驻足，他头也不抬：「听得懂就进来，听不懂就走。」玩家以剑招合他的琴音节拍——剑随音走，节奏若合上，琴音便添了一分暖意。",
        playerHint: "山门外破庙里有琴声，以剑招合琴音节拍试试。",
        completionFlag: "quest_tigerside17_s1",
        at: "喇嘛庙·山门",
        onReach: { exp: 2 },
      },
      {
        id: "s2_teach",
        description: "曲终，琴师微微颔首，起身随手演示了一招剑气外放的秘技——剑未至而气先行。他重新坐下拨了拨琴弦，随口道：「这曲子，是故人教我的。此地故人不少。」说完便闭目养神，不再言语。",
        playerHint: "琴师有话要说，听他教完这招。",
        completionFlag: "quest_tigerside17_s2",
        isCgMoment: true,
        onReach: { exp: 3, pot: 3, flags: ["tigerside_lama_oldfriend_hint"] },
      },
    ],
    rewardText: "剑气外放秘技到手，外加一句意味深长的「此地故人不少」——喇嘛庙一系陈年往事的又一处侧写。",
  },

"tigerside_18_heidian": {
    id: "tigerside_18_heidian",
    type: "QT_TALK",
    title: "天都镇黑店的蒙汗药",
    giver: null,
    description: "为兰姐奔走三样辅料期间，玩家投宿天都镇一间挂羊头卖狗肉的客栈。店家见玩家孤身又带着值钱之物，起了歹心。",
    stages: [
      {
        id: "s1_drug",
        description: "天都行脚楼角落一间不起眼的偏客栈，店家满脸堆笑端来酒菜。玩家刚要动筷，鼻尖闻到一丝若有若无的甜腥——酒里下了蒙汗药。玩家不动声色，假意饮尽伏案睡去。",
        playerHint: "客栈的酒菜有点不对劲——察觉还是不察觉，看你警觉。",
        completionFlag: "quest_tigerside18_s1",
        requireLocation: { district: "天都镇", inner: "天都行脚楼" },
        onReach: { exp: 2 },
      },
      {
        id: "s2_counter",
        description: "夜半，店家摸进房来搜包袱，玩家暴起反制，三两下把人按在桌上。店家吓得魂不附体全盘托出。搜他的暗柜：多年劫掠的财物之外，还有几件失踪商队的遗物——天都镇的地下秩序，远不止百花门一家。",
        playerHint: "店家夜里要来搜身——将计就计反制他。",
        completionFlag: "quest_tigerside18_s2",
        onReach: { exp: 3, money: 40, flags: ["tigerside_underworld_hint"], items: [{ name: "失踪商队遗物", category: "misc", quality: "蓝", tags: ["物证", "伏笔", "任务"], desc: "黑店老板暗柜里的旧物，刻着某失踪商队的徽记——天都镇的水，比看上去深得多。" }] },
      },
    ],
    rewardText: "黑店的财物和商队遗物到手——这片市镇水深，日后邪教据点的事，这就是引子。",
  },

"tigerside_19_yirong": {
    id: "tigerside_19_yirong",
    type: "QT_TALK",
    title: "乔装混入百花楼",
    giver: "兰姐",
    description: "三方辅料收集接近尾声、兰姐即将当众炼蛊之前，她要求玩家先以易容身份混入百花楼内部走一趟——既是验证诚意，也让玩家自己摸摸楼里的底。",
    requiresQuestCompleted: "tigerside_16_fenzang",
    stages: [
      {
        id: "s1_infiltrate",
        description: "兰姐递来一套楼里杂役的衣裳和一张人皮面具：「换上去走一圈，听听我的人私下怎么说你。别露馅。」玩家混入百花楼，端茶递水间听门人们闲谈——有人怀疑玩家来历，有人提起兰姐当年从昆明逃出来的旧事。",
        playerHint: "换上兰姐给的行头混进百花楼，套取闲谈情报。",
        completionFlag: "quest_tigerside19_s1",
        requireLocation: { district: "天都镇", inner: "百花楼" },
        onReach: { exp: 2 },
      },
      {
        id: "s2_pieces",
        description: "零零碎碎的闲谈拼凑出兰姐身世的更多细节：她的师父是怎么死的，她离乡的具体缘由，半枚青银令背后的恩怨。玩家卸了易容回报兰姐，她听完沉默片刻：「你肯费这份心思，我记下了。」",
        playerHint: "把听到的碎片拼起来，回去见兰姐。",
        completionFlag: "quest_tigerside19_s2",
        onReach: { exp: 3, favorability: { "兰姐": 3 }, flags: ["tigerside_lanjie_past_detail"] },
      },
    ],
    rewardText: "兰姐身世的拼图补上一块——不用当面问她，她的来历你已摸到了边角。",
  },

"tigerside_20_fengkou": {
    id: "tigerside_20_fengkou",
    type: "QT_DELIVERY",
    title: "帮派师兄的封口费",
    giver: null,
    description: "虎胆流转进入尾声，天都镇一名自称「帮派师兄」的委托人托玩家送一封密信给「师父清理门户」——实则信中是分赃不均的旧账，他半路安排了杀手灭口。",
    stages: [
      {
        id: "s1_escort",
        description: "镇口，一个精瘦的汉子拦住玩家，递来一封火漆密信和定金：「送锦官城，亲手交给我师父——就说是清理门户用的，别多看。」玩家接了信上路，行至半路，林子里窜出两个持刀杀手，刀刀要命——灭口来的。",
        playerHint: "有人托你送信去锦官城，半路不太平。",
        completionFlag: "quest_tigerside20_s1",
        at: "天都镇·镇口",
        onReach: { exp: 2 },
      },
      {
        id: "s2_choice",
        description: "反杀刺客后拆开密信：哪有什么清理门户，通篇是天都镇地下势力分赃不均的旧账——师兄是要借师父的手除掉知情人。二选一：A.把信原样送给师父，得清理门户的信任与酬劳；B.回头找师兄摊牌，拿信换一笔高额封口费。",
        playerHint: "密信内容已见，交师父还是卖回给师兄，你选。",
        completionFlag: ["quest_tigerside20_s2_honor", "quest_tigerside20_s2_hush"],
        onReach: {
          exp: 3,
          byFlag: {
            quest_tigerside20_s2_honor: { reputation: 4, money: 30, flags: ["tigerside_underworld_clean"] },
            quest_tigerside20_s2_hush: { reputation: -3, money: 120, flags: ["tigerside_underworld_bought"] },
          },
        },
      },
    ],
    rewardText: "无论选了哪条路，天都镇地下势力都记住了你——这份印记，往后的路用得上。",
  },

} };
