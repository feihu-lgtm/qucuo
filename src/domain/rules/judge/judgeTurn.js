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
import { evaluateActionCondition, conditionUnmetNote, conditionMetNote } from "./conditionEval.js";
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
  // D3：带前提动作不再机械跳过——逐动作在循环内按 evaluateActionCondition 确定性
  // 裁决（遇敌/到达/被拒/其他），成立才结算、不成立只留禁写成功批注。
  const actions = rawActions;
  const conditionResults = [];
  // D3：条件裁决结果按动作对象登记——inspect/quest/movePickup/pact 等下游处理器
  // 不在主循环内逐条拦截，必须按同一 Map 过滤，否则条件翻箱仍会消费容器。
  const condVerdicts = new Map();
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
    // D3：同回合前序拒收信号——give/appease/learn 拒收、前置路由 invite 失败时
    // 置 rejected，紧随其后的 condition「被拒」动作据此精确判定。
    lastActionOutcome: {
      rejected: !!envelope.conditionCtx?.inviteRejected,
      kind: envelope.conditionCtx?.inviteRejected ? "invite" : "",
      target: envelope.conditionCtx?.inviteRejectedTarget || "",
    },
    conditionCtx: envelope.conditionCtx || {},
    accept: { value: false },
    // S3 破费查价链修订：同一回合内 得财/破费 按签发顺序累计流水余额，
    // 先赚后花不再被开场余额误卡（materialize 按 facts 顺序落账，此处同序预演）。
    money: { run: envelope.char?.money ?? 0 },
    proposals: proposalsPre,
  };

  for (const action of actions) {
    // D3 条件裁决：condition≠「无」时先判前提。evalCtx 每轮现场组装——
    // lastActionOutcome 随前序动作结算实时更新（被拒信号按动作序传递）。
    if (action?.condition && action.condition !== "无") {
      const evalCtx = {
        encounter: envelope.encounter ?? J.conditionCtx.encounter ?? null,
        moved: !!J.conditionCtx.moved,
        roomName: J.conditionCtx.roomName || place,
        innerRoomName: J.conditionCtx.innerRoomName ?? null,
        visibleNpcs: J.conditionCtx.visibleNpcs || npcs,
        lastActionOutcome: J.lastActionOutcome,
      };
      const verdict0 = evaluateActionCondition(action, evalCtx);
      conditionResults.push({ action, met: verdict0.met, reason: verdict0.reason || "" });
      condVerdicts.set(action, verdict0.met);
      if (!verdict0.met) {
        notes.push(conditionUnmetNote(action, verdict0.reason));
        continue;
      }
      notes.push(conditionMetNote(action));
    }
    if (action.kind === "free_act") { handleFreeAct(J, action); continue; }
    if (action.kind === "steal") { handleSteal(J, action); continue; }

    const npc = findNpc(npcs, action.target);
    if (!npc) {
      // F8 真机修：请客/买物式破费被 intake 误标 give/trade 且对象落空（「无」或
      // 不在场）时，旧路静默丢弃——玩家声明的银两分文未扣，正文只能编「没递钱」
      // 自相矛盾。outcome=破费 的自由开支语义与对象无关，改投 freeAct 查价链：
      // 原话写数额按原话扣，余额够必须落账。
      if ((action.kind === "give" || action.kind === "trade") && action.outcome === "破费") {
        notes.push(`对象落空但声明破费——按 free_act 破费链结算（intake kind 误标 ${action.kind} 纠正）`);
        handleFreeAct(J, action);
      }
      continue;
    }
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
  // D3：未成立条件动作不进容器/任务/移动拾取/履约处理——前提未成而翻箱倒柜
  // 等于替玩家消费容器，必须按 condVerdicts 过滤（缺省 true 不影响旧形状）。
  const effective = actions.filter((a) => condVerdicts.get(a) !== false);
  processInspectContainers(J, effective);

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
    lastActionOutcome: J.lastActionOutcome,
    conditionResults,
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
