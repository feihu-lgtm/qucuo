// 统一武学习得系统：三条渠道（武馆买 / 拜师授 / 偷师偷）最终都产出同一种
// skills 数组条目，调用方统一走 setSkills(sk => [...sk, ...result.skills]) 就够，
// 不用再各写各的分支。
//
// 三条渠道谁能教什么、门槛怎么算，这个文件只负责"决定教什么、算不算成功、
// 值多少钱"这几件确定性的事——真正改 varTree/好感/生气状态仍由调用方
// （MudRPG.jsx 的 handler）来写，这个模块保持纯函数、不碰 React state。
//
// 三条渠道行为速查（对应武功字段审计表 + 设计定稿 2026-07-25）：
//   武馆：固定商店，SKILL_CATALOG 里的可修炼武学，upgradable:true，花银两。
//   拜师·高手（levelCap≥1）：教该NPC专属招（npcSignatureMoves），fixed:true，
//     好感≥40 起才解锁，价格按好感折价曲线走低（TEACH_DISCOUNT_TIERS）。
//   拜师·平民（levelCap<1，这次新加的行为）：教通用招池 MOVE_POOL 的"白"档招，
//     fixed:true，同样走好感门槛+折价曲线，但基础价远低于专属招（本来就是
//     "江湖人人都会的基本功"，不该定专属招那个价）。
//   偷师：偷物+偷招二合一，同一次 attemptSteal 判定，成功后再从"该NPC还有
//     没学过的招 / 还有没偷完的物品"里二选一（pickStealOutcome）。好感只管
//     解锁门槛（复用现有"生气状态期间不可偷"这条锁），身法/敏捷进成功率
//     公式，好感也仍计入成功率（两项独立相加，见 stealSystem.js）。

import { makeLearnedMoveSkill } from "./qucuoKungfu.js";
import { canLearnSkillFrom, describeLearnSkillGate, teachPrice, teachDiscountFactor } from "../quests/learnSkill.js";
import { attemptSteal, pickStealOutcome, createAngryState, STEAL_CONFIG } from "../combat/stealSystem.js";
import { deriveSignatureMoveset, MOVE_POOL } from "../npcGeneration.js";
import { MOVE_TYPE } from "../combat/moveTypes.js";

// 通用招池的基础拜师价——平民没有专属招那么值钱，江湖通行招意思意思收点束脩。
// 只对"白"档收这个价：平民就该只会白档，教不了更高品阶（更高品阶按理该找高手拜师）。
export const GENERIC_MOVE_TEACH_BASE_PRICE = 15;
// 专属招（拜高手为师）的基础拜师价，走原有折价曲线时用这个做基准。
export const SIGNATURE_MOVE_TEACH_BASE_PRICE = 80;

// 从某个 NPC 身上取出玩家还没学过的"可学招列表"——同时供拜师和偷师复用，
// 避免同一段过滤逻辑写两份、以后改一处漏一处。
// mode: "signature"（专属招，教高手时用）| "generic"（通用招池白档，教平民时用）
function collectLearnableMoves(npc, mode, skills, char) {
  const have = new Set([
    ...skills.map(s => s.id),
    ...(char.moveset || []).map(m => m.id),
  ]);

  if (mode === "signature") {
    const cap = npc.levelCap;
    if (cap == null || cap < 1) return [];
    const teachMoves = (deriveSignatureMoveset(npc, { levelCap: cap }) || [])
      .filter(m => (m.type === MOVE_TYPE.ATTACK || m.type === MOVE_TYPE.DEFENSE || m.type === MOVE_TYPE.STATUS)
        && m.archetype !== "回气" && m.id !== "move_hui_qi"); // 回气人人都会，不必传授/偷
    return teachMoves.filter(m => !have.has(m.id));
  }

  // generic：通用招池白档三招（攻/防/状态），江湖人人都能学的基本功
  const genericMoves = [
    { ...MOVE_POOL["白"][MOVE_TYPE.ATTACK], type: MOVE_TYPE.ATTACK, quality: "白" },
    { ...MOVE_POOL["白"][MOVE_TYPE.DEFENSE], type: MOVE_TYPE.DEFENSE, quality: "白" },
    { ...MOVE_POOL["白"][MOVE_TYPE.STATUS], type: MOVE_TYPE.STATUS, quality: "白" },
  ];
  return genericMoves.filter(m => !have.has(m.id));
}

