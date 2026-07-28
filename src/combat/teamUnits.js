// 2v2 团战的"单位对象"装配层
// ============================================================================
// teamBattleEngine.js 只认统一格式的战斗单位对象（见该文件头注释），而游戏里的
// 原始数据有三种形状：玩家（char+背包+战前餐）、雪豹（companion.js 固化的 data）、
// 敌方NPC（room.npcs 里的具名角色）。这里把三种来源各自翻译成引擎要的单位格式，
// 全部纯函数、不碰 React——单位装配的数值正确性可以直接用 Node 脚本验证。
//
// 单位公共字段（引擎读写 + 本层附加）：
//   引擎读写：id, name, side("ally"|"enemy"), alive, special, waigong, neigong,
//     baseAtk, equipAtk, equipDef, equipEffects, hp, energy, statusSlots, movesetLocal,
//     lastCounterSuccess, pendingAtkBonus, costPenalty, frozen, defenseBroken,
//     lastStatusApplied, counterStacks, rebirthUsed
//   本层附加（引擎 {...unit} 展开时会原样保留）：profile(AI性格), history(已用招式类型)
// ============================================================================

import { computeEquippedStats, effectiveSpecial, mergeItemEffects } from "../equipment.js";
import { atkFromWaigong } from "../npcGeneration.js";
import { createEmptyStatusSlots } from "./statusEffects.js";
import { getDefaultProfile } from "./personalityProfile.js";
import { SNOW_LEOPARD_PROFILE } from "../companion.js";

// 跨回合战斗状态的统一初始值（每个单位进场时都是一张白纸）
function freshCombatMemory() {
  return {
    lastCounterSuccess: false, pendingAtkBonus: 0, costPenalty: null,
    frozen: false, defenseBroken: false, lastStatusApplied: false,
    counterStacks: 0, rebirthUsed: false,
    history: [],
  };
}

// 玩家单位：跟 DuelScreen.jsx 的进场装配逐字段对齐——外功梯子 baseAtk、
// 装备聚合攻防/特效、有效七维（基础+装备sixDim）、战前餐气血上限整体抬高。
// combatBuff 是 resolveCombatBuff(pendingCombatBuff) 的产物（由调用方备好）。
export function buildPlayerUnit({ playerChar, playerInv = [], playerMoveset = [], combatBuff = {}, playerSkills = [] }) {
  const { totalAtk, totalDef, equipEffects } = computeEquippedStats(playerInv);
  const buffedWaigong = (playerChar.waigong ?? 0) + (combatBuff.waigong || 0);
  // 内功被动（紫阳神功/青城玄门气/雪山养气诀…）叠进入场血量上限。
  const baseMax = effectiveMaxHp(playerChar.hp[1], playerSkills);
  const boostedMax = Math.round(baseMax * (1 + (combatBuff.hpBonusRatio || 0)));
  return {
    id: "player", name: playerChar.name || "你", side: "ally", alive: true,
    special: effectiveSpecial(playerChar.special, playerInv, playerSkills),
    waigong: playerChar.waigong ?? 0, neigong: playerChar.neigong ?? 0,
    baseAtk: atkFromWaigong(buffedWaigong),
    equipAtk: totalAtk, equipDef: totalDef, equipEffects,
    hp: [Math.min(playerChar.hp[0], boostedMax), boostedMax],
    energy: [10, 10],
    statusSlots: createEmptyStatusSlots(),
    movesetLocal: (playerMoveset || []).map(m => ({ ...m })),
    profile: null, // 玩家由人操作，不需要AI性格
    ...freshCombatMemory(),
  };
}

// 雪豹单位：companionState.snowLeopard.data（createSnowLeopard 固化结果）→ 引擎格式。
// 注意 moveset → movesetLocal 的重命名、补 id/side/alive/statusSlots 等运行时字段，
// 托管性格档案 SNOW_LEOPARD_PROFILE 挂在 unit.profile 上供 decideUnitMove 读取。
export function buildLeopardUnit(leopardData) {
  const maxHp = leopardData.combatStats?.hp?.[1] ?? 100;
  return {
    id: leopardData.id || "companion_snow_leopard", name: leopardData.name || "雪豹",
    side: "ally", alive: true,
    special: leopardData.special, waigong: leopardData.waigong ?? 0, neigong: leopardData.neigong ?? 0,
    baseAtk: leopardData.baseAtk ?? 20,
    equipAtk: 0, equipDef: 0, equipEffects: {}, // 雪豹不穿装备，恒为0（companion.js 已定）
    hp: [maxHp, maxHp], // 每场战斗独立结算，不带伤跨场（companion.js 注释同款简化）
    energy: [10, 10],
    statusSlots: createEmptyStatusSlots(),
    movesetLocal: (leopardData.moveset || []).map(m => ({ ...m })),
    profile: leopardData.profile || SNOW_LEOPARD_PROFILE, // 性格随伙伴数据走（雪豹猛兽本能/珍珠坐骑护主），缺省兜底雪豹
    ...freshCombatMemory(),
  };
}

// 敌方NPC单位：room.npcs 里的具名角色 → 引擎格式。跟 DuelScreen.jsx 的 NPC 侧
// 装配对齐：具名carriedItems里已装备且带effect的，聚合叠进它的招式（mergeItemEffects）。
export function buildEnemyUnit(npc, index = 0) {
  const npcCombat = npc.combatStats || { hp: [100, 100], energy: [10, 10] };
  return {
    id: npc.id || npc.name || `enemy_${index}`, name: npc.name || "对手", side: "enemy", alive: true,
    special: npc.special, waigong: npc.waigong ?? 0, neigong: npc.neigong ?? 0,
    baseAtk: npc.baseAtk ?? 20,
    equipAtk: npc.equipAtk ?? 0, equipDef: npc.equipDef ?? 0,
    equipEffects: mergeItemEffects((npc.carriedItems || []).filter(i => i.equipped && i.effect)),
    hp: [...npcCombat.hp],
    energy: [...(npcCombat.energy || [10, 10])],
    statusSlots: createEmptyStatusSlots(), // 状态槽战斗内独立，不吃场外残留
    movesetLocal: (npc.moveset || []).map(m => ({ ...m })),
    profile: npc.personalityProfile || getDefaultProfile(),
    ...freshCombatMemory(),
  };
}
