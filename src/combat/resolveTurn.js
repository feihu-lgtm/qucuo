// 切磋战斗 · 回合结算引擎
// 输入双方这回合选的招式（及跨回合状态），输出结构化结果：谁生效、扣多少血/能量、
// 施加什么状态、给对方留下什么后续影响。全本地数值计算，AI 不参与判定，只把算好的
// 结果包装成文字。
//
// 【本轮大改】统一战力（baseAtk 由外功算、见 npcGeneration.atkFromWaigong）+ 复活
// 一批此前"声明了但没结算分支"的死 flag（forceFirst/ignoreDefense/onCounterFail 等）+
// 新增读牌/耗气/蓄势等跨回合特效。跨回合信息通过 side 上的 lastCounterSuccess/
// pendingAtkBonus/costPenalty 传入，结果里通过 counterSuccess*/pendingAtkBonusTo*/
// costPenaltyTo*/freezeEnergyTo*/defenseBroken* 传出，由 DuelScreen 存进下一回合。

import { judgeTypeMatchup, MOVE_TYPE } from "./moveTypes.js";
import { applyStatus, tickStatusEffects } from "./statusEffects.js";
import { defFromNeigong } from "../npcGeneration.js";

const BASE_ATK = 20; // baseAtk 缺省兜底（正常玩家/NPC 都会带上按外功算好的 baseAtk）

// 防御力 = (基础防御力+装备防御力) × 防御系数(招式) × 根骨系数，只在防御类招式
// 判定生效那一回合才结算（不是被动全程生效——护甲穿着不代表白天黑夜都在减伤，
// 是"这一回合选择了防御"才用上）。防御系数直接从招式自带的 baseDamageMultiplier
// 换算——那个字段原本是"折扣后还剩多少伤害"（0.05~0.6，越小防得越好），这里用
// (1-baseDamageMultiplier) 反过来当"防御力发挥比例"（招式折扣越狠，说明这招本身
// 越擅长防御，装备/内功的防御力这次也发挥得越充分），不新增字段、不改动
// moveArchetypes.js 已经调好的招式强度曲线。
function calcDefenseValue(defenderSide, defenseMove) {
  const armorDef = defenderSide?.equipDef ?? 0;
  const baseDef = defFromNeigong(defenderSide?.neigong ?? 0);
  const genGuCoef = 0.8 + (defenderSide?.special?.根骨 ?? 5) * 0.04; // 0.8~1.2，同力量系数同款写法
  const defenseEffectRatio = 1 - (defenseMove?.baseDamageMultiplier ?? 0.6);
  return Math.round((baseDef + armorDef) * defenseEffectRatio * genGuCoef);
}

