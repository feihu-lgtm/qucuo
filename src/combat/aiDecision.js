// NPC 切磋回合决策
// 每回合真正选招式的地方：纯本地计算，不调用任何API，读取 personalityProfile.js
// 生成好的权重表，按权重加权随机选类型，再按 riskAppetite 决定敢不敢用高品质技能。

import { MOVE_TYPE } from "./moveTypes.js";

function weightedRandomPick(weights) {
  const entries = Object.entries(weights || {});
  if (entries.length === 0) return null; // 权重表为空（残缺/未生成的profile）：返回null，交由上游用moveset兜底，绝不 entries[0][0] 崩
  const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  if (total <= 0) return entries[0][0]; // 全部权重非正时兜底选第一个，避免除零
  let roll = Math.random() * total;
  for (const [key, w] of entries) {
    roll -= Math.max(0, w);
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

// 按能量决定这个类型下能负担得起的最高品质技能，从moveset里筛选
function pickAffordableMove(moveset, type, currentEnergy, riskAppetite) {
  const candidates = moveset.filter(m => m.type === type && m.energyCost <= currentEnergy);
  if (candidates.length === 0) {
    // 【这个兜底以前是坏的·"敌人无限体力"的真相】
    // 原来写的是 `moveset.find(m => m.id === "move_hui_qi") || moveset[0]`。
    // 但 "move_hui_qi" 是**玩家**招式的 id 命名；NPC 的四槽由
    // deriveSignatureMoveset 生成，id 形如 "sig_<npcId>_回气"，永远匹配不上。
    // 于是每次都退回 moveset[0]——那通常是耗能最高的攻击招（红档可达 7）。
    // 再加上 applyResultToUnit 会把扣成负数的能量夹回 0，结果就是：
    // **敌人能量见底之后，每回合都在免费打出自己最强的攻击招**，
    // 而它自己 cost=0 的回气招明明就在槽里、却永远选不到。
    // 玩家的体感正是"敌人似乎无限体力点""只能应付一个人""激情互秒"。
    //
    // 改成：先找**当前负担得起的**最便宜的招（不限类型），一个都负担不起时
    // 才退回全表最便宜的那一招——那必然是 cost=0 的回气位。
    const affordable = moveset.filter(m => (m.energyCost ?? 0) <= currentEnergy);
    const pool = affordable.length ? affordable : moveset;
    return pool.reduce((min, m) => ((m.energyCost ?? 0) < (min.energyCost ?? 0) ? m : min), pool[0]);
  }
  // riskAppetite越高，越倾向选候选里能量消耗更高（通常也是品质更高）的技能
  candidates.sort((a, b) => a.energyCost - b.energyCost);
  const riskIndex = Math.min(candidates.length - 1, Math.floor(riskAppetite * candidates.length));
  return candidates[riskIndex];
}

// 核心决策函数：给定NPC的性格权重、当前战斗状态，本地瞬间算出这回合出什么招。
// battleState.npcHistory 是这场战斗里NPC已经用过的类型列表，用于 avoidRepeat 惩罚。
export function decideNpcMove(profile, moveset, battleState) {
  // 系统裁决的一环：无论上游传进来的 profile/moveset/battleState 有多残缺，
  // 这个函数都必须返回一个合法的招，绝不抛错、绝不返回 undefined——否则
  // resolveTurn 拿到 move:undefined 读 .type 直接崩，表现为战斗界面黑屏。
  // 之前的坑：任务临时foe、AI涌现NPC等路径造出的NPC可能带残缺profile
  // （moveWeights 空/缺），weightedRandomPick 里 entries[0][0] 读 undefined 崩。
  const safeMoveset = Array.isArray(moveset) ? moveset.filter(Boolean) : [];
  if (safeMoveset.length === 0) return null; // 连招都没有：交由上游（DuelScreen）处理，但不在这里崩

  const p = profile || {};
  const st = battleState || {};
  let weights = { ...(p.moveWeights || {}) };

  const history = Array.isArray(st.npcHistory) ? st.npcHistory : [];
  const lastMove = history[history.length - 1];
  if (lastMove && weights[lastMove] != null) {
    weights[lastMove] = weights[lastMove] * (1 - (p.avoidRepeat || 0));
  }

  // 防御不能连用两回合：上回合刚守过（或防御被克穿），这回合把防御权重清零，
  // 逼NPC变招——跟玩家侧"防御按钮置灰"是同一条规则。
  if (st.forbidDefense) {
    weights[MOVE_TYPE.DEFENSE] = 0;
  }

  // chosenType 可能为 null（权重表整个是空的残缺profile）：退回按 moveset 里
  // 实际存在的招式类型走一次均匀随机，保证 pickAffordableMove 一定能拿到有效type。
  let chosenType = weightedRandomPick(weights);
  if (chosenType == null) {
    const availableTypes = [...new Set(safeMoveset.map(m => m.type))];
    chosenType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  }

  const move = pickAffordableMove(safeMoveset, chosenType, st.npcEnergy ?? 0, p.riskAppetite ?? 0.5);
  // pickAffordableMove 已有 moveset[0] 兜底，但再保一道：任何情况下都给出实招
  return move || safeMoveset[0];
}
