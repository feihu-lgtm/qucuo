// 切磋战斗 · 异常状态系统
// 武侠化命名，机制照抄洛克王国：控制类互斥（同一时间只能有一种控制状态），
// 掉血类互斥（同一时间只能有一种掉血状态），两组之间不冲突（可以同时中毒又被点穴）。

export const STATUS_GROUP = {
  CONTROL: "control",   // 影响能否行动
  DRAIN: "drain",       // 持续掉血
};

export const STATUS_EFFECTS = {
  麻穴: {
    group: STATUS_GROUP.CONTROL,
    actionFailChance: 0.25,   // 25%几率本回合无法行动
    speedPenalty: 2,          // 速度值-2（用于同类型对撞时的先手判定）
    clearOnHitByType: "破",   // 受"破"类招式攻击有几率解除
    clearChance: 0.3,
  },
  气乱: {
    group: STATUS_GROUP.CONTROL,
    selfHitChance: 0.5,       // 50%几率打偏/攻击自己
    autoRecoverChance: 0.25,  // 每回合25%几率自愈
  },
  昏厥点: {
    group: STATUS_GROUP.CONTROL,
    actionFailChance: 1.0,    // 完全无法行动
    wakeOnHighDamage: true,   // 受到高威力攻击会清醒
    wakeThreshold: 0.3,       // 伤害超过己方最大气血30%视为高威力
  },
  冰蚕丝缚: {
    group: STATUS_GROUP.CONTROL,
    actionFailChance: 1.0,
    clearOnHitByType: "攻击", // 受攻击类招式攻击有几率解除
    clearChance: 0.3,
    noTurnLimit: true,        // 没有固定回合上限，只靠概率/克制解除
  },
  淬毒: {
    group: STATUS_GROUP.DRAIN,
    drainRatio: 1 / 8,        // 每回合损失1/8最大气血
    escalating: false,
  },
  剧毒: {
    group: STATUS_GROUP.DRAIN,
    drainRatioBase: 1 / 16,   // 递增版：初始1/16，每回合+1/16，封顶15/16
    escalating: true,
  },
  裂伤: {
    group: STATUS_GROUP.DRAIN,
    drainRatio: 1 / 8,
    atkPenalty: 2,            // 攻击力下降
    autoExpireTurns: 4,       // 固定回合后自动解除
  },
  点穴禁招: {
    group: STATUS_GROUP.CONTROL,
    firstStrikeHalved: true,  // 技能先手值减半（不能行动情况以外的效果，比如无法用红色技能抢先手）
    autoExpireTurns: 3,
  },
};

// 判定新施加的状态是否会替换掉已有的同组状态
export function willReplaceStatus(currentStatus, newStatusName) {
  if (!currentStatus) return { replace: true, previous: null };
  const curDef = STATUS_EFFECTS[currentStatus.name];
  const newDef = STATUS_EFFECTS[newStatusName];
  if (!curDef || !newDef) return { replace: true, previous: currentStatus.name };
  if (curDef.group === newDef.group) return { replace: true, previous: currentStatus.name };
  return { replace: false, previous: null }; // 不同组，两个状态可以共存，这里指"是否覆盖同一个槽位"
}

// 战斗单位可以同时携带的状态槽位：控制类一个槽位，掉血类一个槽位，印记一个槽位。
// 印记（mark）是本轮第三批新增的"可经营资源"——独立于控制/掉血两组，不参与它们的
// 互斥，专门用来承载"内伤印"这类可叠层、可被引爆的暗伤。
export function createEmptyStatusSlots() {
  return { control: null, drain: null, mark: null };
}

// ── 印记（内伤印）· 第三批新增 ──
// 语义：状态类招式命中时可往对方身上叠印（applyMark），攻击类招式可引爆（detonateMark）。
// 印记平时不掉血、不占控制/掉血槽（纯燃料），只在被引爆时按层数一次性追加伤害并清空。
// 这让"状态流叠印 → 攻击流引爆"成为一条可经营的连招线，而不再是孤立的二元开关。
export function applyMark(slots, name, stacks = 1, max = 5) {
  const cur = slots.mark;
  if (cur && cur.name === name) {
    return { ...slots, mark: { name, stacks: Math.min(max, cur.stacks + stacks) } };
  }
  // 异名印记直接替换：体内同一时间只积一种性质的暗伤，换了施加者的招数等于换了淤积性质。
  return { ...slots, mark: { name, stacks: Math.min(max, stacks) } };
}

// 引爆并清空印记，返回被引爆的层数（0 表示对方身上没有印记可引爆）与印记名。
export function detonateMark(slots) {
  const stacks = slots.mark?.stacks ?? 0;
  const name = slots.mark?.name ?? null;
  return { slots: { ...slots, mark: null }, stacks, name };
}

// 驱散自身的控制/掉血状态（dispelSelf 用）——运功自解毒穴，但不动印记（内伤消不掉，只能引爆）。
export function dispelControlDrain(slots) {
  return { ...slots, control: null, drain: null };
}

export function applyStatus(slots, statusName) {
  const def = STATUS_EFFECTS[statusName];
  if (!def) return slots;
  const slotKey = def.group === STATUS_GROUP.CONTROL ? "control" : "drain";
  return {
    ...slots,
    [slotKey]: { name: statusName, turnsElapsed: 0, damageCounter: 1 }, // damageCounter 给剧毒递增用
  };
}

export function clearStatus(slots, slotKey) {
  return { ...slots, [slotKey]: null };
}

// 每回合结束时的状态结算：掉血、递增剧毒、自动解除判定
// 返回 { slots: 更新后的状态槽, damage: 这回合状态造成的伤害, log: 描述文本数组 }
export function tickStatusEffects(slots, maxHp) {
  let { control, drain } = slots;
  let damage = 0;
  const log = [];

  if (drain) {
    const def = STATUS_EFFECTS[drain.name];
    let ratio = def.drainRatio;
    if (def.escalating) {
      const counter = Math.min(15, drain.damageCounter);
      ratio = counter / 16;
    }
    damage += Math.max(1, Math.round(maxHp * ratio));
    log.push(`${drain.name}发作，持续侵蚀气血`);
    const nextCounter = drain.damageCounter + 1;
    const expired = def.autoExpireTurns && drain.turnsElapsed + 1 >= def.autoExpireTurns;
    drain = expired ? null : { ...drain, turnsElapsed: drain.turnsElapsed + 1, damageCounter: nextCounter };
  }

  if (control) {
    const def = STATUS_EFFECTS[control.name];
    if (def.autoRecoverChance && Math.random() < def.autoRecoverChance) {
      log.push(`${control.name}状态自行缓解`);
      control = null;
    } else if (def.autoExpireTurns && control.turnsElapsed + 1 >= def.autoExpireTurns) {
      log.push(`${control.name}状态时限已到，自动解除`);
      control = null;
    } else {
      control = { ...control, turnsElapsed: control.turnsElapsed + 1 };
    }
  }

  // 印记（mark）不参与回合末结算（平时不掉血、不过期），但必须原样透传，
  // 否则每回合 tick 后 mark 会被丢弃、叠好的内伤印凭空消失。
  return { slots: { control, drain, mark: slots.mark ?? null }, damage, log };
}
