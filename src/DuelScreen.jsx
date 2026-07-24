// 切磋战斗界面
// 布局参照传统回合制对战游戏的信息组织方式（双方血条对峙+中央VS+底部技能栏），
// 视觉语言用曲措乡自己的水墨主题（zoneTheme），不是抄二次元卡通美术，
// 只是复用"血条在哪、技能在哪、回合提示在哪"这套久经考验的信息层级。

import React, { useState, useRef, useEffect } from "react";
import { QUALITY_COLOR, computeEquippedStats, effectiveSpecial, mergeItemEffects } from "./equipment.js";
import { MOVE_TYPE } from "./combat/moveTypes.js";
import { resolveTurn, applyEndOfTurnStatus } from "./combat/resolveTurn.js";
import { decideNpcMove } from "./combat/aiDecision.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";
import { getDefaultProfile } from "./combat/personalityProfile.js";
import { createEmptyStatusSlots, applyStatus, applyMark, dispelControlDrain } from "./combat/statusEffects.js";
import { rollBattleLoot, atkFromWaigong } from "./npcGeneration.js";
import { resolveCombatBuff } from "./utils/buffSystem.js";

const TYPE_ICON = { [MOVE_TYPE.ATTACK]: "⚔", [MOVE_TYPE.DEFENSE]: "🛡", [MOVE_TYPE.STATUS]: "☯" };

// 把装备特效叠进本回合招式。原则：招式自带的标志位优先（玩家主动选的招 >
// 被动装备增益），装备只补招式尚未拥有的字段——不覆盖、不叠加数值，避免
// "神兵+强招"双倍暴力。这样一件带"内伤印"的武器，配一个本身不叠印的攻击招时，
// 攻击招也能挂上内伤印；但配一个已经自带更高层内伤印的招时，以招式的为准。
function mergeMoveWithEquip(move, equipEffects) {
  if (!equipEffects || !Object.keys(equipEffects).length) return move;
  const merged = { ...move };
  for (const [k, v] of Object.entries(equipEffects)) {
    if (merged[k] == null) merged[k] = v; // 只补招式没有的
  }
  // applyMark 需要配套的 applyMarkChance 才会触发；装备的 chance 一起带过来
  if (equipEffects.applyMark && merged.applyMarkChance == null && equipEffects.applyMarkChance != null) {
    merged.applyMarkChance = equipEffects.applyMarkChance;
  }
  return merged;
}

// 封穴耗气惩罚的回合推进：已有惩罚 turns-1、到期清除；若这回合又被施加新惩罚，取
// 剩余回合更长/惩罚更重的那个（不无限叠加）。
function tickCostPenalty(current, incoming) {
  let cur = null;
  if (current && current.turns > 1) cur = { value: current.value, turns: current.turns - 1 };
  if (!incoming) return cur;
  if (!cur) return { ...incoming };
  return { value: Math.max(cur.value, incoming.value), turns: Math.max(cur.turns, incoming.turns) };
}

