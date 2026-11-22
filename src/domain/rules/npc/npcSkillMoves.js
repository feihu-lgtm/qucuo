// 武学→招式派生（自 npcGeneration.js 拆出）：一门武学固定绑一个招式，
// 阶段只调数值不改骨架；玩家的切磋招式池 deriveMovesetFromSkills 也在这里。
import { MOVE_TYPE } from "../combat/moveTypes.js";
import { MOVE_POOL } from "./npcMovesets.js";
import { SKILL_CATALOG } from "../../data/kungfu/qucuoKungfu.js";

// 武馆和各家势力武学按 id 认回目录定义：学会时的记录（makeSkillEntry）只存 id/名字/阶段，
// 特效键在目录里，派生招式时从这里补，老存档里已学的武学也一并生效。
let catalogById = null;
const catalogEntry = (id) => {
  if (!id) return null;
  catalogById ??= new Map(Object.values(SKILL_CATALOG).flat().map((entry) => [entry.id, entry]));
  return catalogById.get(id) || null;
};

// 武学 <-> 招式：一一对应，不是循环分配。
// 每门武学从学会那一刻起就固定绑定一个招式类型（攻击/防御/状态），
// 招式的名字也随之固定不变——"三脚猫拳法"从入门练到登峰造极，
// 名字一直是"三脚猫拳法"，变的是威力数值，不会练着练着变成完全不相干的
// 另一招。这样"练哪门武学"直接决定"切磋时能用哪一招"，一一对应、
// 不需要再通过循环分配或类型映射去猜。
//
// 招式类型的分配规则：武学预设时（在 presets/qucuo.js 里）可以显式指定
// moveType 字段；没指定的话，按名字里的关键词粗略猜一个合理类型兜底
// （"拳/腿/掌/刀/枪"这类主动攻击类词 -> 攻击；"桩/盾/架/功"这类防守类词
// -> 防御；其余默认状态类），保证旧预设不用大改也能正常映射。
function inferMoveType(skillName) {
  if (/拳|腿|掌|刀|枪|剑|棍|指/.test(skillName)) return MOVE_TYPE.ATTACK;
  if (/桩|盾|架|功|甲/.test(skillName)) return MOVE_TYPE.DEFENSE;
  return MOVE_TYPE.STATUS;
}

// 每个阶段对应的数值强度系数（不是查表换皮，而是同一招式在自身身上的强化）。
// baseDamageMultiplier / energyCost 等具体数值按这个系数缩放，阶段越高
// 缩放幅度越大，跟品质体系（白绿蓝紫橙红）的强度曲线保持一致的感觉，
// 但招式的"骨架"（是攻击还是防御、特殊效果类型）从诞生起就不变。
const STAGE_POWER = { 入门: 1.0, 小成: 1.15, 大成: 1.3, 圆满: 1.5, 登峰造极: 1.8 };
const STAGE_ENERGY_COST = { 入门: 2, 小成: 3, 大成: 4, 圆满: 5, 登峰造极: 6 };
const STAGE_TO_QUALITY = { 入门: "白", 小成: "绿", 大成: "蓝", 圆满: "紫", 登峰造极: "橙" };

// 根据一门武学的当前阶段和类型，生成对应的招式对象。
// moveType 优先取 skill.moveType（预设手写指定），没有就用名字关键词兜底猜测。
// 武学条目上允许带、并且会被抄到招式上的特效键。与 itemEffectText 的词典同源：
// 词典里有词条 = 界面显示得出来；resolveTurn 认得 = 打起来真的生效。
// 新增特效时三处一起加，别只加一处（本项目已经在这上头栽过好几次）。
export const SKILL_EFFECT_KEYS = [
  "forceFirst", "forceCrit", "ignoreDefense", "ignoreDefenseRatio", "nullifyStatusOnHit",
  "doubleVsStatus", "lowHpBonus", "highHpBonus", "afterStatusBonus", "afterCounterBonus",
  "justiceStrike", "applyMark", "applyMarkChance", "applyMarkOnHit", "detonateMark",
  "applyStatus", "statusChance", "confuseChance", "dodgeChance", "stealOnDodge", "enemyCostPenalty", "freezeEnergyRecovery",
  "onCounterSuccessDamageRatio", "onCounterSuccessEnergyGain", "doubleReflectDamage",
  "immuneControl", "ignoreDefensePartialImmune", "rebirthOnce",
  "hpRestore", "energyRestore", "selfSacrifice", "allInDamage",
  "nextAttackBonus", "lowEnemyEnergyBonus",
];

