import { formatPlanNote } from "../../domain/intent/planNotes.js";
import { applyBookkeep, runBookkeep } from "../../domain/memory/bookkeep.js";
import { getLedger } from "../../domain/memory/npcLedger.js";
import { bindTurnAi, createWebAi } from "../ports/ai.js";
import { gameActions, gameStore } from "../../core/gameStore.js";
import { PHASE, turnMonitor } from "../../core/turnMonitor.js";

function targetName(target) {
  return typeof target === "string" ? target : target?.name;
}

export async function runBookkeepAfterTurn({ ctx = {}, turn = {}, opts = {}, trace } = {}) {
  let bookkeepTrace = null;
  try {
    const narration = typeof turn.narrativeText === "string" ? turn.narrativeText : "";
    if (opts.duelReport || ctx.apiCfg?.bookkeepEnabled === false || !narration.trim()) return null;

    const state = gameStore.getState();
    const roomNpcs = Array.isArray(state.room?.npcs) ? state.room.npcs : [];
    const presentNames = roomNpcs
      .map((npc) => targetName(npc))
      .filter(Boolean);
    const inRoom = new Set(presentNames);
    for (const target of [
      ctx.talkTarget ?? ctx.prompt?.talkTarget ?? ctx.prompt?.recall?.talkTarget,
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

    const latest = gameStore.getState();
    if (result?.ledger && Object.keys(result.ledger).length) {
      // memory will replace p.memory when narration goes prose-only.
      const next = applyBookkeep(latest.varTree, result, latest.time);
      if (next !== latest.varTree) gameActions.setVarTreeState(next);
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
  }
}