// 计算一次技能命中的基础伤害。
// 伤害 = (基础攻击力 + 装备攻击力) × 招式倍率 × 力量系数(体魄)
// 【本轮修正双重计算】外功已经通过 baseAtk（atkFromWaigong）体现、内功已经通过
// 气血上限（hpFromNeigong）体现，所以这里不再乘 waigong/neigong 系数——否则外功
// 内功各顶两遍，伤害爆炸、一击秒杀。现在分工干净：外功=攻击段位(baseAtk)、
// 内功=生存段位(气血)、体魄=同档内的力量微调、武学=招式倍率、装备=额外攻击。
function calcBaseDamage(move, attacker, defender) {
  const special = attacker?.special;
  const strengthCoef = 0.8 + (special?.体魄 ?? 5) * 0.04; // 0.8~1.2
  const atk = (attacker?.baseAtk ?? BASE_ATK) + (attacker?.equipAtk ?? 0);

  let multiplier = move.baseDamageMultiplier ?? 1;

  // ── 博弈层（总纲第十二章）──
  if (move.selfSacrifice) {
    multiplier = move.selfSacrifice.damageMultiplier ?? multiplier;
  } else if (move.allInDamage) {
    const spentEnergy = attacker?.energy?.[0] ?? 0;
    multiplier = Math.max(0.5, spentEnergy / 2);
  } else if (move.lowHpBonus) {
    const hpRatio = (attacker?.hp?.[0] ?? 1) / Math.max(1, attacker?.hp?.[1] ?? 1);
    const lostRatioInTenths = Math.floor((1 - hpRatio) * 10);
    multiplier += move.lowHpBonus * lostRatioInTenths;
  }

  // ── 读牌型加成（C类）──
  if (move.highHpBonus) {
    const hpRatio = (attacker?.hp?.[0] ?? 1) / Math.max(1, attacker?.hp?.[1] ?? 1);
    if (hpRatio >= 0.8) multiplier += move.highHpBonus; // 满血/高血才加
  }
  if (move.selfDebuffBonus) {
    const hasDebuff = attacker?.statusSlots?.control || attacker?.statusSlots?.drain;
    if (hasDebuff) multiplier += move.selfDebuffBonus; // 自己带减益反而更狠
  }
  if (move.afterCounterBonus && attacker?.lastCounterSuccess) {
    multiplier += move.afterCounterBonus; // 上回合应对成功，乘胜追击
  }
  if (move.afterStatusBonus && attacker?.lastStatusApplied) {
    multiplier += move.afterStatusBonus; // 上回合成功施加状态/印记，趁对方气机紊乱补一记重手
  }
  if (attacker?.pendingAtkBonus) {
    multiplier += attacker.pendingAtkBonus; // 上回合蓄势兑现
  }
  // lowEnemyEnergyBonus 是"乘算"（趁对方能量枯竭下重手），放最后
  if (move.lowEnemyEnergyBonus) {
    const { threshold = 2, multiplier: m = 2 } = move.lowEnemyEnergyBonus;
    if ((defender?.energy?.[0] ?? 99) <= threshold) multiplier *= m;
  }

  // ── 神兵特效（乘算，放在最末）──
  // forceCrit（虎啸）：必定暴击，按 multiplier 倍率放大
  if (move.forceCrit) {
    const critMul = (typeof move.forceCrit === "object" ? move.forceCrit.multiplier : 1.8) ?? 1.8;
    multiplier *= critMul;
  }
  // justiceStrike（地藏）：对方带"不义"标记（终局对抗土司府势力）时伤害翻倍
  if (move.justiceStrike && defender?.factionUnjust) {
    multiplier *= 2;
  }

  return Math.round(atk * multiplier * strengthCoef);
}

// 同类型对撞比"身法"（速度）；forceFirst 无视身法强行先手
function decideFirst(sideA, sideB) {
  if (sideA.move.forceFirst && !sideB.move.forceFirst) return "A";
  if (sideB.move.forceFirst && !sideA.move.forceFirst) return "B";
  const sa = sideA.special?.身法 ?? 5, sb = sideB.special?.身法 ?? 5;
  if (sa === sb) return Math.random() < 0.5 ? "A" : "B";
  return sa > sb ? "A" : "B";
}

// 通用状态施加：move.applyStatus = { name, chance }；旧的 confuseChance 视为施加"气乱"。
function rollStatusApply(move) {
  if (move.confuseChance && Math.random() < move.confuseChance) return "气乱";
  if (move.applyStatus && Math.random() < (move.applyStatus.chance ?? 1)) return move.applyStatus.name;
  return null;
}