export function deriveMoveFromSkill(skill) {
  const moveType = skill.moveType || inferMoveType(skill.name);
  const power = STAGE_POWER[skill.stage] || 1.0;
  const quality = STAGE_TO_QUALITY[skill.stage] || "白";

  // 【武学身上的特效标志位必须带过来·此前全被丢掉】
  // 这个函数原来只造 id/name/type/quality/energyCost + 一个倍率，武学条目上写的
  // forceFirst、破防、附异状那些标志位一个都不往招式上抄。后果是整个武学体系
  // 派生出来的招**除了类型和倍率之外完全一样**：一字电剑写着「无视身法强行先手」，
  // 打起来跟普通一剑没有任何区别；右栏的 moveEffectBrief 也因此永远是空的
  // （显示线路本来是通的，只是数据从没送到）。
  // 这里按白名单抄——白名单就是 itemEffectText 那份唯一词典的键 + 它的参数键，
  // 保证「能抄过去的 = 能显示出来的 = 战斗认得的」三者同一套。
  const carried = {};
  const def = catalogEntry(skill.id);
  for (const k of SKILL_EFFECT_KEYS) {
    const value = skill[k] !== undefined ? skill[k] : def?.[k];
    if (value !== undefined) carried[k] = value;
  }

  const base = {
    id: `skill_move_${skill.name}`,
    name: skill.name, // 招式名字直接就是武学名字，不再是另起的"直拳""硬架"这类别名
    type: moveType,
    quality,
    energyCost: STAGE_ENERGY_COST[skill.stage] || 2,
    sourceSkill: skill.name,
    ...carried,
  };

  if (moveType === MOVE_TYPE.ATTACK) {
    return { ...base, baseDamageMultiplier: power };
  }
  if (moveType === MOVE_TYPE.DEFENSE) {
    // 防御类倍率反过来：练得越深，受到的伤害越低（0.6基准往下降，不是往上乘）
    return { ...base, baseDamageMultiplier: Math.max(0.05, 0.65 - (power - 1) * 0.5) };
  }
  // 状态类：练得越深，附加效果的触发几率/强度越高。
  // 注意这两项要让位给武学自己写的值——它们在 base 的 ...carried 里已经带过来了，
  // 这里若无条件覆盖，就会把「回风拂柳剑 confuseChance:0.5」这种手写词条冲掉
  // （曾经就是这么冲掉的，测试当场逮住）。手写优先，没写才按阶段推。
  return {
    ...base,
    confuseChance: carried.confuseChance ?? Math.min(0.7, 0.3 * power),
    energyRestore: carried.energyRestore ?? (moveType === MOVE_TYPE.STATUS && skill.name.includes("回气") ? Math.round(4 * power) : undefined),
  };
}

// 玩家的切磋招式池：一门武学对应一个招式，一一映射，不再循环分配/查表。
// 招式数量 = 武学数量。类型缺位（比如玩家所有武学都是攻击类，完全没有
// 防御/状态类可选）用白色基础技能兜底，保证任何时候三个类型至少各有一个。
// 玩家的切磋招式池：只上阵【运功中】(active) 的武学——运功=装备上阵。
// 每个类型(攻/防/状)最多运功一门；某类没运功任何武学，就用白色基础招兜底，
// 保证三类各有一招可用。最后永远保底一个"回气"(0耗能)，防止运功了耗能状态招后
// 能量枯竭无招可出（与 generateNpcMoveset 的保底回气位一致）。
export function deriveMovesetFromSkills(skills) {
  const list = skills || [];
  const moves = [];
  for (const type of [MOVE_TYPE.ATTACK, MOVE_TYPE.DEFENSE, MOVE_TYPE.STATUS]) {
    const equipped = list.find(s => s.active && (s.moveType || inferMoveType(s.name)) === type);
    if (equipped) {
      moves.push((equipped.fixed && equipped.move) ? { ...equipped.move, sourceSkill: equipped.name } : deriveMoveFromSkill(equipped));
    } else {
      const template = MOVE_POOL["白"][type];
      moves.push({ ...template, type, quality: "白", sourceSkill: null });
    }
  }
  if (!moves.some(m => m.id === "move_hui_qi")) {
    const huiqi = MOVE_POOL["白"][MOVE_TYPE.STATUS];
    moves.push({ ...huiqi, type: MOVE_TYPE.STATUS, quality: "白", sourceSkill: null });
  }
  return moves;
}
