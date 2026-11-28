// 其余七座地宫静态配置（与白塔地宫合计八大地宫，掉落物均来自 CATALOG_INDEX）。

export const DUNGEON_CATALOG_EXTRA = Object.freeze({
  sanxing_bronze_abyss: {
    id: "sanxing_bronze_abyss",
    name: "归墟青铜宫",
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


  wuxian_centipede_den: {
    id: "wuxian_centipede_den",
    name: "五仙百毒禁谷",
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




  dacaodian_duanan_post: {
    id: "dacaodian_duanan_post",
    name: "断鞍古驿",
    district: "大草甸",
    innerRoom: "断鞍古驿",
    clearFlag: "dungeon_cleared_dacaodian_duanan_post",
    subtitle: "荒草甸东头坍塌半边的军马旧驿，底下窖洞直通各派劫匪火拼的藏货大堂。",
    floors: [
      { floor: 1, name: "一层 · 枯草外棚", stepsPerFloor: 2, tier: 2, desc: "断鞍马桩半埋草堆里，天龙与黑风探子在墙缝游走。" },
      { floor: 2, name: "二层 · 暗槽运粮道", stepsPerFloor: 2, tier: 2, desc: "石槽交错的运粮通道留着刀痕与旧镖包。" },
      { floor: 3, name: "三层 · 聚义马厩大堂", stepsPerFloor: 2, tier: 3, desc: "血刀头目厉骨踩在断鞍上守着西域镖银。" },
    ],
    traps: [
      {
        id: "duanan_trap_snare",
        title: "枯草绊马伏索",
        desc: "焦枯草堆里拉着一道铁丝伏索，连向壁间短弩。",
        choices: [
          { id: "leap_snare", label: "踏墙纵跃掠过", stat: "身法", dc: 6, success: { text: "借壁跃过索线拾得散银。", money: 22, exp: 3 }, fail: { text: "绊中伏索受了箭擦伤。", hpLoss: 16, exp: 1 } },
          { id: "cut_snare", label: "顺索路挑断机括", stat: "智谋", dc: 6, success: { text: "精准拆去机簧取出伤药。", items: ["守塔僧金疮药"], exp: 3 }, fail: { text: "拆偏一步刮破指掌。", hpLoss: 14, exp: 1 } },
        ],
      },
    ],
    events: [
      {
        id: "duanan_event_pack",
        title: "废马槽下的皮行囊",
        desc: "一只沾血牛皮包袱卡在石槽夹角。",
        choices: [
          { id: "open_pack", label: "挑破外扣清点物件", stat: "气运", dc: 6, success: { text: "翻出一件厚实熊皮坎肩和碎银。", items: ["熊皮坎肩"], money: 18, exp: 2 }, fail: { text: "只找到十余两散碎银角。", money: 18, exp: 1 } },
          { id: "take_coin", label: "收起外袋碎银快走", success: { text: "收银二十二两稳妥上路。", money: 22, exp: 1 } },
        ],
      },
    ],
    treasures: [
      {
        id: "duanan_treasure_box",
        title: "封蜡军饷木匣",
        desc: "马夫灶后暗格里压着带铜扣的货箱。",
        choices: [
          { id: "open_box", label: "细拨铜扣开匣", stat: "智谋", dc: 6, success: { text: "取出完好的血槽铁刀与二十余两纹银。", items: ["血槽铁刀"], money: 24, exp: 3 }, fail: { text: "硬撬震痛手腕，抱出狼骨匕首。", items: ["狼骨匕"], hpLoss: 10 } },
          { id: "take_outer", label: "取走匣外压着的活血丸", success: { text: "拿走藏红花活血丸与散银。", items: ["藏红花活血丸"], money: 14 } },
        ],
      },
    ],
    rests: [
      {
        id: "duanan_rest_hearth",
        title: "暖炕马夫宿室",
        desc: "避风的旧宿室还留着半堆暖炭与清水囊。",
        choices: [
          { id: "heal", label: "烤火敷伤回气", success: { text: "暖气透入肺腑，气血回升。", hpHealRatio: 0.35, exp: 1 } },
          { id: "train", label: "静坐调息整甲", success: { text: "整理思路增进些许潜能。", hpHeal: 12, pot: 6, exp: 2 } },
        ],
      },
    ],
    enemies: [
      { id: "duanan_cat_scout", name: "血刀巡坡徒", role: "血刀门徒", region: "藏边", levelCap: 2, desc: "荒原马棚里抢先摸包的血刀恶匪。", carry: [{ name: "黑风断刃", category: "weapon", quality: "绿" }], reward: { money: 32, exp: 4, pot: 3 } },
      { id: "duanan_cat_bandit", name: "黑风断刀手", role: "山寨打手", region: "藏边", levelCap: 3, desc: "身披兽皮擅挥重刃的黑风匪徒。", carry: [{ name: "狼裘大氅", category: "armor", quality: "蓝" }, { name: "守塔僧金疮药", category: "misc", quality: "绿" }], reward: { money: 46, exp: 6, pot: 4 } },
    ],
    boss: {
      id: "duanan_cat_boss",
      name: "血刀截货头目·厉骨",
      role: "血刀头目",
      region: "藏边",
      levelCap: 3,
      desc: "拎着血刀守着西域镖银箱的悍匪：「能过这一关再谈分货。」",
      carry: [{ name: "血刀·不饮", category: "weapon", quality: "蓝" }, { name: "黑风寨牛皮重铠", category: "armor", quality: "紫" }],
      reward: { money: 90, exp: 10, pot: 8, items: ["雪莲清毒丸"] },
    },
  },

  yajiang_chensha_dock: {
    id: "yajiang_chensha_dock",
    name: "沉沙古坞",
    district: "雅江",
    innerRoom: "沉沙古坞",
    clearFlag: "dungeon_cleared_yajiang_chensha_dock",
    subtitle: "雅江峡谷水底沉船旧坞，历代治水暗闸与沉银龙骨吸引蜀中诸派群雄争宝。",
    floors: [
      { floor: 1, name: "一层 · 江崖水栈", stepsPerFloor: 2, tier: 2, desc: "江风伴着水雾拍在浸苔竹栈上。" },
      { floor: 2, name: "二层 · 分江水则道", stepsPerFloor: 2, tier: 2, desc: "历代水则铜尺嵌在石渠两壁，各派门人暗中较劲。" },
      { floor: 3, name: "三层 · 沉船龙骨水阁", stepsPerFloor: 2, tier: 3, desc: "沉船龙骨最深处，江铁锚正稳坐在盐箱高台上。" },
    ],
    traps: [
      {
        id: "chensha_trap_sluice",
        title: "倒灌急流石闸",
        desc: "潮浪涌起冲开石槽木闸，暗流挟石块扑面冲来。",
        choices: [
          { id: "dash_sluice", label: "飞点浮石急跃避流", stat: "身法", dc: 6, success: { text: "稳稳踏上岸台并拾得旧铜牌。", items: ["离堆水则牌"], exp: 3 }, fail: { text: "滑落冰水撞伤膝骨。", hpLoss: 17, exp: 1 } },
          { id: "wedge_sluice", label: "撑下分流木卡死", stat: "体魄", dc: 6, success: { text: "硬顶卡住泄水木板平安穿行。", money: 24, pot: 2 }, fail: { text: "木板震碎挨了一记急浪。", hpLoss: 15, exp: 1 } },
        ],
      },
    ],
    events: [
      {
        id: "chensha_event_stele",
        title: "沉水青铜水则刻石",
        desc: "露出水面的半截古碑记着都江分流与运劲诀窍。",
        choices: [
          { id: "read_stele", label: "细观水势刻痕领悟借力", stat: "悟性", dc: 6, success: { text: "顿悟水势吐纳节律，潜能精进。", pot: 7, exp: 3 }, fail: { text: "仅看清大致方位与水路。", money: 18, exp: 1 } },
          { id: "take_coin", label: "拾取碑基下冲积的碎银", success: { text: "收起二十六两碎银。", money: 26, exp: 1 } },
        ],
      },
    ],
    treasures: [
      {
        id: "chensha_treasure_chest",
        title: "防潮沉银货匣",
        desc: "沉船船骨下卡住的铜扣油蜡木匣。",
        choices: [
          { id: "open_hull", label: "巧卸锈锁开匣", stat: "智谋", dc: 6, success: { text: "取出一柄精良的听松玄铁剑。", items: ["听松玄铁剑"], money: 20, exp: 3 }, fail: { text: "只拾走一把青城松纹剑退开。", items: ["青城松纹剑"], hpLoss: 10 } },
          { id: "take_robe", label: "取走匣外裹着的防水道衣", success: { text: "收走三清鹤羽道衣与些许碎银。", items: ["三清鹤羽道衣"], money: 12 } },
        ],
      },
    ],
    rests: [
      {
        id: "chensha_rest_ledge",
        title: "避浪干燥崖室",
        desc: "江崖上方不受水雾侵扰的温暖石室。",
        choices: [
          { id: "heal", label: "揩干水渍包扎休整", success: { text: "恢复精力，伤势稳定许多。", hpHealRatio: 0.35, exp: 1 } },
          { id: "train", label: "听江声调息吐纳", success: { text: "吐纳行气增进武学潜能。", hpHeal: 12, pot: 6, exp: 2 } },
        ],
      },
    ],
    enemies: [
      { id: "chensha_cat_scout", name: "川江盐枭哨", role: "盐枭哨兵", region: "巴蜀", levelCap: 2, desc: "专在船坞暗渠放哨拦截外人的盐帮手。", carry: [{ name: "柳叶小刀", category: "weapon", quality: "绿" }], reward: { money: 34, exp: 4, pot: 3 } },
      { id: "chensha_cat_warden", name: "盐帮铁锚手", role: "盐枭精锐", region: "巴蜀", levelCap: 3, desc: "双臂浑厚的沉船船坞重棍守卫。", carry: [{ name: "老油青竹棒", category: "weapon", quality: "紫" }, { name: "藏红花活血丸", category: "misc", quality: "绿" }], reward: { money: 48, exp: 6, pot: 4 } },
    ],
    boss: {
      id: "chensha_cat_boss",
      name: "川江沉船大瓢把子·江铁锚",
      role: "川江盐枭",
      region: "巴蜀",
      levelCap: 3,
      desc: "半辈子捞江吃浪的老水枭：「想要沉船货柜，先接过我手中这柄分水剑。」",
      carry: [{ name: "听松玄铁剑", category: "weapon", quality: "紫" }, { name: "玄清太极佩", category: "accessory", quality: "紫" }],
      reward: { money: 94, exp: 10, pot: 8, items: ["雪莲清毒丸"] },
    },
  },

  jingguan_ghost_market: {
    id: "jingguan_ghost_market",
    name: "锦官鬼市",
    district: "锦官城",
    innerRoom: "锦官鬼市",
    clearFlag: "dungeon_cleared_jingguan_ghost_market",
    subtitle: "锦官城暗巷地窖门下的地下黑市与销赃暗坊，三教九流提暗灯销赃赌斗。",
    floors: [
      { floor: 1, name: "一层 · 提灯销赃巷", stepsPerFloor: 2, tier: 2, desc: "蒙面客低声问价，角落随时起刀抢宝。" },
      { floor: 2, name: "二层 · 黑赌档与暗当铺", stepsPerFloor: 2, tier: 2, desc: "铁算盘打响，看场打手冷眼盯着每只钱包。" },
      { floor: 3, name: "三层 · 红布拍案总堂", stepsPerFloor: 2, tier: 3, desc: "瞎眼老掌柜退席，算盘爷摇折扇站在主案之后。" },
    ],
    traps: [
      {
        id: "guishi_trap_wire",
        title: "销赃暗道铜铃绞索",
        desc: "脚底砖隙藏着一排倒钩细丝与暗弩。",
        choices: [
          { id: "slip_wire", label: "滑步挑灯越过丝网", stat: "身法", dc: 6, success: { text: "避开全部暗钩顺走碎银。", money: 24, exp: 3 }, fail: { text: "勾中暗丝溅了一身石灰粉。", hpLoss: 15, exp: 1 } },
          { id: "disarm_wire", label: "拆解铜锁簧片", stat: "智谋", dc: 6, success: { text: "稳妥剪断绞索拿走铁算盘尺。", items: ["铁算盘尺"], exp: 3 }, fail: { text: "夹伤指尖损耗气血。", hpLoss: 13, exp: 1 } },
        ],
      },
    ],
    events: [
      {
        id: "guishi_event_ledger",
        title: "死当货柜未合页的册子",
        desc: "夹墙柜台上摊着半本暗市流当记录。",
        choices: [
          { id: "decode_book", label: "核对暗押寻出货格", stat: "智谋", dc: 6, success: { text: "打开偏柜取出锦官制式软甲与碎银。", items: ["锦官制式软甲"], money: 18, exp: 2 }, fail: { text: "暗押早已涂改，仅获二十两散银。", money: 20, exp: 1 } },
          { id: "take_cash", label: "摸走柜边碎银速退", success: { text: "获银二十六两。", money: 26, exp: 1 } },
        ],
      },
    ],
    treasures: [
      {
        id: "guishi_treasure_safe",
        title: "绝当红木大箱",
        desc: "上着双重黄铜暗锁的黑市秘藏箱。",
        choices: [
          { id: "pick_safe", label: "用铁钩摸拨双锁簧", stat: "智谋", dc: 6, success: { text: "打开箱盖抱走鎏金机关折扇！", items: ["鎏金机关折扇"], money: 25, exp: 3 }, fail: { text: "拉断锁舌退求百香纱衣。", items: ["百香纱衣"], hpLoss: 10 } },
          { id: "take_pouch", label: "顺走外挂的百面易容匣", success: { text: "取走百面易容匣与纹银。", items: ["百面易容匣"], money: 15 } },
        ],
      },
    ],
    rests: [
      {
        id: "guishi_rest_booth",
        title: "算账夹室茶桌",
        desc: "背风无人闯入的废账房，热茶余温未散。",
        choices: [
          { id: "heal", label: "喝口热茶包扎擦伤", success: { text: "喘匀了气，恢复稳妥战力。", hpHealRatio: 0.35, exp: 1 } },
          { id: "train", label: "默思黑市诸派身法", success: { text: "颇有所悟，潜能增长。", hpHeal: 12, pot: 6, exp: 2 } },
        ],
      },
    ],
    enemies: [
      { id: "guishi_cat_bouncer", name: "鬼市看场打手", role: "黑市打手", region: "巴蜀", levelCap: 2, desc: "提黑木算盘尺专收过路税的打手。", carry: [{ name: "铁算盘尺", category: "weapon", quality: "蓝" }], reward: { money: 34, exp: 4, pot: 3 } },
      { id: "guishi_cat_warden", name: "暗坊铁尺护院", role: "暗坊护院", region: "巴蜀", levelCap: 3, desc: "穿着杭绸护心袍的总堂贴身保镖。", carry: [{ name: "金珠算盘", category: "weapon", quality: "蓝" }, { name: "杭绸软银护心袍", category: "armor", quality: "紫" }], reward: { money: 48, exp: 6, pot: 4 } },
    ],
    boss: {
      id: "guishi_cat_boss",
      name: "鬼市大掌柜·算盘爷",
      role: "鬼市总掌柜",
      region: "巴蜀",
      levelCap: 3,
      desc: "执掌全城地下暗坊的算盘爷轻合折扇：「鬼市里买命卖货都有价钱，你出得起吗？」",
      carry: [{ name: "鎏金机关折扇", category: "weapon", quality: "紫" }, { name: "杭绸软银护心袍", category: "armor", quality: "紫" }],
      reward: { money: 96, exp: 10, pot: 8, items: ["雪莲清毒丸"] },
    },
  },

  tusi_inner_vault: {
    id: "tusi_inner_vault",
    name: "鱼定土司内府禁库",
    district: "鱼定土司",
    innerRoom: "内府禁库",
    clearFlag: "dungeon_cleared_tusi_inner_vault",
    subtitle: "高台黑宅库房底藏了三十年的秘仓私牢，双份税粮与伪造地契紧锁于巡捕重阵之后。",
    floors: [
      { floor: 1, name: "一层 · 粮仓炭道", stepsPerFloor: 2, tier: 2, desc: "粮袋后藏着通往暗牢的湿冷砖道。" },
      { floor: 2, name: "二层 · 巡捕军械廊", stepsPerFloor: 2, tier: 2, desc: "巡捕营刀矛林立，铜锣更声阵阵紧逼。" },
      { floor: 3, name: "三层 · 三十载密契银库", stepsPerFloor: 2, tier: 3, desc: "暗库铁门前立着总校铁面巴桑。" },
    ],
    traps: [
      {
        id: "tusi_trap_bell",
        title: "巡夜暗弦铜铃阵",
        desc: "廊角挂着连往护院营的细铁丝警铃与暗弩。",
        choices: [
          { id: "cut_bell", label: "避开细丝跃过廊道", stat: "身法", dc: 6, success: { text: "无声滑过警铃区顺走腰牌。", items: ["巡捕营腰牌"], exp: 3 }, fail: { text: "震响铜铃挨了一支暗箭。", hpLoss: 16, exp: 1 } },
          { id: "jam_bell", label: "拿软布先按死铜铃舌", stat: "智谋", dc: 6, success: { text: "哑铃剪索安全脱阵得散银。", money: 24, exp: 3 }, fail: { text: "布条滑脱挨了一记机关钢钉。", hpLoss: 14, exp: 1 } },
        ],
      },
    ],
    events: [
      {
        id: "tusi_event_deed",
        title: "火烤残缺的地契抄架",
        desc: "桌上压着三十年内外两本不同数目的粮税簿。",
        choices: [
          { id: "read_deed", label: "核对双账抓出秘库位置", stat: "智谋", dc: 6, success: { text: "推算出暗门并摸到护心铜牌。", items: ["土司府云雷铜牌"], money: 18, exp: 2 }, fail: { text: "只找到角落的散银。", money: 18, exp: 1 } },
          { id: "take_coin", label: "抽走抽屉税银", success: { text: "带走二十五两税银。", money: 25, exp: 1 } },
        ],
      },
    ],
    treasures: [
      {
        id: "tusi_treasure_armory",
        title: "巡捕军械重匣",
        desc: "上着云雷铁锁的土司府精锐武备匣。",
        choices: [
          { id: "open_armory", label: "撬锁取出上好兵甲", stat: "体魄", dc: 6, success: { text: "提走一柄点钢乌木镇边矛！", items: ["点钢乌木镇边矛"], exp: 3 }, fail: { text: "震伤指骨取走乌木长矛。", items: ["精钢乌木长矛"], hpLoss: 10 } },
          { id: "take_armor", label: "只拿走旁侧备着的札片重甲", success: { text: "收起黑铁札片重甲与散银。", items: ["黑铁札片重甲"], money: 15 } },
        ],
      },
    ],
    rests: [
      {
        id: "tusi_rest_room",
        title: "废旧账箱夹室",
        desc: "壁厚隔音且没人巡查的干燥储物室。",
        choices: [
          { id: "heal", label: "裹伤喝水喘息", success: { text: "疲惫感褪去大半。", hpHealRatio: 0.35, exp: 1 } },
          { id: "train", label: "静坐调匀内息", success: { text: "气息凝实，增长些许潜能。", hpHeal: 12, pot: 6, exp: 2 } },
        ],
      },
    ],
    enemies: [
      { id: "tusi_cat_guard", name: "土司私兵刀手", role: "土司刀手", region: "藏边", levelCap: 2, desc: "专在暗廊盘查外人的巡捕刀手。", carry: [{ name: "巡捕营制式腰刀", category: "weapon", quality: "绿" }], reward: { money: 34, exp: 4, pot: 3 } },
      { id: "tusi_cat_sergeant", name: "巡捕营长矛队正", role: "巡捕队正", region: "藏边", levelCap: 3, desc: "精钢长矛直刺迅猛的营房军官。", carry: [{ name: "精钢乌木长矛", category: "weapon", quality: "蓝" }, { name: "守塔僧金疮药", category: "misc", quality: "绿" }], reward: { money: 48, exp: 6, pot: 4 } },
    ],
    boss: {
      id: "tusi_cat_boss",
      name: "巡捕营暗库总校·铁面巴桑",
      role: "土司营总校",
      region: "藏边",
      levelCap: 3,
      desc: "铁面巴桑横矛立在三十载密契银库门口：「既踏进土司私库，就别想全须全尾走出去。」",
      carry: [{ name: "点钢乌木镇边矛", category: "weapon", quality: "紫" }, { name: "黑铁札片重甲", category: "armor", quality: "紫" }],
      reward: { money: 92, exp: 10, pot: 8, items: ["土司府门客玉扣"] },
    },
  },
});
