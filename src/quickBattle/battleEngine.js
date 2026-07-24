// 斗蛐蛐核心战斗引擎（纯逻辑，无 React、无副作用）
// 复用 combat/resolveTurn.js 的 1v1 回合结算内核，在其上包一层"两个上场者
// 交换一回合招式 → 应用结果回各自的 hp/energy/status"的流程，跟 DuelScreen
// 里的应用逻辑同源，只是砍掉了装备特效叠加/免控/复活这些边缘特性——斗蛐蛐
// 是脱离存档的数值沙盒，参战者身上没有玩家装备，用不到那些分支。
//
// 设计约束（同项目一贯的"系统裁决"哲学）：
//   - 谁赢这一回合，纯 resolveTurn 数值判定，这里不掺任何随机改判
//   - 招式选择：玩家侧由 UI 传入，AI 侧由 decideNpcMove 本地算，都不调用网络
//   - 本引擎只吐出"结算后的新状态 + 这回合发生了什么"，播放交给 UI

import { resolveTurn, applyEndOfTurnStatus } from "../combat/resolveTurn.js";
import { applyStatus, applyMark, dispelControlDrain } from "../combat/statusEffects.js";
import { decideNpcMove } from "../combat/aiDecision.js";

// 把一个 fighter（buildBattleFighter 产出）整理成 resolveTurn 需要的 side 对象。
// move 由调用方选好后塞进来。跨回合字段（lastCounterSuccess/pendingAtkBonus 等）
// 存在 fighter.combatState 上，随战斗推进更新。
function toSide(fighter, move) {
  const cs = fighter.combatState;
  return {
    move,
    special: fighter.special,
    waigong: fighter.waigong,
    neigong: fighter.neigong,
    baseAtk: fighter.baseAtk,
    equipAtk: fighter.equipAtk ?? 0,
    equipDef: fighter.equipDef ?? 0,
    hp: cs.hp,
    energy: cs.energy,
    statusSlots: cs.statusSlots,
    lastCounterSuccess: cs.lastCounterSuccess,
    pendingAtkBonus: cs.pendingAtkBonus,
    costPenalty: cs.costPenalty?.value ?? 0,
    lastStatusApplied: cs.lastStatusApplied,
  };
}

// 给一个刚上场的 fighter 初始化本场战斗状态（hp/energy 从生成时的 combatStats 拷贝，
// 保证同一个人反复上场每次都是满状态，不会串场）。
export function initCombatState(fighter) {
  const stats = fighter.combatStats;
  return {
    ...fighter,
    combatState: {
      hp: [stats.hp[0], stats.hp[1]],
      energy: [stats.energy[0], stats.energy[1]],
      statusSlots: JSON.parse(JSON.stringify(stats.statusSlots)),
      history: [],           // 用过的招式类型，喂给 aiDecision 的 avoidRepeat
      lastCounterSuccess: false,
      pendingAtkBonus: 0,
      costPenalty: null,
      lastStatusApplied: false,
      frozen: false,         // 下回合是否被封回气
      forbidDefense: false,  // 下回合是否禁用防御（防御被克穿/刚守过）
    },
  };
}

// AI 侧选招：读 fighter 的性格 profile + 当前战斗状态，本地瞬间算出这回合出什么招。
// 纯本地，绝不调用网络。返回一个 move 对象（一定有值，aiDecision 内部已兜底）。
export function pickAiMove(fighter) {
  const cs = fighter.combatState;
  const battleState = {
    npcHistory: cs.history,
    npcEnergy: cs.energy[0],
    forbidDefense: cs.forbidDefense,
  };
  return decideNpcMove(fighter.profile, fighter.moveset, battleState);
}

