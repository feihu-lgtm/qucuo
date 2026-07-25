// 2v2 团战回合调度引擎
// ============================================================================
// 核心思路：不改 resolveTurn.js（它是打磨过的1v1纯函数结算器，招式相克/伤害/
// 状态判定全在里面），2v2只是"调度层"——把"我方最多2个单位 vs 敌方最多2个单位"
// 这一回合的行动，拆解成若干次两两配对的 resolveTurn 调用，然后把每次调用的
// 结果应用回各自的单位对象上。
//
// 【关键规则·裸奔挨打】（已与作者确认）每个单位这回合的行动是 {move, targetId}——
// 不只是攻击要选目标，防御也要指定"这一招防的是谁"。若A打B，而B这回合选的招
// 指向的不是A（B在忙着打别人，或B的防御指定防的是另一个来打它的人），那么对A
// 来说B此刻"没有防御姿态"——B相当于对A裸奔。
//
// 【实现方式】没有另写一套"无防御结算"逻辑，而是复用 resolveTurn 本身的三角
// 相克：给"没有真正把招用在这次交锋上"的一方，临时换成一个类型为 STATUS 的
// 空转状态招（IDLE_STATUS_MOVE，不含任何实际效果）。按"攻击克状态"的既有
// 相克规则，A的攻击必然完胜，B不会因为自己那招（其实是打向别人的）而对A产生
// 任何反击/减伤效果——效果上就是"B对A来说没有防御姿态，直接吃满伤害"，且
// 完全复用现有相克代码，不需要另开一条结算路径。这个换招只影响"A打B"这一次
// 配对内部的计算，不影响B真正指向的目标那一次配对（B在那次配对里仍然用它
// 自己真正选的招）。
//
// 【单位对象结构】统一用一个"战斗单位"对象代替 DuelScreen.jsx 那种
// player/npc 两套平铺变量——那种写法在1v1下能接受，扩展到2v2会让状态变量数量
// 直接翻倍以上，不可维护。单位对象字段：
//   id, name, side("ally"|"enemy"), alive,
//   special, waigong, neigong, baseAtk, equipAtk, equipDef, equipEffects,
//   hp:[cur,max], energy:[cur,max], statusSlots, moveset,
//   lastCounterSuccess, pendingAtkBonus, costPenalty, frozen, defenseBroken,
//   lastStatusApplied, counterStacks,
//   rebirthUsed(bool), movesetLocal(招式的本地可变拷贝，供永久成长/降耗使用)
//
// 【回合流程】
//   1. 调用方（TeamDuelScreen.jsx）收集本回合每个存活单位的 {move, targetId}
//      （玩家/雪豹手动选或托管AI选；敌方AI选目标随机分散，不集火）
//   2. runTeamTurn() 按身法从高到低排出全部存活单位的行动顺序
//   3. 依次结算：轮到某单位A行动时，先检查它选定的目标是否还存活——如果已
//      倒下，自动转移到该目标所属阵营里另一个存活单位（已与作者确认）；如果
//      对方阵营已全灭，跳过这次行动。确定实际目标B后，检查B这回合的招是否
//      也指向A：是→双方真对撞；否→B在这次交锋里换成空转状态招（裸奔规则）。
//   4. 调用 resolveOneOnOne(A的招, B的招或空转招)，结果写回两个单位对象。
//   5. 全部单位行动完毕后，返回本回合的完整战报（供UI渲染）。
// ============================================================================

import { resolveTurn, applyEndOfTurnStatus } from "./resolveTurn.js";
import { applyStatus, applyMark, dispelControlDrain } from "./statusEffects.js";
import { decideNpcMove } from "./aiDecision.js";
import { MOVE_TYPE } from "./moveTypes.js";

// 空转状态招：没有任何实际效果的占位招，用于"裸奔挨打"场景（见文件头说明）。
// energyCost:0——不消耗这个单位自己的能量，因为它本来就没把这一招真的用在
// 这次交锋上，不该为此付出代价。
const IDLE_STATUS_MOVE = { id: "idle_no_defense", type: MOVE_TYPE.STATUS, name: "无暇他顾", energyCost: 0, baseDamageMultiplier: 0 };

