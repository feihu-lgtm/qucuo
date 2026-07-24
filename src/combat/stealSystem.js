// 偷窃系统
// 成功率与好感度线性正相关：越信任你，越容易疏于防备，被你顺走东西。
// 失败后果不是简单扣个数字了事——NPC会真的生气，进入一个持续3回合的"愤怒窗口"：
//   - 愤怒期间不缓解，好感度不会自然恢复
//   - 玩家需要主动"嘴辩"（对话+措辞得体）才能提前化解愤怒
//   - 3回合内既不嘴辩成功、也没有其他方式平息，愤怒升级为敌对，触发强制战斗

export const STEAL_CONFIG = {
  baseRate: 0.2,        // 好感度为0时的基础成功率
  bonusPerTen: 0.05,    // 好感度每10点，成功率+5%
  maxRate: 0.85,        // 成功率封顶，永远保留失败可能
  angryTurns: 3,        // 生气状态持续的回合数上限
  angryFavorabilityLoss: 15, // 偷窃失败扣除的好感度
};

// 成功率计算：线性正相关，好感度越高越好偷
export function stealSuccessRate(favorability) {
  const bonus = Math.floor((favorability || 0) / 10) * STEAL_CONFIG.bonusPerTen;
  return Math.min(STEAL_CONFIG.maxRate, STEAL_CONFIG.baseRate + bonus);
}

// 执行一次偷窃判定，返回结果对象，不直接修改状态——
// 调用方（MudRPG.jsx）拿到结果后自己决定怎么写入 varTree/log，
// 这个函数保持纯函数，方便单独测试概率分布是否符合预期。
export function attemptSteal(favorability) {
  const rate = stealSuccessRate(favorability);
  const roll = Math.random();
  return {
    success: roll < rate,
    rate,      // 附带这次判定用的实际成功率，方便调试面板展示
    roll,      // 附带掷出的随机数，同上
  };
}

// 生气状态的数据结构，存进 varTree.角色[npcName].生气状态
export function createAngryState(reason) {
  return {
    active: true,
    reason,                          // "偷窃未遂" 之类的原因说明
    turnsLeft: STEAL_CONFIG.angryTurns,
    startedAt: Date.now(),
  };
}

// 每回合（玩家每次行动后）调用一次，递减生气状态的剩余回合数。
// 返回更新后的生气状态；剩余回合数到0时返回 { active: false, escalated: true }，
// 表示愤怒已经升级为敌对，调用方应据此触发强制战斗或其他惩罚性剧情。
export function tickAngryState(angryState) {
  if (!angryState || !angryState.active) return angryState;
  const turnsLeft = angryState.turnsLeft - 1;
  if (turnsLeft <= 0) {
    return { active: false, escalated: true, reason: angryState.reason };
  }
  return { ...angryState, turnsLeft };
}

// 嘴辩解除生气状态：不是自由聊天就能哄好，而是需要一次"说服判定"。
// 判定本身不在这个纯函数里做（措辞是否得体需要交给LLM判断），这里只提供
// "说服成功后，生气状态应该如何变化"的规则：直接解除，不留残余。
export function resolveAngryByPersuasion(angryState) {
  if (!angryState || !angryState.active) return angryState;
  return { active: false, escalated: false, resolvedBy: "persuasion" };
}