export function resolveTurn(sideA, sideB) {
  const result = {
    matchup: null, speedWinner: null,
    damageToA: 0, damageToB: 0,
    energyDeltaA: 0, energyDeltaB: 0,
    statusAppliedToA: null, statusAppliedToB: null,
    counterTriggered: false,
    // 博弈层
    selfHpCostA: 0, selfHpCostB: 0,
    moveGrowthA: null, moveGrowthB: null,
    // 本轮新增的跨回合传出字段
    counterSuccessA: false, counterSuccessB: false,        // 本回合谁应对成功（供下回合 afterCounterBonus）
    pendingAtkBonusToA: 0, pendingAtkBonusToB: 0,          // 蓄势：给下回合的威力加成
    costPenaltyToA: null, costPenaltyToB: null,            // 封穴：抬高对方后续耗气 {value,turns}
    freezeEnergyToA: false, freezeEnergyToB: false,        // 冻结对方下回合回气
    defenseBrokenA: false, defenseBrokenB: false,          // 防御被状态克穿，下回合防御失效
    moveCostReductionA: null, moveCostReductionB: null,    // permanentCostReductionOnUse
    consumedPendingA: false, consumedPendingB: false,      // 本回合是否消耗了蓄势加成
    // ── 第二/三批新增 ──
    statusSuccessA: false, statusSuccessB: false,          // 我方本回合是否成功给对方施加状态/印记（供下回合 afterStatusBonus）
    markAppliedToA: null, markAppliedToB: null,            // 本回合给对方叠的印记 {name, stacks, max}
    markDetonatedOnA: 0, markDetonatedOnB: 0,              // 本回合引爆了对方多少层印记（>0 时 DuelScreen 负责清空对方 mark 槽）
    dispelSelfA: false, dispelSelfB: false,                // 本回合我方是否驱散了自身控制/掉血状态
    hpRestoreA: 0, hpRestoreB: 0,                           // 疗伤：本回合各自回复的气血量（由 DuelScreen 落到 hp 上，不超上限）
    notes: [],
  };

  // 叠印记：把 move.applyMark 记成"给对方叠印"，并标记我方施加成功（触发下回合 afterStatusBonus）。
  // 支持 move.applyMarkChance（0~1）：装备特效叠上来的印记多带概率，掷骰命中才叠；
  // 招式自带的 applyMark 通常无 chance 字段（默认必叠，保持既有招式行为不变）。
  const markApply = (move, targetTag, winnerTag) => {
    if (!move.applyMark) return;
    const chance = move.applyMarkChance ?? 1;
    if (Math.random() >= chance) return;
    const { name = "内伤", stacks = 1, max = 5 } = move.applyMark;
    result[`markAppliedTo${targetTag}`] = { name, stacks, max };
    result[`statusSuccess${winnerTag}`] = true;
  };
  // 引爆印记：读被引爆方当前印记层数，按 baseAtk×perStackRatio×层数 追加伤害，并标记清空。
  const detonate = (move, loserSide, dmgTargetTag, attacker) => {
    if (!move.detonateMark) return;
    const mk = loserSide.statusSlots?.mark;
    const stacks = mk?.stacks ?? 0;
    if (stacks <= 0) return;
    const perStack = move.detonateMark.perStackRatio ?? 0.4;
    const atk = (attacker?.baseAtk ?? BASE_ATK) + (attacker?.equipAtk ?? 0);
    result[`damageTo${dmgTargetTag}`] += Math.round(atk * perStack * stacks);
    result[`markDetonatedOn${dmgTargetTag}`] = stacks;
    result.notes.push(`${move.name}震爆对方体内积压的${stacks}道${mk.name}，暗伤迸发`);
  };
  // 挨打反叠印（applyMarkOnHit，如欢喜法衣）：防御方的护甲带此特效时，攻击方一旦
  // 命中防御方，反被叠一道内伤印——"打这袍子的人自己沾暗伤"。defMove 是防御方的招
  // （已被 mergeMoveWithEquip 叠上护甲特效），attackerTag 是攻击方的标签。
  const applyMarkOnHitCheck = (defMove, defTag, attackerTag) => {
    if (!defMove.applyMarkOnHit) return;
    const chance = defMove.applyMarkChance ?? 1;
    if (Math.random() >= chance) return;
    const mk = defMove.applyMark || { name: "内伤", stacks: 1, max: 5 };
    result[`markAppliedTo${attackerTag}`] = { name: mk.name ?? "内伤", stacks: mk.stacks ?? 1, max: mk.max ?? 5 };
    result.notes.push(`触及那身诡异衣料，一缕暗劲反噬，攻方隐隐添了内伤`);
  };

  // 蓄势加成用掉就要清（标记给 DuelScreen 清除）
  if (sideA.pendingAtkBonus) result.consumedPendingA = true;
  if (sideB.pendingAtkBonus) result.consumedPendingB = true;

  const matchup = judgeTypeMatchup(sideA.move.type, sideB.move.type);
  result.matchup = matchup;

  if (matchup === "tie") {
    const winner = decideFirst(sideA, sideB);
    result.speedWinner = winner;
    if (sideA.move.type === MOVE_TYPE.ATTACK) {
      const dmgA = calcBaseDamage(sideA.move, sideA, sideB);
      const dmgB = calcBaseDamage(sideB.move, sideB, sideA);
      // 先手方若一击能打死后手方，后手方来不及还手（先手击杀免伤）
      const first = winner === "A" ? { dmg: dmgA, targetHp: sideB.hp?.[0] ?? 1 } : { dmg: dmgB, targetHp: sideA.hp?.[0] ?? 1 };
      const firstKills = first.dmg >= first.targetHp;
      result.damageToB = dmgA;
      result.damageToA = dmgB;
      if (firstKills) {
        if (winner === "A") { result.damageToA = 0; result.notes.push(`${sideA.move.name}抢在身前一击制敌，对方再无还手之力`); }
        else { result.damageToB = 0; result.notes.push(`${sideB.move.name}抢先得手，你的攻势尚未递出便已落败`); }
      } else {
        result.notes.push(`同为攻招硬碰硬，${winner === "A" ? "你" : "对方"}快了半分`);
      }
      // 双攻硬碰，双方都命中：各自的 applyMark 都可触发
      markApply(sideA.move, "B", "A"); detonate(sideA.move, sideB, "B", sideA);
      markApply(sideB.move, "A", "B"); detonate(sideB.move, sideA, "A", sideB);
    } else if (sideA.move.type === MOVE_TYPE.DEFENSE) {
      result.notes.push("双方皆采守势，僵持不下，未有实质交锋");
    } else {
      // 双方都用状态类，各自独立生效
      const sa = rollStatusApply(sideA.move); if (sa) result.statusAppliedToB = sa;
      const sb = rollStatusApply(sideB.move); if (sb) result.statusAppliedToA = sb;
      markApply(sideA.move, "B", "A");
      markApply(sideB.move, "A", "B");
      applySelfStatusMoveEffects(sideA, "A", result);
      applySelfStatusMoveEffects(sideB, "B", result);
      result.notes.push("双方各自运使身法，暗中角力");
    }
  } else {
    const winnerIsA = matchup === "A";
    const winnerSide = winnerIsA ? sideA : sideB;
    const loserSide = winnerIsA ? sideB : sideA;
    const winnerMove = winnerSide.move;
    const loserMove = loserSide.move;

    if (winnerMove.type === MOVE_TYPE.ATTACK) {
      // 攻击克状态：状态被打断，攻击命中
      let dmg = calcBaseDamage(winnerMove, winnerSide, loserSide);
      if (winnerMove.doubleVsStatus) { dmg *= 2; result.notes.push(`${winnerMove.name}克中对方状态招式，威力倍增`); }
      if (winnerIsA) result.damageToB = dmg; else result.damageToA = dmg;
      // nullifyStatusOnHit：确保被打断的状态招不会遗留任何施加效果（本就不会，这里显式保证）
      if (winnerMove.nullifyStatusOnHit) result.notes.push(`${loserMove.name}尚未运转便被${winnerMove.name}生生打散，全无效果`);
      else result.notes.push(`${loserMove.name}尚未运转完全，便被${winnerMove.name}正面打断`);
      // 攻击方自身的蓄势/施毒等自益（若这一招同时挂了）在这里也生效
      applySelfStatusMoveEffects(winnerSide, winnerIsA ? "A" : "B", result);
      // 命中即可叠印记（招式或装备带的 applyMark），并引爆对方已有印记
      markApply(winnerMove, winnerIsA ? "B" : "A", winnerIsA ? "A" : "B");
      detonate(winnerMove, loserSide, winnerIsA ? "B" : "A", winnerSide);
    } else if (winnerMove.type === MOVE_TYPE.STATUS) {
      // 【本轮修复·结构性错位】以下这一整段（"只顾防住正面"那句话起，直到状态招的
      // 全套效果）本来写在**攻击分支内部**——注释自己写着"状态克防御"，却落在了
      // "攻击克状态"里。两个后果：
      //   ① 攻击克状态时会同时输出两句意思重复的话，玩家看到的就是
      //      「踞原嗥月尚未运转完全，便被碎岩击正面打断。」
      //      「踞原嗥月只顾防住正面，却漏了碎岩击这一手。」——同一件事说两遍。
      //   ② 更要紧的是，攻击招赢的时候还会把**状态招的整套效果**跑一遍
      //      （施加状态、封回气、加耗、二倍反弹…）。那些效果本该只属于状态招取胜。
      // 补上这个 else if，各归各位。
      result.notes.push(`${loserMove.name}只顾防住正面，却漏了${winnerMove.name}这一手`);
      // 状态招的伤害/效果
      if (winnerMove.energyDiffDamage) {
        const dmg = Math.abs((sideA.energy?.[0] ?? 0) - (sideB.energy?.[0] ?? 0)) * 3;
        if (winnerIsA) result.damageToB += dmg; else result.damageToA += dmg;
      }
      if (winnerMove.doubleReflectDamage) {
        const wouldBlock = calcBaseDamage(loserMove, loserSide, winnerSide) * (loserMove.baseDamageMultiplier ?? 0.5);
        const reflect = Math.round(wouldBlock * 2);
        if (winnerIsA) result.damageToB += reflect; else result.damageToA += reflect;
        result.notes.push(`${winnerMove.name}二倍反弹，力道尽数奉还`);
      }
      const st = rollStatusApply(winnerMove);
      if (st) { if (winnerIsA) result.statusAppliedToB = st; else result.statusAppliedToA = st; }
      markApply(winnerMove, winnerIsA ? "B" : "A", winnerIsA ? "A" : "B");
      if (winnerMove.freezeEnergyRecovery) {
        if (winnerIsA) result.freezeEnergyToB = true; else result.freezeEnergyToA = true;
        result.notes.push(`${loserMove.name === loserSide.move.name ? "对方" : ""}回气被封，下回合无法调息`);
      }
      if (winnerMove.enemyCostPenalty) {
        if (winnerIsA) result.costPenaltyToB = { ...winnerMove.enemyCostPenalty };
        else result.costPenaltyToA = { ...winnerMove.enemyCostPenalty };
        result.notes.push(`${winnerMove.name}扰乱对方气机，其后数招出手愈发滞涩`);
      }
      applySelfStatusMoveEffects(winnerSide, winnerIsA ? "A" : "B", result);
      // 防御方"应对失败"的惩罚（听桥系高风险防御赌输了要付代价）
      if (loserMove.onCounterFailEnergyPenalty) {
        if (winnerIsA) result.energyDeltaB -= loserMove.onCounterFailEnergyPenalty;
        else result.energyDeltaA -= loserMove.onCounterFailEnergyPenalty;
        result.notes.push(`${loserMove.name}这一守赌错了方向，真气虚耗`);
      }
      if (loserMove.onCounterFailDefenseNullified) {
        if (winnerIsA) result.defenseBrokenB = true; else result.defenseBrokenA = true;
        result.notes.push(`守势被看穿，门户大开，下回合再难守住`);
      }

    } else {
      // 防御克攻击：防御生效大幅减伤，可能触发应对反击
      const rawDmg = calcBaseDamage(loserMove, loserSide, winnerSide); // 攻击方本来的伤害
      // 防御方装备的"部分免疫无视防御"（如守塔僧团铁网衲/官铸镇边重铠）：
      // 当攻击方用 ignoreDefense 时，本来防御白挡全额吃伤，但这层护甲能挡下
      // partialImmune 比例（0~1）的那部分伤害，让"无视防御"不再是100%生效。
      const partialImmune = winnerMove.ignoreDefensePartialImmune ?? winnerSide.ignoreDefensePartialImmune ?? 0;
      // 【ignoreDefenseRatio·此前是死 flag】ignoreDefense 是"全部无视防御"的布尔，
      // 而 ignoreDefenseRatio 是"只无视其中一部分"的小数版（开山锤0.3、十三针囊0.3、
      // 三棱透骨钉0.4，还有唐门那套暗器）。它进了 itemEffectText 的词典、界面上
      // 老老实实显示着「破防」，战斗里却**一处都没读**——玩家看着破防生效，实际
      // 挨的是满额防御减伤。这里补上：按比例把一部分伤害走"无视防御"通道结算。
      const idRatio = Math.max(0, Math.min(1, loserMove.ignoreDefenseRatio ?? loserSide.ignoreDefenseRatio ?? 0));
      if (!loserMove.ignoreDefense && idRatio > 0) {
        const pierced = Math.round(rawDmg * idRatio);                 // 这部分绕过防御
        const immuned = partialImmune > 0 ? Math.round(pierced * partialImmune) : 0;
        const blockedPart = rawDmg - pierced;                          // 剩下的照常被防御削
        const reducedBlocked = Math.round(blockedPart * (loserMove.defenseDiscount ?? 0.35));
        const dmg = Math.max(1, pierced - immuned + reducedBlocked);
        if (winnerIsA) result.damageToA = dmg; else result.damageToB = dmg;
        result.notes.push(`${loserMove.name}专挑劲力薄处扎，${winnerMove.name}挡住了大半，仍被透进去几分`);
        applyMarkOnHitCheck(winnerMove, winnerIsA ? "A" : "B", winnerIsA ? "B" : "A");
      } else if (loserMove.ignoreDefense) {
        // 攻击方"无视防御"：防御大幅失效；但防御方若有部分免疫，仍能削掉一截
        const immuned = partialImmune > 0 ? Math.round(rawDmg * partialImmune) : 0;
        const dmg = Math.max(1, rawDmg - immuned);
        if (winnerIsA) result.damageToA = dmg; else result.damageToB = dmg;
        result.notes.push(immuned > 0
          ? `${loserMove.name}势大力沉，${winnerMove.name}的护体之力堪堪卸去几分，未被全然击穿`
          : `${loserMove.name}势大力沉，${winnerMove.name}竟未能卸去分毫`);
        // 部分免疫护甲同样触发"挨打叠印"（见下方 applyMarkOnHit 统一处理）
        applyMarkOnHitCheck(winnerMove, winnerIsA ? "A" : "B", winnerIsA ? "B" : "A");
      } else {
        // 招式自带折扣（原有强度曲线不变）之上，再叠一层装备/内功/根骨带来的
        // 固定防御力——这是这次新增的维度，见 calcDefenseValue 顶部注释。
        // 保底 1 点伤害：顶级防御配置（内功根骨拉满+橙红护甲+红档听桥类招式）
        // 数学上可能把 reduced 完全吃掉，保底避免出现"永远0伤害、战斗打不动"的僵局。
        const reduced = Math.round(rawDmg * (winnerMove.baseDamageMultiplier ?? 0.6));
        const defenseValue = calcDefenseValue(winnerSide, winnerMove);
        const finalReduced = Math.max(1, reduced - defenseValue);
        let counterDmg = 0;
        if (winnerMove.onCounterSuccessDamageRatio) {
          counterDmg = Math.round(rawDmg * winnerMove.onCounterSuccessDamageRatio);
          result.counterTriggered = true;
          if (winnerIsA) result.counterSuccessA = true; else result.counterSuccessB = true;
        }
        // 抢先结算：反击若能一击击杀攻击方，防御方免掉这次减伤后的伤害
        const attackerHp = loserSide.hp?.[0] ?? 1;
        const preemptiveKill = winnerMove.onCounterSuccessPreemptive && counterDmg >= attackerHp;
        if (winnerIsA) {
          result.damageToB += counterDmg;
          result.damageToA = preemptiveKill ? 0 : finalReduced;
        } else {
          result.damageToA += counterDmg;
          result.damageToB = preemptiveKill ? 0 : finalReduced;
        }
        result.notes.push(
          counterDmg > 0
            ? `${winnerMove.name}稳稳架住来招，反手一击${preemptiveKill ? "抢先制敌，对方再无还手" : "凌厉奉还"}`
            : `${winnerMove.name}架住来招，${loserMove.name}力道去了大半`
        );
        if (winnerMove.onCounterSuccessEnergyGain) {
          if (winnerIsA) result.energyDeltaA += winnerMove.onCounterSuccessEnergyGain;
          else result.energyDeltaB += winnerMove.onCounterSuccessEnergyGain;
        }
        // 挨打反叠印：防御方护甲带 applyMarkOnHit，架住来招时攻方触及衣料反沾内伤
        applyMarkOnHitCheck(winnerMove, winnerIsA ? "A" : "B", winnerIsA ? "B" : "A");
      }
    }
  }

  // 能量结算：双方按自己招式扣能量（叠加封穴带来的临时耗气惩罚），回气招回能量
  const costA = (sideA.move.energyCost ?? 0) + (sideA.costPenalty ?? 0);
  const costB = (sideB.move.energyCost ?? 0) + (sideB.costPenalty ?? 0);
  result.energyDeltaA -= costA;
  result.energyDeltaB -= costB;
  if (sideA.move.energyRestore) result.energyDeltaA += sideA.move.energyRestore;
  if (sideB.move.energyRestore) result.energyDeltaB += sideB.move.energyRestore;

  // 疗伤：按最大气血比例回血，无条件生效（与回气一致，不被相克打断）；实际加血由 DuelScreen
  // 夹到上限。用疗伤这回合仍可能挨打，净值决定续航。
  if (sideA.move.hpRestore) { result.hpRestoreA = Math.round((sideA.hp?.[1] ?? 100) * sideA.move.hpRestore); result.notes.push(`${sideA.move.name}运转真气自疗，气血回复`); }
  if (sideB.move.hpRestore) result.hpRestoreB = Math.round((sideB.hp?.[1] ?? 100) * sideB.move.hpRestore);

  // 蓄势：把 nextAttackBonus 记成"给下回合的威力加成"（真正生效，不再只是文字）
  if (sideA.move.nextAttackBonus) { result.pendingAtkBonusToA = sideA.move.nextAttackBonus; result.notes.push("蓄势已成，下一击威力大涨"); }
  if (sideB.move.nextAttackBonus) result.pendingAtkBonusToB = sideB.move.nextAttackBonus;

  // 博弈层：燃血 / 孤注 / 永久成长 / 永久降耗
  if (sideA.move.selfSacrifice) { result.selfHpCostA = Math.round((sideA.hp?.[1] ?? 100) * sideA.move.selfSacrifice.hpCost); result.notes.push(`${sideA.move.name}燃烧自身气血催动`); }
  if (sideB.move.selfSacrifice) result.selfHpCostB = Math.round((sideB.hp?.[1] ?? 100) * sideB.move.selfSacrifice.hpCost);
  if (sideA.move.allInDamage) result.energyDeltaA = -(sideA.energy?.[0] ?? 0);
  if (sideB.move.allInDamage) result.energyDeltaB = -(sideB.energy?.[0] ?? 0);
  if (sideA.move.permanentGrowthOnUse) result.moveGrowthA = { moveId: sideA.move.id, delta: sideA.move.permanentGrowthOnUse };
  if (sideB.move.permanentGrowthOnUse) result.moveGrowthB = { moveId: sideB.move.id, delta: sideB.move.permanentGrowthOnUse };
  if (sideA.move.permanentCostReductionOnUse) result.moveCostReductionA = { moveId: sideA.move.id, delta: sideA.move.permanentCostReductionOnUse };
  if (sideB.move.permanentCostReductionOnUse) result.moveCostReductionB = { moveId: sideB.move.id, delta: sideB.move.permanentCostReductionOnUse };

  return result;
}

// 状态招"施加在自己身上"的附带效果（蓄势 nextAttackBonus 已在主流程处理；这里预留
// 给未来的自益类，比如自回血/自增益。目前用于状态类互撞时也能触发施毒等施加判定已在
// 主流程 rollStatusApply 覆盖，此函数保持轻量、可扩展）。
function applySelfStatusMoveEffects(side, tag, result) {
  // 预留扩展位：当前主流程已覆盖 nextAttackBonus / applyStatus / confuse。
  // 保留此函数是为了让"状态招同时给自己上增益"这类未来需求有统一入口。
}

export function applyEndOfTurnStatus(sideA, sideB) {
  const tickA = tickStatusEffects(sideA.statusSlots, sideA.hp[1]);
  const tickB = tickStatusEffects(sideB.statusSlots, sideB.hp[1]);
  return {
    statusSlotsA: tickA.slots, statusSlotsB: tickB.slots,
    statusDamageA: tickA.damage, statusDamageB: tickB.damage,
    logA: tickA.log, logB: tickB.log,
  };
}
