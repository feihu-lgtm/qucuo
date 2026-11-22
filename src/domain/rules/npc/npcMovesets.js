// NPC 出生固化的招式池与生成器（自 npcGeneration.js 拆出）：
// 品阶层随机招式（MOVE_POOL/generateNpcMoveset）、专属出招表派生
// （deriveSignatureMoveset）、博弈层招式（BURDEN_MOVE_POOL/resolveBurdenMoves）。
import { rollQuality, QUALITY } from "../economy/equipment.js";
import { MOVE_TYPE } from "../combat/moveTypes.js";
import { NPC_SIGNATURE_MOVES } from "../../data/npc/npcSignatureMoves.js";
import { getImportedSignatureMoves } from "../cards/importedRegistry.js";
import { resolveArchetype } from "../combat/moveArchetypes.js";

// 每个品质档位对应的技能范例池，跟 duel-system-design.md 里的表格一一对应。
// 实际生产环境这份池子应该更丰富（每个类型每个品质多几个候选，避免所有NPC技能撞车），
// 这里先给每格一个代表性技能，验证机制通得通，池子后续可以随时扩充不影响生成逻辑。
export const MOVE_POOL = {
  白: {
    [MOVE_TYPE.ATTACK]: { id: "move_zhi_quan", name: "直拳", energyCost: 2, baseDamageMultiplier: 1.0 },
    [MOVE_TYPE.DEFENSE]: { id: "move_ying_jia", name: "硬架", energyCost: 2, baseDamageMultiplier: 0.6 },
    [MOVE_TYPE.STATUS]: { id: "move_hui_qi", name: "回气", energyCost: 0, energyRestore: 4 },
  },
  绿: {
    [MOVE_TYPE.ATTACK]: { id: "move_lian_huan_tui", name: "连环腿", energyCost: 3, baseDamageMultiplier: 1.15 },
    [MOVE_TYPE.DEFENSE]: { id: "move_tie_bu_shan", name: "铁布衫", energyCost: 3, baseDamageMultiplier: 0.5 },
    [MOVE_TYPE.STATUS]: { id: "move_xu_li", name: "蓄力", energyCost: 3, nextAttackBonus: 0.2 },
  },
  蓝: {
    [MOVE_TYPE.ATTACK]: { id: "move_po_kong_quan", name: "破空拳", energyCost: 4, baseDamageMultiplier: 1.3 },
    [MOVE_TYPE.DEFENSE]: { id: "move_pan_shi_zhuang", name: "磐石桩", energyCost: 4, baseDamageMultiplier: 0.4, onCounterSuccessEnergyGain: 2 },
    [MOVE_TYPE.STATUS]: { id: "move_huo_xin_bu", name: "惑心步", energyCost: 5, confuseChance: 0.5 },
  },
  紫: {
    [MOVE_TYPE.ATTACK]: { id: "move_lie_shi_zhan", name: "裂石斩", energyCost: 5, baseDamageMultiplier: 1.5, doubleVsStatus: true },
    [MOVE_TYPE.DEFENSE]: { id: "move_ting_feng_shi", name: "听风势", energyCost: 6, baseDamageMultiplier: 0.3, onCounterSuccessDamageRatio: 0.7, onCounterFailEnergyPenalty: 3 },
    [MOVE_TYPE.STATUS]: { id: "move_duo_hun_shou", name: "夺魂手", energyCost: 6, energyDiffDamage: true },
  },
  橙: {
    [MOVE_TYPE.ATTACK]: { id: "move_jing_lei_po", name: "惊雷破", energyCost: 7, baseDamageMultiplier: 1.8, ignoreDefense: true },
    [MOVE_TYPE.DEFENSE]: { id: "move_gui_yuan_jue", name: "归元诀", energyCost: 8, baseDamageMultiplier: 0.2, onCounterSuccessDamageRatio: 1.2, onCounterFailEnergyPenalty: 4 },
    [MOVE_TYPE.STATUS]: { id: "move_she_hun_yin", name: "摄魂引", energyCost: 8, freezeEnergyRecovery: true },
  },
  红: {
    [MOVE_TYPE.ATTACK]: { id: "move_yi_jian_xi_lai", name: "一剑西来", energyCost: 9, baseDamageMultiplier: 2.2, forceFirst: true, nullifyStatusOnHit: true },
    [MOVE_TYPE.DEFENSE]: { id: "move_ting_qiao", name: "听桥", energyCost: 9, baseDamageMultiplier: 0.05, onCounterSuccessDamageRatio: 1.0, onCounterSuccessPreemptive: true, onCounterFailEnergyPenalty: 5, onCounterFailDefenseNullified: true },
    [MOVE_TYPE.STATUS]: { id: "move_tian_jing_jue", name: "天惊诀", energyCost: 9, doubleReflectDamage: true },
  },
};

