// 偷窃系统
// 成功率与好感度、身法都正相关：越信任你，越容易疏于防备；身法越高，手越
// 利索，得手概率也越高。两项独立算完相加，再统一封顶。
// 失败后果不是简单扣个数字了事——NPC会真的生气，进入一个持续3回合的"愤怒窗口"：
//   - 愤怒期间不缓解，好感度不会自然恢复
//   - 玩家需要主动"嘴辩"（对话+措辞得体）才能提前化解愤怒
//   - 3回合内既不嘴辩成功、也没有其他方式平息，愤怒升级为敌对，触发强制战斗
//
// 2026-07 扩展：偷窃现在不只偷物品，也能偷招（偷师）——判定用同一套成功率和
// 惩罚，只是成功之后，从"偷到手的到底是物品还是招式"这一步开始分叉。

export const STEAL_CONFIG = {
  baseRate: 0.45,       // 好感度为0时的基础成功率（原0.2太低，叠加偷物分叉后体感像坏了）
  bonusPerTen: 0.06,    // 好感度每10点，成功率+6%
  agilityBonusPerTen: 0.05, // 身法每5点，成功率再+5%（原为每10点+4%，导致默认身法5完全吃不到加成、整条线作废，故改每5点一档）
  maxRate: 0.92,        // 成功率封顶，永远保留失败可能（失败仍扣好感+生气，风险不能丢）
  angryTurns: 3,        // 生气状态持续的回合数上限
  angryFavorabilityLoss: 15, // 偷窃失败扣除的好感度
  stealMoveChance: 0.25, // 偷窃成功后这次偷到的是招式（偷师）的概率；其余偷物。偷窃按钮的主诉求是顺手牵羊拿物件，偷招只是添头（原0.5让一半成功白白变成静默偷招，玩家体感"偷不到东西"）
};

// 成功率计算：好感项 + 身法项独立相加，封顶。
// 身法按每5点一档（修默认身法5零加成的坑）；好感仍按每10点一档。
// agility 参数默认0，不传时行为等同纯好感公式（向后兼容旧调用点）。
export function stealSuccessRate(favorability, agility = 0) {
  const favBonus = Math.floor((favorability || 0) / 10) * STEAL_CONFIG.bonusPerTen;
  const agiBonus = Math.floor((agility || 0) / 5) * STEAL_CONFIG.agilityBonusPerTen;
  return Math.min(STEAL_CONFIG.maxRate, STEAL_CONFIG.baseRate + favBonus + agiBonus);
}

// 执行一次偷窃判定，返回结果对象，不直接修改状态——
// 调用方（MudRPG.jsx）拿到结果后自己决定怎么写入 varTree/log，
// 这个函数保持纯函数，方便单独测试概率分布是否符合预期。
// agility 参数默认0，向后兼容旧调用（只传 favorability 的地方行为不变）。
export function attemptSteal(favorability, agility = 0) {
  const rate = stealSuccessRate(favorability, agility);
  const roll = Math.random();
  return {
    success: roll < rate,
    rate,      // 附带这次判定用的实际成功率，方便调试面板展示
    roll,      // 附带掷出的随机数，同上
  };
}

// 偷窃成功后，决定这次偷到的是"物品"还是"招式"（偷师）。
// 二选一随机，不是每次都优先偷物或优先偷招——除非某一侧根本没得偷，
// 那就直接退化成必定偷另一侧（比如平民没有专属招可偷，就只能偷物）。
// hasStealableMove: 该NPC是否还有玩家没学过的招式可偷（由调用方提前算好传入）。
// hasStealableItem: 该NPC身上是否还有没偷完的随身物品。
// 返回 "move" | "item" | null（null=两边都没得偷，白跑一趟）。
export function pickStealOutcome(hasStealableMove, hasStealableItem) {
  if (!hasStealableMove && !hasStealableItem) return null;
  if (!hasStealableMove) return "item";
  if (!hasStealableItem) return "move";
  // 两边都有得偷时，偏向偷物（偷窃按钮的主诉求）；偷招只是小概率添头。
  return Math.random() < STEAL_CONFIG.stealMoveChance ? "move" : "item";
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
