// Buff 系统（回合制）
// 本轮改造：从"按游戏时辰"改为"按回合"（每次行动算 1 回合，由 MudRPG 的 turnCount 驱动），
// 并新增"战前餐"这一作用于下一场战斗的一次性 buff。此前 applyBuffsToSpecial 从未被调用、
// 七维 buff 挂了不生效的问题，由第二批在 MudRPG/DuelScreen 接通解决。
//
// 两类 buff：
// ① 七维回合 buff：吃食物后接下来 N 个回合内七维 +M，以 flag 字符串
//    buff_属性+M_untilturn_T 存在 flags 数组，T 是到期的回合序号（turnCount）。
// ② 战前餐 buff：作用于"下一场战斗"，存在 char.pendingCombatBuff（一次性，进战斗即应用、
//    战斗结束清除），不走 flags。字段见 mergeCombatBuff 说明。

// ── ① 七维回合 buff ──

// 解析 flags 里当前仍有效（未过期）的七维 buff，累加成 { 属性: 总增量 }
export function parseActiveBuffs(flags, currentTurn) {
  const bonuses = {};
  if (!Array.isArray(flags)) return bonuses;
  for (const f of flags) {
    const m = typeof f === "string" && f.match(/^buff_(.+?)\+(\d+)_untilturn_(\d+)$/);
    if (!m) continue;
    if (currentTurn <= Number(m[3])) bonuses[m[1]] = (bonuses[m[1]] || 0) + Number(m[2]);
  }
  return bonuses;
}

// 把 buff 叠加到 special 副本上（不改原对象），七维上限 10
export function applyBuffsToSpecial(special, flags, currentTurn) {
  const bonuses = parseActiveBuffs(flags, currentTurn);
  const result = { ...(special || {}) };
  for (const [attr, val] of Object.entries(bonuses)) {
    if (attr in result) result[attr] = Math.min(10, (result[attr] || 0) + val);
  }
  return result;
}

// 生成一条七维 buff flag；durationTurns 是持续的回合数（如 30）
export function makeBuffFlag(attr, val, currentTurn, durationTurns) {
  return `buff_${attr}+${val}_untilturn_${currentTurn + durationTurns}`;
}

// 清理已过期的七维 buff flag（每回合推进后调用，保持 flags 干净）
export function cleanExpiredBuffs(flags, currentTurn) {
  if (!Array.isArray(flags)) return flags;
  return flags.filter(f => {
    const m = typeof f === "string" && f.match(/^buff_.+_untilturn_(\d+)$/);
    if (!m) return true;
    return currentTurn <= Number(m[1]);
  });
}

// 列出当前生效的七维 buff 及剩余回合数（供 UI 显示"体魄+1 · 还剩12回合"）
export function activeBuffsWithRemaining(flags, currentTurn) {
  const out = [];
  if (!Array.isArray(flags)) return out;
  for (const f of flags) {
    const m = typeof f === "string" && f.match(/^buff_(.+?)\+(\d+)_untilturn_(\d+)$/);
    if (!m) continue;
    const remaining = Number(m[3]) - currentTurn;
    if (remaining >= 0) out.push({ attr: m[1], val: Number(m[2]), remaining });
  }
  return out;
}

// ── ② 战前餐 buff（下一场战斗，一次性）──
// pendingCombatBuff 字段（都可累加，吃多份叠加）：
//   waigong    外功加成（进战斗后叠到玩家 baseAtk 的外功里，攻击更重）
//   moveMul    所有攻击招式倍率 +此值（"武功发挥"更强，如 +0.2）
//   energyBonus 起手真气 +此值（回气：开战时能量更高）
//   hpBonusRatio 起手气血按最大值 +此比例（回血：开战即多一截血，如 0.3）
// 说明：印记/引爆/连挡等具体机制的强化，通过 moveMul 统一体现在招式威力上；
// 若日后要单独强化某个机制，再在此扩字段、并在 DuelScreen 应用处对应处理。
export function mergeCombatBuff(cur, add) {
  const b = { ...(cur || {}) };
  for (const [k, v] of Object.entries(add || {})) b[k] = (b[k] || 0) + v;
  return b;
}

// 把战前餐 buff 应用到进入战斗的玩家数值上，返回 { waigong, moveMul, energyBonus, hpBonusRatio }
// 的规整结果（缺省全 0），供 DuelScreen 消费。
export function resolveCombatBuff(pendingCombatBuff) {
  const b = pendingCombatBuff || {};
  return {
    waigong: b.waigong || 0,
    moveMul: b.moveMul || 0,
    energyBonus: b.energyBonus || 0,
    hpBonusRatio: b.hpBonusRatio || 0,
  };
}
