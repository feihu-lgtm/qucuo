import { formatPlanNote } from "../../domain/rules/intent/planNotes.js";
import { bookkeepToPatches } from "../../domain/rules/memory/bookkeep.js";
import { applyPatches } from "../../domain/rules/state/applyPatches.js";
import { runBookkeep } from "../ports/bookkeep.js";
import { getLedger } from "../../domain/rules/memory/npcLedger.js";
import { buildPresence } from "../prompt/roundNotes.js";
import { bindTurnAi, createWebAi } from "../ports/ai.js";
import { PHASE, turnMonitor } from "../../infra/turnMonitor.js";

function targetName(target) {
  return typeof target === "string" ? target : target?.name;
}

// 纯叙事键：提取产物 p 只有这些键时，本回合没有任何数值/关系/物品/事件变动。
// respondedNpcs 是闲聊常规字段（"对话即认识"由 commitRound 的 talkKnow 处理，
// 记账层只当叙事元数据）；判据取"只放白名单内的键"而非"没有黑名单键"——提取层
// 以后加新字段时默认仍记账，宁可多记一次也不漏账。
const NARRATION_ONLY_P_KEYS = new Set(["output", "memory", "choices", "respondedNpcs", "_truncated"]);

function turnHasStateWrites({ ctx, turn, opts }) {
  // 系统已结算的回合（卖东西/送礼/平息等）提取被跳过、p 只剩叙事键，
  // 但账本必须落账——settle 全族标志都按有变动处理。
  if (opts?.settle || ctx?.isSettle || opts?.settleKind || opts?.learnInfo || opts?.settleBeast
    || opts?.giftInfo?.weight) return true;
  if (turn?.intentPlan || ctx?.intentPlan || turn?.dealResult) return true;
  if (Array.isArray(turn?.mvuCommands) && turn.mvuCommands.length) return true;
  const p = turn?.p;
  if (!p || typeof p !== "object") return true; // 形态不明按有变动处理，照常记账
  const hasNonNarrationKey = Object.keys(p).some((key) => !NARRATION_ONLY_P_KEYS.has(key));
  if (hasNonNarrationKey) return true;

  // 判官管线启用时，p.memory 来自 composeJudgeMemory 的确定性模板（闲聊也会填充
  // 「玩家对X说：…」），不能用非空 memory 作为状态变更判据，否则每次对话都触发后台记账。
  if (turn?.judgePipelineActive) {
    if (turn?.judgeEffects?.sealReport?.sealData?.spontaneousPact) return true;
    if ((turn?.judgeEffects?.materialized?.receipts || []).length > 0) return true;
    if ((turn?.judgeEffects?.routeReceipts || []).some((r) => r?.ok && r?.kind !== "move")) return true;
    const facts = turn?.judgeEffects?.verdict?.facts || [];
    // 例行闲聊搭话投机（无 anger）已由 materializeFacts 确定性入心账，不值得再跑后台记账模型；
    // 透露秘闻、言语冲撞/生气、赠礼、窃取、赔罪、拜师、破费、得财等才启动记账。
    return facts.some((f) => !(f?.op === "MUTATE_SOCIAL" && f?.reason === "搭话投机" && !f?.anger));
  }

  // 旧单调用/提取层模式：保留 memory 非空判定（可能承载纯文本承诺/人情）。
  if (typeof p.memory === "string" && p.memory.trim()) return true;
  return false;
}

