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
  const confessToNarrator = useCallback(() => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, confessLogic(gameStore.getState()));
  }, { feature: "narrator.confess" }), [captureUndo]);

  const meditate = useCallback(() => applyResult(featureCtxRef.current, () => {
    if (loading) return;
    captureUndo();
    setJustMeditated(true);
    setTimeout(() => setJustMeditated(false), 350);
    applyResult(featureCtxRef.current, meditateLogic(gameStore.getState()));
    noteAction("meditate");
  }, { feature: "cultivation.meditate" }), [loading, noteAction, captureUndo]);

  const trainNeigong = useCallback(() => applyResult(featureCtxRef.current, () => {
    if (loading) return;
    captureUndo();
    applyResult(featureCtxRef.current, trainNeigongLogic(gameStore.getState()));
  }, { feature: "cultivation.trainNeigong" }), [loading, captureUndo]);

  const trainWaigong = useCallback(() => applyResult(featureCtxRef.current, () => {
    if (loading) return;
    captureUndo();
    applyResult(featureCtxRef.current, trainWaigongLogic(gameStore.getState()));
  }, { feature: "cultivation.trainWaigong" }), [loading, captureUndo]);

  const breakthroughSkill = useCallback((skillId) => applyResult(featureCtxRef.current, () => {
    if (loading) return;
    captureUndo();
    applyResult(featureCtxRef.current, breakthroughSkillLogic(gameStore.getState(), skillId));
  }, { feature: "cultivation.breakthroughSkill" }), [loading, captureUndo]);

  return { confessToNarrator, meditate, trainNeigong, trainWaigong, breakthroughSkill };
}