// NPC 的技能品质上限，由角色定位决定——不是所有NPC都该有红色技能，
// 普通村民/路人这种"level"应该封顶在白绿，只有明确设计为高手的角色才给到紫橙红。
// level 对应能解锁到的最高技能品质索引（0=白, 5=红）
function pickQualityWithCap(luck, levelCap) {
  const cappedQuality = () => {
    let q = rollQuality(luck);
    const capIndex = QUALITY.indexOf(QUALITY[levelCap] || "白");
    const rolledIndex = QUALITY.indexOf(q);
    return rolledIndex > capIndex ? QUALITY[capIndex] : q;
  };
  return cappedQuality();
}

// 生成NPC的四个技能位：固定分配为 攻击/防御/状态/状态 各一个（第二个状态位空出来
// 给"回气"这类零消耗保底技能，保证任何NPC能量枯竭时都至少有一个可用选项）
export function generateNpcMoveset(npc, { luck = 5, levelCap = 2 } = {}) {
  const attackQ = pickQualityWithCap(luck, levelCap);
  const defenseQ = pickQualityWithCap(luck, levelCap);
  const statusQ = pickQualityWithCap(luck, levelCap);

  return [
    { ...MOVE_POOL[attackQ][MOVE_TYPE.ATTACK], type: MOVE_TYPE.ATTACK, quality: attackQ },
    { ...MOVE_POOL[defenseQ][MOVE_TYPE.DEFENSE], type: MOVE_TYPE.DEFENSE, quality: defenseQ },
    { ...MOVE_POOL[statusQ][MOVE_TYPE.STATUS], type: MOVE_TYPE.STATUS, quality: statusQ },
    { ...MOVE_POOL["白"][MOVE_TYPE.STATUS], type: MOVE_TYPE.STATUS, quality: "白" }, // 保底回气位，固定白色不受品质上限影响
  ];
}

// levelCap（0-5）→ 品质档位名。越界自动夹到 白/红 之间。
function levelCapToQuality(levelCap) {
  const cap = Math.max(0, Math.min(5, levelCap ?? 0));
  return QUALITY[cap] || "白";
}

// 【NPC 专属出招表派生】按 npcSignatureMoves.js 里每槽声明的"原型+名字"，
// 用 resolveArchetype(原型, levelCap) 算出该档位应有的完整效果（档位越高特效越浓），
// 再套上专属名字/描述。没登记专属的 NPC 返回 null，调用方回退随机品质老逻辑。
//
// 核心：品阶决定"数值段位"(外功→baseAtk，见上) + "特效丰富度"(原型×品阶)。
// 所以红名和平民哪怕用同一个【防守反击】原型，红名解锁到抢先/失败重罚，平民只有
// 基础减伤——这就是"红名听桥≠平民听桥"。
export function deriveSignatureMoveset(npc, { levelCap } = {}) {
  // 入册角色的专属招式跟内置表合并。入册的优先——那是玩家在导入界面亲手配的，
  // 意图比内置表更明确（同名时也该听玩家的）。
  const sig = getImportedSignatureMoves()[npc?.name] || NPC_SIGNATURE_MOVES[npc?.name];
  if (!sig) return null;

  const cap = npc.levelCap ?? levelCap ?? 0;
  const quality = levelCapToQuality(cap);
  const uid = npc.id || npc.name;

  const buildSlot = (slotKey, fallbackArchetype) => {
    const custom = sig[slotKey] || {};
    const archetypeId = custom.archetype || fallbackArchetype;
    const resolved = resolveArchetype(archetypeId, cap) || {}; // 原型×品阶 → 效果
    return {
      ...resolved,               // type + 该档位的全部数值和特效
      ...(custom.effects || {}), // 可选：覆盖/追加独门效果
      quality,
      archetype: archetypeId,
      id: custom.id || `sig_${uid}_${slotKey}`,
      name: custom.name || archetypeId, // 专属名字，没填退回原型名
      desc: custom.desc,
      signature: true,
    };
  };

  // 回气槽：走【回气】原型（保底，能量枯竭时可用，只按档微调回复量），可改名字。
  const moves = [
    buildSlot("攻击", "硬攻"),
    buildSlot("防御", "防守反击"),
    buildSlot("状态", "致乱"),
    buildSlot("回气", "回气"),
  ];
  // 疗伤槽（可选第五招）：只有专属表里显式配了「疗伤」的角色才有回血招——"有些人可以回血"。
  // 没配的角色 moveset 仍是四招，行为不变。moveset 在 UI/AI 里都是遍历使用、不假定固定长度。
  if (sig["疗伤"]) moves.push(buildSlot("疗伤", "疗伤"));
  return moves;
}

