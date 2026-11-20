import { callMainOnce } from "./act/actCall.js";
import { parseMainResponse } from "./act/parseResponse.js";
import { callExtraction, buildExtractionCfg } from "../domain/prompt/extractionEngine.js";
import { step as traceStep } from "../infra/actionTrace.js";
import { PHASE, turnMonitor } from "../core/turnMonitor.js";
import { runKnowledgeTurn, runRecall } from "./act/memoryLayer.js";
import { buildHistBlock, histBlockSavings } from "../domain/memory/histWindow.js";
import { bindTurnAi, createWebAi } from "./ports/ai.js";
import { assemblePrompt } from "./prompt/assemblePrompt.js";

const MAX_AUTO_RETRY = 2;

function withPresenceTrace(ctx) {
  if (!ctx.prompt?.buildPresence) return ctx;
  const buildPresence = (args) => {
    const presence = ctx.prompt.buildPresence(args);
    const { visibleNpcs, visibleNpcsForAI } = presence;
    const { room } = args;
    traceStep(ctx._trace, "在场名单", "info", `喂给AI ${visibleNpcs.length} 人${visibleNpcs.length ? "：" + visibleNpcs.map(n => n.name).join("、") : "（无人）"}${room.npcs.length !== visibleNpcs.length ? `（据点共${room.npcs.length}人，按内层房间过滤掉${room.npcs.length - visibleNpcs.length}人）` : ""}`);
    if (visibleNpcsForAI.length > visibleNpcs.length) {
      traceStep(ctx._trace, "伙伴随行", "info", `${visibleNpcsForAI.at(-1).name}随行在场，已并入喂给AI的在场名单（不影响此地之人UI列表）`);
    }
    return presence;
  };
  return { ...ctx, prompt: { ...ctx.prompt, buildPresence } };
}

export function createExtractionState(ctx, deps) {
  const state = ctx.state || {};
  const lockedDestName = state.lockedDestName ?? deps.lockedDestName;
  const inv = state.inv || deps.inv || [];
  return {
    room: state.room || deps.room,
    char: state.char || deps.char,
    inv,
    invText: inv.map((item) => typeof item === "string" ? item : item.name).join("，") || "空",
    dao: state.dao || deps.dao,
    varTree: deps.varTree,
    lockedDestName,
    lockedExits: lockedDestName ? ctx.getMapNode?.(lockedDestName)?.exits : null,
    pickupJudgment: deps.pickupJudgment,
  };
}

