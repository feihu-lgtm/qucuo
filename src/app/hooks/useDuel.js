import { useCallback, useEffect } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { recognizeNpc, settleNpcDuel } from "../../features/npc/logic.js";
import { ensureNpcCombatData } from "../../domain/npc/npcGeneration.js";
import { NOTE_SOURCE, VIA } from "../../domain/memory/note.js";

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
}) {
  const handleNpcDuel = useCallback(async (npc) => {
    applyResult(featureCtxRef.current, recognizeNpc(gameStore.getState(), npc));
    setActiveTarget(npc.name);
    await act(`向${npc.name}抱拳邀战，请他切磋一番`);
    setDuelPending(npc);
  }, [act]);

  const confirmDuel = useCallback(() => {
    if (!duelPending) return;
    setDuelingNpc(duelPending);
    setDuelPending(null);
  }, [duelPending]);

  const cancelDuel = useCallback(() => {
    if (!duelPending) return;
    addLog([{ t: "sys", text: `  你收起架势，这场切磋作罢，${duelPending.name}也顺势松了口气。` }]);
    setDuelPending(null);
  }, [duelPending, addLog]);

  const duelFinishHandler = useCallback((outcome, loot, battleLog, grownMoveset, usedItems, remainingHp) => {
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
        act(`切磋结束。经过：${result.recap || "双方试探几招，未及深入"}。结果：${result.outcomeText}。请把上面每回合的说书片段串成一篇连贯的整场战报，点出关键招式和胜负经过，说书人口吻、一气呵成。并且务必在本轮 JSON 里输出 memory 字段（不超过50字客观事实），把这场切磋记成一条往事：与谁在何处切磋、用了哪几招、谁胜谁负、有无夺得战利品——供日后回想与旁人提起。`, [], { silentCmd: true, preserveHp: true });
      }, 0);
      jotNote({
        text: result.recapNote,
        owner: [{ name: finishedNpc.name, via: VIA.FIRSTHAND }],
        source: NOTE_SOURCE.DUMB,
      });
    }
  }, [duelingNpc, pendingQuestBranch, noteAction, act, jotNote, aiSummarizeFact, setDuelingNpc, setPendingQuestBranch]);

  return { handleNpcDuel, confirmDuel, cancelDuel, duelFinishHandler };
}
