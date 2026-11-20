import { useCallback } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { confessToNarrator as confessLogic } from "../../features/narrator/logic.js";
import {
  breakthroughSkill as breakthroughSkillLogic,
  meditate as meditateLogic,
  trainNeigong as trainNeigongLogic,
  trainWaigong as trainWaigongLogic,
} from "../../features/cultivation/logic.js";

export function useProgressionHandlers({ loading, noteAction, featureCtxRef, setJustMeditated, captureUndo }) {
  const confessToNarrator = useCallback(() => {
    captureUndo();
    applyResult(featureCtxRef.current, confessLogic(gameStore.getState()));
  }, [captureUndo]);

  const meditate = useCallback(() => {
    if (loading) return;
    captureUndo();
    setJustMeditated(true);
    setTimeout(() => setJustMeditated(false), 350);
    applyResult(featureCtxRef.current, meditateLogic(gameStore.getState()));
    noteAction("meditate");
  }, [loading, noteAction, captureUndo]);

  const trainNeigong = useCallback(() => {
    if (loading) return;
    captureUndo();
    applyResult(featureCtxRef.current, trainNeigongLogic(gameStore.getState()));
  }, [loading, captureUndo]);

  const trainWaigong = useCallback(() => {
    if (loading) return;
    captureUndo();
    applyResult(featureCtxRef.current, trainWaigongLogic(gameStore.getState()));
  }, [loading, captureUndo]);

  const breakthroughSkill = useCallback((skillId) => {
    if (loading) return;
    captureUndo();
    applyResult(featureCtxRef.current, breakthroughSkillLogic(gameStore.getState(), skillId));
  }, [loading, captureUndo]);

  return { confessToNarrator, meditate, trainNeigong, trainWaigong, breakthroughSkill };
}
