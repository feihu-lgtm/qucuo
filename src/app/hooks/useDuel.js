import { useCallback, useEffect } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { recognizeNpc } from "../../features/npc/logic.js";

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

  return { handleNpcDuel, confirmDuel, cancelDuel };
}
