import { callMainOnce } from "./act/actCall.js";
import { parseMainResponse } from "./act/parseResponse.js";
import { step as traceStep } from "../infra/actionTrace.js";
import { PHASE, turnMonitor } from "../infra/turnMonitor.js";
import { runKnowledgeTurn, runRecall } from "./act/memoryLayer.js";
import { formatRecallEntries } from "./ports/recallBlock.js";
import { buildHistBlock, histBlockSavings } from "../domain/rules/memory/histWindow.js";
import { bindTurnAi, createWebAi } from "./ports/ai.js";
import { assemblePrompt } from "./prompt/assemblePrompt.js";
import { getApiModel } from "../content/apiModel.js";
import { filterPlanDelta, filterRejectedEffects } from "../domain/rules/intent/planNotes.js";
import { classifyError, redactSecrets } from "../utils/apiErrors.js";
import { withAI } from "./ports/withAI.js";
import { parseGroupTalkSeal } from "../domain/rules/judge/judgeRuleBlock.js";
import { recordSealMetric } from "./ports/releaseMetrics.js";
import { writeTurnProse } from "./act/proseWrite.js";
import { addProseChunks as proseChunkSink } from "./ports/recallBlock.js";
import { runJudgePhase, getGameStateTime } from "./turn/judgePhase.js";
import { verifyJudgeTail, runAppeaseVerdict, composeJudgeMemory } from "./turn/judgeTail.js";
import { questAdvanceCandidates } from "../domain/rules/quests/questAdvanceCandidates.js";
import { getPresentNpcs } from "../domain/rules/prompt/promptRefs.js";

const MAX_AUTO_RETRY = 2;

function assertNonEmpty(rawFull) {
  if (String(rawFull ?? "").trim()) return;
  const err = new Error("接口返回了空内容（模型没有输出任何文字）");
  err.code = "empty";
  throw err;
}

const RATE_LIMIT_BACKOFF_MS = 2000;
const RATE_LIMIT_MAX_WAIT_MS = 30000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryVerdict(error, attempt) {
  if (attempt > MAX_AUTO_RETRY) return { retry: false, why: "重试用尽仍失败" };
  const ec = classifyError(error);
  if (ec.retryable === false) return { retry: false, why: `${ec.title}，重试无用，不自动重试` };
  if (ec.kind !== "rateLimit") return { retry: true, delayMs: 0 };
  const hinted = error?.retryAfterMs == null ? NaN : Number(error.retryAfterMs);
  const delayMs = Number.isFinite(hinted) && hinted >= 0 ? hinted : RATE_LIMIT_BACKOFF_MS * 2 ** (attempt - 1);
  if (delayMs > RATE_LIMIT_MAX_WAIT_MS) return { retry: false, why: `接口要求等 ${Math.ceil(delayMs / 1000)} 秒，超过自动重试上限，不自动重试` };
  return { retry: true, delayMs };
}

// 自动重试只是过程，不是结果：说明挂在回合状态灯上（turnMonitor.note），不写进主栏日志；
// 重试成功它就自然消失，全部失败才由 useTurn 落一条报错。原文脱敏后只进全流程日志与卷宗。
function retryNotice(error, verdict, attempt) {
  const { line } = classifyError(error);
  if (!verdict.delayMs) return `${line}，正在重试 ${attempt}/${MAX_AUTO_RETRY}`;
  return `${line}，${Math.ceil(verdict.delayMs / 1000)} 秒后重试 ${attempt}/${MAX_AUTO_RETRY}`;
}

const errText = (error) => redactSecrets(error?.message || error);

function withPresenceTrace(ctx) {
  if (!ctx.prompt?.buildPresence) return ctx;
  const buildPresence = (args) => {
    const presence = ctx.prompt.buildPresence(args);
    const { visibleNpcs, visibleNpcsForAI } = presence;
    const { room } = args;
    traceStep(ctx._trace, "在场名单", "info", `喂给AI ${visibleNpcs.length} 人${visibleNpcs.length ? "：" + visibleNpcs.map(n => n.name).join("、") : "（无人）"}${room.npcs.length !== visibleNpcs.length ? `（据点共${room.npcs.length}人，按内层房间过滤掉${room.npcs.length - visibleNpcs.length}人）` : ""}`);
    if (visibleNpcsForAI.length > visibleNpcs.length) {
      traceStep(ctx._trace, "伙伴随行", "info", `${visibleNpcsForAI.at(-1).name}随行在场，已并入喂给AI的在场名单`);
    }
    return presence;
  };
  return { ...ctx, prompt: { ...ctx.prompt, buildPresence } };
}

