import { useCallback, useEffect } from "react";
import { gameActions, gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { recognizeNpc, settleNpcDuel } from "../../features/npc/logic.js";
import { ensureNpcCombatData } from "../../domain/rules/npc/npcGeneration.js";
import { NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";
import { buildDuelNarrationPrompt, duelFactLogs, insertDuelNarration, parseDuelNarration, phraseNarration } from "../../domain/rules/combat/duelBrief.js";
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
export async function narrateDuelInBackground(key, rounds, { outcomeText, place }, {
  ask = askStoryteller, canAsk = hasApiKey, setLog = gameActions.setLog,
} = {}) {
  let narration = null;
  if (canAsk()) {
    const { sys, user } = buildDuelNarrationPrompt(rounds, { outcomeText, place });
    let text = null;
    try {
      text = await ask(sys, user, { callLabel: "切磋战报", maxTokens: 900 });
    } catch {
      text = null;
    }
    narration = parseDuelNarration(text, Array.isArray(rounds) ? rounds.length : 0);
    if (narration) {
      setLog((log) => insertDuelNarration(log, key, narration));
      return "ai";
    }
  }
  narration = phraseNarration(rounds);
  if (!narration) return false;
  setLog((log) => insertDuelNarration(log, key, narration));
  return "phrase";
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
    applyResult(featureCtxRef.current, recognizeNpc(gameStore.getState(), npc));
    setActiveTarget(npc.name);
    await openDuelAfterNarration({ addLog, setDuelPending, isStale }, npc);
  }, { feature: "npc.duel" }), [addLog, captureUndo, featureCtxRef, setActiveTarget, setDuelPending, turnGenerationRef]);

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
    if (pendingQuestBranch?.mode === "combat" && finishedNpc?.questBranchFlag === pendingQuestBranch.flag) {
      setPendingQuestBranch(null);
    }
    noteAction("duel");
    setDuelingNpc(null);
    applyResult(featureCtxRef.current, result);
    if (result.factId) aiSummarizeFact(result.factId, result.cue);
    if (finishedNpc) {
      // 系统事实行立刻落日志；描写在后台补，不走 act，玩家不用等。
      const key = `duel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      addLog(duelFactLogs(result.reportRounds, key, result.outcomeText));
      narrateDuelInBackground(key, result.reportRounds, {
        outcomeText: result.outcomeText, place: gameStore.getState().room?.name,
      }, narrator).catch(() => {});
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
