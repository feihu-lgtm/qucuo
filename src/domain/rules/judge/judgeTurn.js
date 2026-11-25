// WO-12 纯函数判官：AI 提议、系统裁决。
// judgeTurn(envelope, intakeResult, { rng }) 顺序执行四步：
//   1) 核验 refIds 的 witnesses 知情权——不知情 NPC 拆分为独立反应导引；
//   2) 按 NPC 性情/偏爱/好感裁定赠礼、赔罪、求教收拒，拒收不产扣物事实；
//   3) inspect_container 三关掷骰：预设物 → 备料物 → 玩家 proposals
//      （fit 档位 + 气运 + 悬空道具落点，不达标降级残页线索）；
//   4) 签发 JudgeVerdict（契约 C 冻结形状）：facts 铁案 + 空白 warrants，
//      tier/pointBudget/allowedAffixes 由 WO-09 computeCausalBudget 核定。
// 纯函数，禁 Date.now/Math.random——随机只走传入 rng。
// S4 纯搬家：各 kind 签发逻辑拆到 ./rules/*.js，本文件只保留遍历、派发和汇总。

import { computeCausalBudget } from "./causalBudget.js";
import { knowsEntry, findNpc, affectionOf } from "./rules/shared.js";
import { handleFreeAct } from "./rules/freeAct.js";
import { handleSteal } from "./rules/steal.js";
import { handleTalk } from "./rules/talk.js";
import { handleGive } from "./rules/give.js";
import { handleAppease } from "./rules/appease.js";
import { handleLearn } from "./rules/learn.js";
import { processInspectContainers } from "./rules/inspectContainer.js";
import { processMovePickup } from "./rules/movePickup.js";
import { processQuestAdvance, processPactSettle } from "./rules/quest.js";

export function judgeTurn(envelope = {}, intakeResult = {}, { rng } = {}) {
  const roll = typeof rng === "function" ? rng : () => 0.5;
  const turn = Number.isInteger(envelope.turn) ? envelope.turn : 0;
  const day = Number.isInteger(envelope.day) ? envelope.day : 0;
  const place = envelope.place || "";
  const entries = Array.isArray(envelope.entries) ? envelope.entries : [];
  const npcs = Array.isArray(envelope.npcs) ? envelope.npcs : [];
  const varTree = envelope.varTree || {};
  const inv = Array.isArray(envelope.inv) ? envelope.inv : [];
  const budget = computeCausalBudget(envelope.budget || {});

  const facts = [];
  const warrants = [];
  const notes = [];
  let factSeq = 0;
  let warrantSeq = 0;
  const nextFactId = () => `F${turn}_${++factSeq}`;
  const nextWarrantId = () => `W${turn}_${++warrantSeq}`;

  // ── 第一步：refIds 知情权核验 ──
  // 玩家援引的场记板条目，逐 NPC 分知情/不知情；不知情者拆独立反应导引——
  // 他只能对玩家话语的表面反应，不能表现出知道内情。
  const refIds = Array.isArray(intakeResult.refIds) ? intakeResult.refIds : [];
  const refEntries = refIds.map((id) => entries.find((e) => e?.id === id)).filter(Boolean);
  const missingRefIds = refIds.filter((id) => !entries.some((e) => e?.id === id));
  if (missingRefIds.length) notes.push(`查无此条目的引用：${missingRefIds.join("、")}`);
  const reactionGuides = npcs.map((npc) => {
    const known = refEntries.filter((e) => knowsEntry(e, npc.name)).map((e) => e.id);
    const unknown = refEntries.filter((e) => !knowsEntry(e, npc.name)).map((e) => e.id);
    return {
      npc: npc.name,
      knownRefIds: known,
      unknownRefIds: unknown,
      // 不知情拆分：存在不知内情的引用时，给该角色单独的反应导引
      guidance: unknown.length
        ? `${npc.name}不知晓${unknown.join("、")}内情，只能按话语表面反应，禁写出知情暗示`
        : "",
    };
  });

  // ── 第二步：赠礼/赔罪/求教收拒裁决 ──
  const rawActions = Array.isArray(intakeResult.actions) ? intakeResult.actions : [];
  // WO-16G interim：带前提（condition≠无）的动作全部机械结算跳过——前提是否成真
  // 判官还没裁决能力（WO-16F 才做真条件裁决），提前结算会把「要是没人我就翻箱」
  // 当成已经翻了：容器被耗竭、物件被搬空。只留 note 痕迹，其余 action 照常。
  const conditioned = rawActions.filter((a) => a?.condition && a.condition !== "无");
  for (const a of conditioned) {
    notes.push(`前提未裁，暂不结算：${a.kind}${a.target && a.target !== "无" ? `→${a.target}` : ""}（${a.condition}：${a.condition_text || "未述"}）`);
  }
  const actions = rawActions.filter((a) => !(a?.condition && a.condition !== "无"));
  const signedRestKeys = new Set();
  const signedFreeActGainKeys = new Set(); // WO-16F-F1 本 verdict 调息去重
  // 任务交付去重预扫：quest_advance 提议命中带 deliver 的合法候选时，同目标同物的
  // give 动作必须压制——交付件归属由 questFlagRule 任务通道扣件结算，赠礼通道再转
  // 一次就是双扣件+虚假好感（村2 糌粑→老孙：交差不是送礼）。
  const questCandidatesPre = Array.isArray(envelope.questCandidates) ? envelope.questCandidates : [];
  const proposalsPre = Array.isArray(intakeResult.proposals) ? intakeResult.proposals : [];
  const deliverClaims = proposalsPre
    .filter((p) => p?.kind === "quest_advance")
    .map((p) => questCandidatesPre.find((c) => c.questId === p.questId && c.flag === p.flag))
    .filter((c) => c?.deliver)
    .map((c) => c.deliver);
  const isDeliverGive = (action, item) => deliverClaims.some((d) => {
    if (action.target !== d.to) return false;
    const iname = item?.name || action.itemId || "";
    return !!iname && (iname === d.item || iname.includes(d.item) || d.item.includes(iname));
  });
  // WO-16A 搭话开闸：talkOnly 回合（纯搭话）判官只产小额社交事实——
  // 严禁因搭话误搬物品：give/inspect_container 等硬事实整条拦截，只留 notes 痕迹。
  const talkOnly = !!envelope.talkOnly;

  // 共享上下文（S4）：各 kind handler 只读/写入此对象——facts/warrants/notes 按引用
  // 共享；anyAccepted/freeActMoneyRun 是判官内流通的标量，包一层对象保持可写。
  const J = {
    envelope, roll, turn, day, place, npcs, varTree, inv, budget,
    facts, warrants, notes, nextFactId, nextWarrantId, talkOnly, proposalsPre,
    signedRestKeys, signedFreeActGainKeys, isDeliverGive,
    accept: { value: false },
    // S3 破费查价链修订：同一回合内 得财/破费 按签发顺序累计流水余额，
    // 先赚后花不再被开场余额误卡（materialize 按 facts 顺序落账，此处同序预演）。
    money: { run: envelope.char?.money ?? 0 },
    proposals: proposalsPre,
  };

  for (const action of actions) {
    if (action.kind === "free_act") { handleFreeAct(J, action); continue; }
    if (action.kind === "steal") { handleSteal(J, action); continue; }

    const npc = findNpc(npcs, action.target);
    if (!npc) continue;
    const aff = affectionOf(varTree, npc.name);
    const stance = action.stance || "casual";
    const stanceMod = stance === "sincere" ? 0.1 : stance === "perfunctory" ? -0.1 : stance === "forceful" ? -0.15 : 0;

    // 搭话：stance 映射确定性小额好感，不掷骰——闲聊不该有随机性社交风险。
    if (action.kind === "talk") { handleTalk(J, action, npc); continue; }

    // 真白名单：talkOnly 回合只有 talk 进社交结算，其余 action（含 appease——
    // 不能随机 +3 漏进纯搭话）一律只留 notes，零物品/状态/好感搬动。
    if (talkOnly) {
      notes.push(`纯搭话回合不结算${action.kind}（${npc.name}），无物品/状态搬动`);
      continue;
    }

    if (action.kind === "give") handleGive(J, action, npc, aff, stanceMod);
    if (action.kind === "appease") handleAppease(J, action, npc, aff, stanceMod);
    if (action.kind === "learn") handleLearn(J, action, npc, aff, stanceMod);
  }

  // ── 第三步：inspect_container 三关掷骰 ──
  // WO-16A：纯搭话回合不翻容器——搭话时翻箱倒柜本就不该发生，整段跳过。
  processInspectContainers(J, actions);

  // ── B1 任务推进扩展律：quest_advance 白名单核验 ──
  processQuestAdvance(J, proposalsPre);

  // ── WO-16C 移动拾取条件券 ──
  processMovePickup(J);

  // ── 履约核验（WO-22B-P3）──
  processPactSettle(J);

  // ── 第四步：签发 JudgeVerdict（契约 C） ──
  return {
    causalTier: budget.tier,
    pacingWords: Number.isInteger(envelope.pacingWords) ? envelope.pacingWords : 320,
    facts,
    warrants,
    allowSpontaneousPact: J.accept.value || budget.tier !== "T0",
    reactionGuides,
    notes,
    budget: {
      maxQuality: budget.maxQuality,
      maxPointBudget: budget.maxPointBudget,
      remainingDailyQuota: budget.remainingDailyQuota,
    },
  };
}