export function createExtractionState(ctx, deps) {
  const state = ctx.state || {};
  const lockedDestName = state.lockedDestName ?? deps.lockedDestName;
  return {
    room: state.room || deps.room,
    char: state.char || deps.char,
    inv: state.inv || deps.inv || [],
    dao: state.dao || deps.dao,
    varTree: deps.varTree,
    lockedDestName,
    lockedExits: lockedDestName ? ctx.getMapNode?.(lockedDestName)?.exits : null,
    pickupJudgment: deps.pickupJudgment,
    questProgress: state.questProgress || deps.questProgress || ctx.prompt?.questProgress,
    flags: state.flags || deps.flags || ctx.prompt?.flags,
    cmd: deps.cmd,
    innerRoomName: state.innerRoomName ?? deps.innerRoomName ?? ctx.prompt?.innerRoomName,
  };
}

export async function runTurn(ctx, cmd, opts = {}) {
  const trace = ctx._trace || turnMonitor.start(cmd, { source: "engine", commandId: "turnCommit" });
  try {
    const result = await runTurnSteps({ ...ctx, _trace: trace }, cmd, opts);
    if (!ctx._trace) {
      if (result.stale) turnMonitor.transition(trace, PHASE.DISCARDED, "结果已过期");
      else turnMonitor.finish(trace);
    }
    return result;
  } catch (error) {
    if (!ctx._trace) turnMonitor.transition(trace, PHASE.ERROR, String(error));
    throw error;
  }
}