// 结算一个回合：myFighter 用 myMove，foeFighter 用 foeMove（都已选好）。
// 返回 { my, foe, result, log }：
//   my/foe   = 结算后带新 combatState 的 fighter（不可变，新对象）
//   result   = resolveTurn 的原始结构化结果（UI 可据此做血条动画/特效）
//   log      = 这回合的文字描述数组（notes + 状态 tick 日志），供 UI 逐条播放
//
// side 命名：A=我方(my)，B=敌方(foe)，跟 resolveTurn 的 A/B 对齐。
export function resolveBattleTurn(myFighter, foeFighter, myMove, foeMove) {
  const my = myFighter.combatState;
  const foe = foeFighter.combatState;

  const sideA = toSide(myFighter, myMove);
  const sideB = toSide(foeFighter, foeMove);
  const result = resolveTurn(sideA, sideB);

  // ── 应用伤害/自损/回血，夹在 0~上限 ──（同 DuelScreen 的净值口径）
  const newMyHp = Math.max(0, Math.min(my.hp[1],
    my.hp[0] - result.damageToA - result.selfHpCostA + (result.hpRestoreA || 0)));
  const newFoeHp = Math.max(0, Math.min(foe.hp[1],
    foe.hp[0] - result.damageToB - result.selfHpCostB + (result.hpRestoreB || 0)));

  // ── 能量：被封回气的一方，正向增量作废，只留消耗 ──
  let deltaA = result.energyDeltaA, deltaB = result.energyDeltaB;
  if (my.frozen && deltaA > 0) deltaA = 0;
  if (foe.frozen && deltaB > 0) deltaB = 0;
  const newMyEnergy = Math.max(0, Math.min(10, my.energy[0] + deltaA));
  const newFoeEnergy = Math.max(0, Math.min(10, foe.energy[0] + deltaB));

  // ── 状态施加 / 印记 / 引爆清空 / 运功自解 ──
  let newMyStatus = my.statusSlots;
  let newFoeStatus = foe.statusSlots;
  if (result.statusAppliedToA) newMyStatus = applyStatus(newMyStatus, result.statusAppliedToA);
  if (result.statusAppliedToB) newFoeStatus = applyStatus(newFoeStatus, result.statusAppliedToB);
  if (result.markAppliedToA) newMyStatus = applyMark(newMyStatus, result.markAppliedToA.name, result.markAppliedToA.stacks, result.markAppliedToA.max);
  if (result.markAppliedToB) newFoeStatus = applyMark(newFoeStatus, result.markAppliedToB.name, result.markAppliedToB.stacks, result.markAppliedToB.max);
  if (result.markDetonatedOnA > 0) newMyStatus = { ...newMyStatus, mark: null };
  if (result.markDetonatedOnB > 0) newFoeStatus = { ...newFoeStatus, mark: null };
  if (result.dispelSelfA) newMyStatus = dispelControlDrain(newMyStatus);
  if (result.dispelSelfB) newFoeStatus = dispelControlDrain(newFoeStatus);

  // ── 回合末状态 tick（掉血/递增剧毒/自动解除）──
  const endTick = applyEndOfTurnStatus(
    { statusSlots: newMyStatus, hp: [newMyHp, my.hp[1]] },
    { statusSlots: newFoeStatus, hp: [newFoeHp, foe.hp[1]] },
  );
  const finalMyHp = Math.max(0, newMyHp - endTick.statusDamageA);
  const finalFoeHp = Math.max(0, newFoeHp - endTick.statusDamageB);

  // ── 汇总日志：resolveTurn.notes + 状态 tick 的 log ──
  const log = [
    ...(result.notes || []),
    ...(endTick.logA || []).map(s => `（我方）${s}`),
    ...(endTick.logB || []).map(s => `（敌方）${s}`),
  ];

  // ── 组装新的跨回合状态 ──
  const nextMyCS = {
    ...my,
    hp: [finalMyHp, my.hp[1]],
    energy: [newMyEnergy, 10],
    statusSlots: endTick.statusSlotsA,
    history: [...my.history, myMove.type],
    lastCounterSuccess: result.counterSuccessA,
    pendingAtkBonus: result.consumedPendingA ? (result.pendingAtkBonusToA || 0) : (my.pendingAtkBonus + (result.pendingAtkBonusToA || 0)),
    costPenalty: result.costPenaltyToA || (my.costPenalty ? decayPenalty(my.costPenalty) : null),
    lastStatusApplied: result.statusSuccessA,
    frozen: result.freezeEnergyToA,
    forbidDefense: result.defenseBrokenA || myMove.type === "防御", // 刚守过或被克穿：下回合禁守
  };
  const nextFoeCS = {
    ...foe,
    hp: [finalFoeHp, foe.hp[1]],
    energy: [newFoeEnergy, 10],
    statusSlots: endTick.statusSlotsB,
    history: [...foe.history, foeMove.type],
    lastCounterSuccess: result.counterSuccessB,
    pendingAtkBonus: result.consumedPendingB ? (result.pendingAtkBonusToB || 0) : (foe.pendingAtkBonus + (result.pendingAtkBonusToB || 0)),
    costPenalty: result.costPenaltyToB || (foe.costPenalty ? decayPenalty(foe.costPenalty) : null),
    lastStatusApplied: result.statusSuccessB,
    frozen: result.freezeEnergyToB,
    forbidDefense: result.defenseBrokenB || foeMove.type === "防御",
  };

  return {
    my: { ...myFighter, combatState: nextMyCS },
    foe: { ...foeFighter, combatState: nextFoeCS },
    result,
    log,
    myDown: finalMyHp <= 0,
    foeDown: finalFoeHp <= 0,
  };
}

// 封穴耗气惩罚随回合递减（turns 递减到 0 就清）
function decayPenalty(p) {
  if (!p) return null;
  const turns = (p.turns ?? 1) - 1;
  return turns > 0 ? { value: p.value, turns } : null;
}

// 队伍里下一个还活着（hp>0）的候补索引；找不到返回 -1（全灭）。
// excludeIdx：换人时排除当前这个（避免换成自己）。
export function nextAliveIndex(team, currentIdx, excludeIdx = -1) {
  for (let i = 0; i < team.length; i++) {
    if (i === excludeIdx) continue;
    const cs = team[i].combatState;
    const alive = cs ? cs.hp[0] > 0 : true; // 还没上过场的算活
    if (alive && i !== currentIdx) return i;
    if (alive && currentIdx === -1) return i; // 开局第一个
  }
  return -1;
}

// 队伍是否全灭（所有已初始化的都 hp<=0，且没有还没上场的活人）
export function isTeamWiped(team) {
  return team.every(f => {
    const cs = f.combatState;
    return cs && cs.hp[0] <= 0;
  });
}
