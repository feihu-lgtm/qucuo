// 通用地宫配置表（纯静态数据，不依赖上层逻辑）。
// 首期接入「白塔地宫」（white_pagoda_crypt），后续据点如三星铸铜地窖、熊山古洞
// 可直接按同结构追加条目与对应 buildings/locations/*.js 入口。

export const DUNGEON_NODE_TYPE = Object.freeze({
  TRAP: "trap",
  COMBAT: "combat",
  EVENT: "event",
  TREASURE: "treasure",
  REST: "rest",
  BOSS: "boss",
});

export const DUNGEON_CATALOG = Object.freeze({
  white_pagoda_crypt: {
    id: "white_pagoda_crypt",
    name: "白塔地宫",
    district: "白塔",
    innerRoom: "白塔地宫",
    clearFlag: "dungeon_cleared_white_pagoda_crypt",
    subtitle: "半山白塔之下的藏传石窟，机关暗藏，守塔僧团世代扼守深处。",
    floors: [
      { floor: 1, name: "一层 · 转经回廊", stepsPerFloor: 2, tier: 1, desc: "石壁嵌满积灰转经筒，风从窄缝里倒灌进来，隐约能听见铁网摩擦声。" },
      { floor: 2, name: "二层 · 玄石机关阵", stepsPerFloor: 2, tier: 2, desc: "青石地砖刻着藏文八吉祥暗记，踩错半寸便是机括连环。" },
      { floor: 3, name: "三层 · 明王石室", stepsPerFloor: 2, tier: 3, desc: "香火混着陈年石灰味弥漫四壁，深处石台前立着守塔僧团的护法首座。" },
    ],
    traps: [
      {
        id: "trap_wheel",
        title: "逆转经筒阵",
        desc: "两排铜铸经筒卡死在窄道中，墙孔里隐约露出淬灰的暗箭簇。",
        choices: [
          {
            id: "dodge_wheel",
            label: "施展轻功踏墙借力掠过",
            stat: "身法",
            dc: 5,
            success: { text: "足尖连点铜筒边缘，抢在机簧合拢前滑过长廊，顺手在暗槽摸到几枚碎银。", money: 14, exp: 2 },
            fail: { text: "踏空半寸，肩头擦过机簧暗箭，气血翻涌。", hpLoss: 14, exp: 1 },
          },
          {
            id: "decode_wheel",
            label: "辨识经筒梵文顺序拆解机括",
            stat: "悟性",
            dc: 5,
            success: { text: "顺着古藏文偈语逆转三筒，石板应声收拢，露出一包封存的伤药。", items: ["守塔僧金疮药"], exp: 2 },
            fail: { text: "看岔了半句旧梵文，经筒猛然倒弹撞在胸口。", hpLoss: 12, exp: 1 },
          },
        ],
      },
      {
        id: "trap_stone",
        title: "玄石塌方闸",
        desc: "头顶千斤石闸发出闷响缓缓下压，两侧石缝都在掉灰。",
        choices: [
          {
            id: "brace_stone",
            label: "沉腰运劲硬撑闸门穿出",
            stat: "体魄",
            dc: 6,
            success: { text: "双肩抵住石沿爆劲猛推，趁石楔卡住的空当闪身而出。", exp: 2, pot: 2 },
            fail: { text: "石闸太沉，滚出来时后背被碎石砸得生疼。", hpLoss: 18, exp: 1 },
          },
          {
            id: "wedge_stone",
            label: "寻机关卡榫拿碎石卡死滑槽",
            stat: "智谋",
            dc: 5,
            success: { text: "一眼看穿右侧滑槽的旧铁楔，三两下撬歪卡死，闸门停在半空。", money: 10, pot: 2 },
            fail: { text: "碎石被重压崩裂，溅起的石片划破手背。", hpLoss: 13, exp: 1 },
          },
        ],
      },
      {
        id: "trap_miasma",
        title: "石灰地潮井",
        desc: "地窖低洼处聚着守塔僧防潮用的生石灰与陈年瘴气，吸一口便觉喉头灼痛。",
        choices: [
          {
            id: "breath_miasma",
            label: "闭息运功硬扛过去",
            stat: "根骨",
            dc: 5,
            success: { text: "丹田气机闭锁得稳，一口真气撑到上风口，反倒磨砺了内息。", pot: 3, exp: 1 },
            fail: { text: "屏息没撑过最后两步，吸进半口呛灰咳得肺腑发痛。", hpLoss: 15, exp: 1 },
          },
          {
            id: "bypass_miasma",
            label: "沿高处石壁凸棱绕行",
            stat: "身法",
            dc: 6,
            success: { text: "十指抠住石缝借力横移，居然在壁缝里摸到一小株阴生的寒泉雪莲。", items: ["寒泉雪莲"], exp: 2 },
            fail: { text: "湿滑的青苔打了个趔趄，摔进灰水浅滩擦伤脚踝。", hpLoss: 14, exp: 1 },
          },
        ],
      },
      {
        id: "trap_bell",
        title: "金刚铃声阵",
        desc: "檐顶悬着九枚青铜铃，风一吹就发颤，若齐响便会引动壁内伏弩。",
        choices: [
          {
            id: "damp_bell",
            label: "屏声敛气逐一按住铃舌",
            stat: "身法",
            dc: 6,
            success: { text: "掌风轻柔贴上铜舌，九铃无声熄止，伏弩没被惊动。", money: 18, exp: 2 },
            fail: { text: "末枚铜铃晃出半声清鸣，壁间射出一支冷箭擦过小臂。", hpLoss: 16, exp: 1 },
          },
          {
            id: "read_bell",
            label: "推算风道关掉穿堂石窗",
            stat: "智谋",
            dc: 5,
            success: { text: "拨动西侧通风活页截断穿堂风，铜铃立定，暗格弹出一串旧念珠。", items: ["守塔僧的念珠"], exp: 2 },
            fail: { text: "活页锈死卡住，强推时震动了铃索挨了一记暗弩。", hpLoss: 15, exp: 1 },
          },
        ],
      },
    ],
    events: [
      {
        id: "event_scripture",
        title: "残破经卷龛",
        desc: "石龛里散落着前任经师留下的手抄残卷，边角焦黑却还能辨认行气法门。",
        choices: [
          {
            id: "study_scripture",
            label: "借微光研读一刻钟",
            stat: "悟性",
            dc: 5,
            success: { text: "残卷里记载的闭气卸力诀窍颇有门道，心头豁然一亮。", pot: 5, exp: 2 },
            fail: { text: "文字多半漫漶，只模模糊糊理出一点粗浅行气思路。", pot: 2, exp: 1 },
          },
          {
            id: "search_niche",
            label: "只收起经卷下的铜钱与香灰",
            success: { text: "没去硬啃晦涩经文，在龛底清出二十余两散碎供奉银。", money: 22, exp: 1 },
          },
        ],
      },
      {
        id: "event_raider_pack",
        title: "盗墓贼遗囊",
        desc: "石柱后倚着一只落满灰的牛皮行囊，不知是哪位同道仓皇撤退时丢下的。",
        choices: [
          {
            id: "check_trap_pack",
            label: "先探明暗扣再拆封",
            stat: "智谋",
            dc: 5,
            success: { text: "挑断了囊口的毒针机关，里面藏着两包药粉与银锭。", money: 16, items: ["守塔僧金疮药"], exp: 1 },
            fail: { text: "还是漏算了内夹层的细针，手指微麻失了些血气。", hpLoss: 10, money: 12 },
          },
          {
            id: "grab_outer",
            label: "只取外袋散碎银两免生事端",
            success: { text: "谨慎不贪，掂走外袋十几两碎银便转身离开。", money: 15, exp: 1 },
          },
        ],
      },
      {
        id: "event_wall_crack",
        title: "石壁干涸夹缝",
        desc: "阴冷的石壁裂开一道手指宽的缝，风干的朱砂粉里隐约闪着微光。",
        choices: [
          {
            id: "pry_crack",
            label: "细心抠出壁缝里的封存物",
            stat: "气运",
            dc: 5,
            success: { text: "竟从风化石灰层里剥出一小盒品相完好的守宫砂与碎玉。", items: ["守宫砂"], money: 12, exp: 2 },
            fail: { text: "手一滑石粉簌簌掉进袖口，只抢出几枚零碎铜钱。", money: 10, exp: 1 },
          },
          {
            id: "pass_crack",
            label: "不碰来历不明的蛊粉，快步通过",
            success: { text: "绕开壁缝节省了不少脚力，顺势调匀呼吸。", hpHeal: 8, exp: 1 },
          },
        ],
      },
      {
        id: "event_censer",
        title: "半熄古铜香炉",
        desc: "殿角一尊铜香炉余温犹存，香灰里插着半截没烧完的藏香。",
        choices: [
          {
            id: "pray_censer",
            label: "添一缕香烟静心调息",
            success: { text: "沉稳的藏香气息压下地底寒湿，气血平顺不少。", hpHeal: 16, pot: 2 },
          },
          {
            id: "dig_ash",
            label: "拨开香灰翻看炉底暗格",
            stat: "气运",
            dc: 6,
            success: { text: "炉底果然藏着暗匣，里头压着一件贴身护甲。", items: ["铁网僧袍"], exp: 2 },
            fail: { text: "烫灰溅在虎口，炉底空空如也。", hpLoss: 8, exp: 1 },
          },
        ],
      },
    ],
    treasures: [
      {
        id: "treasure_stone_box",
        title: "玄石供龛",
        desc: "供龛雕着降魔纹饰，外层敞开，内层另有九宫锁。",
        choices: [
          {
            id: "unlock_inner",
            label: "拨动九宫锁探内层",
            stat: "气运",
            dc: 6,
            success: { text: "机括咔哒一响，玄石龛内托出一件守塔僧团制式铁网衲。", items: ["守塔僧团铁网衲"], money: 20, exp: 2 },
            fail: { text: "内锁咔嚓咬死，震得手腕发酸，只拿到外层散银。", hpLoss: 10, money: 14 },
          },
          {
            id: "take_outer",
            label: "只收外层供奉银钱与伤药",
            success: { text: "取走外龛的散碎银两与常备药包，干脆利落。", money: 26, items: ["守塔僧金疮药"] },
          },
        ],
      },
      {
        id: "treasure_weapon_rack",
        title: "旧法器木架",
        desc: "木架早已朽半，几件重器斜倚在青砖上，上头缠着防锈油布。",
        choices: [
          {
            id: "inspect_rack",
            label: "细细查验木架暗底",
            stat: "智谋",
            dc: 6,
            success: { text: "木架底座暗藏夹层，抽出一柄刻满梵文的降魔杵。", items: ["降魔杵"], exp: 3 },
            fail: { text: "木架轰然散架，砸中脚背，倒从油布里捡出几两银锭。", hpLoss: 12, money: 24 },
          },
          {
            id: "take_beads",
            label: "顺手收起架旁散落的旧念珠",
            success: { text: "捡起一串温润旧念珠，又搜罗到些许铜钱。", items: ["守塔僧的念珠"], money: 12 },
          },
        ],
      },
      {
        id: "treasure_stash",
        title: "防潮石灰库",
        desc: "守塔僧囤放补给的干燥小室，木箱封着蜡印。",
        choices: [
          {
            id: "open_stash",
            label: "启蜡开箱清点补给",
            success: { text: "箱中备着干净的守塔僧金疮药与一袋盘缠。", money: 28, items: ["守塔僧金疮药"], exp: 1 },
          },
          {
            id: "search_stash_deep",
            label: "掀开箱底垫布搜检夹层",
            stat: "气运",
            dc: 7,
            success: { text: "夹层里竟压着一柄久藏的白塔铜鎏金降魔杵！", items: ["白塔铜鎏金降魔杵"], exp: 3 },
            fail: { text: "夹层早已空着，反被箱沿铁钉划破掌心。", hpLoss: 9, money: 18 },
          },
        ],
      },
    ],
    rests: [
      {
        id: "rest_hearth",
        title: "避风炭盆石室",
        desc: "守塔僧换班歇脚的小石室，炭盆里还有暗红余烬，干燥暖和。",
        choices: [
          {
            id: "rest_heal",
            label: "烤火包扎，恢复气血",
            success: { text: "在炭火旁调匀气息、重裹伤口，精神振作了不少。", hpHealRatio: 0.35, exp: 1 },
          },
          {
            id: "rest_meditate",
            label: "借静室打坐参悟",
            success: { text: "借地底幽静吐纳周天，积攒了些许武学潜能。", hpHeal: 10, pot: 6, exp: 2 },
          },
        ],
      },
      {
        id: "rest_spring",
        title: "石隙渗泉",
        desc: "石壁细缝淌下一线雪山渗水，清冽干净。",
        choices: [
          {
            id: "drink_spring",
            label: "掬水洗伤调息",
            success: { text: "冰凉山泉激得神思一清，外伤痛感减轻许多。", hpHealRatio: 0.3, pot: 2 },
          },
          {
            id: "train_spring",
            label: "迎着泉声演练一遍起手式",
            success: { text: "在回声中拆解几路步法，隐有所得。", hpHeal: 12, pot: 5, exp: 2 },
          },
        ],
      },
    ],
    enemies: [
      {
        id: "crypt_monk_guard",
        name: "守塔僧",
        role: "守塔僧",
        region: "宗教",
        levelCap: 1,
        desc: "身披灰色铁网衲的守塔武僧，步履沉稳，专门盘查擅闯回廊之人。",
        carry: [{ name: "守塔僧金疮药", category: "misc", quality: "绿" }],
        reward: { money: 22, exp: 3, pot: 2 },
      },
      {
        id: "crypt_iron_patrol",
        name: "铁网巡夜僧",
        role: "武僧",
        region: "宗教",
        levelCap: 2,
        desc: "白塔地宫二层的巡夜精锐，内衬铁网护甲，擅使硬派降魔招式。",
        carry: [
          { name: "铁网僧袍", category: "armor", quality: "蓝" },
          { name: "守塔僧金疮药", category: "misc", quality: "绿" },
        ],
        reward: { money: 34, exp: 5, pot: 3 },
      },
    ],
    boss: {
      id: "crypt_head_monk",
      name: "守塔僧团首领",
      role: "守塔首座",
      region: "宗教",
      levelCap: 3,
      desc: "白塔地宫最深处的护法首座，手持降魔杵，眼神沉静而冷峻：「经师说过，要进最深处，先接我这关。」",
      carry: [
        { name: "降魔杵", category: "weapon", quality: "紫" },
        { name: "守塔僧的念珠", category: "accessory", quality: "绿" },
      ],
      reward: { money: 68, exp: 8, pot: 6, items: ["守宫砂"] },
    },
  },
});

export function getDungeonConfig(dungeonId) {
  return DUNGEON_CATALOG[dungeonId] || DUNGEON_CATALOG.white_pagoda_crypt;
}
