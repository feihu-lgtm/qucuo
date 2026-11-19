// 招式原型系统：同一个"原型"（比如防守反击/硬攻/致乱），效果随品阶(levelCap)
// 逐档变浓——这就是"红名的听桥和平民的听桥不一样"的落地。
//
// 【为什么这么设计】上一版专属招式只换名字、数值和特效全继承同一个模板，等于
// 换汤不换药。真正该有的是：一个平民也会"防守反击"，但他的防守反击就是挡一下、
// 反打一点点；一个红名高手的防守反击（听桥）是近乎全免+满额反打+抢先结算+对手
// 应对失败还要重罚。同一个原型，档位越高，解锁的特效越多、越狠。
//
// 【怎么用】NPC 在 npcSignatureMoves.js 里给每个槽位声明一个 archetype（原型id）
// + 专属名字；deriveSignatureMoveset 用 resolveArchetype(原型, levelCap) 算出这个
// 档位下该有的完整效果，再套上专属名字。这样：
//   - 桑杰朵杰(红5)的"如如不动"[防守反击原型] = 全套红档特效
//   - 一个白袍杂鱼的"硬架"[防守反击原型]      = 只有基础减伤
// 不用给每个人手写特效，特效由"原型×品阶"自动算出来。
//
// 【结构】每个原型 = { type, tiers:[t0..t5] }。tiers[cap] 是"到这一档新增/改写的
// 字段"。resolveArchetype 把 tiers[0..cap] 依次合并（后档覆盖前档的数值、新特效
// 累加进来），得到该档位的完整招式效果。
//
// 【数值说明】baseAtk 现在由外功统一算（见 npcGeneration.js 的 atkFromWaigong），
// 这里的 baseDamageMultiplier 只是招式自己的倍率，不含品阶数值——品阶的"数值强度"
// 已经通过"NPC外功随levelCap升高"体现了，这里的 tiers 主要管"特效丰富度"。

import { MOVE_TYPE } from "./moveTypes.js";

// 合并 tiers[0..cap]，后档覆盖前档
function mergeTiers(tiers, cap) {
  const c = Math.max(0, Math.min(5, cap));
  return Object.assign({}, ...tiers.slice(0, c + 1));
}

