// 其余七座地宫静态配置（与白塔地宫合计八大地宫，掉落物均来自 CATALOG_INDEX）。

export const DUNGEON_CATALOG_EXTRA = Object.freeze({
  sanxing_bronze_abyss: {
    id: "sanxing_bronze_abyss",
    name: "归墟青铜秘井",
    district: "广汉",
    innerRoom: "金乌暗室·归墟秘井",
    clearFlag: "dungeon_cleared_sanxing_bronze_abyss",
    subtitle: "神树底座下干涸千年的古蜀秘井，井壁刻满金乌环纹，藏着先秦铸铜机括。",
    floors: [
      { floor: 1, name: "一层 · 纵目井壁", stepsPerFloor: 2, tier: 2, desc: "井梯悬在半空，铜环撞击井壁发出绕梁三匝的余响。" },
      { floor: 2, name: "二层 · 赤炉古铸道", stepsPerFloor: 2, tier: 3, desc: "残余的焦炭与铜渣铺满石道，暗渠不时喷出滚烫硫烟。" },
      { floor: 3, name: "三层 · 太阳神鸟坛", stepsPerFloor: 2, tier: 4, desc: "井底磨亮的圆台泛着暗金微光，守井长老盘坐其旁。" },
    ],
    traps: [
      {
        id: "sanxing_trap_pendulum",
        title: "青铜神鸟摆刃",
        desc: "三柄重逾百斤的青铜弧刃沿铁索交叉扫过井道。",
        choices: [
          {
            id: "dash_pendulum",
            label: "测算摆幅纵身窜过",
            stat: "身法",
            dc: 6,
            success: { text: "借铁链晃动的空隙贴壁连闪，顺手从壁龛抠出一只旧铜铃。", items: ["青铜小铃"], exp: 3 },
            fail: { text: "袖摆被铜刃擦裂，震得胸口一闷。", hpLoss: 18, exp: 1 },
          },
          {
            id: "jam_pendulum",
            label: "找准铁索滑轮卡死枢轴",
            stat: "智谋",
            dc: 6,
            success: { text: "拿断铁楔住青铜绞盘，三柄弧刃同时悬停在半空。", money: 28, exp: 3 },
            fail: { text: "铁楔崩飞弹回手腕，挨了一下反震。", hpLoss: 15, exp: 1 },
          },
        ],
      },
      {
        id: "sanxing_trap_steam",
        title: "地火硫烟裂隙",
        desc: "赤炉旧道下地气翻涌，石缝里忽然嘶嘶喷出白热蒸汽。",
        choices: [
          {
            id: "endure_steam",
            label: "护住心脉硬冲过热浪区",
            stat: "根骨",
            dc: 6,
            success: { text: "内息护体冲出烟区，竟觉得筋骨被地气蒸得愈发通透。", pot: 4, exp: 2 },
            fail: { text: "热气灼伤肩背，勉强滚出裂隙。", hpLoss: 20, exp: 1 },
          },
          {
            id: "cover_vent",
            label: "翻倒石盖压住地气风眼",
            stat: "体魄",
            dc: 6,
            success: { text: "一肩顶翻三百斤青石盖死风眼，清出通往前方的安全石阶。", money: 22, pot: 2 },
            fail: { text: "石盖沉得超乎预料，掀动时拉伤腰背。", hpLoss: 16, exp: 1 },
          },
        ],
      },
      {
        id: "sanxing_trap_mask",
        title: "纵目石雕幻阵",
        desc: "九尊青铜纵目面具围成一圈，孔洞后的回声让人辨不清来去方向。",
        choices: [
          {
            id: "decode_mask",
            label: "按金乌日影方位破解石阵",
            stat: "悟性",
            dc: 6,
            success: { text: "听风辨出唯一不回响的生门石阶，顺利脱阵。", exp: 4, pot: 3 },
            fail: { text: "在石阵里绕了半柱香，碰响暗石挨了一记飞石。", hpLoss: 16, exp: 1 },
          },
          {
            id: "smash_mask",
            label: "砸开东侧铜面具找暗路",
            stat: "体魄",
            dc: 7,
            success: { text: "一拳震碎风化底座，露出面具背后藏着的旧祭祀短剑。", items: ["绿锈青铜剑"], exp: 3 },
            fail: { text: "铜座纹丝不动，震裂虎口失血。", hpLoss: 18, exp: 1 },
          },
        ],
      },
    ],
    events: [
      {
        id: "sanxing_event_kiln",
        title: "未熄古铜浇铸炉",
        desc: "石室角落的青铜坩埚里还凝固着半块暗红金属锭。",
        choices: [
          {
            id: "inspect_kiln",
            label: "细察炉铭纹样领悟铸造劲道",
            stat: "悟性",
            dc: 6,
            success: { text: "从炉壁铭文里的锤打节律中悟出三分发力法门。", pot: 6, exp: 3 },
            fail: { text: "铭文半数剥落，只粗略收走炉旁几锭碎铜钱。", money: 20, exp: 1 },
          },
          {
            id: "take_slag",
            label: "只拣取炉外完好的铜锭换银",
            success: { text: "稳妥收走几块成色极佳的古铜锭。", money: 32, exp: 1 },
          },
        ],
      },
      {
        id: "sanxing_event_echo",
        title: "井壁三叠回声",
        desc: "石壁某处发出异样空鸣，似乎后面还有一层夹室。",
        choices: [
          {
            id: "open_echo",
            label: "循空鸣按动凹陷的太阳纹砖",
            stat: "气运",
            dc: 6,
            success: { text: "砖石缩进墙内，落下一卷完好如初的玄麻祭天袍。", items: ["玄麻祭天袍"], exp: 3 },
            fail: { text: "砖后只有一堆碎瓦与散落铜钱。", money: 18, exp: 1 },
          },
          {
            id: "skip_echo",
            label: "不贪暗室，原地调息养神",
            success: { text: "省下力气舒缓筋骨，气血稳住不少。", hpHeal: 16, exp: 1 },
          },
        ],
      },
      {
        id: "sanxing_event_script",
        title: "祭祀残碑拓片",
        desc: "碎碑旁放着前代三星派弟子遗落的墨拓与一盏冷油灯。",
        choices: [
          {
            id: "read_stele",
            label: "对照残碑摹写剑势轨迹",
            stat: "悟性",
            dc: 6,
            success: { text: "碑纹纵横如剑气，参透一式沉稳重剑发力。", pot: 7, exp: 3 },
            fail: { text: "碑面漫漶难辨，勉强记下少许诀窍。", pot: 3, exp: 1 },
          },
          {
            id: "search_altar",
            label: "翻看供桌抽屉寻摸盘缠",
            success: { text: "抽屉里留着几两银角子和两枚铜钱。", money: 26, exp: 1 },
          },
        ],
      },
    ],
    treasures: [
      {
        id: "sanxing_treasure_forge",
        title: "赤炉密匣",
        desc: "铁铸方匣上嵌着双耳铜锁，锁芯还涂着防锈松香。",
        choices: [
          {
            id: "pick_forge_box",
            label: "以巧劲撬开双耳铜锁",
            stat: "智谋",
            dc: 6,
            success: { text: "挑断铜锁内簧，匣内卧着一柄沉甸甸的赤炉铸铜锤。", items: ["赤炉铸铜锤"], money: 25, exp: 3 },
            fail: { text: "锁芯反弹划伤手指，只撬出边角散银。", hpLoss: 12, money: 20 },
          },
          {
            id: "take_forge_outer",
            label: "取走匣外散落的铜器配件",
            success: { text: "收齐外盒里的精铜件与碎银。", money: 34 },
          },
        ],
      },
      {
        id: "sanxing_treasure_sword",
        title: "神树铜剑架",
        desc: "腐朽的楠木剑架上插着一柄无鞘重剑，剑身泛青。",
        choices: [
          {
            id: "pull_bronze_sword",
            label: "运劲拔出插在底座里的古铜重剑",
            stat: "体魄",
            dc: 7,
            success: { text: "沉喝一声拔剑出座，重剑入手极沉，锋芒犹在！", items: ["古铜重剑"], exp: 4 },
            fail: { text: "底座铁卡纹丝不动，震痛掌心，只取走剑旁供银。", hpLoss: 14, money: 26 },
          },
          {
            id: "take_bell",
            label: "只解下剑穗上的青铜小铃",
            success: { text: "解下一枚音色清越的青铜小铃。", items: ["青铜小铃"], money: 14 },
          },
        ],
      },
    ],
    rests: [
      {
        id: "sanxing_rest_chamber",
        title: "干燥石龛避风室",
        desc: "井壁内侧一处避风石室，摆着干草垫与石凳。",
        choices: [
          {
            id: "sanxing_heal",
            label: "靠壁包扎伤口喘息片刻",
            success: { text: "喘匀了气，伤势缓解许多。", hpHealRatio: 0.35, exp: 1 },
          },
          {
            id: "sanxing_meditate",
            label: "静坐听井风悟劲",
            success: { text: "听着井底风声吐纳行气，潜能见涨。", hpHeal: 12, pot: 6, exp: 2 },
          },
        ],
      },
      {
        id: "sanxing_rest_spring",
        title: "青铜滤水槽",
        desc: "山泉顺着青铜竹节暗管滴进石槽，清凉甘冽。",
        choices: [
          {
            id: "drink_bronze_water",
            label: "痛饮山泉洗去疲惫",
            success: { text: "清冽泉水下肚，精神大振。", hpHealRatio: 0.3, pot: 3 },
          },
          {
            id: "polish_gear",
            label: "整束兵甲调匀呼吸",
            success: { text: "重整兵刃气机，略有所得。", hpHeal: 15, exp: 3 },
          },
        ],
      },
    ],
    enemies: [
      {
        id: "sanxing_disciple_guard",
        name: "三星守井门人",
        role: "三星门人",
        region: "中原",
        levelCap: 2,
        desc: "戴青铜小面具的三星守井弟子，剑法沉稳古拙。",
        carry: [{ name: "绿锈青铜剑", category: "weapon", quality: "绿" }],
        reward: { money: 32, exp: 4, pot: 3 },
      },
      {
        id: "sanxing_bronze_warden",
        name: "纵目石卫",
        role: "古墟护卫",
        region: "中原",
        levelCap: 3,
        desc: "扼守赤炉铸道的精锐护卫，身披重甲，招式大开大合。",
        carry: [
          { name: "古铜重剑", category: "weapon", quality: "紫" },
          { name: "守塔僧金疮药", category: "misc", quality: "绿" },
        ],
        reward: { money: 46, exp: 6, pot: 4 },
      },
    ],
    boss: {
      id: "sanxing_elder_boss",
      name: "金乌守井长老",
      role: "三星长老",
      region: "中原",
      levelCap: 4,
      desc: "独守归墟秘井数十载的三星老宿，手握古铜重器：「能走到太阳圆台前，先接老夫三剑。」",
      carry: [
        { name: "古铜重剑", category: "weapon", quality: "紫" },
        { name: "青铜小铃", category: "accessory", quality: "紫" },
      ],
      reward: { money: 86, exp: 10, pot: 8, items: ["玄麻祭天袍"] },
    },
  },

  tangmen_poison_vault: {
    id: "tangmen_poison_vault",
    name: "唐堡试毒暗阁",
    district: "蜀南唐堡",
    innerRoom: "试毒暗阁",
    clearFlag: "dungeon_cleared_tangmen_poison_vault",
    subtitle: "蜀南竹坞尽头不开窗的试毒禁阁，陶瓮密布，千机暗弩密如蛛网。",
    floors: [
      { floor: 1, name: "一层 · 朱签陶瓮室", stepsPerFloor: 2, tier: 2, desc: "空气里飘着甜腻药味，每一步都得看清地砖是否下陷。" },
      { floor: 2, name: "二层 · 千机弩机道", stepsPerFloor: 2, tier: 3, desc: "两侧竹墙开满细小孔洞，机簧声在黑暗里若有若无。" },
      { floor: 3, name: "三层 · 秘方铁阁", stepsPerFloor: 2, tier: 4, desc: "铁门后陈列着唐门封存的毒方与孤本暗器。" },
    ],
    traps: [
      {
        id: "tangmen_trap_needles",
        title: "梅花暴雨壁弩",
        desc: "踩中松动竹板，壁间三十六枚细孔同时缩簧蓄势。",
        choices: [
          {
            id: "roll_needles",
            label: "贴地急滚穿过射界",
            stat: "身法",
            dc: 6,
            success: { text: "千钧一发滚进死角柱后，银针全数钉空。", money: 24, exp: 3 },
            fail: { text: "左臂擦中两枚冷针，逼出毒血消耗了不少气血。", hpLoss: 19, exp: 1 },
          },
          {
            id: "jam_needles",
            label: "预判机括线路反拨泄力簧",
            stat: "智谋",
            dc: 6,
            success: { text: "甩出一枚石子击中墙角铜钮，暗弩无声失效，捡回一袋药粉。", items: ["守塔僧金疮药"], exp: 3 },
            fail: { text: "算慢了半息，袖口挂上一枚暗针。", hpLoss: 16, exp: 1 },
          },
        ],
      },
      {
        id: "tangmen_trap_fumes",
        title: "甜腥曼陀毒雾",
        desc: "两口朱签陶瓮倾倒，淡紫色药烟缓缓漫过脚踝。",
        choices: [
          {
            id: "hold_breath_fume",
            label: "封住鼻息强运内功冲过",
            stat: "根骨",
            dc: 6,
            success: { text: "真气闭锁百脉穿过毒雾，末了还吸纳了些许药性炼气。", pot: 4, exp: 2 },
            fail: { text: "吸进半口甜烟，头晕目眩摔了一跤。", hpLoss: 18, exp: 1 },
          },
          {
            id: "fan_fume",
            label: "借上风气口震开高窗散烟",
            stat: "智谋",
            dc: 6,
            success: { text: "震落通风竹栅把烟气抽空，在架上顺走两柄短刃。", items: ["柳叶小刀"], exp: 3 },
            fail: { text: "竹栅卡死，挣扎间还是吸入了几口毒雾。", hpLoss: 15, exp: 1 },
          },
        ],
      },
      {
        id: "tangmen_trap_wire",
        title: "玄丝牵机索",
        desc: "半空横着十几根几乎看不见的蚕丝，牵动便会引爆火药竹筒。",
        choices: [
          {
            id: "spot_wire",
            label: "眯眼借反光辨认蚕丝走向绕行",
            stat: "悟性",
            dc: 6,
            success: { text: "步步踩准蚕丝间隙穿过走廊，稳稳拆下一只药囊。", money: 26, exp: 3 },
            fail: { text: "脚背勾断一根细丝，爆开的硫磺烟熏伤双腿。", hpLoss: 17, exp: 1 },
          },
          {
            id: "dodge_wire",
            label: "翻身跃上横梁爬过",
            stat: "身法",
            dc: 7,
            success: { text: "轻功纵上梁木悄无声息滑过全廊。", exp: 4, pot: 2 },
            fail: { text: "梁木朽脆踩断半根，摔落时撞痛肋骨。", hpLoss: 16, exp: 1 },
          },
        ],
      },
    ],
    events: [
      {
        id: "tangmen_event_bowl",
        title: "案头一碗清水",
        desc: "石桌上摆着一只粗瓷碗，水清见底，旁边压着半张试毒方。",
        choices: [
          {
            id: "drink_clear_water",
            label: "按唐堡旧规饮下半碗清水",
            stat: "根骨",
            dc: 5,
            success: { text: "原是秘制洗脉药水，饮下后神清气爽，旧伤舒缓。", hpHeal: 22, pot: 3 },
            fail: { text: "药性偏寒，腹中微绞一阵才平复。", hpLoss: 8, pot: 2 },
          },
          {
            id: "read_formula",
            label: "不喝水，细抄半张配药方子",
            success: { text: "记下几味克毒配伍，见识大长。", exp: 3, money: 16 },
          },
        ],
      },
      {
        id: "tangmen_event_drawer",
        title: "机密药柜暗格",
        desc: "药柜最下层的百草抽屉虚掩着，锁眼沾着新鲜松油。",
        choices: [
          {
            id: "search_drawer",
            label: "小心摸探抽屉暗层",
            stat: "气运",
            dc: 6,
            success: { text: "摸到一瓶罕见的雪莲清毒丸与几锭碎银。", items: ["雪莲清毒丸"], money: 20, exp: 2 },
            fail: { text: "指尖被暗钉扎破，只抓出几枚散银。", hpLoss: 10, money: 14 },
          },
          {
            id: "take_bandages",
            label: "只取上层明处的干净伤药",
            success: { text: "收好一包常备金疮药。", items: ["守塔僧金疮药"], exp: 1 },
          },
        ],
      },
    ],
    treasures: [
      {
        id: "tangmen_treasure_silk",
        title: "防毒香匣",
        desc: "樟木匣里叠着一件泛着幽香的轻薄护衣。",
        choices: [
          {
            id: "open_silk_box",
            label: "按九宫锁拆开香匣",
            stat: "智谋",
            dc: 6,
            success: { text: "解开九宫机簧，取出一件珍贵的百香纱衣。", items: ["百香纱衣"], exp: 3 },
            fail: { text: "机簧弹出刺伤手背，只拿到匣底银钱。", hpLoss: 12, money: 28 },
          },
          {
            id: "take_silver_tray",
            label: "只收走匣外几锭纹银",
            success: { text: "掂走三十两银子，不冒机括之险。", money: 30 },
          },
        ],
      },
      {
        id: "tangmen_treasure_dart",
        title: "暗器紫檀盒",
        desc: "盒盖刻着竹叶纹，盒侧有半截机簧露在外面。",
        choices: [
          {
            id: "claim_baihuaci",
            label: "稳住机簧打开紫檀盒",
            stat: "身法",
            dc: 7,
            success: { text: "快手按住机簧打开盒盖，收得精巧暗器「百花刺」！", items: ["百花刺"], exp: 3 },
            fail: { text: "弹簧震开擦破虎口，只捞到一柄柳叶小刀。", hpLoss: 12, items: ["柳叶小刀"] },
          },
          {
            id: "take_box_coin",
            label: "只取盒边盘缠不拆暗锁",
            success: { text: "取走盘缠二十五两。", money: 25 },
          },
        ],
      },
    ],
    rests: [
      {
        id: "tangmen_rest_bamboo",
        title: "外姓竹歇亭",
        desc: "通风良好的半封闭竹室，备有清茶和干净绷带。",
        choices: [
          {
            id: "tangmen_heal",
            label: "换药调息回气",
            success: { text: "换过洁净绷带，气血回升。", hpHealRatio: 0.35, exp: 1 },
          },
          {
            id: "tangmen_study",
            label: "观摩墙上千机图谱",
            success: { text: "琢磨机关连环原理，潜能增进。", hpHeal: 10, pot: 6, exp: 2 },
          },
        ],
      },
      {
        id: "tangmen_rest_tea",
        title: "解瘴药茶炉",
        desc: "炭炉上温着半壶甘草绿豆汤。",
        choices: [
          {
            id: "drink_tea",
            label: "连饮两碗解毒汤",
            success: { text: "腹中毒气散尽，恢复不少气血。", hpHealRatio: 0.3, pot: 2 },
          },
          {
            id: "calm_mind",
            label: "闭目养神听竹风",
            success: { text: "心神安定，气息更加凝练。", hpHeal: 14, exp: 3 },
          },
        ],
      },
    ],
    enemies: [
      {
        id: "tangmen_puppet_guard",
        name: "唐堡试毒弟子",
        role: "唐门守卫",
        region: "巴蜀",
        levelCap: 2,
        desc: "袖藏机簧短刃的试毒暗卫，出招阴柔刁钻。",
        carry: [{ name: "柳叶小刀", category: "weapon", quality: "绿" }],
        reward: { money: 34, exp: 4, pot: 3 },
      },
      {
        id: "tangmen_crossbow_warden",
        name: "千机暗弩卫",
        role: "千机护卫",
        region: "巴蜀",
        levelCap: 3,
        desc: "负责看守二层秘道的机关老手，手脚极快。",
        carry: [
          { name: "百花刺", category: "weapon", quality: "蓝" },
          { name: "守塔僧金疮药", category: "misc", quality: "绿" },
        ],
        reward: { money: 48, exp: 6, pot: 4 },
      },
    ],
    boss: {
      id: "tangmen_iron_master",
      name: "铁手暗器师",
      role: "唐门长老",
      region: "巴蜀",
      levelCap: 4,
      desc: "戴着精铁护手的暗阁总管事，半辈子与毒方暗弩打交道：「进了试毒阁，就按阁里的规矩算账。」",
      carry: [
        { name: "百花刺", category: "weapon", quality: "蓝" },
        { name: "百香纱衣", category: "armor", quality: "蓝" },
      ],
      reward: { money: 84, exp: 10, pot: 7, items: ["雪莲清毒丸"] },
    },
  },

  wuxian_centipede_den: {
    id: "wuxian_centipede_den",
    name: "赤蜈百蛊毒窟",
    district: "雾隐寨",
    innerRoom: "赤蜈毒窟",
    clearFlag: "dungeon_cleared_wuxian_centipede_den",
    subtitle: "吊脚楼地桩下方的天然溶洞，寒水渗赤，火药与五仙蛊虫气息交织。",
    floors: [
      { floor: 1, name: "一层 · 湿廊蛊阶", stepsPerFloor: 2, tier: 2, desc: "石壁湿滑泛红，阴暗石缝里偶尔闪过一双赤亮复眼。" },
      { floor: 2, name: "二层 · 铁木封印窟", stepsPerFloor: 2, tier: 3, desc: "洞中堆着贴唐门封条的铁木箱，硝烟味呛得人睁不开眼。" },
      { floor: 3, name: "三层 · 赤蜈母巢", stepsPerFloor: 2, tier: 4, desc: "赤红钟乳石柱环抱毒泉，窟主静候在蛊坛尽头。" },
    ],
    traps: [
      {
        id: "wuxian_trap_mire",
        title: "赤蜈酸水沼",
        desc: "溶洞积水泛着铁锈红泡，踩进去靴底立刻冒白烟。",
        choices: [
          {
            id: "leap_mire",
            label: "踏着突出水面钟乳石尖跃过",
            stat: "身法",
            dc: 6,
            success: { text: "如鹤点水连踏七石跳过毒沼，还在石根拾得一点散碎银两。", money: 24, exp: 3 },
            fail: { text: "落脚打滑溅到毒水，足踝辣痛。", hpLoss: 17, exp: 1 },
          },
          {
            id: "bridge_mire",
            label: "掀过铁木箱盖铺成稳固木桥",
            stat: "体魄",
            dc: 6,
            success: { text: "扛起沉重铁木板稳稳铺桥走过，从容不迫。", exp: 3, pot: 2 },
            fail: { text: "木板滑进水潭带起毒水溅面。", hpLoss: 16, exp: 1 },
          },
        ],
      },
      {
        id: "wuxian_trap_spores",
        title: "沉香迷障虫巢",
        desc: "顶壁吊着十几只干瘪蛊囊，受震便会扬出迷神粉末。",
        choices: [
          {
            id: "calm_spores",
            label: "以纯熟内力震散粉尘护住灵台",
            stat: "根骨",
            dc: 6,
            success: { text: "一口真气吐出冲开毒粉，顺便炼化了几分浊气。", pot: 4, exp: 2 },
            fail: { text: "吸进少许迷粉头重脚轻撞在岩壁上。", hpLoss: 16, exp: 1 },
          },
          {
            id: "route_spores",
            label: "绕走上风干燥岩脊",
            stat: "智谋",
            dc: 6,
            success: { text: "循着石壁凉风绕开所有虫囊，毫发无伤。", money: 20, exp: 3 },
            fail: { text: "暗脊尽头无路，折返时惊落虫囊。", hpLoss: 15, exp: 1 },
          },
        ],
      },
    ],
    events: [
      {
        id: "wuxian_event_crate",
        title: "贴封条的铁木箱",
        desc: "一只唐门旧铁木箱撬开半边，里头裹着油纸包与银票。",
        choices: [
          {
            id: "check_crate",
            label: "拆开油纸验明封存货",
            stat: "气运",
            dc: 6,
            success: { text: "竟是一盒品相极佳的守宫砂与十几两盘缠！", items: ["守宫砂"], money: 18, exp: 2 },
            fail: { text: "多半受潮化成了黑灰，只余下几锭银两。", money: 20, exp: 1 },
          },
          {
            id: "grab_crate_silver",
            label: "不碰油纸药粉，拿了银两就走",
            success: { text: "拿走二十六两现银，干净利索。", money: 26, exp: 1 },
          },
        ],
      },
      {
        id: "wuxian_event_incense",
        title: "圣母留下的百花香炉",
        desc: "石台上青烟袅袅，似乎能克制洞中赤蜈毒气。",
        choices: [
          {
            id: "breathe_incense",
            label: "俯身调息驱毒",
            success: { text: "芳香入肺，身上的湿毒酸痛顿消大半。", hpHeal: 20, pot: 2 },
          },
          {
            id: "search_incense_base",
            label: "拨看炉座暗格寻秘药",
            stat: "悟性",
            dc: 6,
            success: { text: "认出底座暗扣，取出一枚雪莲清毒丸。", items: ["雪莲清毒丸"], exp: 2 },
            fail: { text: "暗格空空如也，烫红了指腹。", hpLoss: 8, exp: 1 },
          },
        ],
      },
    ],
    treasures: [
      {
        id: "wuxian_treasure_mirror",
        title: "五仙古镜龛",
        desc: "溶洞石壁凿出的供龛里放着一面斑驳古铜镜和绸衣。",
        choices: [
          {
            id: "take_mirror",
            label: "细察镜后蛊印后再取走",
            stat: "悟性",
            dc: 6,
            success: { text: "破去镜背干涸毒蜡，收起紫品旧铜镜与碎银。", items: ["旧铜镜"], money: 22, exp: 3 },
            fail: { text: "指尖蹭到陈年毒蜡麻木一阵，抓了旁边绸衣退开。", hpLoss: 12, items: ["百花楼绸衣"] },
          },
          {
            id: "take_silk",
            label: "只取叠在一旁的干净绸衣",
            success: { text: "收起这件轻巧的百花楼绸衣。", items: ["百花楼绸衣"], money: 10 },
          },
        ],
      },
      {
        id: "wuxian_treasure_pouch",
        title: "百蛊药囊箱",
        desc: "漆黑藤箱上绕着五彩苗疆丝绳。",
        choices: [
          {
            id: "untie_pouch",
            label: "顺丝结规律解开藤箱",
            stat: "智谋",
            dc: 6,
            success: { text: "轻松解开死结，里面装着雪莲清毒丸与二十两银子。", items: ["雪莲清毒丸"], money: 20, exp: 2 },
            fail: { text: "扯紧了活扣，好在还有些零碎银角子。", hpLoss: 10, money: 24 },
          },
          {
            id: "grab_pouch_coin",
            label: "只取藤箱提手旁拴着的银袋",
            success: { text: "掂走银袋二十八两。", money: 28 },
          },
        ],
      },
    ],
    rests: [
      {
        id: "wuxian_rest_alcove",
        title: "干爽藤蔓岩台",
        desc: "高出地面丈余的干燥岩台，毒虫攀不上来。",
        choices: [
          {
            id: "wuxian_heal",
            label: "涂抹伤药歇脚回血",
            success: { text: "在干燥岩台喘过一口气，伤痛消退。", hpHealRatio: 0.35, exp: 1 },
          },
          {
            id: "wuxian_meditate",
            label: "借洞中阴凉凝练内息",
            success: { text: "行功一周天，觉出毒窟湿寒亦能磨心。", hpHeal: 12, pot: 6, exp: 2 },
          },
        ],
      },
    ],
    enemies: [
      {
        id: "wuxian_poison_guard",
        name: "赤蜈养蛊人",
        role: "五仙教众",
        region: "苗疆",
        levelCap: 2,
        desc: "腰挂竹筒苗刀的赤蜈护法，身法诡谲。",
        carry: [{ name: "柳叶小刀", category: "weapon", quality: "绿" }],
        reward: { money: 32, exp: 4, pot: 3 },
      },
      {
        id: "wuxian_warden",
        name: "百蛊毒窟护卫",
        role: "五仙精英",
        region: "苗疆",
        levelCap: 3,
        desc: "戴银铃面罩的高手，招招透着腥风。",
        carry: [
          { name: "百花刺", category: "weapon", quality: "蓝" },
          { name: "雪莲清毒丸", category: "misc", quality: "蓝" },
        ],
        reward: { money: 46, exp: 6, pot: 4 },
      },
    ],
    boss: {
      id: "wuxian_centipede_boss",
      name: "赤蜈蛊主",
      role: "五仙窟主",
      region: "苗疆",
      levelCap: 4,
      desc: "盘踞毒窟深处的神秘长老，银铃轻响间煞气逼人：「踏进赤蜈母巢，便把一身修为留下试试。」",
      carry: [
        { name: "百花刺", category: "weapon", quality: "蓝" },
        { name: "旧铜镜", category: "accessory", quality: "紫" },
      ],
      reward: { money: 85, exp: 10, pot: 7, items: ["守宫砂"] },
    },
  },

  tianlong_serpent_crypt: {
    id: "tianlong_serpent_crypt",
    name: "摩呼罗迦蛇窟",
    district: "天龙营",
    innerRoom: "摩呼罗迦蛇窟",
    clearFlag: "dungeon_cleared_tianlong_serpent_crypt",
    subtitle: "沙坡下垂着蟒皮帘的西域秘窟，陶瓮成列，天龙八部护法潜修其中。",
    floors: [
      { floor: 1, name: "一层 · 蟒帘沙窟", stepsPerFloor: 2, tier: 2, desc: "风沙止于帘外，窟内阴凉干爽，陶瓮盖下沙沙作响。" },
      { floor: 2, name: "二层 · 护法沙道", stepsPerFloor: 2, tier: 3, desc: "火把照出玄铁经轮与密宗护法雕像，杀意潜伏。" },
      { floor: 3, name: "三层 · 大蟒石坛", stepsPerFloor: 2, tier: 4, desc: "黑石坛上盘坐着摩呼罗迦护法，铜铃无风自响。" },
    ],
    traps: [
      {
        id: "tianlong_trap_jars",
        title: "乌鞘蛇陶瓮阵",
        desc: "十余口盖着木板的陶瓮堵在窄道，碰翻一个便会惊动满地冷蛇。",
        choices: [
          {
            id: "tiptoe_jars",
            label: "敛息踏沙悄然穿行",
            stat: "身法",
            dc: 6,
            success: { text: "足底如絮落沙面，木板纹丝未动地走过陶瓮阵。", money: 22, exp: 3 },
            fail: { text: "鞋尖扫倒木板，小腿挨了一口好在不算深。", hpLoss: 17, exp: 1 },
          },
          {
            id: "scent_jars",
            label: "撒火镰硫粉逼退瓮内冷蛇",
            stat: "智谋",
            dc: 6,
            success: { text: "硫粉味一出，陶瓮里沙沙退声四起，平安过阵。", exp: 3, pot: 3 },
            fail: { text: "风向倒吹散了硫粉，挨了一口狠扑。", hpLoss: 16, exp: 1 },
          },
        ],
      },
      {
        id: "tianlong_trap_wheel",
        title: "西域转轮刀壁",
        desc: "石墙嵌入三面锯齿弯刀轮，踏中暗砖即刻高速旋出。",
        choices: [
          {
            id: "block_wheel",
            label: "迎着刀背震断石枢",
            stat: "体魄",
            dc: 7,
            success: { text: "一记重拳砸裂石枢，弯刀轮咔嚓卡死。", items: ["西域弯刀"], exp: 3 },
            fail: { text: "刀风削破臂甲，受了皮肉伤。", hpLoss: 19, exp: 1 },
          },
          {
            id: "duck_wheel",
            label: "贴地急伏从刀轮下方滑出",
            stat: "身法",
            dc: 6,
            success: { text: "贴着黄沙滑出十余尺，冷风擦发而过。", money: 25, exp: 3 },
            fail: { text: "肩甲挂住刀齿，拽裂衣袍失了气血。", hpLoss: 16, exp: 1 },
          },
        ],
      },
    ],
    events: [
      {
        id: "tianlong_event_tinder",
        title: "西域行营遗物袋",
        desc: "石柱下挂着一只旧骆驼皮囊，缝线细密。",
        choices: [
          {
            id: "search_tinder",
            label: "细细翻检皮囊夹层",
            stat: "气运",
            dc: 6,
            success: { text: "翻出一枚磨损的藏银火镰和一袋银两。", items: ["磨损藏银火镰"], money: 20, exp: 2 },
            fail: { text: "只有些许干燥干粮渣和零散碎银。", money: 18, exp: 1 },
          },
          {
            id: "take_camel_silver",
            label: "取走外袋沉甸甸的钱囊",
            success: { text: "收起二十八两驼队盘缠。", money: 28, exp: 1 },
          },
        ],
      },
      {
        id: "tianlong_event_sutra",
        title: "密宗壁画残偈",
        desc: "石壁绘着降龙伏蛇之势，笔锋凌厉刚猛。",
        choices: [
          {
            id: "study_sutra",
            label: "对照壁画演练拳架",
            stat: "悟性",
            dc: 6,
            success: { text: "体悟西域猛烈劲道，武学潜能大增。", pot: 7, exp: 3 },
            fail: { text: "领会了一点皮毛招势。", pot: 3, exp: 1 },
          },
          {
            id: "rest_sutra",
            label: "坐在壁前静心吐纳",
            success: { text: "收摄心神，气血平顺不少。", hpHeal: 18, exp: 1 },
          },
        ],
      },
    ],
    treasures: [
      {
        id: "tianlong_treasure_mirror",
        title: "玄甲兵备匣",
        desc: "天龙军需遗留的铜锁铁箱，沉重异常。",
        choices: [
          {
            id: "open_armor_box",
            label: "硬劈铁锁开箱",
            stat: "体魄",
            dc: 6,
            success: { text: "劈开铁锁，里面护垫上躺着一面玄甲护心镜！", items: ["玄甲护心镜"], exp: 3 },
            fail: { text: "震伤手腕才掀开箱角，捞出二十两银锭。", hpLoss: 13, money: 22 },
          },
          {
            id: "take_armor_coin",
            label: "收起箱顶压着的银袋与火药银",
            success: { text: "稳稳拿走三十二两军饷。", money: 32 },
          },
        ],
      },
      {
        id: "tianlong_treasure_vajra",
        title: "大蟒石坛暗龛",
        desc: "石坛侧壁嵌着一柄金铜交错的短杵。",
        choices: [
          {
            id: "take_vajra",
            label: "默念口诀旋出石龛机关",
            stat: "悟性",
            dc: 7,
            success: { text: "石龛滑开，请出一柄上乘梵铃杵！", items: ["梵铃杵"], exp: 4 },
            fail: { text: "暗龛卡死，只抽出一柄旧弯刀。", hpLoss: 12, items: ["西域弯刀"] },
          },
          {
            id: "take_tinder_loot",
            label: "顺走坛旁供奉的银两与弯刀",
            success: { text: "拾得西域弯刀与银两。", items: ["西域弯刀"], money: 16 },
          },
        ],
      },
    ],
    rests: [
      {
        id: "tianlong_rest_tent",
        title: "驼毡避沙龛",
        desc: "挂着厚驼毡的干燥岩洞，备着干肉与伤药。",
        choices: [
          {
            id: "tianlong_heal",
            label: "烤火裹伤休整",
            success: { text: "暖气透入四肢，气血恢复明显。", hpHealRatio: 0.35, exp: 1 },
          },
          {
            id: "tianlong_train",
            label: "打磨筋骨调息",
            success: { text: "静坐行气，潜能增进。", hpHeal: 12, pot: 6, exp: 2 },
          },
        ],
      },
    ],
    enemies: [
      {
        id: "tianlong_sentry",
        name: "天龙暗窟武士",
        role: "天龙卫士",
        region: "西域",
        levelCap: 2,
        desc: "腰佩弯刀的西域护卫，招法凶悍。",
        carry: [{ name: "西域弯刀", category: "weapon", quality: "绿" }],
        reward: { money: 35, exp: 4, pot: 3 },
      },
      {
        id: "tianlong_elite",
        name: "蛇窟护法僧",
        role: "天龙护法",
        region: "西域",
        levelCap: 3,
        desc: "精通西域刚猛拳脚的护法武者，气势迫人。",
        carry: [
          { name: "梵铃杵", category: "weapon", quality: "紫" },
          { name: "磨损藏银火镰", category: "accessory", quality: "紫" },
        ],
        reward: { money: 50, exp: 6, pot: 4 },
      },
    ],
    boss: {
      id: "tianlong_serpent_boss",
      name: "摩呼罗迦护法",
      role: "八部护法",
      region: "西域",
      levelCap: 4,
      desc: "坐镇蛇窟尽头的天龙八部护法，双掌如铁：「外客能闯到这里，倒有资格接我一掌。」",
      carry: [
        { name: "梵铃杵", category: "weapon", quality: "紫" },
        { name: "玄甲护心镜", category: "armor", quality: "紫" },
      ],
      reward: { money: 92, exp: 10, pot: 8, items: ["磨损藏银火镰"] },
    },
  },

  gongcuo_submerged_vault: {
    id: "gongcuo_submerged_vault",
    name: "贡措湖底密室",
    district: "贡措海",
    innerRoom: "贡措海密室",
    clearFlag: "dungeon_cleared_gongcuo_submerged_vault",
    subtitle: "冰封湖畔墓碑后方的水底石室，寒气刺骨，藏着前辈剑修遗物与雪域奇珍。",
    floors: [
      { floor: 1, name: "一层 · 冰砌石阶", stepsPerFloor: 2, tier: 2, desc: "石阶结着厚霜，一步踩稳才不至于滑进寒渊。" },
      { floor: 2, name: "二层 · 剑意寒潭廊", stepsPerFloor: 2, tier: 3, desc: "墙面到处是当年强绝剑意劈出的深槽，寒风如刀。" },
      { floor: 3, name: "三层 · 霜剑遗冢", stepsPerFloor: 2, tier: 4, desc: "冰晶倒悬的尽头，沉剑守陵人抱剑而立。" },
    ],
    traps: [
      {
        id: "gongcuo_trap_ice",
        title: "寒渊冰棱裂道",
        desc: "拱顶悬着一排锋利冰锥，脚步重一分便成片坠落。",
        choices: [
          {
            id: "glide_ice",
            label: "足不点尘轻滑过冰道",
            stat: "身法",
            dc: 6,
            success: { text: "如雪鹤掠冰穿过寒道，顺手拾走冰缝里的雪莲。", items: ["寒泉雪莲"], exp: 3 },
            fail: { text: "冰锥砸中肩头，寒气透骨损耗气血。", hpLoss: 18, exp: 1 },
          },
          {
            id: "shatter_ice",
            label: "运震劲先震落头顶冰锥再走",
            stat: "根骨",
            dc: 6,
            success: { text: "一声长啸震塌所有危冰，坦然踏过碎冰层。", exp: 3, pot: 3 },
            fail: { text: "寒气反冲经脉，气血微微翻涌。", hpLoss: 15, exp: 1 },
          },
        ],
      },
      {
        id: "gongcuo_trap_frost",
        title: "湖底寒煞风眼",
        desc: "两道水闸之间吹出割面的冰风，连护腕都结起白霜。",
        choices: [
          {
            id: "resist_frost",
            label: "催动内息抵住寒煞硬行",
            stat: "根骨",
            dc: 7,
            success: { text: "内力运转如沸，寒煞不仅没伤到你，反倒锤炼了内功。", pot: 5, exp: 3 },
            fail: { text: "手足僵麻被冰风掀翻。", hpLoss: 19, exp: 1 },
          },
          {
            id: "seal_sluice",
            label: "推上生锈铁闸挡住风口",
            stat: "体魄",
            dc: 6,
            success: { text: "卡住水闸挡住寒风，还在闸边找到一袋旧银。", money: 28, exp: 2 },
            fail: { text: "铁闸冻得纹丝不动，挨了半程冰风。", hpLoss: 16, exp: 1 },
          },
        ],
      },
    ],
    events: [
      {
        id: "gongcuo_event_swordwall",
        title: "前辈残剑刻壁",
        desc: "半截剑痕横贯整面冰壁，细看仍有凌厉破空之势。",
        choices: [
          {
            id: "comprehend_sword",
            label: "凝神观摩半刻参悟剑理",
            stat: "悟性",
            dc: 6,
            success: { text: "剑气如在眼前，武学潜能陡升。", pot: 8, exp: 3 },
            fail: { text: "寒气太重未能专注，只记下零星几笔。", pot: 3, exp: 1 },
          },
          {
            id: "search_wall_base",
            label: "检查壁下前人遗留的行囊",
            success: { text: "包里还有两株保存完好的寒泉雪莲。", items: ["寒泉雪莲"], money: 14 },
          },
        ],
      },
      {
        id: "gongcuo_event_crystal",
        title: "冰层中的寒玉龛",
        desc: "千年坚冰里冻着一枚隐泛蓝光的寒器。",
        choices: [
          {
            id: "melt_crystal",
            label: "以内力缓溶外冰取出奇珍",
            stat: "气运",
            dc: 7,
            success: { text: "坚冰应掌融开，居然藏着一件极品的贡措冰晶！", items: ["贡措冰晶"], exp: 4 },
            fail: { text: "冰裂太急震伤手指，只拾到一把松纹旧剑。", hpLoss: 12, items: ["雪山松纹剑"] },
          },
          {
            id: "leave_crystal",
            label: "不耗内力破冰，带走外龛银两",
            success: { text: "拿走冰龛外供着的银两。", money: 30 },
          },
        ],
      },
    ],
    treasures: [
      {
        id: "gongcuo_treasure_chest",
        title: "雪域剑匣",
        desc: "冷玉打磨的剑匣，上头覆着一层不化寒霜。",
        choices: [
          {
            id: "open_jade_chest",
            label: "顺纹路开启寒玉锁",
            stat: "智谋",
            dc: 6,
            success: { text: "盒盖无声弹起，里头卧着一柄寒光凛冽的「断念」。", items: ["断念"], exp: 4 },
            fail: { text: "寒气冻指撬偏，取出一柄雪山松纹剑作罢。", hpLoss: 12, items: ["雪山松纹剑"] },
          },
          {
            id: "take_feather",
            label: "取走匣盖旁压着的雪鸮翎配饰",
            success: { text: "收起珍贵的雪鸮翎与碎银。", items: ["雪鸮翎"], money: 18 },
          },
        ],
      },
      {
        id: "gongcuo_treasure_lotus",
        title: "寒泉玉瓶架",
        desc: "石架上摆着几个白玉瓷瓶，封蜡未开。",
        choices: [
          {
            id: "check_lotus_pill",
            label: "细辨瓶签寻出压箱秘药",
            stat: "气运",
            dc: 7,
            success: { text: "竟摸出一枚稀世奇药「千年雪莲回天丹」！", items: ["千年雪莲回天丹"], exp: 3 },
            fail: { text: "拿出一瓶寒泉雪莲与一包药膏。", items: ["熊山活血药膏"], money: 15 },
          },
          {
            id: "take_safe_ointment",
            label: "稳稳拿走贴着外伤标签的活血药膏",
            success: { text: "带走一盒紫品熊山活血药膏。", items: ["熊山活血药膏"], money: 12 },
          },
        ],
      },
    ],
    rests: [
      {
        id: "gongcuo_rest_cave",
        title: "背风地热冰窟",
        desc: "密室一角恰巧透出地底温气，水汽如雾。",
        choices: [
          {
            id: "gongcuo_heal",
            label: "借温气活血疗伤",
            success: { text: "寒气逐出体外，气血回复。", hpHealRatio: 0.35, exp: 1 },
          },
          {
            id: "gongcuo_meditate",
            label: "在冰火交界处吐纳参悟",
            success: { text: "一冷一热之间内息自成周天。", hpHeal: 12, pot: 7, exp: 2 },
          },
        ],
      },
    ],
    enemies: [
      {
        id: "gongcuo_frost_guard",
        name: "雪山巡墓弟子",
        role: "护陵武者",
        region: "雪域",
        levelCap: 2,
        desc: "披白裘执剑的雪山守墓客，剑势森冷。",
        carry: [{ name: "雪山松纹剑", category: "weapon", quality: "蓝" }],
        reward: { money: 34, exp: 4, pot: 3 },
      },
      {
        id: "gongcuo_blade_warden",
        name: "寒渊剑卫",
        role: "古墓剑卫",
        region: "雪域",
        levelCap: 3,
        desc: "长年潜修于冰湖底的隐世剑客，出剑快如闪电。",
        carry: [
          { name: "断念", category: "weapon", quality: "紫" },
          { name: "寒泉雪莲", category: "misc", quality: "绿" },
        ],
        reward: { money: 52, exp: 6, pot: 5 },
      },
    ],
    boss: {
      id: "gongcuo_vault_boss",
      name: "沉剑守陵人",
      role: "遗冢宗师",
      region: "雪域",
      levelCap: 4,
      desc: "守护贡措海密室的沉默剑客，腰间双剑如冰凝：「既敢踏进寒泉剑冢，便接这一式沉剑。」",
      carry: [
        { name: "断念", category: "weapon", quality: "紫" },
        { name: "贡措冰晶", category: "weapon", quality: "紫" },
      ],
      reward: { money: 96, exp: 11, pot: 8, items: ["雪鸮翎"] },
    },
  },

  jingguan_iron_dungeon: {
    id: "jingguan_iron_dungeon",
    name: "北衙铁栅暗牢",
    district: "锦官城",
    innerRoom: "北衙地底·铁栅暗牢",
    clearFlag: "dungeon_cleared_jingguan_iron_dungeon",
    subtitle: "都事府营房地底盘旋十二级的青砖死牢，玄铁栏外油灯摇曳，铁镣铿然。",
    floors: [
      { floor: 1, name: "一层 · 刑名值廊", stepsPerFloor: 2, tier: 1, desc: "油灯味混着铁锈，值房钥匙架和铁链挂满青砖墙。" },
      { floor: 2, name: "二层 · 玄铁死囚道", stepsPerFloor: 2, tier: 2, desc: "三道沉重铁栅门依次隔开囚室，暗道机关藏在门枢后。" },
      { floor: 3, name: "三层 · 审讯深室", stepsPerFloor: 2, tier: 3, desc: "铁面牢头守在最深处的卷宗铁柜前。" },
    ],
    traps: [
      {
        id: "jingguan_trap_gate",
        title: "玄铁断龙栅",
        desc: "锈迹斑斑的铁栅门机括被扯动，千斤铁闸轰然下坠。",
        choices: [
          {
            id: "roll_gate",
            label: "趁门底空隙滑身冲过",
            stat: "身法",
            dc: 5,
            success: { text: "贴地抢先半瞬穿门而过，从值桌摸走一串银两。", money: 20, exp: 2 },
            fail: { text: "靴跟被铁栅压住，费力扯出时脚踝磨破。", hpLoss: 14, exp: 1 },
          },
          {
            id: "jam_gate",
            label: "拉断侧面平衡铁链",
            stat: "体魄",
            dc: 5,
            success: { text: "猛扯铁索卡死滑轮，铁闸悬停在头顶。", exp: 2, pot: 2 },
            fail: { text: "铁索崩断反抽在肩上，隐隐作痛。", hpLoss: 15, exp: 1 },
          },
        ],
      },
      {
        id: "jingguan_trap_caltrops",
        title: "暗角铁蒺藜阵",
        desc: "转角暗影撒了一地淬油铁蒺藜，借着昏暗油灯极难看清。",
        choices: [
          {
            id: "spot_caltrops",
            label: "提灯照地辨清落脚石缝",
            stat: "智谋",
            dc: 5,
            success: { text: "逐一避开铁刺，还顺手摸走墙角的算盘暗器。", items: ["金珠算盘"], exp: 2 },
            fail: { text: "昏暗里踩中两枚倒刺，扯出一身冷汗。", hpLoss: 13, exp: 1 },
          },
          {
            id: "sweep_caltrops",
            label: "甩袍兜风扫清前路",
            stat: "身法",
            dc: 5,
            success: { text: "袖风一卷将铁刺悉数扫进排水沟。", money: 16, exp: 2 },
            fail: { text: "几枚铁刺弹回擦破小腿。", hpLoss: 12, exp: 1 },
          },
        ],
      },
    ],
    events: [
      {
        id: "jingguan_event_ledger",
        title: "罚没物证簿",
        desc: "铁桌上摊着半本未封存的罚没登记册，旁边压着一袋碎银。",
        choices: [
          {
            id: "read_ledger",
            label: "翻看密押暗号查明暗柜位置",
            stat: "智谋",
            dc: 5,
            success: { text: "破译页边暗记打开铁柜，取得锦官制式软甲与银两。", items: ["锦官制式软甲"], money: 16, exp: 2 },
            fail: { text: "账簿少了一页，只拿了桌上的碎银。", money: 18, exp: 1 },
          },
          {
            id: "grab_evidence_silver",
            label: "直接收起桌角封存袋银两",
            success: { text: "拿到二十四两纹银。", money: 24, exp: 1 },
          },
        ],
      },
      {
        id: "jingguan_event_prisoner",
        title: "墙缝旧纸条",
        desc: "死囚室铁栏砖缝里塞着昔年江洋大盗留下的越狱简图。",
        choices: [
          {
            id: "study_escape_map",
            label: "默记换气口与轻身路线",
            success: { text: "对暗牢结构了然于胸，涨了不少江湖见识。", exp: 3, pot: 3 },
          },
          {
            id: "dig_brick",
            label: "抠开砖缝看里面藏了什么",
            stat: "气运",
            dc: 6,
            success: { text: "砖后竟藏着一柄擦得雪亮的血槽铁刀！", items: ["血槽铁刀"], exp: 2 },
            fail: { text: "砖后只剩半块霉饼和几枚铜钱。", money: 12, exp: 1 },
          },
        ],
      },
    ],
    treasures: [
      {
        id: "jingguan_treasure_cabinet",
        title: "兵备罚没铁柜",
        desc: "上着官府铜锁的铁皮柜，门缝透着油布味。",
        choices: [
          {
            id: "pick_cabinet",
            label: "用铁丝探入铜锁拨开锁舌",
            stat: "身法",
            dc: 6,
            success: { text: "锁舌弹开，柜中存着一件察世青布短打与银两。", items: ["察世青布短打"], money: 20, exp: 2 },
            fail: { text: "锁芯卡断，干脆顺走柜旁的制式软甲。", items: ["锦官制式软甲"], hpLoss: 8 },
          },
          {
            id: "take_cabinet_cash",
            label: "只收走账房抽屉里的零碎银钱",
            success: { text: "抽屉里共有二十八两散银。", money: 28 },
          },
        ],
      },
    ],
    rests: [
      {
        id: "jingguan_rest_guardroom",
        title: "无人值房茶桌",
        desc: "巡夜差役换班空出的值房，桌上放着热茶和跌打膏。",
        choices: [
          {
            id: "jingguan_heal",
            label: "趁空当擦药喝茶回气",
            success: { text: "歇息片刻，体力恢复不少。", hpHealRatio: 0.35, exp: 1 },
          },
          {
            id: "jingguan_meditate",
            label: "闭目回味一路拆招经验",
            success: { text: "整理思路，收获些许潜能。", hpHeal: 12, pot: 5, exp: 2 },
          },
        ],
      },
    ],
    enemies: [
      {
        id: "jingguan_jailer",
        name: "北衙看牢差役",
        role: "官府差役",
        region: "巴蜀",
        levelCap: 1,
        desc: "提着铁尺巡牢的差役，下手毫不留情。",
        carry: [{ name: "铁算盘尺", category: "weapon", quality: "蓝" }],
        reward: { money: 24, exp: 3, pot: 2 },
      },
      {
        id: "jingguan_captain",
        name: "铁牢巡检卫",
        role: "精锐巡检",
        region: "巴蜀",
        levelCap: 2,
        desc: "披制式软甲的营房好手，刀法稳重。",
        carry: [
          { name: "血槽铁刀", category: "weapon", quality: "蓝" },
          { name: "守塔僧金疮药", category: "misc", quality: "绿" },
        ],
        reward: { money: 36, exp: 5, pot: 3 },
      },
    ],
    boss: {
      id: "jingguan_iron_warden",
      name: "铁面牢头",
      role: "暗牢总管",
      region: "巴蜀",
      levelCap: 3,
      desc: "执掌北衙暗牢钥匙的黑脸汉子，刀鞘上缠着玄铁链：「敢闯官府死牢，先把命押下！」",
      carry: [
        { name: "血槽铁刀", category: "weapon", quality: "蓝" },
        { name: "锦官制式软甲", category: "armor", quality: "蓝" },
      ],
      reward: { money: 72, exp: 8, pot: 6, items: ["金珠算盘"] },
    },
  },

  heifeng_wolf_cavern: {
    id: "heifeng_wolf_cavern",
    name: "狼曲旧契藏窟",
    district: "黑风寨",
    innerRoom: "狼曲暗道·旧契藏窟",
    clearFlag: "dungeon_cleared_heifeng_wolf_cavern",
    subtitle: "寨后岩洞柴垛下的夹缝密道，藏着十年前血账与悬崖逃生秘窟。",
    floors: [
      { floor: 1, name: "一层 · 柴垛密道", stepsPerFloor: 2, tier: 1, desc: "松动青石板下风声呜咽，洞壁插着熏黑的松明火把。" },
      { floor: 2, name: "二层 · 血账石窟", stepsPerFloor: 2, tier: 2, desc: "成捆麻绳吊着防潮油包，黑风寨暗桩在岔口游走。" },
      { floor: 3, name: "三层 · 悬崖暗栈", stepsPerFloor: 2, tier: 3, desc: "洞窟尽头直临狼曲绝崖，风声如吼。" },
    ],
    traps: [
      {
        id: "heifeng_trap_snare",
        title: "山寨捕兽铁夹",
        desc: "枯草与碎石下埋着黑风寨猎户自制的锯齿铁夹。",
        choices: [
          {
            id: "probe_snare",
            label: "用短棍探路挑开铁夹",
            stat: "智谋",
            dc: 5,
            success: { text: "啪啪两声提前弹废铁夹，从夹旁枯骨袋摸出散银。", money: 20, exp: 2 },
            fail: { text: "漏过一只隐蔽副夹，靴底被咬出两道血口。", hpLoss: 14, exp: 1 },
          },
          {
            id: "leap_snare",
            label: "借壁岩落脚腾跃过去",
            stat: "身法",
            dc: 5,
            success: { text: "身形矫健掠过陷阱带。", exp: 3, pot: 2 },
            fail: { text: "岩面湿苔打滑，摔在碎石堆擦伤手肘。", hpLoss: 13, exp: 1 },
          },
        ],
      },
      {
        id: "heifeng_trap_rockslide",
        title: "崖道滚石索",
        desc: "崖边拉着一根拌马索，牵动就会塌下一堆碎砾。",
        choices: [
          {
            id: "cut_rope",
            label: "看清绳索走向轻轻跨过",
            stat: "悟性",
            dc: 5,
            success: { text: "认出山寨警戒绳结，未触机关稳步通过。", money: 16, exp: 2 },
            fail: { text: "石壁滚下一块砾石砸中肩胛。", hpLoss: 15, exp: 1 },
          },
          {
            id: "tank_rocks",
            label: "撑臂护头硬冲过去",
            stat: "体魄",
            dc: 5,
            success: { text: "顶着零星碎石冲出滚石带，反倒捡了把好匕首。", items: ["狼骨匕"], exp: 2 },
            fail: { text: "乱石滚落砸伤腿脚。", hpLoss: 16, exp: 1 },
          },
        ],
      },
    ],
    events: [
      {
        id: "heifeng_event_ledger",
        title: "油布包着的旧账册",
        desc: "石缝里塞着一捆涂蜡油布，里面记着狼曲水路的往来账目。",
        choices: [
          {
            id: "read_blood_ledger",
            label: "翻看账册夹带的藏货清单",
            stat: "智谋",
            dc: 5,
            success: { text: "按图索骥翻出隐秘石洞里的狼裘与盘缠。", items: ["狼裘大氅"], money: 18, exp: 2 },
            fail: { text: "清单已被水渍泡糊，只收走几两银钱。", money: 18, exp: 1 },
          },
          {
            id: "take_ledger_coin",
            label: "拿走油布旁塞着的私房银",
            success: { text: "顺手得银二十二两。", money: 22, exp: 1 },
          },
        ],
      },
      {
        id: "heifeng_event_campfire",
        title: "熄了一半的猎户火堆",
        desc: "洞口余温犹存，架上挂着半块风干肉和伤药。",
        choices: [
          {
            id: "eat_camp",
            label: "歇脚吃些干粮裹伤",
            success: { text: "吃饱喝足，气力恢复不少。", hpHeal: 22, exp: 1 },
          },
          {
            id: "loot_camp",
            label: "翻看火堆旁的皮囊",
            success: { text: "捡到一把顺手的黑风断刃和几枚铜钱。", items: ["黑风断刃"], money: 10 },
          },
        ],
      },
    ],
    treasures: [
      {
        id: "heifeng_treasure_fur",
        title: "劫掠皮货箱",
        desc: "山寨抢来的货箱，上面压着厚实兽皮与银钱。",
        choices: [
          {
            id: "open_fur_box",
            label: "撬开铁扣整箱查验",
            stat: "体魄",
            dc: 6,
            success: { text: "撬开铁扣，挑走一件上乘狼裘大氅与银两。", items: ["狼裘大氅"], money: 22, exp: 2 },
            fail: { text: "扭断木栓震伤手指，拿到一件熊皮坎肩。", items: ["熊皮坎肩"], hpLoss: 10 },
          },
          {
            id: "take_vest",
            label: "顺走最上面那件熊皮坎肩和碎银",
            success: { text: "收起熊皮坎肩与二十两银子。", items: ["熊皮坎肩"], money: 20 },
          },
        ],
      },
    ],
    rests: [
      {
        id: "heifeng_rest_cliff",
        title: "崖风避石龛",
        desc: "能俯瞰狼曲河谷的石龛，空气清新干燥。",
        choices: [
          {
            id: "heifeng_heal",
            label: "吹风歇息包扎",
            success: { text: "精神抖擞，血气回转。", hpHealRatio: 0.35, exp: 1 },
          },
          {
            id: "heifeng_meditate",
            label: "观谷底风势体悟刀意",
            success: { text: "听风演势，潜能有所增长。", hpHeal: 12, pot: 5, exp: 2 },
          },
        ],
      },
    ],
    enemies: [
      {
        id: "heifeng_bandit",
        name: "黑风暗哨",
        role: "山寨好汉",
        region: "藏边",
        levelCap: 1,
        desc: "守在密道岔口的黑风汉子，出手狠辣。",
        carry: [{ name: "黑风断刃", category: "weapon", quality: "绿" }],
        reward: { money: 24, exp: 3, pot: 2 },
      },
      {
        id: "heifeng_raider",
        name: "黑风护窟头目",
        role: "山寨头目",
        region: "藏边",
        levelCap: 2,
        desc: "披着狼皮坎肩的寨中头领，刀刀拼命。",
        carry: [
          { name: "狼骨匕", category: "weapon", quality: "绿" },
          { name: "熊皮坎肩", category: "armor", quality: "绿" },
        ],
        reward: { money: 36, exp: 5, pot: 3 },
      },
    ],
    boss: {
      id: "heifeng_third_chief",
      name: "黑风三当家",
      role: "黑风寨头领",
      region: "藏边",
      levelCap: 3,
      desc: "独守旧契藏窟的黑风三当家，提着厚背断刀冷笑：「这窖里的账本和银子，可不是外人拿得动的！」",
      carry: [
        { name: "黑风断刃", category: "weapon", quality: "绿" },
        { name: "狼裘大氅", category: "armor", quality: "蓝" },
      ],
      reward: { money: 74, exp: 8, pot: 6, items: ["霜牙"] },
    },
  },
});
