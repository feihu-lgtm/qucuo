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

export function useProgressionHandlers({ loading, noteAction, featureCtxRef, setJustMeditated }) {
  const confessToNarrator = useCallback(() => {
    applyResult(featureCtxRef.current, confessLogic(gameStore.getState()));
  }, []);

  const meditate = useCallback(() => {
    if (loading) return;
    setJustMeditated(true);
    setTimeout(() => setJustMeditated(false), 350);
    applyResult(featureCtxRef.current, meditateLogic(gameStore.getState()));
    noteAction("meditate");
  }, [loading, noteAction]);

  const trainNeigong = useCallback(() => {
    if (loading) return;
    applyResult(featureCtxRef.current, trainNeigongLogic(gameStore.getState()));
  }, [loading]);

  const trainWaigong = useCallback(() => {
    if (loading) return;
    applyResult(featureCtxRef.current, trainWaigongLogic(gameStore.getState()));
  }, [loading]);

  const breakthroughSkill = useCallback((skillId) => {
    if (loading) return;
    applyResult(featureCtxRef.current, breakthroughSkillLogic(gameStore.getState(), skillId));
  }, [loading]);

  return { confessToNarrator, meditate, trainNeigong, trainWaigong, breakthroughSkill };
}