// 把装备特效叠进本回合招式（原样搬自 DuelScreen.jsx 的 mergeMoveWithEquip，
// 逻辑完全一致：招式自带的标志位优先，装备只补招式没有的字段）。
export function mergeMoveWithEquip(move, equipEffects) {
  if (!equipEffects || !Object.keys(equipEffects).length) return move;
  const merged = { ...move };
  for (const [k, v] of Object.entries(equipEffects)) {
    if (merged[k] == null) merged[k] = v;
  }
  if (equipEffects.applyMark && merged.applyMarkChance == null && equipEffects.applyMarkChance != null) {
    merged.applyMarkChance = equipEffects.applyMarkChance;
  }
  return merged;
}

// 封穴耗气惩罚的回合推进（原样搬自 DuelScreen.jsx 的 tickCostPenalty）。
function tickCostPenalty(current, incoming) {
  let cur = null;
  if (current && current.turns > 1) cur = { value: current.value, turns: current.turns - 1 };
  if (!incoming) return cur;
  if (!cur) return { ...incoming };
  return { value: Math.max(cur.value, incoming.value), turns: Math.max(cur.turns, incoming.turns) };
}

// 把单位对象转成 resolveTurn 需要的 side 形状。
function unitToSide(unit, move) {
  const equipped = mergeMoveWithEquip(move, unit.equipEffects);
  return {
    move: equipped, special: unit.special, waigong: unit.waigong, neigong: unit.neigong,
    baseAtk: unit.baseAtk, equipAtk: unit.equipAtk ?? 0, equipDef: unit.equipDef ?? 0,
    hp: unit.hp, energy: unit.energy, statusSlots: unit.statusSlots,
    lastCounterSuccess: unit.lastCounterSuccess, pendingAtkBonus: unit.pendingAtkBonus ?? 0,
    costPenalty: unit.costPenalty?.value ?? 0,
    lastStatusApplied: unit.lastStatusApplied, counterStacks: unit.counterStacks ?? 0,
  };
}

// 一次 resolveTurn 结算后，把 result 的 A/B 两侧结果分别写回 attacker/defender
// 单位对象（原地修改并返回新对象，不改原引用——跟 React state 的不可变更新习惯
// 保持一致，调用方用 setUnits 整体替换）。tag 是 "A"（attacker）或 "B"（defender）
// 在 result 里对应哪个字母，两次调用时相反。
function applyResultToUnit(unit, result, tag, move) {
  const dmg = result[`damageTo${tag}`] || 0;
  const selfCost = result[`selfHpCost${tag}`] || 0;
  const hpRestore = result[`hpRestore${tag}`] || 0;
  const newHp = Math.max(0, Math.min(unit.hp[1], unit.hp[0] - dmg - selfCost + hpRestore));

  let deltaEnergy = result[`energyDelta${tag}`] || 0;
  if (unit.frozen && deltaEnergy > 0) deltaEnergy = 0;
  const newEnergy = Math.max(0, Math.min(unit.energy[1] ?? 10, unit.energy[0] + deltaEnergy));

  let newStatus = unit.statusSlots;
  const immune = !!unit.equipEffects?.immuneControl;
  const statusApplied = result[`statusAppliedTo${tag}`];
  if (statusApplied && !immune) newStatus = applyStatus(newStatus, statusApplied);
  const markApplied = result[`markAppliedTo${tag}`];
  if (markApplied && !immune) newStatus = applyMark(newStatus, markApplied.name, markApplied.stacks, markApplied.max);
  if ((result[`markDetonatedOn${tag}`] || 0) > 0) newStatus = { ...newStatus, mark: null };
  if (result[`dispelSelf${tag}`]) newStatus = dispelControlDrain(newStatus);

  // 永久成长/降耗：写回本地 movesetLocal 拷贝（调用方持有 unit.movesetLocal 数组）
  let movesetLocal = unit.movesetLocal;
  const growth = result[`moveGrowth${tag}`];
  if (growth) {
    movesetLocal = movesetLocal.map(m => m.id === growth.moveId
      ? { ...m, baseDamageMultiplier: (m.baseDamageMultiplier ?? 1) + growth.delta } : m);
  }
  const costReduction = result[`moveCostReduction${tag}`];
  if (costReduction) {
    movesetLocal = movesetLocal.map(m => m.id === costReduction.moveId
      ? { ...m, energyCost: Math.max(1, (m.energyCost ?? 2) - costReduction.delta) } : m);
  }

  return {
    ...unit,
    hp: [newHp, unit.hp[1]], // 这一步的 hp 还未经过 applyEndOfTurnStatus 的状态跳动伤害，调用方随后统一处理
    energy: [newEnergy, unit.energy[1] ?? 10],
    statusSlots: newStatus,
    movesetLocal,
    lastCounterSuccess: !!result[`counterSuccess${tag}`],
    lastStatusApplied: !!result[`statusSuccess${tag}`],
    counterStacks: result[`counterSuccess${tag}`] ? (unit.counterStacks ?? 0) + 1 : 0,
    pendingAtkBonus: result[`pendingAtkBonusTo${tag}`] || 0,
    frozen: !!result[`freezeEnergyTo${tag}`],
    costPenalty: tickCostPenalty(unit.costPenalty, result[`costPenaltyTo${tag}`]),
    defenseBroken: move.type === MOVE_TYPE.DEFENSE || !!result[`defenseBroken${tag}`],
  };
}

