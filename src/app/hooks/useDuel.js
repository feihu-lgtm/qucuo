import { useCallback, useEffect } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { recognizeNpc, settleNpcDuel } from "../../features/npc/logic.js";
import { ensureNpcCombatData } from "../../domain/npc/npcGeneration.js";
import { NOTE_SOURCE, VIA } from "../../domain/memory/note.js";
import { createTurnStaleCheck } from "./useUndo.js";

export async function openDuelAfterNarration({ act, setDuelPending, isStale }, npc) {
  await act(`向${npc.name}抱拳邀战，请他切磋一番`, [], { keepUndo: true });
  if (isStale()) return false;
  setDuelPending(npc);
  return true;
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
  captureUndo, turnGenerationRef,
}) {
  const handleNpcDuel = useCallback((npc) => applyResult(featureCtxRef.current, async () => {
    const isStale = createTurnStaleCheck(turnGenerationRef);
    captureUndo();
    applyResult(featureCtxRef.current, recognizeNpc(gameStore.getState(), npc));
    setActiveTarget(npc.name);
    await openDuelAfterNarration({ act, setDuelPending, isStale }, npc);
  }, { feature: "npc.duel" }), [act, captureUndo, featureCtxRef, setActiveTarget, setDuelPending, turnGenerationRef]);

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

  const duelFinishHandler = useCallback((outcome, loot, battleLog, grownMoveset, usedItems, remainingHp) => applyResult(featureCtxRef.current, () => {
    const finishedNpc = duelingNpc;
    const result = settleNpcDuel(gameStore.getState(), finishedNpc, {
      outcome,
      loot,
      battleLog,
      grownMoveset,
      usedItems,
      remainingHp,
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
      setTimeout(() => {
        act(`切磋结束。经过：${result.recap || "双方试探几招，未及深入"}。结果：${result.outcomeText}。请把上面每回合的说书片段串成一篇连贯的整场战报，点出关键招式和胜负经过，说书人口吻、一气呵成。并且务必在本轮 JSON 里输出 memory 字段（不超过50字客观事实），把这场切磋记成一条往事：与谁在何处切磋、用了哪几招、谁胜谁负、有无夺得战利品——供日后回想与旁人提起。`, [], { silentCmd: true, preserveHp: true, keepUndo: true });
      }, 0);
      jotNote({
        text: result.recapNote,
        owner: [{ name: finishedNpc.name, via: VIA.FIRSTHAND }],
        source: NOTE_SOURCE.DUMB,
      });
    }
  }, { feature: "duel.finish" }), [duelingNpc, pendingQuestBranch, noteAction, act, jotNote, aiSummarizeFact, setDuelingNpc, setPendingQuestBranch, featureCtxRef]);

  return { handleNpcDuel, confirmDuel, cancelDuel, duelFinishHandler };
}
