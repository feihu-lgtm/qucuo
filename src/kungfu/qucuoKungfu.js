// 曲措乡武学目录：各武馆出售的功法秘籍清单。
// 武学分三类：招式（战斗用，有 moveType）、内功（被动加成 passiveBonus）、轻功（被动加成）。
// 购买后以"入门"阶段加入角色的 skills 数组，通过 deriveMovesetFromSkills 自动影响战斗。
//
// passiveBonus 目前支持：maxHp（气血上限加成）、speedBonus（身法加值，影响先手判断）。
// 被动加成在 MudRPG 里调用 computePassiveBonus(skills) 汇总后叠加到 char 的相关字段上。

export const SKILL_TYPE = {
  MOVE: "招式",
  NEIGONG: "内功",
  QINGGONG: "轻功",
};

// 各武馆的武学目录，key 对应 qucuoBuildings.js 里 skillSet 字段
export const SKILL_CATALOG = {
  // ── 玉泉练武场：藏地摔跤+游走风格，状态/轻功为主 ──
  玉泉: [
    {
      id: "kf_liuyun", name: "流云步法", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 45,
      moveType: "状态",
      desc: "藏地牧民代代相传的步伐心诀，身随意转，如云散无形。修习后身法加强，与对手同类招式对撞时更易占得先手。",
      passiveBonus: { speedBonus: 1 },
    },
    {
      id: "kf_daishuai", name: "摔跌术", type: SKILL_TYPE.MOVE, quality: "绿", price: 35,
      moveType: "状态",
      desc: "借力打力，将对手的气势引入虚处——看似平淡，实则以巧破力，是玉泉寨人相互切磋最常用的手段。",
    },
    {
      id: "kf_jiangong", name: "坚桩功", type: SKILL_TYPE.MOVE, quality: "白", price: 20,
      moveType: "防御",
      desc: "扎实的站桩功夫，招式简单但根基牢固，练到纯熟能以守代攻。初学者的不二之选。",
    },
  ],

  // ── 雪山练功堂：雪山派内外兼修，防御反击+内功为主 ──
  雪山: [
    {
      id: "kf_xuexin", name: "雪山养气诀", type: SKILL_TYPE.NEIGONG, quality: "绿", price: 70,
      moveType: "防御",
      desc: "雪山派内功入门，以静养气、以气养血。修习后气血上限提升，且每次切磋后恢复更快。",
      passiveBonus: { maxHp: 15 },
    },
    {
      id: "kf_bingxin", name: "冰心掌", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "防御",
      desc: "以静制动，掌法平稳如雪山不动，防住来势后余力犹在。雪山派弟子入门必学的防身功夫。",
    },
    {
      id: "kf_xuekong", name: "虚空游步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 100,
      moveType: "状态",
      desc: "雪山派独门轻功，步随心走，动静之间令对手难以判断落脚点，身法与状态浑然一体。",
      passiveBonus: { speedBonus: 1 },
    },
  ],

  // ── 锦官武馆：通行江湖功夫，攻击为主，入门无门槛 ──
  锦官: [
    {
      id: "kf_gangfeng", name: "刚锋腿", type: SKILL_TYPE.MOVE, quality: "白", price: 18,
      moveType: "攻击",
      desc: "朴实无华的腿法，踢出去带着一股硬劲，胜在简单直接，江湖初入者常练。",
    },
    {
      id: "kf_lieyan", name: "烈焰拳", type: SKILL_TYPE.MOVE, quality: "绿", price: 45,
      moveType: "攻击",
      desc: "流传甚广的刚猛拳法，以力破巧，一拳连着一拳往上催，架不住就是硬吃。",
    },
    {
      id: "kf_jinshen", name: "金身诀", type: SKILL_TYPE.NEIGONG, quality: "白", price: 22,
      moveType: "防御",
      desc: "流传于锦官城武林的入门内功，练气固体，气血略有增益，初学者常备。",
      passiveBonus: { maxHp: 8 },
    },
    {
      id: "kf_wuyou", name: "无忧步", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 40,
      moveType: "状态",
      desc: "行云流水般的步法，能在混战中灵活穿插，身形难以捉摸，是走南闯北的江湖人惯用的入门轻功。",
      passiveBonus: { speedBonus: 1 },
    },
  ],

  // ── 令狐冲墓·独孤九剑：非售卖，仅通过贡措海令狐冲墓参悟获得 ──
  独孤: [
    {
      id: "kf_dugujiujian", name: "独孤九剑", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      moveType: "攻击",
      desc: "剑魔独孤求败所创，无招胜有招。总诀式、破剑式、破刀式、破掌式、破索式、破鞭式、破枪式、破箭式、破气式，九式归一。令狐冲刻于墓壁，待有缘人。",
      passiveBonus: { speedBonus: 2 },
    },
  ],

  // ── 青城派：以柔克刚、后发制人，道门正宗 ──
  青城: [
    {
      id: "kf_songfeng", name: "松风剑法", type: SKILL_TYPE.MOVE, quality: "绿", price: 50,
      moveType: "攻击",
      desc: "青城派入门剑法，三十六式舒展如松涛过涧。不以快取胜——剑尖划过空气看似缓慢，实则每一剑藏着连绵后劲。使到第三十六式时第一式剑劲还在对手体内残留，新旧叠加，一剑比一剑沉。宝瓶口练此剑，剑尖点水不起水花方为入门。",
    },
    {
      id: "kf_xuanmenqi", name: "青城玄门气", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 90,
      moveType: "防御",
      desc: "道门正宗内功，以呼吸吐纳养气。气劲悠长连绵如岷江之水，表面平缓底下深沉。运功时周身气机形成绵密防御场，来犯之力如击棉絮，层层消解。缺陷：防御状态下只能守不能攻——蓄水时不泄洪，泄洪时不蓄水。",
      passiveBonus: { maxHp: 20 },
    },
    {
      id: "kf_dujiangshi", name: "都江古堰势", type: SKILL_TYPE.MOVE, quality: "蓝", price: 120,
      moveType: "状态",
      desc: "不伤敌不护身——改变脚下的势。将内劲灌入地面布下无形力场，力场内敌方劲力被引导分流，快招自动变慢、准头偏移，如岷江激流撞上离堆被迫分为内外两江。维持时间短极耗内力，但一旦布下攻守之势立转。",
      passiveBonus: { speedBonus: 1 },
    },
    {
      id: "kf_tiyunzong", name: "梯云纵", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 0,
      moveType: "状态",
      desc: "青城派不传之秘，仅藏于伏龙观藏经阁。纵身时如踏云梯而上，一步高过一步，三步之后人在半空，落地无声。不是跳得高——是每一步都踩在前一步的余势上，如岷江后浪推前浪，绵绵不绝。",
      passiveBonus: { speedBonus: 2 },
    },
  ],
};

