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

// 阶段突破价格表：在武馆花钱强行突破瓶颈，前提是等级达标。
// 花钱的逻辑：同一位置的武馆 NPC 帮你"点拨"，实际练习靠自己。
export const STAGE_BREAKTHROUGH = {
  小成: { price: 60, minLevel: 5 },
  大成: { price: 150, minLevel: 15 },
  圆满: { price: 350, minLevel: 30 },
  登峰造极: { price: 900, minLevel: 50 },
};
export const STAGE_ORDER = ["入门", "小成", "大成", "圆满", "登峰造极"];

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

// 拜师学到的招式：并入"武学"栏统一管理，但学到即【完整版】——不修炼、不成长，
// 没有阶段/等级/经验。保存完整招式本体 move，deriveMovesetFromSkills 原样取用，
// 不做阶段缩放（区别于武馆买的可修炼武学）。
export function makeLearnedMoveSkill(move) {
  return {
    id: move.id,
    name: move.name,
    type: SKILL_TYPE.MOVE,
    moveType: move.type,                 // 攻击/防御/状态
    quality: move.quality || "白",       // 完整版的品阶，直接显示
    fixed: true,                         // 固定招：武学栏不显示成长条
    learned: true,                       // 来源：拜师所授
    active: false,
    move: { ...move, sourceSkill: move.name }, // 完整招式本体，带 sourceSkill 与派生招统一
  };
}

// 从目录定义生成一条 skills 数组里的初始记录
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
  };
}

// 获取某技能下一阶段突破所需条件；如已到顶则返回 null
export function nextBreakthroughReq(skill) {
  const idx = STAGE_ORDER.indexOf(skill.stage);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  const nextStage = STAGE_ORDER[idx + 1];
  return { nextStage, ...STAGE_BREAKTHROUGH[nextStage] };
}
