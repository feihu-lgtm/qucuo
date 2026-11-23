export default { quest: {
  // ── 花1·花酒风波（入门主线，发布人：小蝉 → 兰姐） ──
  baihuamen_1_huajiufengbo: {
    id: "baihuamen_1_huajiufengbo",
    type: "QT_TALK",
    title: "花1·花酒风波",
    giver: "小蝉",
    giverId: "resident_xiaochan",
    localOnly: true,
    requiresFactionRep: { 百花门: 0 },
    description: "天都镇东街的百花楼明面卖玫瑰酿，暗地里是苗裔流亡者的落脚地。你刚踏进前厅，就撞见镇口恶汉赫连铸带着几个口音怪异的南边客商借醉砸场。",
    stages: [
      {
        id: "meet",
        giver: null,
        requireLocation: { district: "天都镇", inner: "百花楼" },
        playerHint: "进天都镇东街的百花楼，看看谁在小蝉的场子里闹事。",
        description: "乌木方桌翻了两张，玫瑰酿淌了一地。赫连铸拎着酒坛口出秽语，他身后一个南客趁乱往坛里弹入一撮无色药粉。小蝉攥着托盘退到台角，圆脸煞白。",
        completionFlag: ["quest_bh1_subdue", "quest_bh1_disarm"],
        choices: [
          { flag: "quest_bh1_subdue", label: "直接打断赫连铸腿脚", resolve: "combat", combatNpc: { name: "赫连铸与南客", levelCap: 4 } },
          { flag: "quest_bh1_disarm", label: "只缴械驱离·留活口细查", resolve: "none", narration: "你不拔刀，只借势卸了赫连铸的腕子把人轰出门，反手扣住那个弹药粉的南客——他咬破齿间毒囊，当场毙命。花婆赶来验尸，认出是滇南五仙教手法的「三步醉」。" },
        ],
        onReach: {
          byFlag: {
            quest_bh1_subdue: { favorability: { "阿芷": 5 }, reputation: -2 },
            quest_bh1_disarm: { favorability: { "兰姐": 5, "苏折柳": 5 }, reputation: 3 },
          },
        },
      },
      {
        id: "ask",
        giver: null,
        requireLocation: { district: "天都镇", inner: "天都香行" },
        playerHint: "兰姐让你去西市天都香行门外，问隔街观望的老何一句「东街的酒可曾泼脏了西市的鞋」。",
        description: "老何蹲在香行门槛上抽水烟，听完眯眼一笑：「西市只管卖香，不养滇南毒虫。」他磕了磕烟锅，顺口提点——那伙南客昨夜是从大草甸官道翻进来的，马蹄印还没干。",
        completionFlag: "quest_bh1_asked",
        onReach: { favorability: { "老何": 5 } },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "天都镇", inner: "百花楼" },
        playerHint: "回百花楼向兰姐复命。",
        description: "兰姐自二楼踱下来，暗靛苗襟上连酒星都没沾。听完回禀她冷笑一声：「死的是麻九娘的跑腿，活的是我的楼。这人情我记下了——往后这楼里你的酒，我请。」",
        completionFlag: "quest_bh1_report",
        onReach: {
          money: 80,
          factionRep: { 百花门: 15 },
          items: [
            { name: "玫瑰花酿", fromCatalog: true },
            { name: "玫瑰花酿", fromCatalog: true },
            { name: "祛瘴花茶", fromCatalog: true },
            { name: "祛瘴花茶", fromCatalog: true },
          ],
        },
      },
    ],
  },
  // ── 花2·蛊影暗香（主线，发布人：阿芷） ──
  baihuamen_2_guyinganxiang: {
    id: "baihuamen_2_guyinganxiang",
    type: "QT_TALK",
    title: "花2·蛊影暗香",
    giver: "阿芷",
    giverId: "resident_azhi",
    localOnly: true,
    requiresQuestCompleted: "baihuamen_1_huajiufengbo",
    requiresFactionRep: { 百花门: 15 },
    description: "阿芷查到那伙南客的同伙藏身天都镇东郊荒林的废弃茶棚，怀疑是五仙教大长老麻九娘派来的先头毒使，邀你同去摸底。",
    stages: [
      {
        id: "scout",
        giver: null,
        requireLocation: { district: "天都镇", inner: "镇口" },
        playerHint: "跟阿芷去镇口外的荒林茶棚摸底——看看南客的同伙在和谁接头。",
        description: "荒林深处，两名鱼定土司府的便衣差役正把陆福生手签的通行条和五十两银子递给一个苗疆装束的毒使，换回两瓶「软筋瘴」。阿芷腕间麻布一紧，压低声音：「看见没有——土司府和麻九娘，已经坐到一张桌上去了。」",
        completionFlag: ["quest_bh2_disguise", "quest_bh2_raid"],
        choices: [
          { flag: "quest_bh2_disguise", label: "回听风雅阁易容·智取密信", resolve: "none", narration: "苏折柳一盏茶功夫把你画成土司府跑腿小吏。你大摇大摆上前递了句切口，毒使不疑有他，密信残片与瘴药到手，零伤亡撤离。" },
          { flag: "quest_bh2_raid", label: "夜袭毒棚·强攻夺信", resolve: "combat", combatNpc: { name: "苗疆毒使与便衣差役", levelCap: 5 } },
        ],
        onReach: {
          byFlag: {
            quest_bh2_disguise: { favorability: { "苏折柳": 10 } },
            quest_bh2_raid: { favorability: { "阿芷": 10 }, factionRep: { 鱼定土司府: -8 } },
          },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "天都镇", inner: "百花楼" },
        playerHint: "把麻九娘的密信残片与雾隐寨山图交回百花楼。",
        description: "兰姐对着那张写着「雾隐寨北坛」的山图沉默了半晌，指节捏得发白。苏折柳点破陆福生借刀杀人的算盘；阿芷领你走到暖棚水井旁，掀开那块活板门——「地窖养蛊房，从今天起对你开着。」",
        completionFlag: "quest_bh2_report",
        onReach: {
          money: 150,
          flags: ["baihua_cellar_unlocked"],
          factionRep: { 百花门: 20 },
          items: [
            { name: "雾隐寨秘道残图", fromCatalog: true },
            { name: "百草解瘴散", fromCatalog: true },
            { name: "百草解瘴散", fromCatalog: true },
            { name: "百草解瘴散", fromCatalog: true },
          ],
        },
      },
    ],
  },
  // ── 花支1·退墨旧纸（支线，发布人：苏折柳） ──
  baihuamen_side_1_tuimozhang: {
    id: "baihuamen_side_1_tuimozhang",
    type: "QT_TALK",
    title: "花支1·退墨旧纸",
    giver: "苏折柳",
    giverId: "resident_suzheliu",
    localOnly: true,
    requiresFactionRep: { 百花门: 15 },
    description: "苏折柳整理暗账时发现：天都镇黑市近月总有人高价收陈年藏纸与蜀南明矾，手法像极了做旧假契——而这路数，他只在一个地方见过。",
    stages: [
      {
        id: "ask",
        giver: null,
        requireLocation: { district: "锦官城", inner: "唐门暗巷" },
        playerHint: "去锦官城南城暗巷的唐门暗器铺，用行话探探唐三少的口风。",
        description: "你递了句行话试探，唐三少听完脸色微变，拨着算珠压低声音：这批「退墨旧矾水」不是店中正货，是外务管事唐伯渊私下调出去卖给曲措乡的——「这事儿你别到处嚷。」",
        completionFlag: "quest_bhs1_asked",
        onReach: { favorability: { "唐三少": 5 } },
      },
      {
        id: "seize",
        giver: null,
        requireLocation: { district: "锦官城", inner: "城门" },
        playerHint: "在锦官城郊截住陆福生派来接货的马夫，夺下那瓶退墨矾水。",
        description: "城门外的骡马队里，你盯上了那个包裹得最严实的褡裢。",
        completionFlag: ["quest_bhs1_sneak", "quest_bhs1_fight"],
        choices: [
          { flag: "quest_bhs1_sneak", label: "顺手牵羊·不声不响取走", resolve: "none", narration: "你混入脚夫堆里打了个转，褡裢里的瓷瓶与半张试笔草纸已进了你的袖子，马夫还在跟守城卒插科打诨。" },
          { flag: "quest_bhs1_fight", label: "拦路硬夺·缴货走人", resolve: "combat", combatNpc: { name: "陆府马夫与护卫", levelCap: 4 } },
        ],
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "天都镇", inner: "听风雅阁" },
        playerHint: "把矾水与草纸带回听风雅阁给苏折柳化验；顺便决定要不要把唐伯渊私售的事捅给唐三少。",
        description: "苏折柳以醋淬、火焙、墨试三法验罢，把那页化验录推给你：「三十年的老宣纸，哪来的去年新矾味？陆福生这笔账，我记下了。」",
        completionFlag: ["quest_bhs1_report", "quest_bhs1_expose"],
        choices: [
          { flag: "quest_bhs1_report", label: "秘而不宣·铁证留在手里", resolve: "none", narration: "你收好化验录——这纸东西留着，比说出去值钱。" },
          { flag: "quest_bhs1_expose", label: "顺道揭发·告知唐三少真相", resolve: "none", narration: "你折回唐门暗巷把唐伯渊私售违禁药水的来龙去脉摊开讲了。唐三少脸色铁青，拱手一礼：「唐门谢你这一声。」" },
        ],
        onReach: {
          money: 120,
          flags: ["bh_forge_evidence"],
          factionRep: { 百花门: 15 },
          items: [
            { name: "退墨矾水化验录", fromCatalog: true },
            { name: "人皮易容薄胎", fromCatalog: true },
          ],
          byFlag: {
            quest_bhs1_expose: { factionRep: { 唐门: 10, 鱼定村: 5 }, favorability: { "唐三少": 10 } },
          },
        },
      },
    ],
  },

  // ── 花3·蚀心余毒（主线，发布人：花婆；合稿 四.3）──
  baihuamen_3_shixinyudu: {
    id: "baihuamen_3_shixinyudu",
    type: "QT_TALK",
    localOnly: true,
    title: "花3·蚀心余毒",
    giver: "花婆",
    requiresQuestCompleted: "baihuamen_2_guyinganxiang",
    requiresFactionRep: { 百花门: 30 },
    description: "麻九娘的暗哨夜袭百花楼暖棚，兰姐为护小蝉强运内力逼退来敌，反引动蛰伏十年的「蚀心蛊」旧毒，呕血昏迷。",
    stages: [
      {
        id: "diag",
        giver: null,
        requireLocation: { district: "天都镇", inner: "花医静室" },
        playerHint: "去花医静室看看兰姐——花婆在等她醒。",
        description: "花婆按着兰姐腕脉，眉头拧成疙瘩：「寻常药石压不住母蛊噬心。上策是熊山虎王之胆，一拔了之；虎胆若已另有所属，只能取雪山雪参心露配喇嘛庙佛手清心丸，替她续三年命。」",
        completionFlag: "quest_bh3_diag",
      },
      {
        id: "cure",
        giver: null,
        requireLocation: { district: "天都镇", inner: "花医静室" },
        playerHint: "为兰姐求药：虎胆已到手就当场拔毒；否则走一趟雪山与喇嘛庙，凑齐续命的方子。",
        description: "药引只有两条路：虎胆拔毒断根，或雪参佛丸续命三年。你想起花婆顺手递过的一张纸——「你那位雪山朋友的寒疾，倒像是掺了外来的异毒。」",
        completionFlag: ["quest_bh3_tiger", "quest_bh3_snowmed"],
        choices: [
          { flag: "quest_bh3_tiger", label: "虎胆拔毒·一拔了之", resolve: "none", requiresFlag: ["quest_lanjie_s6"], narration: "你将虎胆递与花婆。三日汤药逼出一团黑雾，兰姐睁眼第一句话是问你烫着没有。" },
          { flag: "quest_bh3_snowmed", label: "雪参清心·替她续三年", resolve: "none", narration: "你上雪山取了雪参心露，又上喇嘛庙达摩药堂求得佛手清心丸。药灌下去，兰姐脸上总算回了点血色。花婆把雪山寒疾掺着外毒的推断细细说与你听。" },
        ],
        onReach: {
          byFlag: {
            quest_bh3_tiger: { favorability: { "兰姐": 25 }, flags: ["bh3_rooted", "kunming_attic_ready"] },
            quest_bh3_snowmed: { favorability: { "兰姐": 12 }, factionRep: { 喇嘛庙: 5 }, flags: ["bh3_delayed", "xueshan_poison_clue"] },
          },
        },
      },
      {
        id: "confess",
        giver: null,
        requireLocation: { district: "天都镇", inner: "花医静室" },
        playerHint: "兰姐醒了，去花医静室听她把这十年的账说清。",
        description: "兰姐靠着引枕，把《五仙毒典》残页的来历、十年前昆明血案、麻九娘如何构陷她逐出苗疆，一字一句说完，末了摘下贴身的素梅牌塞进你手里：「往后这楼里，没有你不能去的地方。」",
        completionFlag: "quest_bh3_confess",
        onReach: {
          money: 180,
          factionRep: { 百花门: 20 },
          items: [{ name: "素梅牌", fromCatalog: true }],
        },
      },
    ],
  },
  // ── 花4·雾隐旧案（核心跨势力主线，发布人：兰姐；合稿 四.4）──
} };