// 汇总某角色skills里所有内功/轻功的被动加成，供 MudRPG 叠加到 char 字段上
export function computePassiveBonus(skills) {
  const bonus = { maxHp: 0, speedBonus: 0 };
  if (!Array.isArray(skills)) return bonus;
  for (const s of skills) {
    if (s.passiveBonus) {
      bonus.maxHp += (s.passiveBonus.maxHp || 0);
      bonus.speedBonus += (s.passiveBonus.speedBonus || 0);
    }
  }
  return bonus;
}

// 检查某个 skill id 是否已被玩家习得
export function hasSkill(skills, skillId) {
  return skills.some(s => s.id === skillId);
}

// 拜师/偷师学到的招式：并入"武学"栏统一管理，但学到即【完整版】——不修炼、不
// 成长，没有阶段/等级/经验。保存完整招式本体 move，deriveMovesetFromSkills 原样
// 取用，不做阶段缩放（区别于武馆买的可修炼武学）。
// source 标注这一条是怎么来的，供右栏 UI 显示不同小标签：
//   "拜师"（专属招，倾囊相授）/ "拜师·通用"（平民教通用招池的招）/ "偷师"（偷来的）
// 不传 source 时兜底成 "拜师"，向后兼容旧调用点。
export function makeLearnedMoveSkill(move, source = "拜师") {
  return {
    id: move.id,
    name: move.name,
    type: SKILL_TYPE.MOVE,
    moveType: move.type,                 // 攻击/防御/状态
    quality: move.quality || "白",       // 完整版的品阶，直接显示
    fixed: true,                         // 固定招：武学栏不显示成长条
    upgradable: false,                   // 与 fixed 同义，供统一习得系统按这个字段判断能否升阶
    learned: true,                       // 来源：拜师/偷师所授，区别于武馆买的
    source,                              // ★来源维度："拜师" | "拜师·通用" | "偷师"
    active: false,
    move: { ...move, sourceSkill: move.name }, // 完整招式本体，带 sourceSkill 与派生招统一
  };
}

// 从目录定义生成一条 skills 数组里的初始记录（武馆购买）
export function makeSkillEntry(catalogItem) {
  return {
    id: catalogItem.id,
    name: catalogItem.name,
    type: catalogItem.type,
    quality: catalogItem.quality || "白", // 武学本身的品阶（白绿蓝紫橙红），随学会带入，供武学栏显示。
    level: 1,
    exp: 0,
    maxExp: 100,
    stage: "入门",
    active: false,
    moveType: catalogItem.moveType,
    passiveBonus: catalogItem.passiveBonus || null,
    source: "武馆",       // ★来源维度，武馆买的都能潜能升阶
    upgradable: true,     // 与 fixed:false 同义
  };
}