// ── 渠道一：拜师（高手教专属招 / 平民教通用招，同一套折价逻辑，基础价不同）──
//
// 参数：
//   npc: 房间里的 NPC 对象（需要 name/levelCap）
//   varTree: 当前好感度所在的状态树
//   skills, char: 玩家当前武学栏和角色数据（用于去重）
//
// 返回：
//   { ok:false, reason } —— 门槛没过或没什么可学时的说明文字
//   { ok:true, mode, freshSkills, moveBrief, totalPrice } —— 可以学，
//     freshSkills 是已经包好的 skill 条目数组，调用方直接 setSkills 追加；
//     totalPrice 是这次一次性教完所有新招要花的银两（按好感折价后的价格）。
//     调用方自己决定要不要真的扣钱（比如银两不够时改成部分学，或者直接拒绝）。
export function tryLearnFromMaster(npc, varTree, skills, char) {
  if (npc.beast || npc.unlearnable) {
    return { ok: false, reason: `${npc.name}是头畜生，纵有一身凶悍本事，也无从传你半分。` };
  }

  const gate = canLearnSkillFrom(npc.name, varTree, []);
  if (!gate.eligible) {
    return { ok: false, reason: describeLearnSkillGate(gate, npc.name) };
  }

  const isMaster = npc.levelCap != null && npc.levelCap >= 1;
  const mode = isMaster ? "signature" : "generic";
  const basePrice = isMaster ? SIGNATURE_MOVE_TEACH_BASE_PRICE : GENERIC_MOVE_TEACH_BASE_PRICE;

  const freshMoves = collectLearnableMoves(npc, mode, skills, char);
  if (freshMoves.length === 0) {
    return { ok: false, reason: `${npc.name}这一身本事你都已学全，再无新招可授。` };
  }

  const source = isMaster ? "拜师" : "拜师·通用";
  const freshSkills = freshMoves.map(m => makeLearnedMoveSkill(m, source));
  const moveBrief = freshMoves.map(m => `${m.name}(${m.archetype || m.type})`).join("、");
  const perMovePrice = teachPrice(basePrice, gate.currentFavorability);
  const totalPrice = perMovePrice * freshMoves.length;

  return {
    ok: true,
    mode,
    isMaster,
    freshSkills,
    freshMoves,
    moveBrief,
    perMovePrice,
    totalPrice,
    discountFactor: teachDiscountFactor(gate.currentFavorability),
  };
}

// ── 渠道二：偷师（偷物+偷招二合一）──
//
// 参数：
//   npc: 房间里的 NPC 对象
//   varTree: 状态树（读好感度、生气状态）
//   skills, char: 玩家武学栏和角色数据（判断该NPC是否还有招可偷）
//   agility: 玩家当前身法值（char.special.身法），参与成功率计算
//
// 返回：
//   { ok:false, reason } —— 生气状态期间不可偷时的说明（复用现状锁）
//   { ok:true, success:false, rate, angryState... } —— 尝试了但失败，附带
//     调用方需要写入 varTree 的好感扣减和生气状态
//   { ok:true, success:true, outcome:"item"|"move"|null, ... } —— 成功，
//     outcome 为 null 表示这次判定成功但对方身上物品招式都被拿空了，白跑一趟
export function tryStealFrom(npc, varTree, skills, char, agility = 0) {
  const npcAttrs = varTree.角色?.[npc.name] || {};
  if (npcAttrs.生气状态?.active) {
    return { ok: false, reason: `${npc.name}此刻正满心戒备，你若再敢造次，怕是当场就要翻脸。（生气期间无法偷窃）` };
  }

  const favorability = npcAttrs.好感度 ?? 0;
  const result = attemptSteal(favorability, agility);

  if (!result.success) {
    return {
      ok: true,
      success: false,
      rate: result.rate,
      favorabilityLoss: STEAL_CONFIG.angryFavorabilityLoss,
      angryState: createAngryState("偷窃未遂"),
    };
  }

  // 判定成功，再决定这次偷到的是招式还是物品
  const stealableMoves = collectLearnableMoves(npc, "signature", skills, char);
  const stealableItems = (npc.carriedItems || []).filter(it => !it.stolen);
  const outcome = pickStealOutcome(stealableMoves.length > 0, stealableItems.length > 0);

  if (outcome === "move") {
    const target = stealableMoves[Math.floor(Math.random() * stealableMoves.length)];
    const skill = makeLearnedMoveSkill(target, "偷师");
    return { ok: true, success: true, outcome: "move", rate: result.rate, skill, move: target };
  }
  if (outcome === "item") {
    const target = stealableItems[Math.floor(Math.random() * stealableItems.length)];
    return { ok: true, success: true, outcome: "item", rate: result.rate, item: target };
  }
  // outcome === null：身手得逞，但对方身上确实一无所有（招学光了、物件也偷空了）
  return { ok: true, success: true, outcome: null, rate: result.rate };
}