// 单次1v1结算：attacker 对 defender 使出各自选的招，返回 { attacker, defender, result }
// （两个单位对象是更新后的新对象；result 是 resolveTurn 原始返回，供战报文案使用）。
// 这是调度层的最小单元，2v2的每一次"谁打谁"都调用这个函数一次。
export function resolveOneOnOne(attackerUnit, attackerMove, defenderUnit, defenderMove) {
  const sideA = unitToSide(attackerUnit, attackerMove);
  const sideB = unitToSide(defenderUnit, defenderMove);
  const result = resolveTurn(sideA, sideB);

  let newAttacker = applyResultToUnit(attackerUnit, result, "A", attackerMove);
  let newDefender = applyResultToUnit(defenderUnit, result, "B", defenderMove);

  // 回合末状态跳动伤害（applyEndOfTurnStatus 需要 hp[1] 算比例掉血），跟
  // DuelScreen.jsx 的处理顺序一致：先应用本回合伤害，再跑一次状态跳动。
  const endTick = applyEndOfTurnStatus(
    { statusSlots: newAttacker.statusSlots, hp: newAttacker.hp },
    { statusSlots: newDefender.statusSlots, hp: newDefender.hp },
  );
  const finalAttackerHp = Math.max(0, newAttacker.hp[0] - endTick.statusDamageA);
  const finalDefenderHp = Math.max(0, newDefender.hp[0] - endTick.statusDamageB);

  newAttacker = { ...newAttacker, hp: [finalAttackerHp, newAttacker.hp[1]], statusSlots: endTick.statusSlotsA };
  newDefender = { ...newDefender, hp: [finalDefenderHp, newDefender.hp[1]], statusSlots: endTick.statusSlotsB };

  // 复活特效（涅槃引 rebirthOnce）：跟 DuelScreen.jsx 一致，一场限一次。
  if (finalAttackerHp <= 0 && newAttacker.equipEffects?.rebirthOnce && !newAttacker.rebirthUsed) {
    newAttacker = { ...newAttacker, hp: [Math.round(newAttacker.hp[1] * 0.5), newAttacker.hp[1]], rebirthUsed: true };
    result.notes.push(`${newAttacker.name}气血将尽，涅槃引骤然一热，一线生机被这缕檀香勾了回来`);
  }
  if (finalDefenderHp <= 0 && newDefender.equipEffects?.rebirthOnce && !newDefender.rebirthUsed) {
    newDefender = { ...newDefender, hp: [Math.round(newDefender.hp[1] * 0.5), newDefender.hp[1]], rebirthUsed: true };
    result.notes.push(`${newDefender.name}气血将尽，却凭一缕异香生生续住了性命`);
  }

  newAttacker = { ...newAttacker, alive: newAttacker.hp[0] > 0 };
  newDefender = { ...newDefender, alive: newDefender.hp[0] > 0 };

  return { attacker: newAttacker, defender: newDefender, result, statusLogA: endTick.logA, statusLogB: endTick.logB };
}