// ── 博弈层招式池（总纲v3第十二章：品阶定下限，博弈定上限） ──
// 跟上面 MOVE_POOL 的核心区别：完全不分品阶档位，任何角色（不管
// levelCap多低）都能装备这里的招式，通过承担风险换取超越自身品阶
// 应有的效果。角色是否装备、装备哪个，由 residentNpcs.js 等数据里
// 显式声明的 burdenMoves 数组决定（不是随机生成的），因为这类招式
// 强绑定角色的处境和性格，不该靠系统随机抽。
//
// 三类效果标志位，在 combat/resolveTurn.js 里统一结算：
// - permanentGrowthOnUse：每次使用后基础威力永久+此数值（"越打越顺手"）
// - allInDamage：消耗当前全部能量，消耗量直接决定伤害倍数（孤注一掷）
// - lowHpBonus：自己生命每损失10%，威力+此系数（残血反扑）
// - selfSacrifice: {hpCost, damageMultiplier}：主动燃烧自身生命比例
//   换一次性大额伤害，最激进的一档，用不好等于自杀
export const BURDEN_MOVE_POOL = {
  move_chuisi_fanji: {
    id: "move_chuisi_fanji", name: "垂死反击", type: MOVE_TYPE.ATTACK,
    energyCost: 4, baseDamageMultiplier: 1.0,
    lowHpBonus: 0.5, // 每损失当前生命10%，威力+50%
  },
  move_menghu_yiji: {
    id: "move_menghu_yiji", name: "孤注一掷", type: MOVE_TYPE.ATTACK,
    energyCost: 0, baseDamageMultiplier: 1.0,
    allInDamage: true, // 消耗全部能量，消耗量决定伤害倍数
  },
  move_yuebai_yuey: {
    id: "move_yuebai_yuey", name: "拼命三招", type: MOVE_TYPE.ATTACK,
    energyCost: 5, baseDamageMultiplier: 1.2,
    selfSacrifice: { hpCost: 0.3, damageMultiplier: 3 }, // 燃烧30%当前生命，伤害×3
  },
  move_shengshou_lianji: {
    id: "move_shengshou_lianji", name: "生手渐熟", type: MOVE_TYPE.ATTACK,
    energyCost: 3, baseDamageMultiplier: 0.8,
    permanentGrowthOnUse: 0.15, // 每次使用后基础倍率永久+0.15，起手弱但越打越强
  },
};

// 根据角色声明的 burdenMoveIds（字符串数组）取出对应的博弈层招式对象。
// 未声明或声明了不存在的id会被安全过滤掉，不会让整个moveset生成报错。
export function resolveBurdenMoves(burdenMoveIds) {
  if (!Array.isArray(burdenMoveIds) || burdenMoveIds.length === 0) return [];
  return burdenMoveIds.map(id => BURDEN_MOVE_POOL[id]).filter(Boolean).map(m => ({ ...m }));
}
