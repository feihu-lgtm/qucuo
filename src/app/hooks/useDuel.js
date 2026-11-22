import { useCallback, useEffect } from "react";
import { gameActions, gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { lookNpc, recognizeNpc, settleNpcDuel } from "../../features/npc/logic.js";
import { isNpcLooked } from "../../domain/rules/npc/npcAwareness.js";
import { ensureNpcCombatData } from "../../domain/rules/npc/npcGeneration.js";
import { NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";
import { buildDuelNarrationPrompt, duelFactLogs, duelNarrationSlots, parseDuelNarration, phraseNarration } from "../../domain/rules/combat/duelBrief.js";
import { backfillInBackground, insertWhenIdle, newBackfillKey } from "../../engine/ports/backfill.js";
import { askStoryteller, hasApiKey } from "../../engine/ports/storyteller.js";
import { createTurnStaleCheck } from "./useUndo.js";

export function consumeDuelRequest(result, {
  opts = {}, isStale, isTalk, interactMode, recognize,
  setActiveTarget, setDuelPending, featureCtxRef, trace,
}) {
  const npc = result?.duelRequest;
  if (!result?.ok || result.stale || (typeof isStale === "function" && isStale())
    || isTalk || interactMode === "talk" || interactMode === "whisper"
    || opts.settle || opts.settleKind === "duel_invite" || !npc?.name) return false;
  if (recognize) recognize(npc);
  else applyResult(featureCtxRef.current, recognizeNpc(gameStore.getState(), npc), { turn: trace, feature: "npc.duel" });
  setActiveTarget(npc.name);
  setDuelPending(npc);
  return true;
}

// 邀战只出一行系统提示（三五十字），不再整轮请 AI 写，点完立刻弹出切磋确认。
export function duelInviteLine(npc) {
  return `  你向${npc.name}抱拳邀战。${npc.name}略一打量，点头应下，拉开了架势。`;
}

export async function openDuelAfterNarration({ addLog, setDuelPending, isStale }, npc) {
  addLog([{ t: "sys", text: duelInviteLine(npc) }]);
  if (isStale()) return false;
  setDuelPending(npc);
  return true;
}

// 后台补写描写：不占回合、不排队，玩家可以接着打下一场。
// 没配 API 或 AI 失败时用短语池拼句兜底；返回 "ai" / "phrase" / false。
export async function narrateDuelInBackground(key, rounds, { outcomeText, place, aftermath }, {
  ask = askStoryteller, canAsk = hasApiKey, setLog = gameActions.setLog, retryMs,
} = {}) {
  const { sys, user } = buildDuelNarrationPrompt(rounds, { outcomeText, place, aftermath });
  const roundCount = Array.isArray(rounds) ? rounds.length : 0;
  const viaAi = await backfillInBackground(key, {
    canAsk,
    setLog,
    ask: () => ask(sys, user, { callLabel: "切磋战报", maxTokens: 900 }),
    parse: (text) => duelNarrationSlots(parseDuelNarration(text, roundCount)),
    retryMs,
  });
  if (viaAi) return "ai";
  const lines = duelNarrationSlots(phraseNarration(rounds));
  if (!lines) return false;
  return (await insertWhenIdle(key, lines, { setLog, retryMs })) && "phrase";
}

export function useForcedDuelNpc({ forcedDuelNpc, setDuelingNpc, setForcedDuelNpc }) {
  useEffect(() => {
    if (forcedDuelNpc) {
      setDuelingNpc(forcedDuelNpc);
      setForcedDuelNpc(null);
    }
  }, [forcedDuelNpc]);
}

export function useDuel({
  act, addLog, duelPending, featureCtxRef, setActiveTarget, setDuelPending, setDuelingNpc,
  duelingNpc, pendingQuestBranch, noteAction, jotNote, aiSummarizeFact, setPendingQuestBranch,
  captureUndo, turnGenerationRef, narrator,
}) {
  const handleNpcDuel = useCallback((npc) => applyResult(featureCtxRef.current, async () => {
    const isStale = createTurnStaleCheck(turnGenerationRef);
    captureUndo();
    // 没端详过的人不能上来就打——先替他做「细看」这一步，看清楚了
    // 再点一次切磋才真的邀战。
    if (!isNpcLooked(gameStore.getState().varTree, npc.name)) {
      const look = lookNpc(gameStore.getState(), npc);
      applyResult(featureCtxRef.current, look);
      setActiveTarget(npc.name);
      addLog([{ t: "sys", text: `  动手前，你先端详了${npc.name}——掂量清楚再决定动不动手。` }]);
      await act("look " + npc.id, look.extraReplies || [], { keepUndo: true, inspect: true });
      return;
    }
    applyResult(featureCtxRef.current, recognizeNpc(gameStore.getState(), npc));
    setActiveTarget(npc.name);
    await openDuelAfterNarration({ addLog, setDuelPending, isStale }, npc);
  }, { feature: "npc.duel" }), [act, addLog, captureUndo, featureCtxRef, setActiveTarget, setDuelPending, turnGenerationRef]);

  const confirmDuel = useCallback(() => applyResult(featureCtxRef.current, () => {
    if (!duelPending) return;
    setDuelingNpc(duelPending);
    setDuelPending(null);
  }, { feature: "duel.confirm" }), [duelPending, featureCtxRef]);

  const cancelDuel = useCallback(() => applyResult(featureCtxRef.current, () => {
    if (!duelPending) return;
    addLog([{ t: "sys", text: `  你收起架势，这场切磋作罢，${duelPending.name}也顺势松了口气。` }]);
    setDuelPending(null);
  }, { feature: "duel.cancel" }), [duelPending, addLog, featureCtxRef]);

  const duelFinishHandler = useCallback((outcome, loot, battleLog, grownMoveset, usedItems, remainingHp, dodgeStolenItems) => applyResult(featureCtxRef.current, () => {
    const finishedNpc = duelingNpc;
    const result = settleNpcDuel(gameStore.getState(), finishedNpc, {
      outcome,
      loot,
      battleLog,
      reportFollows: true,
      grownMoveset,
      usedItems,
      remainingHp,
      dodgeStolenItems,
      pendingQuestBranch,
      createRespawnNpc: ensureNpcCombatData,
    });
    const questBranch = pendingQuestBranch?.mode === "combat" && finishedNpc?.questBranchFlag === pendingQuestBranch.flag
      ? pendingQuestBranch : null;
    if (questBranch) {
      setPendingQuestBranch(null);
    }
    noteAction("duel");
    setDuelingNpc(null);
    applyResult(featureCtxRef.current, result);
    if (result.factId) aiSummarizeFact(result.factId, result.cue);
    if (finishedNpc) {
      // 系统事实行立刻落日志；描写在后台补，不走 act，玩家不用等。
      const key = newBackfillKey("duel");
      addLog(duelFactLogs(result.reportRounds, key, result.outcomeText));
      // 任务分支战斗打赢后，aftermath（任务数据登记的收尾梗概）交给叙事段写成
      // 结局段——玩家不只看到战况，还看到这件事怎么作结、怎么回归
      //（小牧童：牦牛认人、牵牛回寨、阿索分糌粑）。
      narrateDuelInBackground(key, result.reportRounds, {
        outcomeText: result.outcomeText,
        place: gameStore.getState().room?.name,
        aftermath: questBranch && outcome === "win"
          ? questBranch.aftermath || `这场打斗是「${questBranch.title}」的一环，写清这件事如何作结、主角如何回归。`
          : "",
      }, narrator);
      jotNote({
        text: result.recapNote,
        owner: [{ name: finishedNpc.name, via: VIA.FIRSTHAND }],
        source: NOTE_SOURCE.DUMB,
      });
    }
  }, { feature: "duel.finish" }), [duelingNpc, pendingQuestBranch, noteAction, addLog, jotNote, aiSummarizeFact, setDuelingNpc, setPendingQuestBranch, featureCtxRef, narrator]);

  const resetDuel = useCallback(() => applyResult(featureCtxRef.current, () => {
    setDuelingNpc(null);
    setPendingQuestBranch(null);
  }, { feature: "duel.reset" }), [featureCtxRef, setDuelingNpc, setPendingQuestBranch]);

  return { handleNpcDuel, confirmDuel, cancelDuel, duelFinishHandler, resetDuel };
}
