export default { quest: {  xueshan_4_yadi_zhenxiang: {
    id: "xueshan_4_yadi_zhenxiang",
    type: "QT_TALK",
    title: "雪4·雪山崖底三十年",
    giver: "何雨谢",
    giverId: "resident_heyuxie",
    localOnly: true,
    requiresQuestCompleted: "xueshan_3_emei_jiushu",
    requiresFactionRep: { 雪山派: 60 },
    description: "青城密证与伪造地契的线索拼在一起，何雨谢终于决定直面三十年不敢踏足的禁地——顶峰，雪山崖底。",
    stages: [
      {
        id: "summon",
        giver: null,
        requireLocation: { district: "雪山派", inner: "内堂" },
        playerHint: "去内堂见何雨谢。",
        description: "何雨谢把旧剑谱与密函一页页看完，指尖停在「家贼勾结外人」六个字上：「三十年了……我怕的不是真相，是真相之后雪山该怎么办。——你陪我走一趟崖底。叫上照野和小雪。」",
        completionFlag: "quest_x4_summon",
        onReach: { favorability: { "何雨谢": 10 } },
      },
      {
        id: "cliff",
        giver: null,
        requireLocation: { district: "顶峰", inner: "雪山崖底" },
        playerHint: "登顶峰，下雪山崖底，寻呼延大侠遗踪。",
        description: "崖底冰隙深处，一只鬃毛全白的老猿守着半截断剑与一方血刻残角。它见人来，目露凶光拦在骸骨之前。",
        completionFlag: ["quest_x4_ape_peace", "quest_x4_ape_fight"],
        choices: [
          { flag: "quest_x4_ape_peace", label: "以玄女信物安抚白猿", resolve: "none", narration: "你取出玄女相赠的冰蚕素绫，老白猿嗅出旧友气息，呜咽一声让开了路——骸骨旁的血刻地契残角，道尽当年误斗真相。" },
          { flag: "quest_x4_ape_fight", label: "出手制服守骸白猿", resolve: "combat", combatNpc: { name: "守骸老白猿", levelCap: 4 } },
        ],
        onReach: {
          items: [{ name: "血刻地契残角", fromCatalog: true }],
          byFlag: {
            quest_x4_ape_peace: { favorability: { "玄女": 10 } },
            quest_x4_ape_fight: { favorability: { "玄女": -5 } },
          },
        },
      },
      {
        id: "lama",
        giver: null,
        requireLocation: { district: "喇嘛庙", inner: "大殿" },
        playerHint: "携血刻残角上喇嘛庙，对质住持。",
        description: "大殿酥油灯影里，住持看到残角血刻，手中念珠啪然散落。三十年前年少目击全程却因畏惧噤声的往事，被一字一句揭开——老泪纵横间，他终于点头：「贫僧上山，亲口向何师母作证。」",
        completionFlag: "quest_x4_lama",
        onReach: {
          factionRep: { 喇嘛庙: 25 },
          favorability: { "何雨谢": 10 },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雪山派", inner: "内堂" },
        playerHint: "回雪山内堂，决定如何处置崖底真相。",
        description: "住持当堂作证，呼延大侠遗物入祀拜师堂。何雨谢长跪一夜，天明时望着「尘事止此」碑问你：这真相，是公诸全门，还是先压在少数人手里？",
        completionFlag: ["quest_x4_public", "quest_x4_secret"],
        choices: [
          { flag: "quest_x4_public", label: "公诸全门·雪耻定心", resolve: "none", narration: "当着全派弟子之面，崖底真相与土司府三十年伪造地契之罪一并揭开。陆寒枝怔在原地，缓缓单膝跪地——风声，也注定传到山下去了。" },
          { flag: "quest_x4_secret", label: "密藏内堂·稳步布局", resolve: "none", narration: "铁证只存在内堂与住持之间。何雨谢轻声道：「雪山的元气，再也经不起提前被围山了。」" },
        ],
        onReach: {
          money: 400,
          items: [{ name: "呼延旧玉扳指", fromCatalog: true }],
          factionRep: { 雪山派: 35 },
          byFlag: {
            quest_x4_public: { flags: ["xueshan_truth_public"], factionRep: { 鱼定土司府: -20 }, favorability: { "陆寒枝": 15 } },
            quest_x4_secret: { favorability: { "陆寒枝": -5 } },
          },
        },
      },
    ],
    rewardText: "三十年坚冰一朝消融，「尘事止此」碑上的封雪被亲手拆下。",
  },

  // ── 雪5·破戒出山（终局请山）──
  xueshan_5_pojie_chushan: {
    id: "xueshan_5_pojie_chushan",
    type: "QT_TALK",
    title: "雪5·破戒出山",
    giver: "何雨谢",
    giverId: "resident_heyuxie",
    localOnly: true,
    requiresQuestCompleted: "xueshan_4_yadi_zhenxiang",
    requiresFactionRep: { 雪山派: 80 },
    description: "曲措乡战云密布。雪山派三十年来第一次全门议事——陆寒枝横剑立在练功堂上：「出山不是嘴上喊的，先接住雪山派的剑！」",
    stages: [
      {
        id: "duel_lu",
        giver: null,
        requireLocation: { district: "雪山派", inner: "雪山练功堂" },
        playerHint: "上练功堂，接陆寒枝的问门一剑。",
        description: "木桩阵前，陆寒枝铁鞘重剑出鞘：「你要雪山为山下拼命，就先让我看看你的命够不够硬。」",
        completionFlag: "quest_x5_lu",
        choices: [
          { flag: "quest_x5_lu", label: "登台与陆寒枝切磋", resolve: "combat", combatNpc: { name: "陆寒枝", levelCap: 4 } },
        ],
        onReach: { favorability: { "陆寒枝": 15 } },
      },
      {
        id: "duel_he",
        giver: null,
        requireLocation: { district: "雪山派", inner: "内堂" },
        playerHint: "入内堂，接何雨谢的问心三剑。",
        description: "内堂烛火不动，何雨谢解下北墙无鞘旧剑：「三剑。守得住本心，雪山随你下山。」",
        completionFlag: "quest_x5_he",
        choices: [
          { flag: "quest_x5_he", label: "接问心三剑", resolve: "combat", combatNpc: { name: "何雨谢", levelCap: 5 } },
        ],
        onReach: { favorability: { "何雨谢": 15 } },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雪山派", inner: "内堂" },
        playerHint: "剑鸣落定，听雪山派的决断。",
        description: "剑鸣震落檐雪。何雨谢环视全门：「三十年前雪山沉默了一次，换来曲措乡三十年寒霜。」——出山的方式，由你与她一同定。",
        completionFlag: ["quest_x5_full", "quest_x5_lone"],
        choices: [
          { flag: "quest_x5_full", label: "破戒倾巢出山", resolve: "none", requiresFlag: ["xueshan_truth_public"], narration: "「今日破戒，非为私仇，为山下生民！」何雨谢率陆寒枝、沈既白与雪山剑阵，随你下山。" },
          { flag: "quest_x5_lone", label: "独剑随行·保全道统", resolve: "none", narration: "雪山派大部闭山自守，沈既白解下算盘坠子佩了剑：「我以个人身份随你走——山里的规矩，不能真破。」" },
        ],
        onReach: {
          money: 600,
          // 合稿：雪5 完成授称号「雪岭剑盟」（rep140 客卿长老档引擎封顶 100 后合入）
          flags: ["title_xueshan_jianmeng"],
          factionRep: { 雪山派: 30 },
          byFlag: {
            quest_x5_full: { flags: ["xueshan_endgame_ally"], factionRep: { 鱼定土司府: -15, 鱼定村: 10, 玉泉寨: 10, 喇嘛庙: 6, 峨眉派: 6, 青城派: 6 } },
            quest_x5_lone: { flags: ["xueshan_endgame_lone"], factionRep: { 鱼定村: 4 } },
          },
        },
      },
    ],
    rewardText: "雪山派的剑，三十年来第一次指向了山下。",
  },

  // ── 雪支2·红瞳与白猿（跨势力：天龙教·血刀部）──
  xueshan_side_2_hongtong_baiyuan: {
    id: "xueshan_side_2_hongtong_baiyuan",
    type: "QT_TALK",
    title: "雪支2·红瞳与白猿",
    giver: "玄女",
    giverId: "resident_xuannu",
    localOnly: true,
    requiresFavorability: { "玄女": 20 },
    description: "温泉水汽突现紊乱，玄女抬眼望向峰顶，冷声吐出四个字：「峰上，血腥。」",
    stages: [
      {
        id: "spring",
        giver: null,
        requireLocation: { district: "雪山派", inner: "后山温泉" },
        playerHint: "去后山温泉找玄女。",
        description: "玄女立在泉边，红瞳映着水汽：「老猿在峰上叫人围了。跟我走，或者我自己去。」",
        completionFlag: "quest_xsz2_go",
        onReach: { favorability: { "玄女": 5 } },
      },
      {
        id: "peak",
        giver: null,
        requireLocation: { district: "顶峰", inner: "绝顶" },
        playerHint: "上顶峰绝顶，截下围猎白猿的血刀探子。",
        description: "绝顶风雪中，三名血刀部侦骑以毒烟围猎老白猿，口中念着「剑谱」与「暗道」。玄女的红瞳冷得像崖冰。",
        completionFlag: "quest_xsz2_fight",
        choices: [
          { flag: "quest_xsz2_fight", label: "联手截击血刀探子", resolve: "combat", combatNpc: { name: "血刀部侦骑", levelCap: 3 } },
        ],
        onReach: {
          items: [{ name: "血刀过境腰牌", fromCatalog: true }],
          factionRep: { 天龙教: -4 },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雪山派", inner: "后山温泉" },
        playerHint: "回温泉，替白猿包扎，定夺腰牌的去处。",
        description: "雪岩边，玄女替白猿缠好伤，瞥见你手里的腰牌：「土司府的路引，草甸的刀。你拿它怎么办？」",
        completionFlag: ["quest_xsz2_keep", "quest_xsz2_release"],
        choices: [
          { flag: "quest_xsz2_keep", label: "把腰牌呈给何雨谢作铁证", resolve: "none", narration: "腰牌入了内堂。何雨谢看着土司府私印，许久没说话——这一条暗线，记下了。" },
          { flag: "quest_xsz2_release", label: "废武驱逐·不结死仇", resolve: "none", narration: "血刀探子瘸着腿滚下大草甸。玄女淡淡道：「也好，雪山的刀口不必见太多血。」" },
        ],
        onReach: {
          money: 180,
          items: [{ name: "雪猿灵桃", fromCatalog: true }, { name: "雪猿灵桃", fromCatalog: true }, { name: "冰蚕护腕", fromCatalog: true }],
          byFlag: {
            quest_xsz2_keep: { factionRep: { 雪山派: 15, 天龙教: -10, 青城派: 3 }, favorability: { "玄女": 18, "何雨谢": 10 } },
            quest_xsz2_release: { factionRep: { 雪山派: 10, 天龙教: -4 }, favorability: { "玄女": 8 } },
          },
        },
      },
    ],
    rewardText: "白猿脱险，一枚过境腰牌揭开了管家通联血刀部的暗线。",
  },

  // ── 雪支3·霜天问剑（衔接神兵 divine_shuangtianyue）──
  xueshan_side_3_shuangtian_wenjian: {
    id: "xueshan_side_3_shuangtian_wenjian",
    type: "QT_TALK",
    title: "雪支3·霜天问剑",
    giver: "齐照野",
    giverId: "resident_qizhaoye",
    localOnly: true,
    requiresQuestCompleted: "xueshan_3_emei_jiushu",
    requiresFactionRep: { 雪山派: 80 },
    requiresFavorability: { "齐照野": 40 },
    description: "剑阁里，齐照野从石案下取出一块封存三十年的玄冰陨铁：「呼延大侠的残锋，该重见天日了。」",
    stages: [
      {
        id: "iron",
        giver: null,
        requireLocation: { district: "雪山派", inner: "寒玉旧剑阁" },
        playerHint: "去寒玉旧剑阁见齐照野。",
        description: "玄冰陨铁摆在寒玉石案上，齐照野摩挲着旧剑残锋：「要铸霜天月，还缺一味冰心炭——山洞深处寒泉边的石髓底下才有。」",
        completionFlag: "quest_xsz3_iron",
        onReach: {
          items: [{ name: "玄冰陨铁", fromCatalog: true }],
          favorability: { "齐照野": 10 },
        },
      },
      {
        id: "charcoal",
        giver: null,
        requireLocation: { district: "山洞", inner: "深处" },
        playerHint: "去山洞深处采冰心炭。",
        description: "山洞尽头的寒泉泛着幽光，石髓底下嵌着几块烧不化的奇炭。寒气顺着指尖往骨缝里钻。",
        completionFlag: "quest_xsz3_charcoal",
        onReach: {
          items: [{ name: "冰心炭", fromCatalog: true }],
        },
      },
      {
        id: "forge",
        giver: null,
        requireLocation: { district: "雪山派", inner: "后山温泉" },
        playerHint: "回后山温泉，借热泉与玄女的寒玉真气双淬成剑。",
        description: "硫磺热泉腾起白汽，玄女一掌寒玉真气压进炉口，齐照野的铁锤落下最后一声——剑身映雪无声。",
        completionFlag: "quest_xsz3_forge",
        onReach: {
          favorability: { "玄女": 10, "齐照野": 10 },
        },
      },
      {
        id: "report",
        giver: null,
        requireLocation: { district: "雪山派", inner: "雪山练功堂" },
        playerHint: "到练功堂承接剑煞，决定霜天月归处。",
        description: "何雨谢亲自以残存真气点锋开刃，霜天月悬在练功堂上，满室落雪皆滞半拍。「此剑归处，由你来定。」",
        completionFlag: ["quest_xsz3_keep", "quest_xsz3_take"],
        choices: [
          { flag: "quest_xsz3_keep", label: "剑归雪山·镇山留锋", resolve: "none", narration: "你双手奉还神兵。何雨谢接剑的手顿了顿，解下腰间客卿令：「雪岭剑主令，往后雪山的剑也听你半分调遣。」" },
          { flag: "quest_xsz3_take", label: "承剑下山·自佩神兵", resolve: "none", narration: "何雨谢将剑递到你掌心：「持此剑者，须守雪山清誉。」剑柄上的霜纹映着你的名字。" },
        ],
        onReach: {
          money: 300,
          byFlag: {
            quest_xsz3_keep: { items: [{ name: "雪岭剑主令", fromCatalog: true }], factionRep: { 雪山派: 35 }, favorability: { "何雨谢": 25 } },
            quest_xsz3_take: { items: [{ name: "霜天月", fromCatalog: true }], factionRep: { 雪山派: 15 }, favorability: { "何雨谢": 10 } },
          },
        },
      },
    ],
    rewardText: "断绝三十年的锋芒，重新映上了雪岭的月光。",
  },
} };
