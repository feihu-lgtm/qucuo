// 百花门（天都镇·百花楼）任务线：照合稿《百花门》四、任务线。
// 声誉门槛用顶层 requiresFactionRep / requiresQuestCompleted（#237 写法），奖励按合稿原值。
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
  baihuamen_4_wuxianjiuan: {
    id: "baihuamen_4_wuxianjiuan",
    type: "QT_TALK",
    localOnly: true,
    title: "花4·雾隐旧案",
    giver: "兰姐",
    requiresQuestCompleted: "baihuamen_3_shixinyudu",
    requiresFactionRep: { 百花门: 50 },
    requiresFlags: ["wuxian_invited"],
    description: "兰姐把随身半枚教主青银令交给你：五仙教新教主龙汐月已亲抵雾隐寨北坛。她想知道，这位师妹是来清理门户，还是来查十年前的冤案。",
    stages: [
      {
        id: "token",
        giver: null,
        requireLocation: { district: "天都镇", inner: "百花暖棚" },
        playerHint: "去百花暖棚听兰姐交代雾隐寨一行。",
        description: "「青银令是我教主信物的半枚，另一半在她手里。」兰姐替你拢了拢衣襟，「见到她，先把令亮出来，再看她眼睛——要是她先问起昆明，那就是自己人。」",
        completionFlag: "quest_bh4_token",
        onReach: { items: [{ name: "半枚教主青银令", fromCatalog: true }] },
      },
      {
        id: "meet",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "五仙灵坛" },
        playerHint: "避开麻九娘的毒哨，去五仙灵坛面见龙汐月。",
        description: "你亮出半枚青银令，龙汐月自袖中取出另一半，两令相击声如碎冰。「师姐还活着，麻九娘骗了我十年。」她压低声音：老教主临终血书疑麻九娘勾结外敌，账本就藏在她私房。",
        completionFlag: "quest_bh4_meet",
      },
      {
        id: "ledger",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "百蛊湿廊" },
        playerHint: "潜入麻九娘私房，截下她与唐门、土司府的三方毒账。",
        description: "湿廊尽头那间上了蛇形锁的暗室里，一册赤皮账簿记着麻九娘与唐伯渊、陆福生的每一笔毒蛊买卖。门外已有脚步声——毒哨察觉了。",
        completionFlag: ["quest_bh4_sneak", "quest_bh4_fight"],
        choices: [
          { flag: "quest_bh4_sneak", label: "潜行取证·不惊蛇走账", resolve: "none", narration: "你贴着廊柱阴影翻身而出，账簿在怀里还带着蛇涎的凉。毒哨追丢了人，只在崖风里骂了两句。" },
          { flag: "quest_bh4_fight", label: "硬闯夺账·打倒毒哨", resolve: "combat", combatNpc: { name: "麻九娘心腹毒哨", levelCap: 5 } },
        ],
        onReach: { items: [{ name: "麻九娘三方毒账", fromCatalog: true }] },
      },
      {
        id: "breakout",
        giver: null,
        requireLocation: { district: "雾隐寨", inner: "紫岚藤桥" },
        playerHint: "麻九娘驱使毒尸叛徒围了藤桥——选一条路杀出去。",
        description: "藤桥头火把连成一条赤蜈。龙汐月握剑立在你身侧；阿芷的暗信也在此时送到——「别信苗疆的人，烧了她的通缉名册就回来。」",
        completionFlag: ["quest_bh4_reconcile", "quest_bh4_solo", "quest_bh4_betray"],
        choices: [
          { flag: "quest_bh4_reconcile", label: "当众揭穿·助龙汐月平乱", resolve: "combat", combatNpc: { name: "麻九娘", levelCap: 5 } },
          { flag: "quest_bh4_solo", label: "断尾独行·烧册撤出", resolve: "combat", combatNpc: { name: "五仙教追杀头目", levelCap: 4 } },
          { flag: "quest_bh4_betray", label: "卖主求荣·投奔麻九娘", resolve: "none", narration: "你当着满寨人的面，把兰姐藏身昆明阁与《五仙毒典》残页的下落一字一句卖给了麻九娘。她抚掌大笑，赏银六百两——百花楼的名册上，从此没有你这号人。" },
        ],
        onReach: {
          byFlag: {
            quest_bh4_reconcile: {
              money: 300,
              factionRep: { 百花门: 30, 五仙教: 25 },
              flags: ["bh4_reconciled"],
              favorability: { "龙汐月": 15, "兰姐": 15 },
            },
            quest_bh4_solo: {
              money: 300,
              factionRep: { 百花门: 25, 五仙教: -15 },
              favorability: { "阿芷": 20 },
              flags: ["bh4_solo"],
            },
            quest_bh4_betray: {
              money: 600,
              quietFactionRep: { 百花门: -70, 五仙教: 35 },
              // 合稿 7.4 花谱除名：收回素梅牌/银梅令；记作叛出百花门，百花高阶武学不得再学、再突破。
              consumeItems: ["素梅牌", "银梅令"],
              flags: ["bh4_betrayed", "baihua_huapu_chuming", "叛出:百花门"],
            },
          },
        },
      },
    ],
  },
  // ── 花5·花落土司（终局拉拢主线，发布人：兰姐；合稿 四.5）──
  baihuamen_5_hualuotusi: {
    id: "baihuamen_5_hualuotusi",
    type: "QT_TALK",
    localOnly: true,
    title: "花5·花落土司",
    giver: "兰姐",
    requiresQuestCompleted: "baihuamen_4_wuxianjiuan",
    requiresFactionRep: { 百花门: 80 },
    requiresFavorability: { 兰姐: 60 },
    blockedByFlags: ["bh4_betrayed"],
    description: "鱼定土司府管家陆福生遣使夜访百花楼，抬来千两现银与一张朱印「百花商号永久合法文契」——只要百花楼在终局战袖手，或替土司府配一副迷烟。",
    stages: [
      {
        id: "offer",
        giver: "兰姐",
        requireLocation: { district: "天都镇", inner: "百花楼" },
        playerHint: "去百花楼，听兰姐怎么接土司府这单「大买卖」。",
        description: "来使走后楼里吵翻了天：阿芷攥着那张文契不撒手——「全楼二十几口人，就这一条安稳活路！」苏折柳和小蝉冷笑：连地契都敢做旧的人家，发的誓一文不值。兰姐把文契拍在你面前：「你替大伙儿拿个主意。」",
        completionFlag: "quest_bh5_offer",
      },
      {
        id: "verdict",
        giver: null,
        requireLocation: { district: "天都镇", inner: "百花楼" },
        playerHint: "说服阿芷与全楼站队：拿出铁证或请出和解的后盾；或者劝兰姐退银守中。",
        description: "全楼的眼睛都落在你身上。阿芷的手还按在文契上，指节泛白。",
        completionFlag: ["quest_bh5_burn", "quest_bh5_neutral"],
        choices: [
          { flag: "quest_bh5_burn", label: "焚契结盟·说服阿芷入局", resolve: "none", requiresFlagAny: ["bh_forge_evidence", "bh4_reconciled"], narration: "你把退墨矾水化验录摊在阿芷眼前（或搬出已与百花门和解的龙汐月作保）：连地契都做得出假的人，给你的「永久文契」值几个钱？兰姐夺过文契就火折子点燃——「今夜起，百花楼入局。」" },
          { flag: "quest_bh5_neutral", label: "退银守中·劝兰姐闭楼", resolve: "none", narration: "你说百花楼经不起再逃一次。兰姐沉默良久，命人把千两白银与文契原路退回，只捎一句话：「我们不帮你害人。」" },
        ],
        onReach: {
          byFlag: {
            quest_bh5_burn: {
              money: 200,
              factionRep: { 百花门: 35, 鱼定土司府: -25 },
              flags: ["bh5_allied", "finale_baihua_joined"],
              items: [
                { name: "百花奇兵令", fromCatalog: true },
                { name: "百花净毒露", fromCatalog: true },
                { name: "百花净毒露", fromCatalog: true },
                { name: "百花净毒露", fromCatalog: true },
              ],
            },
            quest_bh5_neutral: {
              factionRep: { 百花门: 10 },
              flags: ["bh5_neutral"],
              items: [
                { name: "百草解瘴散", fromCatalog: true },
                { name: "百草解瘴散", fromCatalog: true },
                { name: "百草解瘴散", fromCatalog: true },
              ],
            },
          },
        },
      },
    ],
  },
  // ── 花支2·师叔祖的茶（支线，发布人：兰姐；合稿 四.支线2）──
  baihuamen_side_2_shishuzudecha: {
    id: "baihuamen_side_2_shishuzudecha",
    type: "QT_TALK",
    localOnly: true,
    title: "花支2·师叔祖的茶",
    giver: "兰姐",
    requiresFactionRep: { 百花门: 20 },
    requiresKnownNpcAny: ["梵衍那", "罗琦"],
    description: "欢喜教圣女罗琦素衣登门，代梵衍那送来一匣天竺曼陀罗奇香，附柬戏称：「苗疆蛊术本出天竺，老夫托大，请沈小师侄品鉴。」",
    stages: [
      {
        id: "gift",
        giver: "兰姐",
        requireLocation: { district: "天都镇", inner: "百花楼" },
        playerHint: "先听兰姐说说这盒香是什么意思。",
        description: "兰姐掀开香匣冷笑：「他是来探百花楼近来乱没乱阵脚。」她让你先去暖棚找花婆调一坛百花解瘴露作回礼，再以熟客身份送去西市天都香行。",
        completionFlag: "quest_bhs2_gift",
      },
      {
        id: "brew",
        giver: null,
        requireLocation: { district: "天都镇", inner: "百花暖棚" },
        playerHint: "找花婆领回礼用的百花解瘴露。",
        description: "花婆掀开地窖封坛，给你装了小小一坛：「就这一坛，多了没有——让那老小子闻闻什么叫正经药香。」",
        completionFlag: "quest_bhs2_brew",
      },
      {
        id: "tea",
        giver: null,
        requireLocation: { district: "天都镇", inner: "香行内堂" },
        playerHint: "送解瘴露去香行内堂，陪罗琦品一回茶——对答时站稳了。",
        description: "罗琦烹茶请你落座，三句江湖切口连珠抛来，句句都往天都镇的格局上绕。屏风后隐约有条人影在听。",
        completionFlag: ["quest_bhs2_bold", "quest_bhs2_weak"],
        choices: [
          { flag: "quest_bhs2_bold", label: "不卑不亢·逐句拆解机锋", resolve: "none", narration: "你滴水不漏接完三句，屏风后梵衍那朗声大笑现身：「小师侄调教得好！」他顺手替你斟满茶，状似无意提了一句——锦官城姓柳的女都事，眼线已摸到东街茶摊外三步了。" },
          { flag: "quest_bhs2_weak", label: "卖惨示弱·哭穷讨巧", resolve: "none", narration: "你唉声叹气说了半天楼里的难处，罗琦脸上笑着应和，眼底却冷下来。茶喝完了，半句有用的也没套出来。" },
        ],
        onReach: {
          byFlag: {
            quest_bhs2_bold: { factionRep: { 欢喜教: 8 }, favorability: { "梵衍那": 10, "罗琦": 10 }, flags: ["bh_gov_warning"] },
            quest_bhs2_weak: { factionRep: { 欢喜教: -3 }, favorability: { "罗琦": -5 } },
          },
        },
      },
      {
        id: "report",
        giver: "兰姐",
        requireLocation: { district: "天都镇", inner: "百花楼" },
        playerHint: "把香行这一趟的回话带给兰姐。",
        description: "苏折柳听完那句暗警，当场换了脸色，连夜拔掉了潜伏在门外茶摊的官府耳目——账房的机密保住了。",
        completionFlag: "quest_bhs2_report",
        onReach: {
          money: 100,
          factionRep: { 百花门: 15 },
          items: [
            { name: "天竺安神香", fromCatalog: true },
            { name: "天竺安神香", fromCatalog: true },
            { name: "玫瑰花酿", fromCatalog: true },
            { name: "玫瑰花酿", fromCatalog: true },
          ],
        },
      },
    ],
  },
  // ── 花支3·断羽彩雀（支线，发布人：小蝉；合稿 四.支线3）──
  baihuamen_side_3_duanyucaique: {
    id: "baihuamen_side_3_duanyucaique",
    type: "QT_TALK",
    localOnly: true,
    title: "花支3·断羽彩雀",
    giver: "小蝉",
    requiresFactionRep: { 百花门: 10 },
    description: "小蝉急得眼圈发红：她最心爱的绿背彩雀往狼曲河谷送信后一夜未归，怕是撞上了巡捕或野鹰。",
    stages: [
      {
        id: "search",
        giver: null,
        requireLocation: { district: "大草甸" },
        playerHint: "沿大草甸南侧草丛循着鸟鸣找彩雀。",
        description: "岩缝里一团绿影扑簌簌发抖——彩雀左翼被流箭擦伤，脚筒还死死绑着一封染血家书与一小包碎银。",
        completionFlag: "quest_bhs3_found",
      },
      {
        id: "deliver",
        giver: null,
        requireLocation: { district: "玉泉寨" },
        playerHint: "把染血家书与过冬盐钱亲手送到玉泉寨卓玛手里。",
        description: "花婆给彩雀涂了金创花膏：这信是逃亡天都镇的玉泉寨牧民托百花楼捎回老家的过冬盐钱。半道上，一队土司巡捕横在马前盘查。",
        completionFlag: ["quest_bhs3_pay", "quest_bhs3_fight"],
        choices: [
          { flag: "quest_bhs3_pay", label: "亮银打发·息事宁人", resolve: "none", requiresMoney: 20, narration: "你摸出二十两碎银塞过去，巡捕掂了掂分量，挥手放行。" },
          { flag: "quest_bhs3_fight", label: "动武震退·亮家伙", resolve: "combat", combatNpc: { name: "土司巡捕", levelCap: 3 } },
        ],
        onReach: {
          byFlag: {
            quest_bhs3_pay: { money: -20 },
            quest_bhs3_fight: { factionRep: { 玉泉寨: 5, 鱼定土司府: -3 } },
          },
        },
      },
      {
        id: "return",
        giver: null,
        requireLocation: { district: "天都镇", inner: "百花楼" },
        playerHint: "回百花楼，把卓玛捎的回礼带给小蝉。",
        description: "卓玛收下家书与盐钱，硬塞给你一袋新炒的青稞面。小蝉抱着伤愈的彩雀转圈，连声道谢。",
        completionFlag: "quest_bhs3_return",
        onReach: {
          money: 60,
          factionRep: { 百花门: 12, 玉泉寨: 10 },
          favorability: { "小蝉": 15 },
          items: [
            { name: "驯化信雀哨", fromCatalog: true },
            { name: "青稞炒面", fromCatalog: true },
            { name: "青稞炒面", fromCatalog: true },
            { name: "青稞炒面", fromCatalog: true },
          ],
        },
      },
    ],
  },
} };
