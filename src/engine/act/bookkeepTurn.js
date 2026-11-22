import { formatPlanNote } from "../../domain/rules/intent/planNotes.js";
import { applyBookkeep, runBookkeep } from "../../domain/rules/memory/bookkeep.js";
import { getLedger } from "../../domain/rules/memory/npcLedger.js";
import { buildPresence } from "../prompt/roundNotes.js";
import { bindTurnAi, createWebAi } from "../ports/ai.js";
import { gameActions, gameStore, subscribeGameReplaced } from "../../store/gameStore.js";
import { PHASE, turnMonitor } from "../../core/turnMonitor.js";

function targetName(target) {
  return typeof target === "string" ? target : target?.name;
}

export async function runBookkeepAfterTurn({ ctx = {}, turn = {}, opts = {}, trace } = {}) {
  let bookkeepTrace = null;
  let unsubscribeGameReplaced = null;
  let gameReplaced = false;
  try {
    const narration = typeof turn.narrativeText === "string" ? turn.narrativeText : "";
    if (opts.duelReport || ctx.apiCfg?.bookkeepEnabled === false || !narration.trim()) return null;

    const state = gameStore.getState();
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
    unsubscribeGameReplaced = subscribeGameReplaced(() => { gameReplaced = true; });
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
      const time = gameStore.getState().time;
      const setVarTree = typeof ctx.setVarTree === "function" ? ctx.setVarTree : gameActions.setVarTreeState;
      setVarTree((prev) => applyBookkeep(prev, result, time));
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