// 按身法（special.身法）从高到低排出全部存活单位的行动顺序。相同身法随机决定
// 谁先——跟 resolveTurn.js 里同类型对撞比身法的规则保持一致的处理方式（那边
// 也是身法相同时 Math.random()<0.5 决定），不新增另一套规则。
function orderBySpeed(units) {
  return [...units]
    .filter(u => u.alive)
    .map(u => ({ u, jitter: Math.random() }))
    .sort((a, b) => {
      const sa = a.u.special?.身法 ?? 5, sb = b.u.special?.身法 ?? 5;
      if (sa !== sb) return sb - sa;
      return a.jitter - b.jitter; // 同身法随机排序
    })
    .map(x => x.u);
}

// 敌方AI选目标：随机/分散，不做集火策略（已与作者确认）。从我方存活单位里
// 随机挑一个。
function pickRandomAliveTarget(candidateUnits) {
  const alive = candidateUnits.filter(u => u.alive);
  if (alive.length === 0) return null;
  return alive[Math.floor(Math.random() * alive.length)];
}

// 目标转移：若原目标已不在存活列表里，自动转移到该阵营另一个存活单位
// （已与作者确认此规则——不是打空气，也不是重新问玩家）。
function resolveActualTarget(intendedTargetId, allUnitsById, enemyOrAllyUnits) {
  const intended = allUnitsById[intendedTargetId];
  if (intended && intended.alive) return intended;
  return pickRandomAliveTarget(enemyOrAllyUnits);
}