async function runTurnSteps(ctx, cmd, opts) {
  const ai = bindTurnAi(ctx.ai || createWebAi(), ctx._trace);
  const convo = ctx.convo || [];
  const newConvo = [...convo, { role: "user", content: cmd }];
  const mainConvo = newConvo.filter((message) => !(
    typeof message.content === "string"
    && (message.content.startsWith("（私聊）") || message.content.startsWith("（旁白私聊回应）"))
  ));
  const isTalk = !!ctx.isTalk;
  const isSettle = !!opts.settle || !!ctx.isSettle;
  const contextWindow = ctx.apiCfg?.contextWindow || 16;
  const histWindow = isSettle ? 6 : isTalk ? Math.max(contextWindow, 20) : contextWindow;
  const histSource = mainConvo.length > histWindow ? mainConvo.slice(-histWindow) : mainConvo;
  const hist = buildHistBlock(histSource, {
    recentPairs: isTalk ? 3 : 2,
    // Review 修：room 不在 ctx 顶层——turnContext 挂在 state/prompt 下，
    // 取不到会让「他处旧幕」房间头永远失效。
    currentRoom: ctx.state?.room?.name || ctx.prompt?.room?.name || "",
    currentInner: ctx.innerRoomName ?? ctx.state?.innerRoomName ?? ctx.prompt?.innerRoomName ?? null,
  });
  const historySavings = histBlockSavings(histSource, { recentPairs: isTalk ? 3 : 2 });
  if (historySavings.savedChars > 0) {
    traceStep(ctx._trace, "历史压缩", "info", `${historySavings.legacyChars}→${historySavings.nowChars}字（省 ${historySavings.savedChars}，约 ${Math.round(historySavings.savedChars * 1.6)} tokens）`);
  }
  const onPromptRefMissing = (paths) => traceStep(ctx._trace, "提示词引用缺失", "warn", paths.join("、"));
  const preparedPrompt = assemblePrompt(withPresenceTrace({ ...ctx, onPromptRefMissing }), cmd, opts, convo, mainConvo, hist, newConvo);
  const promptContext = { ...preparedPrompt };
  let knowledgeTurn = null;
  let recall = { recallInfo: null, recallBlock: "" };
  if (ctx.memory) {
    // 知识推演仅更新信息域，不增删 角色 键；与只读向量召回互相独立，可并行执行。
    // 若 playTurn 在软结算阶段已提前发起只读召回，这里直接复用其 Promise。
    const recallPromise = ctx._prefetchedRecall || runRecall({
      ...ctx.memory.recall,
      lastAiText: preparedPrompt.lastAiText || ctx.memory.recall.lastAiText,
      varTreeLatest: ctx.memory.varTreeLatest,
      recentTexts: [hist],
      viewer: ctx.prompt?.char?.name || ctx.char?.name || "主角",
      currentTurn: ctx.getGameState?.()?.time ?? undefined,
      lineage: ctx.getGameState?.()?.proseLineage,
    });
    [knowledgeTurn, recall] = await Promise.all([
      runKnowledgeTurn({
        ...ctx.memory,
        ...(preparedPrompt.visibleNpcsForAI ? { infoDomainNpcNames: preparedPrompt.visibleNpcsForAI.map(n => n.name) } : {}),
        ai,
      }),
      recallPromise,
    ]);
    if (ctx.isStale?.()) return { stale: true };
    if (ctx._prefetchedRecall && recall?.recallInfo) {
      recall = formatRecallEntries(recall.recallInfo, { recentTexts: [hist] });
    }
  }
  const memoryDeps = {
    varTree: knowledgeTurn?.kTree,
    infoDomainBlock: knowledgeTurn?.infoDomainBlock || "",
    recallInfo: recall.recallInfo,
    recallBlock: recall.recallBlock,
  };
  const baseDeps = {
    ...(typeof ctx.callDeps === "function" ? ctx.callDeps(memoryDeps, promptContext) : (ctx.callDeps || ctx)),
    ...promptContext,
  };
  const deps = {
    ...baseDeps,
    ...Object.fromEntries(Object.entries(memoryDeps).filter(([, value]) => value !== undefined)),
    room: ctx.prompt?.room ?? baseDeps.room,
    activeTarget: ctx.prompt?.activeTarget ?? baseDeps.activeTarget,
    // turnContext 顶层 talkTarget 是 web 链唯一可靠来源——createPromptContext 不带它、
    // callDeps 也不带它（Review 实证：玩家选中 NPC 搭话时 deps.talkTarget 恒 undefined，
    // synthesizeTalkIntake 只能填「无」，搭话事实签不到对象头上）。顶层优先，其余为兜底。
    talkTarget: ctx.talkTarget ?? ctx.prompt?.talkTarget ?? ctx.prompt?.recall?.talkTarget ?? baseDeps.talkTarget,
    cmd,
    ai,
  };
  const addLog = deps.addLog || ctx.addLog || (() => {});
  const trace = (layer, status, detail, fields = {}) => traceStep(deps._trace, layer, status, detail, "domain", fields);
  const callDeps = () => ({ ...deps });
  const apiCfg = deps.apiCfg;
  // ── WO-13 判官管线：前哨听意 → 纯函数判官 → 定案单注入主叙事（S4 拆到 turn/judgePhase.js）──
  const judgePhaseOut = await runJudgePhase({ ctx, deps, opts, preparedPrompt, convo, cmd, ai, isTalk, isSettle, trace });
  if (judgePhaseOut?.stale) return { stale: true };
  // D8：亲密门槛拒决——拒词与扣好感已在判官段直写落盘，本回合就此打住不进主叙事。
  if (judgePhaseOut?.intimacyRefused) return { intimacyRefused: true, done: true };
  let judgeVerdict = judgePhaseOut?.judgeVerdict || null;
  const isGroupTalk = !!judgePhaseOut?.isGroupTalk;
  const visibleNpcsPre = judgePhaseOut?.visibleNpcsPre || [];

  // ── WO-15 窄过渡：赔罪开庭前仲裁（S4 拆到 turn/judgePhase.js）──
  const appeaseOut = await runAppeaseVerdict({ ctx, deps, opts, cmd, ai, apiCfg, isSettle, trace });
  if (appeaseOut?.stale) return { stale: true };
  let appeaseVerdict = appeaseOut?.appeaseVerdict || null;


  let rawFull = "";
  let sealParts = null;
  let p = {};
  let mvuCommands = [];
  let dealResult = null;
  let narrativeText = "";
  let pickupExtractionFailed = false;

  if (apiCfg.extractionEnabled) {
    let mainFinishReason;
    for (let attempt = 1; attempt <= MAX_AUTO_RETRY + 1; attempt++) {
      try {
        const result = await callMainOnce(null, true, callDeps());
        if (ctx.isStale?.()) return { stale: true };
        assertNonEmpty(result.rawFull);
        rawFull = result.rawFull;
        mainFinishReason = result.finishReason;
        sealParts = { sealText: result.sealText, anchors: result.sealAnchors, sealed: result.sealed };
        trace("AI调用", "pass", attempt > 1
          ? `主叙事第${attempt}次尝试成功（双调用·主叙事模型=${getApiModel(apiCfg) || "未设置"}）`
          : `主叙事一次成功（双调用·主叙事模型=${getApiModel(apiCfg) || "未设置"}）`);
        break;
      } catch (error) {
        if (ctx.isStale?.()) return { stale: true };
        const verdict = retryVerdict(error, attempt);
        if (verdict.retry) {
          turnMonitor.note(ctx._trace, retryNotice(error, verdict, attempt));
          trace("AI调用", "fail", `主叙事第${attempt}次失败：${errText(error)}，重试`);
          if (verdict.delayMs) {
            await (ctx.sleep || sleep)(verdict.delayMs);
            if (ctx.isStale?.()) return { stale: true };
          }
          continue;
        }
        trace("AI调用", "fail", `主叙事${verdict.why}：${errText(error)}`);
        throw error;
      }
    }

    const dealMatch = typeof rawFull === "string" && rawFull.match(/<deal>\s*([\s\S]*?)\s*<\/deal>/i);
    if (dealMatch) {
      try { dealResult = JSON.parse(dealMatch[1].replace(/[\x00-\x1f]/g, " ").trim()); } catch {}
      rawFull = rawFull.replace(/<deal>[\s\S]*?<\/deal>/gi, "").trim();
    }
    // V1：半句腰斩不留账——撞上限时先把正文裁回最近一个完整句尾（。！？…」），
    // 半截句子不进 convo/落账/公屏；流式已上屏部分由警告行说明。
    if (/length|max[_ ]?tokens|max[_ ]?output/i.test(mainFinishReason || "")) {
      const beforeLen = rawFull.length;
      const trimmed = rawFull.replace(/[^。！？!?.…」』")\n]{1,80}$/, "");
      if (trimmed.length >= Math.floor(beforeLen * 0.5) && trimmed.length < beforeLen) {
        rawFull = trimmed;
        trace("截断检查", "pass", `半句裁尾：${beforeLen - trimmed.length} 字残句不落账`);
      }
    }
    narrativeText = rawFull;
    if (!apiCfg.streamEnabled) {
      const lines = rawFull.split("\n").map((line) => line.trim()).filter(Boolean);
      addLog(lines.map((text) => ({ t: "desc", text: `  ${text}` })));
    }
    if (/length|max[_ ]?tokens|max[_ ]?output/i.test(mainFinishReason || "")) {
      trace("截断检查", "block", `主叙事撞 token 上限（finishReason=${mainFinishReason}）`);
      addLog([{ t: "sys", text: "  ⚠ 本轮叙事被接口中途截断（撞到输出 token 上限），以上是已收到的部分。提取层只能按这段残文结算状态，本轮状态可能不全。" }]);
    }

    // WO-15：独立提取层已整块删除。双调用模式下自由行动状态只来自判官管线的
    // materializeFacts 落账（尾章校对段），不再二次提取；settle 回合靠 feature 前置硬结算。
    p = {};
    mvuCommands = [];

    // WO-15 窄过渡：赔罪裁定在开庭前已完成（见上），这里只按定案落系统 mvu。
    if (appeaseVerdict?.choice === "奏效") {
      mvuCommands = [
        { op: "set", path: `角色.${appeaseVerdict.npc}.生气解除`, value: true },
        { op: "add", path: `角色.${appeaseVerdict.npc}.好感度`, value: 3 },
      ];
    }
  } else {
    for (let attempt = 1; attempt <= MAX_AUTO_RETRY + 1; attempt++) {
      const nudge = attempt > 1
        ? "\n\n（注意：上一次回复未能输出完整闭合的 JSON。请确保本次输出一个语法完整、正常闭合收尾的 JSON，不要中途断开。）"
        : "";
      let finishReason;
      try {
        const result = await callMainOnce(nudge, false, callDeps());
        if (ctx.isStale?.()) return { stale: true };
        assertNonEmpty(result.rawFull);
        rawFull = result.rawFull;
        finishReason = result.finishReason;
        sealParts = { sealText: result.sealText, anchors: result.sealAnchors, sealed: result.sealed };
        trace("AI调用", "pass", attempt > 1
          ? `第${attempt}次重试后成功（单调用·主模型=${getApiModel(apiCfg) || "未设置"}）`
          : `一次成功（单调用·主模型=${getApiModel(apiCfg) || "未设置"}）`);
      } catch (error) {
        if (ctx.isStale?.()) return { stale: true };
        const verdict = retryVerdict(error, attempt);
        if (verdict.retry) {
          turnMonitor.note(ctx._trace, retryNotice(error, verdict, attempt));
          trace("AI调用", "fail", `第${attempt}次失败：${errText(error)}，重试`);
          if (verdict.delayMs) {
            await (ctx.sleep || sleep)(verdict.delayMs);
            if (ctx.isStale?.()) return { stale: true };
          }
          continue;
        }
        trace("AI调用", "fail", `${verdict.why}：${errText(error)}`);
        throw error;
      }
      ({ p, mvuCommands, dealResult } = parseMainResponse(rawFull));
      normalizeDuelRequest(p, createExtractionState(ctx, deps));
      mvuCommands = filterRejectedEffects(mvuCommands, deps.intentPlan); p = filterPlanDelta(p, deps.intentPlan);
      narrativeText = (p.output || []).join("");
      const truncated = p._truncated || /length|max[_ ]?tokens|max[_ ]?output/i.test(finishReason || "");
      if (truncated && attempt <= MAX_AUTO_RETRY) {
        turnMonitor.note(ctx._trace, `叙事被截断，正在重说 ${attempt}/${MAX_AUTO_RETRY}`);
        continue;
      }
      if (p.output?.[0]?.startsWith("（引擎回应格式异常，原始内容）")) {
        throw new Error("AI reply format is invalid");
      }
      if (!truncated) break;
    }
  }

  // ── WO-13 尾章校对与落账编译（S4 拆到 turn/judgePhase.js）──
  const judgeTailOut = verifyJudgeTail({ ctx, deps, judgeVerdict, sealParts, narrativeText, rawFull, p, addLog, trace });
  let judgeEffects = judgeTailOut.judgeEffects;
  narrativeText = judgeTailOut.narrativeText;
  p = judgeTailOut.p;

  // settle 回合提取被跳过（或没吐出 memory）时，把结算文本登记为本轮事实：
  // 事实账本/小纸条/日总结都走 p.memory 这一个入口，不能因为是结算轮就漏记。
  // 只取首句：settle 文本尾部常带叙事指令（"请让…说道""只描写…"），不是事实不能入账。
  if (isSettle && !(p && p.memory)) {
    const memoryText = cmd.split(/[。！？]/).filter(Boolean)[0] || cmd;
    p = { ...p, memory: memoryText };
  }

  // ── WO-16A memory 过渡（S4 拆到 turn/judgeTail.js）──
  const judgeMemoryText = composeJudgeMemory({ judgeVerdict, deps, judgeEffects, isTalk, ctx, cmd });
  if (!isSettle && !(p && p.memory) && judgeMemoryText) {
    p = { ...p, memory: judgeMemoryText };
    // V8 Review 修：memory 模板源自判官首条事实时，把事实级 witnesses 一并贴给
    // 记忆登记——闺房密事/密行只主角+对象知情，不得按全屋目击者记账。
    // （facts 非空时 memory 必取自首条事实——composeJudgeMemory 首分支优先。）
    const firstFactWitnesses = judgeVerdict?.facts?.[0]?.witnesses;
    if (judgeVerdict?.facts?.length && Array.isArray(firstFactWitnesses) && firstFactWitnesses.length) {
      p = { ...p, memoryFactWitnesses: firstFactWitnesses };
    }
  }

  // WO-16H-H1 群聊尾章校对：parseGroupTalkSeal 按在场白名单过滤——越界名字
  // 安静丢弃并记 trace，绝不进状态（群聊不改任何游戏状态，只此一键）。
  if (isGroupTalk && deps.groupTalkRuleBlock) {
    // B0：群聊尾章计量 chain=group——有 SEAL+JSON 可解析+白名单过滤后无 dropped 才 passed；
    // 缺尾章/坏 JSON/越界名字都 failed。群聊不写状态不变，计量只读。
    const presentNames = visibleNpcsPre.map((n) => n?.name).filter(Boolean);
    const sealText = sealParts?.sealText || "";
    const parsed = parseGroupTalkSeal(sealText, presentNames);
    if (sealText) {
      for (const dropped of parsed.dropped) {
        trace("群聊尾章", "warn", `respondedNpcs 越界名字「${dropped}」不在场，已丢弃`);
      }
      if (parsed.respondedNpcs.length) {
        p = { ...p, respondedNpcs: parsed.respondedNpcs };
      }
    }
    recordSealMetric({
      epoch: String(ctx.proseEpoch ?? "default"),
      cfg: apiCfg,
      chain: "group",
      sealText,
      sealData: parsed.jsonOk ? parsed.data : null,
      warnings: [
        ...(parsed.validationErrors || []),
        ...(parsed.dropped.length ? [`dropped:${parsed.dropped.join("/")}`] : []),
      ],
    });
  }

  // WO-18 原文段落写挂 payload：不在这里触发——commitRound 可能抛错回滚，
  // 被回滚的叙事不能进段落库。payload 随结果带给 finalizeTurn，在事务成功
  // 且未 stale 后统一派发（见 finalizeTurn）。
  const prosePayload = (() => {
    const liveNow = ctx.getGameState?.() || {};
    const roomNow = liveNow.room || deps.room || {};
    return {
      narrativeText,
      turn: getGameStateTime(ctx, deps),
      location: roomNow.name || "",
      playerName: (liveNow.char || deps.char)?.name || deps.charName || "主角",
      roomNpcNames: (roomNow.npcs || []).map((n) => n?.name).filter(Boolean),
      isTalk: !!isTalk,
      talkTarget: ctx.talkTarget || "",
      anchoredFacts: [
        ...(judgeVerdict?.facts || []).map((f) => f?.id).filter(Boolean),
        ...(sealParts?.anchors || []).map((a) => a?.id).filter(Boolean),
      ],
    };
  })();

  return {
    prosePayload,
    p,
    mvuCommands,
    dealResult,
    rawFull,
    narrativeText,
    pickupExtractionFailed,
    knowledgeTree: knowledgeTurn?.kTree,
    knowledgeTreeBase: knowledgeTurn ? ctx.memory.varTreeLatest : undefined,
    recallInfo: recall.recallInfo,
    recallBlock: recall.recallBlock,
    newConvo,
    judgeEffects,
    intimateTicket: judgeVerdict?.intimateTicket || deps.intimateTicket || null,
    derivedRespondedNpcs: deps.derivedRespondedNpcs || null,
    intakeTargets: deps.intakeTargets || null,
    intakeRefIds: deps.intakeRefIds || null,
    postRouteRoom: deps.postRouteRoom || null,
    postRouteInnerRoom: deps.postRouteInnerRoom ?? null,
    judgePipelineActive: !!deps.judgePipelineActive,
    groupTalk: !!deps.groupTalkRuleBlock,
    // WO-16F-F2c：交互意向随 turn 对象带出——finalizeTurn 无需特别处理，
    // useTurn 在 result.ok && !stale 后复用 intentRouter runDeferred 消费。
    deferredIntents: deps.deferredIntents || null,
  };
}

// WO-15：normalizeDuelRequest 自 extractionEngine 内联——单调用 JSON 模式的
// duelRequest 名字解析回在场 NPC 对象（双调用判官管线不经此路）。
function normalizeDuelRequest(parsed, state = {}) {
  if (!parsed || typeof parsed !== "object" || parsed.duelRequest == null) return parsed;
  const raw = parsed.duelRequest;
  let name = "";
  if (typeof raw === "string") name = raw.trim();
  else if (typeof raw?.name === "string") name = raw.name.trim();
  const npc = getPresentNpcs(state).find((candidate) => candidate.name === name);
  if (npc) parsed.duelRequest = npc; else delete parsed.duelRequest;
  return parsed;
}