// @判官定案单 引用渲染：铁案与天机券的紧凑清单，供叙事模型照本写正文。
export function renderJudgeVerdict(verdict) {
  if (!verdict || typeof verdict !== "object") return "";
  const lines = [`因果档 ${verdict.causalTier || "T0"}，目标篇幅约 ${verdict.pacingWords ?? 320} 字`];
  for (const fact of verdict.facts || []) {
    lines.push(`⟦${fact.id}⟧${fact.op}${fact.itemName ? `·${fact.itemName}` : ""}${fact.npc ? `·${fact.npc}` : ""}${fact.detail ? `·${fact.detail}` : ""}`);
  }
  for (const warrant of verdict.warrants || []) {
    if (warrant.conditional) {
      lines.push(`⟦${warrant.factId}⟧条件拾取券/⟦${warrant.warrantId}⟧ GRANT_ITEM（品质「${warrant.quality}」/类别「${warrant.category}」系统锁定）：若写拾取，须在落实处埋 ⟦${warrant.factId}⟧ 并在尾章 fills 填名；若此刻不宜拾取，忽略此券即可（券自动作废，不会在正文外硬塞）。`);
    } else {
      lines.push(`⟦${warrant.warrantId}⟧空白天机券 ${warrant.op}（${warrant.pointBudget} 点，待尾章填名）`);
    }
  }
  for (const note of verdict.notes || []) lines.push(`注：${note}`);
  return lines.join("\n");
}

// @因果授信 引用渲染：本拍额度一行。
export function renderCausalBudget(budget) {
  if (!budget || typeof budget !== "object") return "";
  return `本拍授信：品阶上限${budget.maxQuality || "白"}，词条点数 ${budget.maxPointBudget ?? 0}，今日搜刮余量 ${budget.remainingDailyQuota ?? 0}`;
}