// runTeamTurn：本回合的完整调度入口。
// allyUnits/enemyUnits：当前存活状态的单位数组（调用方传入最新state）。
// intents：Map<unitId, {move, targetId}> —— 每个存活单位这回合选定的招和目标
//   （目标可以为 null，届时按"该单位阵营的对方"自动挑一个存活目标——用于
//   "敌方只剩1人不用选"这类只有单一合理目标的情况）。
// 返回 { updatedAlly, updatedEnemy, turnLog }：turnLog 是本回合按行动顺序排列的
// 逐条结算记录，供 UI 渲染战报。
export function runTeamTurn(allyUnits, enemyUnits, intents) {
  // 用可变的工作副本贯穿整个回合——同一回合内前面的结算会影响后面单位的
  // "目标是否还存活"判断，所以不能一次性用回合开始时的快照，必须逐步更新。
  let allyPool = allyUnits.map(u => ({ ...u }));
  let enemyPool = enemyUnits.map(u => ({ ...u }));
  const byId = () => Object.fromEntries([...allyPool, ...enemyPool].map(u => [u.id, u]));

  const actingOrder = orderBySpeed([...allyPool, ...enemyPool]);
  const turnLog = [];

  // 【一招之限】每个单位这回合只能"出一招"。当 A 攻击 B、而 B 这回合选定要打的
  // 正是 A 时（双向对打），这一次交锋就把 A 和 B 的招同时用掉了——B 不该稍后又
  // 作为主动 actor 再出一次招（那就是一回合出了两招）。用 consumed 记下"这一招
  // 已经用在了一次真实交锋里"的单位，轮到它自己主动出手时直接跳过。
  // 这正是 2v1 里"敌人打了一招就不能打第二下、面对另一个攻击者只能站着挨打"的
  // 实现：敌人的招只在它 intent 指向的那个对手那场里生效，对另一个走裸奔空转，
  // 且它自己不再单独出招。
  const consumed = new Set();

  for (const actorRef of actingOrder) {
    const idMap = byId();
    const actor = idMap[actorRef.id];
    if (!actor || !actor.alive) continue; // 这回合已经被前面的结算打死，跳过
    if (consumed.has(actor.id)) continue; // 这一招已在之前的双向交锋里用掉，不再单独出招

    const intent = intents[actor.id];
    if (!intent || !intent.move) continue; // 没有登记行动意图（理论上不该发生，防御性跳过）

    const enemyPoolForActor = actor.side === "ally" ? enemyPool : allyPool;
    const target = resolveActualTarget(intent.targetId, idMap, enemyPoolForActor);
    if (!target) { turnLog.push({ actorId: actor.id, actorName: actor.name, skipped: true, reason: "对方已全部倒下，这一击没有目标" }); continue; }

    // 裸奔规则：目标B这回合的招，只有在"B自己指向的目标也是A（这次的actor）"
    // 时才真正用上；否则B在这次交锋里被视为没有防御姿态，换成空转状态招——
    // 不能直接把target.movesetLocal[0]或"target的原始intent"不加甄别地复用，
    // 那样会让target的招在同一回合内被结算多次（这正是最初版本的bug：敌人A
    // 被玩家和雪豹先后攻击时，它自己那招被读取了两次，又在它自己主动出招时
    // 读取第三次，等于一个单位一回合"消耗"了三次行动）。
    const targetIntent = intents[target.id];
    const targetTrueTargetId = targetIntent?.targetId ?? null;
    // target 若没显式指定目标（比如敌方唯一目标不用选），视同"指向了当前actor"，
    // 不判定为裸奔——这类场景下 target 这回合本来就只有 actor 这一个可能的对手。
    const targetReallyFacesActor = targetIntent && (targetTrueTargetId == null || targetTrueTargetId === actor.id);
    const targetMove = targetReallyFacesActor ? targetIntent.move : IDLE_STATUS_MOVE;

    // 双向对打：target 真的把这一招用在了 actor 身上，它这回合的招就此用尽，
    // 后面轮到它主动出手时要跳过（consumed 门在循环开头拦截）。裸奔（空转）时
    // target 并没有真把招用出去，不算消耗，它稍后仍可作为主动 actor 打自己选的目标。
    if (targetReallyFacesActor) consumed.add(target.id);

    const { attacker, defender, result, statusLogA, statusLogB } = resolveOneOnOne(actor, intent.move, target, targetMove);

    // 把更新后的单位写回对应的池子
    allyPool = allyPool.map(u => u.id === attacker.id ? attacker : u.id === defender.id ? defender : u);
    enemyPool = enemyPool.map(u => u.id === attacker.id ? attacker : u.id === defender.id ? defender : u);
    // attacker/defender 可能一个在ally一个在enemy，也可能反过来；上面两行
    // 各自只会命中真正属于该池子的那个id，不会误伤。

    turnLog.push({
      actorId: actor.id, actorName: actor.name, actorMove: intent.move.name,
      targetId: target.id, targetName: target.name,
      targetMove: targetReallyFacesActor ? targetMove.name : null, // 裸奔时不展示"目标用了什么招"，因为它根本没把招用在这
      targetWasIdle: !targetReallyFacesActor,
      matchup: result.matchup, notes: result.notes,
      dmgToTarget: result.damageToB, dmgToActor: result.damageToA,
      statusLog: [...(statusLogA || []), ...(statusLogB || [])],
      targetRedirected: intent.targetId != null && intent.targetId !== target.id,
    });
  }

  return { updatedAlly: allyPool, updatedEnemy: enemyPool, turnLog };
}

// 供敌方/托管单位使用：调用现有的 decideNpcMove，不重新发明AI决策逻辑。
export function decideUnitMove(unit, battleState) {
  return decideNpcMove(unit.profile, unit.movesetLocal, battleState);
}

// 供托管单位（雪豹）选目标：纯野兽本能，不做策略——随机挑一个存活敌人
// （已与作者确认：托管时不特意配合玩家战术）。
export function decideUnitTarget(enemyUnits) {
  return pickRandomAliveTarget(enemyUnits)?.id ?? null;
}

// 战斗是否结束：一方全灭即结束。
export function checkBattleOver(allyUnits, enemyUnits) {
  const allyWiped = allyUnits.every(u => !u.alive);
  const enemyWiped = enemyUnits.every(u => !u.alive);
  if (allyWiped && enemyWiped) return "draw"; // 理论上罕见（双方同回合互相打死），但要有出口
  if (enemyWiped) return "win";
  if (allyWiped) return "lose";
  return null;
}