export async function runBookkeepAfterTurn({ ctx = {}, turn = {}, opts = {}, trace } = {}) {
  let bookkeepTrace = null;
  let unsubscribeGameReplaced = null;
  let gameReplaced = false;
  try {
    const narration = typeof turn.narrativeText === "string" ? turn.narrativeText : "";
    if (ctx.apiCfg?.bookkeepEnabled === false || !narration.trim()) return null;
    // 纯对话/无变动回合短路：不发起多余的记账小模型调用。
    if (!turnHasStateWrites({ ctx, turn, opts })) return null;

    const state = ctx.getGameState();
    const room = state.room ?? ctx.prompt?.room ?? { name: "", npcs: [] };
    const presence = buildPresence({
      isTalk: ctx.isTalk ?? ctx.prompt?.isTalk ?? false,
      lockedDestName: ctx.lockedDestName ?? ctx.prompt?.lockedDestName,
      room: { ...room, npcs: Array.isArray(room.npcs) ? room.npcs : [] },
      innerRoomName: state.innerRoomName ?? ctx.prompt?.innerRoomName,
      companionState: state.companionState ?? ctx.prompt?.companionState,
    });
    const presentNames = presence.visibleNpcsForAI
      .map((npc) => targetName(npc))
      .filter(Boolean);
    const inRoom = new Set(presentNames);
    for (const target of [
      ctx.talkTarget ?? ctx.memory?.recall?.talkTarget ?? ctx.prompt?.talkTarget ?? ctx.prompt?.recall?.talkTarget,
      ctx.activeTarget ?? ctx.prompt?.activeTarget,
    ]) {
      const name = targetName(target);
      if (name && inRoom.has(name)) presentNames.push(name);
    }
    const names = [...new Set(presentNames)];
    if (!names.length) return null;

    bookkeepTrace = turnMonitor.start("回合记账", {
      source: "background",
      background: true,
      parentId: trace?.id,
    });
    unsubscribeGameReplaced = ctx.subscribeGameReplaced?.(() => { gameReplaced = true; }) ?? null;
    turnMonitor.add(bookkeepTrace, "engine", "记账准备", { status: "pass", detail: `${names.join("、")}在场` });

    const intentPlan = turn.intentPlan ?? ctx.intentPlan ?? opts.intentPlan;
    const result = await runBookkeep({
      ai: bindTurnAi(ctx.ai || createWebAi(), bookkeepTrace),
      apiCfg: ctx.apiCfg,
      ctx: {
        narration: narration.slice(0, 2000),
        settleSummary: intentPlan ? formatPlanNote(intentPlan, state) : "",
        presentNames: names,
        ledgers: Object.fromEntries(names.map((name) => [name, getLedger(state.varTree, name).lines])),
        turn: state.time,
      },
    });

    if (ctx.isStale?.() || gameReplaced) {
      turnMonitor.add(bookkeepTrace, "engine", "记账结果已作废（回合已回滚）", {
        status: "warn",
        detail: gameReplaced ? "游戏已替换" : "回合已回滚",
      });
      turnMonitor.finish(bookkeepTrace, "记账结果已作废");
      return null;
    }

    if (result?.ledger && Object.keys(result.ledger).length) {
      // memory will replace p.memory when narration goes prose-only.
      const time = ctx.getGameState().time;
      const setVarTree = typeof ctx.setVarTree === "function" ? ctx.setVarTree : ctx.gameActions?.setVarTreeState;
      setVarTree((prev) => applyPatches({ varTree: prev }, bookkeepToPatches(prev, result, time)).state.varTree);
    }
    const updated = Object.keys(result?.ledger || {}).length > 0;
    turnMonitor.add(bookkeepTrace, "engine", "记账完成", {
      status: "pass",
      detail: updated ? "人物旧账已更新" : "未产生新账",
    });
    turnMonitor.finish(bookkeepTrace, updated ? "旧账已更新" : "未产生新账");
    return result;
  } catch (error) {
    const detail = error?.message || String(error);
    const errorTrace = bookkeepTrace || turnMonitor.start("回合记账", {
      source: "background",
      background: true,
      parentId: trace?.id,
    });
    turnMonitor.add(errorTrace, "engine", "记账失败", { status: "fail", detail });
    turnMonitor.transition(errorTrace, PHASE.ERROR, detail);
    return null;
  } finally {
    unsubscribeGameReplaced?.();
  }
}