export async function runTurn(ctx, cmd, opts = {}) {
  const trace = ctx._trace || turnMonitor.start(cmd, { source: "engine" });
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
  const hist = buildHistBlock(histSource, { recentPairs: isTalk ? 3 : 2 });
  const historySavings = histBlockSavings(histSource, { recentPairs: isTalk ? 3 : 2 });
  if (historySavings.savedChars > 0) {
    traceStep(ctx._trace, "历史压缩", "info", `${historySavings.legacyChars}→${historySavings.nowChars}字（省 ${historySavings.savedChars}，约 ${Math.round(historySavings.savedChars * 1.6)} tokens）`);
  }
  const preparedPrompt = assemblePrompt(withPresenceTrace(ctx), cmd, opts, convo, mainConvo, hist, newConvo);
  const promptContext = { ...preparedPrompt };
  let knowledgeTurn = null;
  let recall = { recallInfo: null, recallBlock: "" };
  if (ctx.memory) {
    knowledgeTurn = await runKnowledgeTurn({ ...ctx.memory, ai });
    if (ctx.isStale?.()) return { stale: true };
    recall = await runRecall({
      ...ctx.memory.recall,
      lastAiText: preparedPrompt.lastAiText || ctx.memory.recall.lastAiText,
      varTreeLatest: knowledgeTurn.kTree,
    });
    if (ctx.isStale?.()) return { stale: true };
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
  const deps = { ...baseDeps, ...Object.fromEntries(Object.entries(memoryDeps).filter(([, value]) => value !== undefined)), cmd, ai };
  const addLog = deps.addLog || ctx.addLog || (() => {});
  const trace = (layer, status, detail) => traceStep(deps._trace, layer, status, detail);
  const callDeps = () => ({ ...deps });
  const apiCfg = deps.apiCfg;
  let rawFull = "";
  let p = {};
  let mvuCommands = [];
  let dealResult = null;
  let narrativeText = "";
  let pickupExtractionFailed = false;

  if (apiCfg.extractionEnabled) {
    const extractionSpecKey = deps.isTalk ? "TALK_CASUAL" : deps.intent.code;
    const extractionCfg = buildExtractionCfg(extractionSpecKey, apiCfg);
    let mainFinishReason;
    for (let attempt = 1; attempt <= MAX_AUTO_RETRY + 1; attempt++) {
      try {
        const result = await callMainOnce(null, true, callDeps());
        if (ctx.isStale?.()) return { stale: true };
        rawFull = result.rawFull;
        mainFinishReason = result.finishReason;
        trace("AI调用", "pass", attempt > 1
          ? `主叙事第${attempt}次尝试成功（双调用·主叙事模型=${apiCfg.model || "未设置"}）`
          : `主叙事一次成功（双调用·主叙事模型=${apiCfg.model || "未设置"}）`);
        break;
      } catch (error) {
        if (ctx.isStale?.()) return { stale: true };
        if (attempt <= MAX_AUTO_RETRY) {
          addLog([{ t: "sys", text: `  ⚠ 接口中断（${error.message || error}），正在自动重试（第 ${attempt}/${MAX_AUTO_RETRY} 次）…` }]);
          trace("AI调用", "fail", `主叙事第${attempt}次失败：${error.message || error}，重试`);
          continue;
        }
        trace("AI调用", "fail", `主叙事重试用尽仍失败：${error.message || error}`);
        throw error;
      }
    }

    const dealMatch = typeof rawFull === "string" && rawFull.match(/<deal>\s*([\s\S]*?)\s*<\/deal>/i);
    if (dealMatch) {
      try { dealResult = JSON.parse(dealMatch[1].replace(/[\x00-\x1f]/g, " ").trim()); } catch {}
      rawFull = rawFull.replace(/<deal>[\s\S]*?<\/deal>/gi, "").trim();
    }
    narrativeText = rawFull;
    if (!apiCfg.streamEnabled || apiCfg.apiType === "gemini") {
      const lines = rawFull.split("\n").map((line) => line.trim()).filter(Boolean);
      addLog(lines.map((text) => ({ t: "desc", text: `  ${text}` })));
    }
    if (/length|max[_ ]?tokens|max[_ ]?output/i.test(mainFinishReason || "")) {
      trace("截断检查", "block", `主叙事撞 token 上限（finishReason=${mainFinishReason}）`);
      addLog([{ t: "sys", text: "  ⚠ 本轮叙事被接口中途截断（撞到输出 token 上限），以上是已收到的部分。提取层只能按这段残文结算状态，本轮状态可能不全。" }]);
    }

    const extractionState = createExtractionState(ctx, deps);
    const settleOptions = (opts.settleKind && opts.settleNpc)
      ? {
        settleKind: opts.settleKind,
        settleNpc: opts.settleNpc,
        giftInfo: opts.giftInfo,
        learnInfo: opts.learnInfo,
        settleBeast: !!opts.settleBeast,
      }
      : null;
    const extracted = await callExtraction(
      extractionSpecKey,
      rawFull,
      extractionState,
      apiCfg,
      settleOptions,
      deps.ai,
    ).catch((error) => {
      if (!ctx.isStale?.()) {
        addLog([{ t: "sys", text: `  ⚠ 提取层调用失败（${error.message || error}），本轮状态未更新` }]);
        trace("提取调用", "fail", `提取模型=${extractionCfg.model || "未设置"}调用异常：${error.message || error}，本轮状态未更新`);
      }
      return null;
    });
    if (ctx.isStale?.()) return { stale: true };
    pickupExtractionFailed = !extracted || !!extracted.parseFailed;
    if (extracted?.parseFailed) {
      addLog([{ t: "sys", text: "  ⚠ 提取层返回的不是合法JSON（可能被截断或模型没按格式输出），本轮状态未更新" }]);
      trace("提取调用", "fail", `返回内容无法解析（提取模型=${extractionCfg.model || "未设置"}），本轮状态未更新`);
    } else if (extracted) {
      trace("提取调用", "pass", `状态提取完成（提取模型=${extractionCfg.model || "未设置"}${settleOptions ? `·${settleOptions.settleKind}专属spec` : ""}）`);
    }
    p = extracted?.p || {};
    mvuCommands = extracted?.mvuCommands || [];
  } else {
    for (let attempt = 1; attempt <= MAX_AUTO_RETRY + 1; attempt++) {
      const nudge = attempt > 1
        ? "\n\n（注意：上一次回复未能输出完整闭合的 JSON。请确保本次输出一个语法完整、正常闭合收尾的 JSON，不要中途断开。）"
        : "";
      let finishReason;
      try {
        const result = await callMainOnce(nudge, false, callDeps());
        if (ctx.isStale?.()) return { stale: true };
        rawFull = result.rawFull;
        finishReason = result.finishReason;
        trace("AI调用", "pass", attempt > 1
          ? `第${attempt}次重试后成功（单调用·主模型=${apiCfg.model || "未设置"}）`
          : `一次成功（单调用·主模型=${apiCfg.model || "未设置"}）`);
      } catch (error) {
        if (ctx.isStale?.()) return { stale: true };
        if (attempt <= MAX_AUTO_RETRY) {
          addLog([{ t: "sys", text: `  ⚠ 接口中断（${error.message || error}），正在自动重试（第 ${attempt}/${MAX_AUTO_RETRY} 次）…` }]);
          trace("AI调用", "fail", `第${attempt}次失败：${error.message || error}，重试`);
          continue;
        }
        trace("AI调用", "fail", `重试用尽仍失败：${error.message || error}`);
        throw error;
      }
      ({ p, mvuCommands, dealResult } = parseMainResponse(rawFull));
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
  };
}