export default function DuelScreen({ npc, playerChar, pendingCombatBuff, playerInv, playerMoveset, zoneTheme, onFinish }) {
  // 战前餐 buff（消耗品系统第3步）：进场一次性应用。resolveCombatBuff 把 pendingCombatBuff
  // 规整成 { waigong, moveMul, energyBonus, hpBonusRatio }。起手血/气在这里落到初始 state 上，
  // waigong/moveMul 在每回合结算时叠进玩家攻击（见 handleSelectMove）。
  const combatBuff = resolveCombatBuff(pendingCombatBuff);
  const [playerHp, setPlayerHp] = useState(() => {
    const baseMax = playerChar.hp[1];
    // 战前餐"开战即多一截血"：把这一场的气血上限整体抬高 hpBonusRatio 一截，起手即满。
    // （不是临时护盾叠在满血之上被夹回——那样加成会立刻蒸发。）
    const boosted = Math.round(baseMax * (1 + (combatBuff.hpBonusRatio || 0)));
    return [boosted, boosted];
  });
  const [playerEnergy, setPlayerEnergy] = useState(() => {
    const start = Math.min(10, 10 + (combatBuff.energyBonus || 0));
    return [start, 10];
  });
  const [playerStatus, setPlayerStatus] = useState(createEmptyStatusSlots());
  const [playerHistory, setPlayerHistory] = useState([]);

  const npcCombat = npc.combatStats || { hp: [100, 100], energy: [10, 10], statusSlots: createEmptyStatusSlots() };
  const [npcHp, setNpcHp] = useState(npcCombat.hp);
  const [npcEnergy, setNpcEnergy] = useState(npcCombat.energy);
  const [npcStatus, setNpcStatus] = useState(npcCombat.statusSlots);
  const [npcHistory, setNpcHistory] = useState([]);

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState("select");
  const [lastResult, setLastResult] = useState(null);
  const [outcome, setOutcome] = useState(null);
  // 复活（涅槃引 rebirthOnce）本场是否已用过，一场限一次
  const playerRebirthUsedRef = useRef(false);
  const npcRebirthUsedRef = useRef(false);
  // ── 跨回合战斗状态（本轮新增，供 resolveTurn 的读牌/蓄势/封穴/冻气特效使用）──
  // 上回合是否应对成功（afterCounterBonus 乘胜追击要读）
  const [playerLastCounter, setPlayerLastCounter] = useState(false);
  const [npcLastCounter, setNpcLastCounter] = useState(false);
  // 蓄势留给下回合的威力加成（nextAttackBonus 兑现）
  const [playerPendingAtk, setPlayerPendingAtk] = useState(0);
  const [npcPendingAtk, setNpcPendingAtk] = useState(0);
  // 封穴造成的临时耗气惩罚 {value, turns}
  const [playerCostPenalty, setPlayerCostPenalty] = useState(null);
  const [npcCostPenalty, setNpcCostPenalty] = useState(null);
  // 冻气：本回合是否被封住回气（回气招/自然回气无效）
  const [playerFrozen, setPlayerFrozen] = useState(false);
  const [npcFrozen, setNpcFrozen] = useState(false);
  // 防御被状态克穿 / 或刚用过防御 → 本回合防御失效（防御不能连用两回合）
  const [playerDefenseBroken, setPlayerDefenseBroken] = useState(false);
  const [npcDefenseBroken, setNpcDefenseBroken] = useState(false);
  // 上回合是否成功施加状态/印记（afterStatusBonus 趁中招追击要读）
  const [playerLastStatusApplied, setPlayerLastStatusApplied] = useState(false);
  const [npcLastStatusApplied, setNpcLastStatusApplied] = useState(false);
  // 连续应对成功的层数（counterStacksGrowth 越守越狠要读；一旦某回合没应对成功即清零）
  const [playerCounterStacks, setPlayerCounterStacks] = useState(0);
  const [npcCounterStacks, setNpcCounterStacks] = useState(0);
  // 敌招迷雾：对方的招式一开始全是"？"，只有被使用过才揭示、之后可详细察看
  const [revealedNpcMoves, setRevealedNpcMoves] = useState(() => new Set());
  const [inspectMove, setInspectMove] = useState(null); // 当前正在详细察看的招式（弹层）
  // 完整的回合战报，结束时整个发给AI生成总结——不只是招式类型（那个只给AI对手做决策用），
  // 而是具体招式名+双方伤害，这样AI才能写出"谁在第几回合用什么招打赢了"这种有细节的总结。
  const [battleLog, setBattleLog] = useState([]);

  // ── 战斗内道具栏（消耗品系统第1步）──
  // 战斗中嗑掉的消耗品名列表，战斗结束时通过 onFinish 第五参回传父组件，从背包扣除。
  // 战斗内只支持"即时救命"类效果（A档）：回血 hpRestore、回气 energyRestore、
  // 解异常 dispel、假死保命 rebirthOnce。临时六维/战前餐这类作用于时间线的 buff
  // 在战斗外吃更合理，战斗内不列出（见下方 isBattleUsableConsumable 过滤）。
  const [usedItems, setUsedItems] = useState([]);
  const [showItemPanel, setShowItemPanel] = useState(false);
  // 假死保命（消耗品版 rebirthOnce）：本场是否已备好续命、是否已触发
  const consumableRebirthArmedRef = useRef(false);
  const consumableRebirthUsedRef = useRef(false);

  const npcProfile = npc.personalityProfile || getDefaultProfile();
  // 本地moveset拷贝——永久成长型招式（permanentGrowthOnUse，见总纲v3
  // 第十二章）需要在战斗过程中实时累积威力，不能直接改props（React单向
  //数据流），战斗结束时把最终版本通过onFinish回传给父组件持久化。
  // 未使用博弈层招式的角色，这份拷贝跟原始moveset内容完全一致，不影响。
  const [playerMovesetLocal, setPlayerMovesetLocal] = useState(() => (playerMoveset || []).map(m => ({ ...m })));
  const [npcMovesetLocal, setNpcMovesetLocal] = useState(() => (npc.moveset || []).map(m => ({ ...m })));
  const moveset = playerMovesetLocal;

  // 战斗内可用的消耗品：只列即时救命类（A档）——回血/回气/解异常/假死保命。
  // 临时六维、战前餐这类作用于时间线的 buff（B档）在战斗外吃更合理，战斗内不列出，
  // 免得玩家在这里嗑一颗只在"下一场"才生效的战前餐、白白浪费一个回合。
  // usedItems 里已经嗑过的份数要从可用数量里扣掉（同名药可能背包有多件）。
  const isBattleUsableConsumable = (c) =>
    !!c && (c.hpRestore || c.energyRestore || c.dispel || c.dispelAll || c.rebirthOnce);
  const battleItems = (() => {
    const counts = {};
    for (const it of (playerInv || [])) {
      if (it && typeof it === "object" && isBattleUsableConsumable(it.consumable)) {
        counts[it.name] = counts[it.name] || { item: it, total: 0 };
        counts[it.name].total += 1;
      }
    }
    for (const name of usedItems) {
      if (counts[name]) counts[name].total -= 1;
    }
    return Object.values(counts).filter(x => x.total > 0);
  })();

  const [error, setError] = useState(null);

  // consumedItem：本回合玩家不是出招而是服用消耗品（战斗内道具栏）。传入时，
  // playerMove 是由该消耗品即时效果构造出的临时"疗伤型"状态招（见 handleUseItem），
  // 走完全相同的结算主体——玩家服药这回合 NPC 照常出招攻击，净值决定续航（复用项目
  // 既有"疗伤"家族的博弈设计，不新增特殊分支）。结算成功后记录进 usedItems 供扣背包。
  const handleSelectMove = (playerMove, consumedItem = null) => {
    if (phase !== "select") return;
    setError(null);
    setPhase("resolving");
    setShowItemPanel(false);

    try {
      const npcMove = decideNpcMove(npcProfile, npcMovesetLocal, { npcHistory, npcEnergy: npcEnergy[0], forbidDefense: npcDefenseBroken });
      // 最后一道保险：decideNpcMove 已保证正常情况返回实招，但若这个NPC连moveset
      // 都是空的（数据严重残缺），它会返回null。此时不能把 undefined 送进 resolveTurn
      // （会读 move.type 崩 → 黑屏），显式抛一句能被下方catch接住的错，退回select。
      if (!npcMove) throw new Error("这个对手没有可用的招式（NPC数据残缺），已中止本回合");

      // 攻击输出 = (基础攻击力+装备攻击力) × 招式倍率 × 体魄系数；
      // 防御力 = (基础防御力+装备防御力) × 防御系数(招式) × 根骨系数，从攻击输出里
      // 扣除得到最终伤害（见 resolveTurn.js 顶部注释）。基础攻击力/防御力分别由
      // 外功/内功决定（atkFromWaigong/defFromNeigong），装备攻击力/防御力则来自
      // 玩家已装备的武器/护甲；NPC 按品质档位（白绿蓝紫橙红）走 getTierPower 生成
      // baseAtk，不需要装备。
      // 装备聚合：攻防加数 + 特效标志位(equipEffects) + 六维加成
      const pStats = computeEquippedStats(playerInv || []);
      const { totalAtk: playerEquipAtk, totalDef: playerEquipDef, equipEffects: playerEquipEffects } = pStats;
      // 玩家 baseAtk 现在也上"外功梯子"（跟 NPC 同一个 atkFromWaigong 公式），
      // 不再恒为 20——这是"玩家和 NPC 战力统一"的落地。
      // 战前餐 waigong：当作临时外功点数直接叠加（进 atkFromWaigong 抬高本场基础攻击）。
      const buffedWaigong = (playerChar.waigong ?? 0) + (combatBuff.waigong || 0);
      const playerBaseAtk = atkFromWaigong(buffedWaigong);
      // 有效七维 = 基础(已含探索态临时buff) + 装备 sixDim
      const playerEffSpecial = effectiveSpecial(playerChar.special, playerInv || []);
      // 装备特效叠进本回合招式：招式自带的标志位优先（主动招 > 被动装备增益），
      // 装备只补招式没有的那些字段——mergeMoveWithEquip 见下方 helper。
      const playerMoveEquipped = mergeMoveWithEquip(playerMove, playerEquipEffects);
      // 战前餐 moveMul：给攻击类招式的倍率加一截"武功发挥更强"（服药构造的疗伤型
      // 状态招不是攻击、不受影响）。
      if (combatBuff.moveMul && playerMoveEquipped.type === MOVE_TYPE.ATTACK) {
        playerMoveEquipped.baseDamageMultiplier = (playerMoveEquipped.baseDamageMultiplier ?? 1) + combatBuff.moveMul;
      }
      const sideA = {
        move: playerMoveEquipped, special: playerEffSpecial, waigong: playerChar.waigong, neigong: playerChar.neigong,
        baseAtk: playerBaseAtk, equipAtk: playerEquipAtk, equipDef: playerEquipDef, hp: playerHp, energy: playerEnergy, statusSlots: playerStatus,
        lastCounterSuccess: playerLastCounter, pendingAtkBonus: playerPendingAtk, costPenalty: playerCostPenalty?.value ?? 0,
        lastStatusApplied: playerLastStatusApplied, counterStacks: playerCounterStacks,
      };
      // NPC 侧：如果 NPC 带了已装备的具名 carriedItems（有 effect 的），同样叠进它的招式
      const npcEquipEffects = mergeItemEffects((npc.carriedItems || []).filter(i => i.equipped && i.effect));
      const npcMoveEquipped = mergeMoveWithEquip(npcMove, npcEquipEffects);
      const sideB = {
        move: npcMoveEquipped, special: npc.special, waigong: npc.waigong, neigong: npc.neigong,
        baseAtk: npc.baseAtk, equipAtk: npc.equipAtk, equipDef: npc.equipDef, hp: npcHp, energy: npcEnergy, statusSlots: npcStatus,
        lastCounterSuccess: npcLastCounter, pendingAtkBonus: npcPendingAtk, costPenalty: npcCostPenalty?.value ?? 0,
        lastStatusApplied: npcLastStatusApplied, counterStacks: npcCounterStacks,
      };

      const result = resolveTurn(sideA, sideB);

      // 博弈层的生命消耗（selfSacrifice）跟对方伤害是两件独立的事，一起扣；疗伤回血（hpRestore）
      // 同回合一并结算——净值决定生死（一边疗伤一边挨打，回血抵掉多少算多少），并夹在 0~上限之间
      const newPlayerHp = Math.max(0, Math.min(playerHp[1], playerHp[0] - result.damageToA - result.selfHpCostA + (result.hpRestoreA || 0)));
      const newNpcHp = Math.max(0, Math.min(npcHp[1], npcHp[0] - result.damageToB - result.selfHpCostB + (result.hpRestoreB || 0)));
      // 冻气：本回合被封住回气的一方，正向能量增量（回气/应对回气）作废，只保留消耗
      let deltaA = result.energyDeltaA, deltaB = result.energyDeltaB;
      if (playerFrozen && deltaA > 0) deltaA = 0;
      if (npcFrozen && deltaB > 0) deltaB = 0;
      const newPlayerEnergy = Math.max(0, Math.min(10, playerEnergy[0] + deltaA));
      const newNpcEnergy = Math.max(0, Math.min(10, npcEnergy[0] + deltaB));

      let newPlayerStatus = playerStatus;
      let newNpcStatus = npcStatus;
      // 免控（不动明王杵 immuneControl）：装备此特效者，控制/掉血/印记类状态施加全部无效
      const playerImmune = !!playerEquipEffects?.immuneControl;
      const npcImmune = !!npcEquipEffects?.immuneControl;
      if (result.statusAppliedToA && !playerImmune) newPlayerStatus = applyStatus(playerStatus, result.statusAppliedToA);
      if (result.statusAppliedToB && !npcImmune) newNpcStatus = applyStatus(npcStatus, result.statusAppliedToB);
      // ── 印记（第三批）：叠印 / 被引爆清空 / 运功自解 ──
      // 叠印：对方状态招在我方身上积内伤印（免控者不吃印）
      if (result.markAppliedToA && !playerImmune) newPlayerStatus = applyMark(newPlayerStatus, result.markAppliedToA.name, result.markAppliedToA.stacks, result.markAppliedToA.max);
      if (result.markAppliedToB && !npcImmune) newNpcStatus = applyMark(newNpcStatus, result.markAppliedToB.name, result.markAppliedToB.stacks, result.markAppliedToB.max);
      // 被引爆清空：引爆的额外伤害已在 result.damageTo* 里结算过，这里只负责把被引爆方的印记槽清零
      if (result.markDetonatedOnA > 0) newPlayerStatus = { ...newPlayerStatus, mark: null };
      if (result.markDetonatedOnB > 0) newNpcStatus = { ...newNpcStatus, mark: null };
      // 运功自解：dispelSelf 清掉自身控制/掉血状态（不动印记）
      if (result.dispelSelfA) newPlayerStatus = dispelControlDrain(newPlayerStatus);
      if (result.dispelSelfB) newNpcStatus = dispelControlDrain(newNpcStatus);

      // 关键修复：applyEndOfTurnStatus 内部要用 hp[1]（最大血量）计算状态掉血比例
      // （比如"损失1/8最大气血"），之前这里只传了 statusSlots，完全没传 hp，
      // 导致 resolveTurn.js 里访问 sideA.hp[1] 直接抛 TypeError——
      // 这正是"点了武学之后就卡死"的真正根因，不是兼容性或字段名问题。
      const endTick = applyEndOfTurnStatus(
        { statusSlots: newPlayerStatus, hp: [newPlayerHp, playerHp[1]] },
        { statusSlots: newNpcStatus, hp: [newNpcHp, npcHp[1]] },
      );
      let finalPlayerHp = Math.max(0, newPlayerHp - endTick.statusDamageA);
      let finalNpcHp = Math.max(0, newNpcHp - endTick.statusDamageB);

      // 复活（涅槃引 rebirthOnce）：气血归零时，若装备带此特效且本场未用过，
      // 回复50%气血续命一次。用 ref 记录本场是否已触发，保证一场只复活一次。
      if (finalPlayerHp <= 0 && playerEquipEffects?.rebirthOnce && !playerRebirthUsedRef.current) {
        finalPlayerHp = Math.round(playerHp[1] * 0.5);
        playerRebirthUsedRef.current = true;
        result.notes.push("气血将尽，涅槃引骤然一热——“香未尽”，一线生机竟被这缕檀香勾了回来");
      }
      if (finalNpcHp <= 0 && npcEquipEffects?.rebirthOnce && !npcRebirthUsedRef.current) {
        finalNpcHp = Math.round(npcHp[1] * 0.5);
        npcRebirthUsedRef.current = true;
        result.notes.push("对方气血将尽，却凭一缕异香生生续住了性命");
      }

      setPlayerHp([finalPlayerHp, playerHp[1]]);
      setNpcHp([finalNpcHp, npcHp[1]]);
      setPlayerEnergy([newPlayerEnergy, 10]);
      setNpcEnergy([newNpcEnergy, 10]);
      setPlayerStatus(endTick.statusSlotsA);
      setNpcStatus(endTick.statusSlotsB);
      setPlayerHistory(h => [...h, playerMove.type]);
      setNpcHistory(h => [...h, npcMove.type]);
      // 永久成长型招式（permanentGrowthOnUse）在本地moveset拷贝里累加威力，
      // 不用等战斗结束——万一这场没打完就撤退，已经涨过的威力这场内依然
      // 保留生效（只是不会持久化出这场战斗，见onFinish那边的说明）。
      if (result.moveGrowthA) {
        setPlayerMovesetLocal(prev => prev.map(m =>
          m.id === result.moveGrowthA.moveId
            ? { ...m, baseDamageMultiplier: (m.baseDamageMultiplier ?? 1) + result.moveGrowthA.delta }
            : m
        ));
      }
      if (result.moveGrowthB) {
        setNpcMovesetLocal(prev => prev.map(m =>
          m.id === result.moveGrowthB.moveId
            ? { ...m, baseDamageMultiplier: (m.baseDamageMultiplier ?? 1) + result.moveGrowthB.delta }
            : m
        ));
      }
      // permanentCostReductionOnUse：越用越便宜，在本地moveset拷贝里累减能耗（最低1）
      if (result.moveCostReductionA) {
        setPlayerMovesetLocal(prev => prev.map(m =>
          m.id === result.moveCostReductionA.moveId
            ? { ...m, energyCost: Math.max(1, (m.energyCost ?? 2) - result.moveCostReductionA.delta) } : m));
      }
      if (result.moveCostReductionB) {
        setNpcMovesetLocal(prev => prev.map(m =>
          m.id === result.moveCostReductionB.moveId
            ? { ...m, energyCost: Math.max(1, (m.energyCost ?? 2) - result.moveCostReductionB.delta) } : m));
      }

      // ── 跨回合状态推进 ──
      // 应对成功记忆（供下回合乘胜追击）
      setPlayerLastCounter(result.counterSuccessA);
      setNpcLastCounter(result.counterSuccessB);
      // 施加成功记忆（供下回合 afterStatusBonus 趁中招追击）
      setPlayerLastStatusApplied(result.statusSuccessA);
      setNpcLastStatusApplied(result.statusSuccessB);
      // 连续应对层数（counterStacksGrowth）：本回合成功则累加，中断则清零
      setPlayerCounterStacks(result.counterSuccessA ? playerCounterStacks + 1 : 0);
      setNpcCounterStacks(result.counterSuccessB ? npcCounterStacks + 1 : 0);
      // 蓄势：本回合消耗掉旧的，再存入这回合新蓄的
      setPlayerPendingAtk(result.pendingAtkBonusToA);
      setNpcPendingAtk(result.pendingAtkBonusToB);
      // 冻气：本回合的冻结已在上面结算完，清掉；再存入对方这回合施加的冻结（作用于下回合）
      setPlayerFrozen(result.freezeEnergyToA);
      setNpcFrozen(result.freezeEnergyToB);
      // 封穴耗气惩罚：已有的减一回合、到期清除；再叠加对方这回合施加的新惩罚
      setPlayerCostPenalty(tickCostPenalty(playerCostPenalty, result.costPenaltyToA));
      setNpcCostPenalty(tickCostPenalty(npcCostPenalty, result.costPenaltyToB));
      // 防御不能连用：这回合用了防御 → 下回合防御失效；被状态克穿门户大开同理
      setPlayerDefenseBroken(playerMove.type === MOVE_TYPE.DEFENSE || result.defenseBrokenA);
      setNpcDefenseBroken(npcMove.type === MOVE_TYPE.DEFENSE || result.defenseBrokenB);

      setLastResult({ ...result, playerMove, npcMove, statusLogA: endTick.logA, statusLogB: endTick.logB });
      // 对方这一招被使用了 → 揭示，之后玩家可详细察看
      setRevealedNpcMoves(prev => { const n = new Set(prev); n.add(npcMove.id); return n; });
      setBattleLog(log => [...log, {
        round,
        playerMove: playerMove.name,
        npcMove: npcMove.name,
        matchup: result.matchup, // 'A'=你克制 'B'=对方克制 'tie'=同类
        dmgToNpc: result.damageToB,
        dmgToPlayer: result.damageToA,
        playerEnergyLeft: newPlayerEnergy,
        npcEnergyLeft: newNpcEnergy,
        notes: result.notes,
        statusLog: [...(endTick.logA || []), ...(endTick.logB || [])],
      }]);

      // 服药回合结算成功 → 登记这件消耗品，战斗结束时从背包扣除。假死保命类
      // （_armRebirth）不产生即时数值，只是把本场"续命一次"的开关备好，真正生效
      // 在下方 finalPlayerHp<=0 的判定里。
      if (consumedItem) {
        setUsedItems(prev => [...prev, consumedItem.name]);
        if (consumedItem._armRebirth) consumableRebirthArmedRef.current = true;
      }

      // 假死保命（消耗品 rebirthOnce）：血将尽时，若本场服过假死药且尚未触发，
      // 保留 1 点气血续命一次。与装备版涅槃引各自独立计数，可叠一次保险。
      if (finalPlayerHp <= 0 && consumableRebirthArmedRef.current && !consumableRebirthUsedRef.current) {
        finalPlayerHp = 1;
        consumableRebirthUsedRef.current = true;
        setPlayerHp([1, playerHp[1]]);
        result.notes.push("气息将绝，怀中那枚灰丸药力发作——心跳慢得摸不出，却硬是吊住了这条命");
      }

      setPhase("result");

      if (finalPlayerHp <= 0 || finalNpcHp <= 0) {
        setOutcome(finalNpcHp <= 0 ? "win" : "lose");
      }
    } catch (e) {
      // 结算过程中任何一步出错，之前会导致 phase 卡在 "resolving"——
      // 而 resolving 这个状态本身没有对应的UI渲染，表现就是"技能栏消失、
      // 界面无反应、也不结算"。现在把错误显式抛给玩家看，并退回 select
      // 阶段让玩家能重新选择，而不是死在一个没有任何按钮的空白状态。
      console.error("切磋回合结算出错", e);
      setError(e?.message || "回合结算时发生未知错误");
      setPhase("select");
    }
  };

  // 战斗内服用一件消耗品：把它的即时效果翻译成一个临时的"疗伤型"状态招，
  // 交给 handleSelectMove 走正常回合结算——服药这回合玩家不攻击，NPC 照常出招，
  // 净值决定续航（跟项目既有"疗伤"招式一个模型）。只处理 A 档即时效果：
  //   hpRestore（比例回血）/ energyRestore（回气）/ 解异常（dispelSelf）/ 假死保命（armRebirth）。
  const handleUseItem = (invItem) => {
    if (phase !== "select") return;
    const c = invItem.consumable || {};
    const pseudoMove = {
      id: `__consume_${invItem.name}`,
      name: `服「${invItem.name}」`,
      type: MOVE_TYPE.STATUS,
      energyCost: 0,
      baseDamageMultiplier: 0,
    };
    if (c.hpRestore) pseudoMove.hpRestore = c.hpRestore;
    if (c.energyRestore) pseudoMove.energyRestore = c.energyRestore;
    // 解异常：药品用 dispel:true 或 dispelAll:true 标记，统一走招式的 dispelSelf 通道，
    // 清掉自身控制/掉血类状态（不解印记，跟运功自解同语义）。
    if (c.dispel || c.dispelAll) pseudoMove.dispelSelf = true;
    // 假死保命：不是即时数值，标一个开关，结算里 _armRebirth 备好本场续命一次。
    const armRebirth = !!c.rebirthOnce;
    handleSelectMove(pseudoMove, { name: invItem.name, _armRebirth: armRebirth });
  };

  const handleContinue = () => {
    if (outcome) {
      setPhase("over");
      return;
    }
    setRound(r => r + 1);
    setPhase("select");
    setLastResult(null);
  };

  const handleClose = () => {
    // 赢了才有掉落——参照参考实现里"战斗结束把结果摘要抛给外层容器"的思路，
    // 这里不在DuelScreen内部直接改玩家的钱/背包（DuelScreen不该知道MudRPG的
    // 完整状态结构），只计算掉落内容，交给外层的onFinish去真正应用状态变更。
    const loot = outcome === "win" ? rollBattleLoot(npc) : null;

    // 完整战报交给外层——MudRPG.jsx 有 apiCfg/callModel，由它异步请求AI写总结
    // （谁在第几回合用了什么招、最后怎么分出胜负），不在这里裁决文字内容。
    // 第四个参数：永久成长型招式（permanentGrowthOnUse）这场战斗里累积
    // 的威力增长，父组件据此把玩家的 char.moveset 更新成这份最终版本，
    // 不这样做的话，玩家这场打出来的成长下场战斗就会消失，跟"永久"这个
    // 名字自相矛盾。NPC那边的成长不做持久化——大概率不会再遇到同一个
    // NPC第二次，持久化的收益远小于额外维护一套NPC存档结构的成本。
    // 第五参 usedItems：战斗内嗑掉的消耗品名列表，交给父组件从背包扣除。
    // 无论胜负/中途撤退都要扣——药已经吃进肚子了，不会因为输了而吐出来。
    onFinish?.(outcome, loot, battleLog, playerMovesetLocal, usedItems);
  };

  const playerHpPct = (playerHp[0] / playerHp[1]) * 100;
  const npcHpPct = (npcHp[0] / npcHp[1]) * 100;

  // MUD结算日志自动滚到底
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [battleLog.length]);

  const selecting = phase === "select";

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.container, background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}` }}>

        {/* ── 血/气条（保留）：双方对峙状态 ── */}
        <div style={styles.topBar}>
          <div style={styles.sideInfo}>
            <div style={styles.name(zoneTheme)}>你</div>
            <HpBar pct={playerHpPct} color={zoneTheme.accent} />
            <div style={styles.hpText}>{playerHp[0]}/{playerHp[1]}</div>
            <EnergyDots value={playerEnergy[0]} color={zoneTheme.accent} />
          </div>
          <div style={styles.vsBadge(zoneTheme)}>第{round}回合</div>
          <div style={{ ...styles.sideInfo, textAlign: "right" }}>
            <div style={styles.name(zoneTheme)}>{npc.name}</div>
            <HpBar pct={npcHpPct} color="#c45044" />
            <div style={styles.hpText}>{npcHp[0]}/{npcHp[1]}</div>
            <EnergyDots value={npcEnergy[0]} color="#c45044" right />
          </div>
        </div>

        {/* ── 上半：操作区 ── */}
        <div style={styles.opSection}>
          <div style={styles.sectionLabel(zoneTheme)}>
            {selecting ? "◆ 请出招" : outcome ? (outcome === "win" ? "◆ 切磋已分胜负" : "◆ 你落败了") : "◆ 结算中"}
          </div>

          {selecting && (
            <>
              {error && <div style={styles.warnLine}>⚠ 上一回合结算出错：{error}（已重置，可重新出招）</div>}
              {moveset.length === 0 && <div style={styles.warnLine}>招式数据尚未就绪，请退出重新发起切磋</div>}
              {playerDefenseBroken && <div style={styles.hintLine(zoneTheme)}>守势已露，此回合不可再守，须变招</div>}
              {round === 1 && (combatBuff.waigong || combatBuff.moveMul || combatBuff.energyBonus || combatBuff.hpBonusRatio) ? (
                <div style={styles.hintLine(zoneTheme)}>
                  战前一餐，药力正盛：{[
                    combatBuff.hpBonusRatio ? `气血+${Math.round(combatBuff.hpBonusRatio * 100)}%` : null,
                    combatBuff.energyBonus ? `起手真气+${combatBuff.energyBonus}` : null,
                    combatBuff.waigong ? `外功+${combatBuff.waigong}` : null,
                    combatBuff.moveMul ? `招式威力+${combatBuff.moveMul}` : null,
                  ].filter(Boolean).join("，")}
                </div>
              ) : null}
              <div style={styles.moveGrid}>
                {moveset.map((move, i) => {
                  const blockedByRepeat = move.type === MOVE_TYPE.DEFENSE && playerDefenseBroken;
                  return (
                    <MoveButton key={move.id || i} move={move}
                      disabled={move.energyCost > playerEnergy[0] || blockedByRepeat}
                      zoneTheme={zoneTheme} onClick={() => handleSelectMove(move)}
                      onInspect={() => setInspectMove({ ...move, side: "你" })} />
                  );
                })}
              </div>

              {/* ── 战斗内道具栏：服药消耗本回合行动，对方照常出招 ── */}
              <div style={styles.itemBarRow}>
                <span
                  onClick={() => battleItems.length > 0 && setShowItemPanel(v => !v)}
                  style={styles.itemToggle(zoneTheme, battleItems.length === 0)}
                  title={battleItems.length === 0 ? "身上没有可在战斗中服用的丹药" : "服药消耗本回合，对方照常出招"}>
                  {showItemPanel ? "▾" : "▸"} ⊙ 用道具{battleItems.length > 0 ? `（${battleItems.length}）` : "（无）"}
                </span>
              </div>
              {showItemPanel && battleItems.length > 0 && (
                <div style={styles.itemGrid}>
                  {battleItems.map(({ item, total }) => {
                    const c = item.consumable || {};
                    const effBits = [];
                    if (c.hpRestore) effBits.push(`回血${Math.round(c.hpRestore * 100)}%`);
                    if (c.energyRestore) effBits.push(`回气${c.energyRestore}`);
                    if (c.dispel || c.dispelAll) effBits.push("解异常");
                    if (c.rebirthOnce) effBits.push("假死保命");
                    return (
                      <div key={item.name} onClick={() => handleUseItem(item)}
                        style={styles.itemBtn(zoneTheme, item.quality)}
                        title={item.desc || ""}>
                        <div style={styles.itemName}>{item.name} ×{total}</div>
                        <div style={styles.itemEff(zoneTheme)}>{effBits.join(" · ")}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 敌招迷雾：用过才揭示，可点开详细察看 */}
              <div style={styles.enemyStripLabel(zoneTheme)}>{npc.name}的招式（用过才可察看）</div>
              <div style={styles.enemyStrip}>
                {npcMovesetLocal.map((m, i) => {
                  const revealed = revealedNpcMoves.has(m.id);
                  return (
                    <div key={m.id || i}
                      onClick={revealed ? () => setInspectMove({ ...m, side: npc.name }) : undefined}
                      style={styles.enemyChip(zoneTheme, revealed)}
                      title={revealed ? "点击详细察看" : "尚未见识过这一招"}>
                      {revealed ? `${TYPE_ICON[m.type]} ${m.name}` : "？ 未知"}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {phase === "result" && !outcome && (
            <div style={styles.continueRow}><span onClick={handleContinue} style={styles.continueBtn(zoneTheme)}>下一回合 ▸</span></div>
          )}
          {phase === "result" && outcome && (
            <div style={styles.continueRow}><span onClick={handleContinue} style={styles.continueBtn(zoneTheme)}>结束切磋</span></div>
          )}
          {phase === "over" && (
            <div style={styles.continueRow}><span onClick={handleClose} style={styles.continueBtn(zoneTheme)}>关闭</span></div>
          )}
        </div>

        {/* ── 下半：MUD形式的结算展示 ── */}
        <div style={styles.logSection} ref={logRef}>
          {battleLog.length === 0 && <div style={styles.logHint(zoneTheme)}>——两人拉开架势，静待第一招——</div>}
          {battleLog.map((e, i) => (
            <MudRoundLog key={i} entry={e} npcName={npc.name} zoneTheme={zoneTheme} />
          ))}
        </div>
      </div>

      {inspectMove && (
        <MoveInspect move={inspectMove} zoneTheme={zoneTheme} onClose={() => setInspectMove(null)} />
      )}
    </div>
  );
}

// 人类可读地翻译一个招式挂了哪些机制（用于详细察看）
function describeMoveEffects(m) {
  const out = [];
  if (m.baseDamageMultiplier != null) {
    if (m.type === MOVE_TYPE.DEFENSE) out.push(`减伤至 ${Math.round(m.baseDamageMultiplier * 100)}%（挡下越多越强）`);
    else if (m.type === MOVE_TYPE.ATTACK) out.push(`攻击倍率 ${m.baseDamageMultiplier}×`);
  }
  if (m.energyRestore) out.push(`回复能量 ${m.energyRestore}`);
  if (m.doubleVsStatus) out.push("克中对方状态招时伤害翻倍");
  if (m.ignoreDefense) out.push("无视对方防御减伤");
  if (m.forceFirst) out.push("必定先手（无视身法）");
  if (m.nullifyStatusOnHit) out.push("命中即打散对方状态招");
  if (m.onCounterSuccessDamageRatio) out.push(`应对成功反打对方 ${Math.round(m.onCounterSuccessDamageRatio * 100)}%`);
  if (m.onCounterSuccessEnergyGain) out.push(`应对成功回气 ${m.onCounterSuccessEnergyGain}`);
  if (m.onCounterSuccessPreemptive) out.push("反击抢先结算，可能一击制敌免伤");
  if (m.onCounterFailEnergyPenalty) out.push(`应对失败倒扣能量 ${m.onCounterFailEnergyPenalty}`);
  if (m.onCounterFailDefenseNullified) out.push("应对失败则门户大开，下回合难守");
  if (m.confuseChance) out.push(`${Math.round(m.confuseChance * 100)}% 令对方气乱`);
  if (m.applyStatus) out.push(`${Math.round((m.applyStatus.chance ?? 1) * 100)}% 施加「${m.applyStatus.name}」`);
  if (m.energyDiffDamage) out.push("按双方能量差造成伤害");
  if (m.doubleReflectDamage) out.push("二倍反弹对方力道");
  if (m.freezeEnergyRecovery) out.push("冻结对方下回合回气");
  if (m.enemyCostPenalty) out.push(`抬高对方出招耗气 ${m.enemyCostPenalty.value}（持续${m.enemyCostPenalty.turns}回合）`);
  if (m.nextAttackBonus) out.push(`蓄势：下一击威力 +${Math.round(m.nextAttackBonus * 100)}%`);
  if (m.lowEnemyEnergyBonus) out.push(`对方能量≤${m.lowEnemyEnergyBonus.threshold}时伤害×${m.lowEnemyEnergyBonus.multiplier}`);
  if (m.afterCounterBonus) out.push(`上回合应对成功则本招威力 +${Math.round(m.afterCounterBonus * 100)}%`);
  if (m.lowHpBonus) out.push("残血时越战越勇");
  if (m.allInDamage) out.push("孤注一掷：耗尽能量换爆发");
  if (m.selfSacrifice) out.push("燃烧自身气血催动");
  if (m.permanentGrowthOnUse) out.push("每次使用永久增强");
  if (m.permanentCostReductionOnUse) out.push("每次使用永久降低耗气");
  return out;
}

function MoveInspect({ move, zoneTheme, onClose }) {
  const closeGuard = useOverlayCloseGuard(onClose);
  const color = QUALITY_COLOR[move.quality] || zoneTheme.text;
  const effects = describeMoveEffects(move);
  return (
    <div style={styles.inspectOverlay} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div style={{ ...styles.inspectCard, background: zoneTheme.bgPanel, border: `1px solid ${color}` }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "10px", color }}>{TYPE_ICON[move.type]} {move.quality}袍 · {move.side}的招式</div>
        <div style={{ fontSize: "16px", color: zoneTheme.text, margin: "4px 0 2px" }}>{move.name}</div>
        {move.desc && <div style={{ fontSize: "12px", color: zoneTheme.textDim, lineHeight: 1.6, margin: "6px 0" }}>{move.desc}</div>}
        <div style={{ fontSize: "11px", color: zoneTheme.accentDim, margin: "8px 0 4px" }}>耗能 {move.energyCost ?? 0}</div>
        <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 6 }}>
          {effects.length ? effects.map((t, i) => (
            <div key={i} style={{ fontSize: "12px", color: zoneTheme.text, marginBottom: 3 }}>· {t}</div>
          )) : <div style={{ fontSize: "12px", color: zoneTheme.textDim }}>· 无特殊机制，纯凭火候</div>}
        </div>
        <div style={styles.continueRow}><span onClick={onClose} style={styles.continueBtn(zoneTheme)}>收起</span></div>
      </div>
    </div>
  );
}

// 一个回合的MUD式结算文字
function MudRoundLog({ entry, npcName, zoneTheme }) {
  const matchupText = entry.matchup === "A" ? "你占了上风" : entry.matchup === "B" ? `${npcName}占了上风` : "两招同门相撞";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: "11px", color: zoneTheme.accent }}>▸ 第 {entry.round} 回合</div>
      <div style={{ fontSize: "12.5px", color: zoneTheme.text, marginTop: 2 }}>
        你使「{entry.playerMove}」，{npcName}使「{entry.npcMove}」——{matchupText}。
      </div>
      {entry.notes.map((n, i) => (
        <div key={i} style={{ fontSize: "12px", color: zoneTheme.textDim, marginTop: 1 }}>{n}。</div>
      ))}
      {(entry.dmgToNpc > 0 || entry.dmgToPlayer > 0) && (
        <div style={{ fontSize: "12px", marginTop: 2 }}>
          {entry.dmgToNpc > 0 && <span style={{ color: "#e08b6f" }}>{npcName}受创 {entry.dmgToNpc}　</span>}
          {entry.dmgToPlayer > 0 && <span style={{ color: "#c45044" }}>你受创 {entry.dmgToPlayer}</span>}
        </div>
      )}
      {(entry.statusLog || []).map((l, i) => (
        <div key={"s" + i} style={{ fontSize: "11px", color: zoneTheme.textDim, marginTop: 1 }}>{l}</div>
      ))}
      <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginTop: 2 }}>
        余·你 能量{entry.playerEnergyLeft}／{npcName} 能量{entry.npcEnergyLeft}
      </div>
    </div>
  );
}

function HpBar({ pct, color }) {
  return (
    <div style={{ width: "100%", height: 8, background: "rgba(0,0,0,0.3)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s ease" }} />
    </div>
  );
}

function EnergyDots({ value, color, right }) {
  return (
    <div style={{ display: "flex", gap: 3, marginTop: 4, justifyContent: right ? "flex-end" : "flex-start" }}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: i < value ? color : "rgba(255,255,255,0.15)",
        }} />
      ))}
    </div>
  );
}

function MoveButton({ move, disabled, zoneTheme, onClick, onInspect }) {
  const color = QUALITY_COLOR[move.quality] || zoneTheme.text;
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        background: zoneTheme.bg,
        border: `1px solid ${color}`,
        borderRadius: 4,
        padding: "10px 8px",
        textAlign: "center",
      }}
    >
      {/* 右上角"察看"：点它只看详情、不出招 */}
      <span onClick={(e) => { e.stopPropagation(); onInspect?.(); }}
        title="详细察看"
        style={{ position: "absolute", top: 2, right: 5, fontSize: "11px", color: zoneTheme.textDim, cursor: "pointer" }}>ⓘ</span>
      <div style={{ fontSize: "10px", color }}>{TYPE_ICON[move.type]} {move.quality}</div>
      <div style={{ fontSize: "13px", color: zoneTheme.text, marginTop: 2 }}>{move.name}</div>
      <div style={{ fontSize: "10px", color: zoneTheme.textDim, marginTop: 2 }}>耗能{move.energyCost}</div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(4,4,10,0.85)",
    zIndex: 450, display: "flex", alignItems: "center", justifyContent: "center",
  },
  container: {
    width: 480, maxWidth: "94vw", maxHeight: "92vh", borderRadius: 6, padding: 16,
    display: "flex", flexDirection: "column", gap: 12,
  },
  topBar: { display: "flex", alignItems: "center", gap: 12 },
  sideInfo: { flex: 1 },
  name: (t) => ({ fontSize: "12px", color: t.text, marginBottom: 4 }),
  hpText: { fontSize: "10px", color: "#888", marginTop: 2 },
  vsBadge: (t) => ({
    fontSize: "10px", color: t.accent, border: `1px solid ${t.accent}`,
    borderRadius: 12, padding: "3px 8px", display: "flex",
    alignItems: "center", justifyContent: "center", flexShrink: 0, whiteSpace: "nowrap",
  }),
  // 上半：操作区
  opSection: { display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 },
  sectionLabel: (t) => ({ fontSize: "12px", color: t.accent, letterSpacing: "1px" }),
  moveGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: "30vh", overflowY: "auto" },
  warnLine: { textAlign: "center", color: "#c45044", fontSize: "11px", padding: "4px 0" },
  hintLine: (t) => ({ fontSize: "11px", color: t.textDim, textAlign: "center" }),
  // 战斗内道具栏
  itemBarRow: { marginTop: 6 },
  itemToggle: (t, empty) => ({
    fontSize: "11.5px", cursor: empty ? "default" : "pointer",
    color: empty ? t.textDim : t.accent, letterSpacing: "0.5px",
    opacity: empty ? 0.55 : 1, userSelect: "none",
  }),
  itemGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6,
    maxHeight: "22vh", overflowY: "auto",
  },
  itemBtn: (t, quality) => ({
    cursor: "pointer", padding: "6px 10px", borderRadius: 4,
    border: `1px solid ${QUALITY_COLOR[quality] || t.accentDim}`,
    background: "rgba(255,255,255,0.03)",
  }),
  itemName: { fontSize: "12px", color: "inherit" },
  itemEff: (t) => ({ fontSize: "10px", color: t.textDim, marginTop: 2 }),
  enemyStripLabel: (t) => ({ fontSize: "10.5px", color: t.textDim, marginTop: 4 }),
  enemyStrip: { display: "flex", flexWrap: "wrap", gap: 6 },
  enemyChip: (t, revealed) => ({
    fontSize: "11px", padding: "4px 8px", borderRadius: 4,
    border: `1px dashed ${revealed ? t.accentDim : "rgba(255,255,255,0.15)"}`,
    color: revealed ? t.text : t.textDim,
    cursor: revealed ? "pointer" : "default",
    background: revealed ? "rgba(255,255,255,0.04)" : "transparent",
  }),
  // 下半：MUD结算日志
  logSection: {
    borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10,
    maxHeight: "34vh", overflowY: "auto", fontFamily: "inherit",
  },
  logHint: (t) => ({ fontSize: "12px", color: t.textDim, textAlign: "center", padding: "16px 0" }),
  continueRow: { textAlign: "center", marginTop: 6 },
  continueBtn: (t) => ({
    cursor: "pointer", display: "inline-block", padding: "8px 24px",
    color: t.accent, border: `1px solid ${t.accent}`, borderRadius: 4, fontSize: "12px",
  }),
  // 详细察看弹层
  inspectOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 460,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  inspectCard: { width: 320, maxWidth: "88vw", borderRadius: 6, padding: 16 },
};
