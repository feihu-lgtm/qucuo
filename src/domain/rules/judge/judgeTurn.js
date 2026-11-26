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
import { knowsEntry, findNpc, affectionOf, personaMod, affectionMod } from "./rules/shared.js";
import { handleFreeAct } from "./rules/freeAct.js";
import { handleSteal } from "./rules/steal.js";
import { handleTalk } from "./rules/talk.js";
import { handleIntimate } from "./rules/intimate.js";
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
  // V4 跨房密告硬隔离：知识领域里带房间作用域的密告/私语事实，若诞生于
  // 别的房间（据点或内层房不同）且该 NPC 不在知晓者名单，自动并入 unknownRefIds——
  // 玩家在才旦家密告账册后切到老孙饭馆，老孙绝不可复述或默认知晓他处密谈。
  // 只追近 30 回合内的密谈，避免陈年老账噪声刷屏。
  const curInner = envelope.innerRoomName ?? null;
  const knowledgeFacts = Object.values(varTree?.世界?.知识领域?.事实 || {});
  const crossRoomSecrets = knowledgeFacts.filter((fct) => {
    if (!fct?.房间?.district) return false;
    if (!["密告", "私语"].includes(fct.标签)) return false;
    if (turn - (fct.诞生回合 || 0) > 30) return false;
    const sameRoom = fct.房间.district === place && (fct.房间.inner ?? null) === curInner;
    return !sameRoom;
  });
  const reactionGuides = npcs.map((npc) => {
    const known = refEntries.filter((e) => knowsEntry(e, npc.name)).map((e) => e.id);
    const unknown = refEntries.filter((e) => !knowsEntry(e, npc.name)).map((e) => e.id);
    const foreignSecrets = crossRoomSecrets.filter((fct) => !fct.知晓者?.[npc.name]);
    const allUnknown = [...unknown, ...foreignSecrets.map((fct) => fct.id)];
    return {
      npc: npc.name,
      knownRefIds: known,
      unknownRefIds: allUnknown,
      // 不知情拆分：存在不知内情的引用或他处密谈时，给该角色单独的反应导引
      guidance: allUnknown.length
        ? `${npc.name}不知晓${allUnknown.join("、")}内情，只能按话语表面反应，禁写出知情暗示；严禁复述或默认知晓他处密谈细节`
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
    reactionGuides,
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
    // V8 Review 修：只有门禁真的介入过（intimateCtx 存在）才跳过 kind 结算——
    // nsfw 关门禁不跑，intake 标的 intimate  flirt 动作必须落回 talk/free_act 正路，
    // 否则调情搭话好感两头落空。
    if (action.intimate === true && J.envelope?.intimateCtx?.npc) continue;
    if (action.kind === "free_act") { handleFreeAct(J, action); continue; }
    if (action.kind === "steal") { handleSteal(J, action); continue; }

    const npc = findNpc(npcs, action.target);
    if (!npc) {
      // F8 真机修：请客/买物式破费被 intake 误标 give/trade 且对象落空（「无」或
      // 不在场）时，旧路静默丢弃——玩家声明的银两分文未扣，正文只能编「没递钱」
      // 自相矛盾。outcome=破费 的自由开支语义与对象无关，改投 freeAct 查价链：
      // 原话写数额按原话扣，余额够必须落账。
      // Review 修：trade 带实物目标（买货）且卖家落空时不得按破费扣银——
      // 买货不成立就一文不动；纯开销（无实物目标的请客/打赏/应酬）才落破费链。
      const tradeWithGoods = action.kind === "trade" && action.item && action.item !== "无" && action.item !== "银两";
      if ((action.kind === "give" || action.kind === "trade") && action.outcome === "破费" && !tradeWithGoods) {
        notes.push(`对象落空但声明破费——按 free_act 破费链结算（intake kind 误标 ${action.kind} 纠正）`);
        handleFreeAct(J, action);
      } else if (tradeWithGoods && action.outcome === "破费") {
        notes.push(`买货对象落空（${action.item}）——交易不成立，不破费扣银`);
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

  // ── V8 亲密回合社交结算：门禁放行（envelope.intimateCtx）才签发，回合至多一条 ──
  // Review 修：带前提的亲密动作前提未成（condVerdicts=false）时行为未发生，
  // 不得因门禁先行放行就照签好感——无任何 intimate 动作执行则本轮不签。
  // （正则兜底路无 intimate 标动作——intimateActs 空时按旧口径签发。）
  // Review 二轮修：签发与焚卡共用同一执行信号——门禁选定对象（intimateCtx.npc）的
  // 亲密动作真的执行才算数。前提未成/只有别人对象的动作执行（多对象边缘）都不算：
  // 不签好感（门槛好感是 gate 对象的，签给别人即错账），verdict 透出信号让
  // judgePhase 不焚卡不烙印（行为未发生，卡不该没）。
  const intimateActs = actions.filter((a) => a?.intimate === true);
  const gateNpc = J.envelope?.intimateCtx?.npc;
  const intimateCtxExecuted = !gateNpc || intimateActs.length === 0
    ? true
    : intimateActs.some((a) => condVerdicts.get(a) !== false
        && (!a.target || a.target === "无" || a.target === gateNpc));
  if (intimateCtxExecuted) handleIntimate(J);

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

  // ── W-FIX2 即兴立约正道化（第 16 式）：判官先定，严禁尾章后置硬塞。
  // proposals 含非 absurd 的 social_deal 且在场有非敌对、有好感轨道的目标 NPC 时，
  // 判官当场掷骰（0.45+personaMod+affectionMod+stanceMod）定应不应约。
  let pactVerdict = null; // true=应约 false=婉拒 null=本轮无立约提议
  const socialDealsAll = proposalsPre.filter((pp) => pp?.kind === "social_deal" && pp.fit !== "absurd");
  // V5（7.5）买卖防契约串场：本轮有 trade 动作，或 social_deal 提案缺乏未来履约
  // 条件（无期限/日后/事成类承诺词，仅是当场称斤付钱买干粮）→ 不参与立约掷骰，
  // 强制 allowSpontaneousPact=false，买三斤炒面不判成口头立约。
  const hasTrade = actions.some((a) => a?.kind === "trade");
  // 当场即时交易词（买/卖/称斤/付钱/现银等）且无未来履约承诺 → 排除出立约；
  // 其余 claim 保留原 W-FIX2 口径（承诺类表述本身即带未来性，靠关键词枚举会漏）。
  const FUTURE_PACT_RE = /日后|明天|明日|三天|三日|两天|两日|一天|一日|天内|日内|回头|再来|事成|为期|期限|定去|定替|替你|帮你|之约|立下/;
  const INSTANT_DEAL_RE = /买|卖|称斤|付钱|现银|当场结|赊账|成交|多少钱/;
  const socialDeals = hasTrade ? [] : socialDealsAll.filter((pp) => {
    const c = String(pp?.claim || "");
    return !(INSTANT_DEAL_RE.test(c) && !FUTURE_PACT_RE.test(c));
  });
  const pactSuppressed = socialDealsAll.length > 0 && socialDeals.length === 0;
  if (socialDeals.length) {
    // Review 修两条：
    // ②目标 NPC 取条件过滤后动作里「最后一个」有效在场目标——先寒暄张三再跟
    //   李四谈价时，约定是李四的，不能掷到张三头上（立约句多在句尾压轴）。
    // ③条件未成的动作不参与立约（前提黄了还拍板等于架空条件律）——
    //   与容器/任务同走 condVerdicts 过滤口径。
    const condFiltered = actions.filter((a) => condVerdicts.get(a) !== false);
    const targetNames = [...new Set(condFiltered.map((a) => a?.target).filter((t) => t && t !== "无"))];
    const pactNpc = targetNames
      .map((nm) => npcs.find((n) => n?.name === nm))
      .filter((n) => n && !(n.intimacy?.forbidden || n.beast) && !n.anger?.active)
      .pop() || null;
    if (pactNpc) {
      const pactAction = condFiltered.find((a) => a?.target === pactNpc.name) || {};
      const pactStanceMod = pactAction.stance === "sincere" ? 0.1 : pactAction.stance === "perfunctory" ? -0.1 : pactAction.stance === "forceful" ? -0.15 : 0;
      const pactScore = 0.45 + personaMod(pactNpc.personality) + affectionMod(affectionOf(varTree, pactNpc.name)) + pactStanceMod;
      pactVerdict = roll() < Math.max(0.05, Math.min(0.9, pactScore));
      if (pactVerdict) {
        notes.push(`「${pactNpc.name}」已当面应下约定，正文须写出双方拍板说定，且尾章 spontaneousPact 必须按玩家所提期限与不超过 20 两的酬谢如实填写，不得留 null。`);
      } else {
        notes.push(`「${pactNpc.name}」未应下这桩口头约定，正文须写明对方婉拒或未松口，不得写成已立约。`);
      }
    }
  }

  // ── 第四步：签发 JudgeVerdict（契约 C） ──
  return {
    intimateCtxExecuted,
    causalTier: budget.tier,
    pacingWords: Number.isInteger(envelope.pacingWords) ? envelope.pacingWords : 320,
    facts,
    warrants,
    lastActionOutcome: J.lastActionOutcome,
    conditionResults,
    // V5：买卖/无未来履约条件的 social_deal 本轮强制 false——哪怕 accept/tier 放行。
    allowSpontaneousPact: pactSuppressed ? false : (pactVerdict !== null ? pactVerdict : (J.accept.value || budget.tier !== "T0")),
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