export const MOVE_ARCHETYPES = {
  // ── 防守反击（听桥家族）：防御类，档位越高越接近"全免+满反打+抢先" ──
  防守反击: {
    type: MOVE_TYPE.DEFENSE,
    tiers: [
      // 白：挡一下，几乎没反击
      { energyCost: 2, baseDamageMultiplier: 0.6, onCounterSuccessDamageRatio: 0.2 },
      // 绿：挡得稳一点，反打略增
      { energyCost: 3, baseDamageMultiplier: 0.5, onCounterSuccessDamageRatio: 0.35 },
      // 蓝：应对成功开始回气
      { energyCost: 4, baseDamageMultiplier: 0.4, onCounterSuccessDamageRatio: 0.5, onCounterSuccessEnergyGain: 2 },
      // 紫：反打成型，应对失败开始有代价
      { energyCost: 5, baseDamageMultiplier: 0.3, onCounterSuccessDamageRatio: 0.7, onCounterFailEnergyPenalty: 3 },
      // 橙：近乎全免，满额反打
      { energyCost: 6, baseDamageMultiplier: 0.15, onCounterSuccessDamageRatio: 1.0, onCounterSuccessEnergyGain: 3, onCounterFailEnergyPenalty: 4, counterStacksGrowth: 0.2 }, // 橙：连挡越守气势越长，反打渐狠
      // 红名：听桥——近乎全免 + 满反打 + 抢先结算(可能反杀) + 连挡叠势 + 运功自解 + 应对失败防御失效重罚
      { energyCost: 6, baseDamageMultiplier: 0.05, onCounterSuccessDamageRatio: 1.0, onCounterSuccessPreemptive: true, onCounterSuccessEnergyGain: 3, onCounterFailEnergyPenalty: 5, onCounterFailDefenseNullified: true, counterStacksGrowth: 0.3, dispelSelf: true },
    ],
  },

  // ── 硬攻（一剑西来家族）：攻击类，档位越高倍率越大，顶档带无视/必先 ──
  硬攻: {
    type: MOVE_TYPE.ATTACK,
    tiers: [
      { energyCost: 2, baseDamageMultiplier: 1.0 },
      { energyCost: 3, baseDamageMultiplier: 1.15 },
      { energyCost: 4, baseDamageMultiplier: 1.3 },
      { energyCost: 5, baseDamageMultiplier: 1.5, doubleVsStatus: true }, // 紫：克中状态招翻倍
      { energyCost: 7, baseDamageMultiplier: 1.8, doubleVsStatus: true, ignoreDefense: true, afterStatusBonus: 0.4, detonateMark: { perStackRatio: 0.4 } }, // 橙：无视防御 + 趁中招追击 + 引爆内伤
      { energyCost: 8, baseDamageMultiplier: 2.2, doubleVsStatus: true, ignoreDefense: true, forceFirst: true, nullifyStatusOnHit: true, afterStatusBonus: 0.6, detonateMark: { perStackRatio: 0.6 } }, // 红：必先+命中废招+趁中招重击+重手引爆
    ],
  },

  // ── 趁虚（读牌攻击）：档位越高，越能抓对手的"能量空/刚防御"下重手 ──
  趁虚: {
    type: MOVE_TYPE.ATTACK,
    tiers: [
      { energyCost: 2, baseDamageMultiplier: 0.9 },
      { energyCost: 2, baseDamageMultiplier: 1.0 },
      { energyCost: 3, baseDamageMultiplier: 1.1, lowEnemyEnergyBonus: { threshold: 2, multiplier: 2 } }, // 蓝：敌能量≤2时×2
      { energyCost: 3, baseDamageMultiplier: 1.2, lowEnemyEnergyBonus: { threshold: 2, multiplier: 3 } },
      { energyCost: 4, baseDamageMultiplier: 1.3, lowEnemyEnergyBonus: { threshold: 3, multiplier: 3 }, afterCounterBonus: 0.8, afterStatusBonus: 0.6 }, // 橙：应对成功/刚中招都能追击
      { energyCost: 4, baseDamageMultiplier: 1.4, lowEnemyEnergyBonus: { threshold: 3, multiplier: 4 }, afterCounterBonus: 1.5, afterStatusBonus: 1.0, detonateMark: { perStackRatio: 0.5 } }, // 红：满读牌 + 趁中招重击 + 引爆
    ],
  },

  // ── 致乱（惑心/夺魂/摄魂/天惊家族）：状态类，档位越高扰乱手段越毒 ──
  致乱: {
    type: MOVE_TYPE.STATUS,
    tiers: [
      { energyCost: 3, confuseChance: 0.3 },
      { energyCost: 4, confuseChance: 0.45 },
      { energyCost: 5, confuseChance: 0.6 }, // 蓝：惑心步
      { energyCost: 6, confuseChance: 0.6, energyDiffDamage: true }, // 紫：夺魂手，打能量差
      { energyCost: 7, confuseChance: 0.7, energyDiffDamage: true, freezeEnergyRecovery: true, applyMark: { name: "内伤", stacks: 1, max: 5 } }, // 橙：摄魂引，冻回气 + 神魂震荡积内伤
      { energyCost: 8, confuseChance: 0.7, energyDiffDamage: true, freezeEnergyRecovery: true, doubleReflectDamage: true, applyMark: { name: "内伤", stacks: 2, max: 5 } }, // 红：天惊诀，二倍反弹 + 叠两道内伤印
    ],
  },

  // ── 封穴耗气（阴人流）：状态类，抬高对手出招耗气、冻结回气，逼对方枯竭 ──
  封穴: {
    type: MOVE_TYPE.STATUS,
    tiers: [
      { energyCost: 3, enemyCostPenalty: { value: 1, turns: 2 } },
      { energyCost: 3, enemyCostPenalty: { value: 2, turns: 2 } },
      { energyCost: 4, enemyCostPenalty: { value: 2, turns: 3 } },
      { energyCost: 5, enemyCostPenalty: { value: 3, turns: 3 }, freezeEnergyRecovery: true },
      { energyCost: 6, enemyCostPenalty: { value: 4, turns: 3 }, freezeEnergyRecovery: true, applyStatus: { name: "点穴禁招", chance: 0.4 }, applyMark: { name: "内伤", stacks: 1, max: 5 } }, // 橙：点穴禁招 + 穴道淤积
      { energyCost: 6, enemyCostPenalty: { value: 5, turns: 3 }, freezeEnergyRecovery: true, applyStatus: { name: "麻穴", chance: 0.5 }, applyMark: { name: "内伤", stacks: 1, max: 5 } }, // 红：麻穴 + 淤积
    ],
  },

  // ── 蓄势（蓄力家族）：状态类，为下一击蓄力，档位越高蓄得越猛 ──
  蓄势: {
    type: MOVE_TYPE.STATUS,
    tiers: [
      { energyCost: 2, nextAttackBonus: 0.3 },
      { energyCost: 2, nextAttackBonus: 0.4 },
      { energyCost: 3, nextAttackBonus: 0.6 },
      { energyCost: 3, nextAttackBonus: 0.9 },
      { energyCost: 4, nextAttackBonus: 1.3 },
      { energyCost: 4, nextAttackBonus: 1.8, dispelSelf: true }, // 红：蓄力之际以浑厚内力逼出毒穴，一举两得
    ],
  },

  // ── 施毒（下毒/裂伤家族）：状态类，按档位施加不同的掉血异常 ──
  施毒: {
    type: MOVE_TYPE.STATUS,
    tiers: [
      { energyCost: 3, applyStatus: { name: "淬毒", chance: 0.5 } },
      { energyCost: 3, applyStatus: { name: "淬毒", chance: 0.7 } },
      { energyCost: 4, applyStatus: { name: "裂伤", chance: 0.6 } },
      { energyCost: 4, applyStatus: { name: "裂伤", chance: 0.8 }, applyMark: { name: "内伤", stacks: 1, max: 5 } }, // 紫：裂伤之余在体内积一道内伤印
      { energyCost: 5, applyStatus: { name: "剧毒", chance: 0.6 }, applyMark: { name: "内伤", stacks: 1, max: 5 } }, // 橙：剧毒 + 叠印
      { energyCost: 5, applyStatus: { name: "剧毒", chance: 0.85 }, applyMark: { name: "内伤", stacks: 2, max: 5 } }, // 红：剧毒 + 每次叠两道内伤印
    ],
  },

  // ── 回气（保底原型）：能量枯竭时人人可用，档位只微调回复量，不叠特效 ──
  回气: {
    type: MOVE_TYPE.STATUS,
    isRecover: true, // 标记：这是保底回气位，deriveSignatureMoveset 特殊处理
    tiers: [
      { energyCost: 0, energyRestore: 4 },
      { energyCost: 0, energyRestore: 4 },
      { energyCost: 0, energyRestore: 5 },
      { energyCost: 0, energyRestore: 5 },
      { energyCost: 0, energyRestore: 6 },
      { energyCost: 0, energyRestore: 6 },
    ],
  },

  // ── 疗伤（运功疗伤家族）：状态类自益，回复自身气血（按"最大气血比例"，而非固定点数，
  // 以适配不同内功档位的血量），耗气不低。与【回气】的区别：回气回的是能量、零消耗、
  // 人人保底可用；疗伤回的是气血、要耗气，且只有专属表里显式配了「疗伤」槽的角色才有
  // （医家/佛门/内功深厚者），不是人人都会。回血无条件结算（选了就回，与回气一致，不被
  // 相克打断），但用疗伤这回合若被攻击命中一样会挨打——净值决定续航，自带博弈。 ──
  疗伤: {
    type: MOVE_TYPE.STATUS,
    tiers: [
      { energyCost: 3, hpRestore: 0.08 },
      { energyCost: 3, hpRestore: 0.10 },
      { energyCost: 4, hpRestore: 0.13 }, // 蓝
      { energyCost: 4, hpRestore: 0.16 }, // 紫
      { energyCost: 5, hpRestore: 0.20 }, // 橙
      { energyCost: 5, hpRestore: 0.25 }, // 红：一运功回四分之一气血
    ],
  },
};

// 把一个原型在指定品阶下解析成完整招式效果对象（不含名字/id，那些由专属表提供）
export function resolveArchetype(archetypeId, levelCap = 0) {
  const arch = MOVE_ARCHETYPES[archetypeId];
  if (!arch) return null;
  return {
    type: arch.type,
    ...mergeTiers(arch.tiers, levelCap),
  };
}

export function archetypeType(archetypeId) {
  return MOVE_ARCHETYPES[archetypeId]?.type || null;
}
