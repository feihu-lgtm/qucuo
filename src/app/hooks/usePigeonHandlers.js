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
  featureCtxRef, aiSummarizeFact, setInput, setPigeonTarget,
  setInteractMode, setActiveBuilding, captureUndo,
}) {
  const pigeonDelayShichen = useCallback(
    (npcName) => pigeonDelayShichenLogic(gameStore.getState(), npcName),
    [],
  );

  const applyPigeonResult = useCallback((result, options) => {
    applyResult(featureCtxRef.current, result, options);
    if (result.factSummary) aiSummarizeFact(result.factSummary.id, result.factSummary.cue);
    return result;
  }, [aiSummarizeFact]);

  const sendPigeonLetter = useCallback((npcName, content, opts = {}) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    const result = sendPigeonLetterLogic(gameStore.getState(), npcName, content, opts);
    applyPigeonResult(result);
    if (result.sent) {
      setInput("");
      setPigeonTarget(null);
      setInteractMode("action");
    }
    return result;
  }, { feature: "pigeon.sendLetter" }), [applyPigeonResult, captureUndo]);

  const buyPigeon = useCallback((qty, price) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyPigeonResult(buyPigeonLogic(gameStore.getState(), qty, price));
  }, { feature: "pigeon.buy" }), [applyPigeonResult, captureUndo]);

  const handleCollectPigeons = useCallback(({ qty, dayIdx }) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyPigeonResult(collectPigeonsLogic(gameStore.getState(), { qty, dayIdx }));
  }, { feature: "pigeon.collect" }), [applyPigeonResult, captureUndo]);

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
