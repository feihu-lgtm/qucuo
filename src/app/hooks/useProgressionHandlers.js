import { useCallback } from "react";
import { featureCtx } from "../runtime/gameRuntime.js";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { confessToNarrator as confessLogic } from "../../features/narrator/logic.js";
import {
  breakthroughSkill as breakthroughSkillLogic,
  meditate as meditateLogic,
  trainNeigong as trainNeigongLogic,
  trainWaigong as trainWaigongLogic,
} from "../../features/cultivation/logic.js";

export function useProgressionHandlers({ loading, noteAction, setJustMeditated, captureUndo }) {
  const confessToNarrator = useCallback(() => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), confessLogic(gameStore.getState()));
  }, { feature: "narrator.confess" }), [captureUndo]);

  const meditate = useCallback(() => applyResult(featureCtx(), () => {
    if (loading) return;
    captureUndo();
    setJustMeditated(true);
    setTimeout(() => setJustMeditated(false), 350);
    applyResult(featureCtx(), meditateLogic(gameStore.getState()));
    noteAction("meditate");
  }, { feature: "cultivation.meditate" }), [loading, noteAction, captureUndo]);

  const trainNeigong = useCallback(() => applyResult(featureCtx(), () => {
    if (loading) return;
    captureUndo();
    applyResult(featureCtx(), trainNeigongLogic(gameStore.getState()));
  }, { feature: "cultivation.trainNeigong" }), [loading, captureUndo]);

  const trainWaigong = useCallback(() => applyResult(featureCtx(), () => {
    if (loading) return;
    captureUndo();
    applyResult(featureCtx(), trainWaigongLogic(gameStore.getState()));
  }, { feature: "cultivation.trainWaigong" }), [loading, captureUndo]);

  const breakthroughSkill = useCallback((skillId) => applyResult(featureCtx(), () => {
    if (loading) return;
    captureUndo();
    applyResult(featureCtx(), breakthroughSkillLogic(gameStore.getState(), skillId));
  }, { feature: "cultivation.breakthroughSkill" }), [loading, captureUndo]);

  return { confessToNarrator, meditate, trainNeigong, trainWaigong, breakthroughSkill };
}
