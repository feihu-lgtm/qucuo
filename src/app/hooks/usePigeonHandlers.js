import { useCallback } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import {
  buyPigeon as buyPigeonLogic,
  collectPigeons as collectPigeonsLogic,
  pigeonDelayShichen as pigeonDelayShichenLogic,
  sendPigeonLetter as sendPigeonLetterLogic,
} from "../../features/pigeon/logic.js";

export function usePigeonHandlers({
  room, varTree, featureCtxRef, aiSummarizeFact, setInput, setPigeonTarget,
  setInteractMode, setActiveBuilding,
}) {
  const pigeonDelayShichen = useCallback(
    (npcName) => pigeonDelayShichenLogic(gameStore.getState(), npcName),
    [room.name, varTree],
  );

  const applyPigeonResult = useCallback((result) => {
    applyResult(featureCtxRef.current, result);
    if (result.factSummary) aiSummarizeFact(result.factSummary.id, result.factSummary.cue);
    return result;
  }, [aiSummarizeFact]);

  const sendPigeonLetter = useCallback((npcName, content, opts = {}) => {
    const result = sendPigeonLetterLogic(gameStore.getState(), npcName, content, opts);
    applyPigeonResult(result);
    if (result.sent) {
      setInput("");
      setPigeonTarget(null);
      setInteractMode("action");
    }
    return result;
  }, [applyPigeonResult]);

  const buyPigeon = useCallback((qty, price) => {
    applyPigeonResult(buyPigeonLogic(gameStore.getState(), qty, price));
  }, [applyPigeonResult]);

  const handleCollectPigeons = useCallback(({ qty, dayIdx }) => {
    applyPigeonResult(collectPigeonsLogic(gameStore.getState(), { qty, dayIdx }));
  }, [applyPigeonResult]);

  const handlePostSend = useCallback(({ npcName, content, channel, gift }) => {
    setActiveBuilding(null);
    sendPigeonLetter(npcName, content, { channel, gift });
  }, [sendPigeonLetter]);

  return {
    pigeonDelayShichen,
    applyPigeonResult,
    sendPigeonLetter,
    buyPigeon,
    handleCollectPigeons,
    handlePostSend,
  };
}
