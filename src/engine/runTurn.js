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
import { classifyError } from "../utils/apiErrors.js";
import { withAI } from "./ports/withAI.js";
import { judgeTurn } from "../domain/rules/judge/judgeTurn.js";
import { renderJudgeVerdict, renderCausalBudget } from "../domain/rules/judge/judgeTurn.js";
import { buildIntakeUserContent, normalizeIntakeResult } from "./turn/intakeTurn.js";
import { verifySealAndMaterialize } from "../domain/rules/effects/sealVerifier.js";
import { random } from "../utils/rng.js";
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

function retryNotice(error, verdict, attempt) {
  if (!verdict.delayMs) return `  ⚠ 接口中断（${error.message || error}），正在自动重试（第 ${attempt}/${MAX_AUTO_RETRY} 次）…`;
  return `  ⏳ 接口限流（${error.message || error}），${Math.ceil(verdict.delayMs / 1000)} 秒后自动重试（第 ${attempt}/${MAX_AUTO_RETRY} 次）…`;
}

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


function getGameStateTime(ctx, deps) {
  const t = ctx.getGameState?.()?.time ?? deps.time;
  return Number.isFinite(t) ? t : 0;
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
  const hist = buildHistBlock(histSource, { recentPairs: isTalk ? 3 : 2 });
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
    talkTarget: ctx.prompt?.talkTarget ?? ctx.prompt?.recall?.talkTarget ?? baseDeps.talkTarget,
    cmd,
    ai,
  };
  const addLog = deps.addLog || ctx.addLog || (() => {});
  const trace = (layer, status, detail) => traceStep(deps._trace, layer, status, detail);
  const callDeps = () => ({ ...deps });
  const apiCfg = deps.apiCfg;
  // ── WO-13 判官管线：前哨听意 → 纯函数判官 → 定案单注入主叙事 ──
  // 降级安全：intake 调用失败/不合形制一律空听意单，判官照常签发（多半空事实），
  // 主叙事拿不到锚点任务时退化为普通正文，锚点剥离/尾章校对全是 no-op。
  let judgeVerdict = null;
  // 闸门：① 单调用 JSON 模式的输出契约是纯 JSON，锚点+SEAL 的散文指令会让模型
  // 丢 JSON 骨架，故只在双调用叙事（extractionEnabled）模式激活；
  // ② settle 回合（赠礼/赔罪/求教等）状态在进叙事前已由 feature 层硬结算落账
  // （giftNpc/learnNpcSkill/inviteCompanion 先扣先写），判官再裁会双重结算——
  // settle 回合不激活；待后续工单把前置硬写改成「事实请求先裁后落」才可开放。
  // ③ 纯搭话回合不发生任何动作（搭话免费、不动状态），判官收礼会越权搬背包。
  if (deps.apiCfg?.judgePipelineEnabled && deps.apiCfg?.extractionEnabled && !isSettle && !isTalk) {
    try {
      const visibleNpcs = preparedPrompt.visibleNpcsForAI || preparedPrompt.visibleNpcs || deps.room?.npcs || [];
      const intakeContent = buildIntakeUserContent({
        playerInput: cmd,
        recentTurns: convo.slice(-4).map((m) => (m.role === "user" ? { user: m.content } : { engine: m.content }))
          .reduce((acc, cur) => { if (cur.user) acc.push({ user: cur.user, engine: "" }); else if (acc.length) acc[acc.length - 1].engine = cur.engine; return acc; }, []),
        npcs: visibleNpcs,
        entries: [],
      });
      const intakeRes = await withAI("turn.intake", { userContent: intakeContent, cfg: deps.apiCfg }, { ai, apiCfg: deps.apiCfg, throwOnError: false });
      const intakeResult = normalizeIntakeResult(intakeRes?.data);
      const timeNow = getGameStateTime(ctx, deps);
      judgeVerdict = judgeTurn({
        turn: timeNow, day: Math.floor(timeNow / 24) + 1, place: deps.room?.name || "",
        npcs: visibleNpcs, varTree: deps.varTree || ctx.memory?.varTreeLatest || {},
        inv: deps.inv || [], entries: [],
        budget: { riskLevel: 0, luck: deps.char?.special?.气运 ?? 0 },
      }, intakeResult, { rng: random });
      deps.judgePipelineActive = true;
      deps.judgeVerdict = judgeVerdict;
      deps.causalBudget = judgeVerdict.budget;
      deps.judgeRuleBlock = [
        "【判官定案·锚点铁律】系统已裁定本轮事实，你只有叙事权：",
        renderJudgeVerdict(judgeVerdict),
        renderCausalBudget(judgeVerdict.budget),
        "正文中每落实一条 facts 事实，须在落实处文末埋对应锚点 ⟦F编号⟧（玩家不可见，系统会剥除）；",
        "禁编造判官未签发的新器物/新武学/好感大变；写完正文换行输出 ---SEAL--- 紧跟单行 JSON：fills 给空白天机券填 name/chosenAffix/desc，respondedNpcs 列本轮开口的角色，spontaneousPact 无则 null。",
      ].join("\n");
      trace("判官管线", "pass", `intake ${intakeResult.actions?.length || 0} 动作/${intakeResult.proposals?.length || 0} 提议 → facts ${judgeVerdict.facts.length} 条/warrants ${judgeVerdict.warrants.length} 张（tier ${judgeVerdict.causalTier}）`);
    } catch (error) {
      trace("判官管线", "fail", `前哨听意异常降级：${error?.message || error}`);
    }
  }
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
          addLog([{ t: "sys", text: retryNotice(error, verdict, attempt) }]);
          trace("AI调用", "fail", `主叙事第${attempt}次失败：${error.message || error}，重试`);
          if (verdict.delayMs) {
            await (ctx.sleep || sleep)(verdict.delayMs);
            if (ctx.isStale?.()) return { stale: true };
          }
          continue;
        }
        trace("AI调用", "fail", `主叙事${verdict.why}：${error.message || error}`);
        throw error;
      }
    }

    const dealMatch = typeof rawFull === "string" && rawFull.match(/<deal>\s*([\s\S]*?)\s*<\/deal>/i);
    if (dealMatch) {
      try { dealResult = JSON.parse(dealMatch[1].replace(/[\x00-\x1f]/g, " ").trim()); } catch {}
      rawFull = rawFull.replace(/<deal>[\s\S]*?<\/deal>/gi, "").trim();
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

    // WO-15：独立提取层已整块删除。双调用模式下状态只来自判官管线的
    // materializeFacts 落账（尾章校对段），不再二次提取；自由行动/赠礼/赔罪/求教等
    // 全部收拒与数额由判官一裁定案。
    p = {};
    mvuCommands = [];
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
          addLog([{ t: "sys", text: retryNotice(error, verdict, attempt) }]);
          trace("AI调用", "fail", `第${attempt}次失败：${error.message || error}，重试`);
          if (verdict.delayMs) {
            await (ctx.sleep || sleep)(verdict.delayMs);
            if (ctx.isStale?.()) return { stale: true };
          }
          continue;
        }
        trace("AI调用", "fail", `${verdict.why}：${error.message || error}`);
        throw error;
      }
      ({ p, mvuCommands, dealResult } = parseMainResponse(rawFull));
      normalizeDuelRequest(p, createExtractionState(ctx, deps));
      mvuCommands = filterRejectedEffects(mvuCommands, deps.intentPlan); p = filterPlanDelta(p, deps.intentPlan);
      narrativeText = (p.output || []).join("");
      const truncated = p._truncated || /length|max[_ ]?tokens|max[_ ]?output/i.test(finishReason || "");
      if (truncated && attempt <= MAX_AUTO_RETRY) {
        addLog([{ t: "sys", text: `  ⚠ 上一轮被接口截断，正在自动重说一遍（第 ${attempt}/${MAX_AUTO_RETRY} 次，这次会更简短）…` }]);
        continue;
      }
      if (p.output?.[0]?.startsWith("（引擎回应格式异常，原始内容）")) {
        throw new Error("AI reply format is invalid");
      }
      if (!truncated) break;
    }
  }

  // ── WO-13 尾章校对与落账编译：漏写锚点系统补句、穿帮告警、
  // fills 编译进 materializeFacts，产物随 turn 带给 finalizeTurn 经 commitRound 落盘。
  let judgeEffects = null;
  if (judgeVerdict && deps.judgePipelineActive) {
    // 状态袋一律以 getGameState 实录为准（deps 里的 inv/char 在部分链路是空壳，
    // 空背包进 materializeFacts 会让 changes.inv 只含新货、把真背包整包抹掉）。
    const live = ctx.getGameState?.() || {};
    const stateForFacts = {
      time: getGameStateTime(ctx, deps),
      inv: live.inv || deps.inv || [], room: live.room || deps.room, char: live.char || deps.char,
      skills: live.skills || deps.skills || [],
      exp: live.exp ?? 0, pot: live.pot ?? 0,
      flags: live.flags || deps.flags || [],
      varTree: live.varTree, companionState: live.companionState,
      claimedMilestones: live.claimedMilestones,
    };
    const verified = verifySealAndMaterialize({
      sealText: sealParts?.sealText || "",
      screenText: narrativeText || rawFull,
      verdict: judgeVerdict,
      anchorIds: (sealParts?.anchors || []).map((a) => a.id),
      state: stateForFacts,
      luck: deps.char?.special?.气运 ?? 0,
      turn: stateForFacts.time,
    });
    if (verified.missingAnchors.length) {
      const before = narrativeText || "";
      const patched = verified.screenText.startsWith(before) ? verified.screenText.slice(before.length) : "";
      narrativeText = verified.screenText;
      // 正文已上屏（流式/非流式皆然）——系统补写的事实短句以旁白行追补落地，不篡改原文
      if (patched.trim()) addLog([{ t: "desc", text: "  " + patched.trim() }]);
    }
    for (const warning of verified.warnings) {
      trace("尾章校对", "warn", warning);
      addLog([{ t: "sys", text: `  ⚠ ${warning}` }]);
    }
    judgeEffects = { verdict: judgeVerdict, sealReport: verified, materialized: verified.materialized };
    trace("尾章校对", "pass", `锚点齐 ${judgeVerdict.facts.length - verified.missingAnchors.length}/${judgeVerdict.facts.length}，编译券 ${Object.keys(verified.materialized?.receipts || {}).length}，facts 落盘 ${verified.facts.length} 条`);
  }

  // settle 回合提取被跳过（或没吐出 memory）时，把结算文本登记为本轮事实：
  // 事实账本/小纸条/日总结都走 p.memory 这一个入口，不能因为是结算轮就漏记。
  // 只取首句：settle 文本尾部常带叙事指令（"请让…说道""只描写…"），不是事实不能入账。
  if (isSettle && !(p && p.memory)) {
    const memoryText = cmd.split(/[。！？]/).filter(Boolean)[0] || cmd;
    p = { ...p, memory: memoryText };
  }

  return {
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
