import { useCallback } from "react";
import { featureCtx } from "../runtime/gameRuntime.js";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import {
  comfort,
  resolveTrauma,
  enterSeaOfMind as enterSeaOfMindLogic,
  leaveSeaOfMind as leaveSeaOfMindLogic,
} from "../../features/narrator/logic.js";
import { switchCompanion } from "../../features/companion/logic.js";
import { SEA_OF_MIND } from "../../domain/rules/narrator/seaOfMind.js";

export function usePlayerActionHandlers({ noteAction, setInnerRoomName, seaReturnRef, captureUndo }) {
  const handleComfort = useCallback((actionKey) => applyResult(featureCtx(), () => {
    captureUndo();
    const result = comfort(gameStore.getState(), actionKey);
    applyResult(featureCtx(), result);
    if (result.changes) noteAction("comfort");
  }, { feature: "narrator.comfort" }), [captureUndo, noteAction]);

  const handleSwitchCompanion = useCallback((key) => applyResult(featureCtx(), () => {
    const result = switchCompanion(gameStore.getState(), key);
    // 被拒（留守在别处）只有提示没有 changes：不占撤销点
    if (result.changes) captureUndo();
    applyResult(featureCtx(), result);
    if (result.changes) noteAction("companionSwitch");
  }, { feature: "companion.switchCompanion" }), [captureUndo, noteAction]);

  const handleResolveTrauma = useCallback(() => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), resolveTrauma(gameStore.getState()));
  }, { feature: "narrator.resolveTrauma" }), [captureUndo]);

  const enterSeaOfMind = useCallback(() => applyResult(featureCtx(), () => {
    captureUndo();
    const state = gameStore.getState();
    const result = enterSeaOfMindLogic(state);
    if (result.changes) seaReturnRef.current = { room: state.room.name, inner: state.innerRoomName };
    applyResult(featureCtx(), result);
    if (result.changes) {
      setTimeout(() => setInnerRoomName(SEA_OF_MIND.anchor), 0);
      noteAction("seaEnter");
    }
  }, { feature: "narrator.enterSeaOfMind" }), [captureUndo, setInnerRoomName, noteAction]);

  const leaveSeaOfMind = useCallback(() => applyResult(featureCtx(), () => {
    captureUndo();
    const back = seaReturnRef.current || { room: "鱼定村", inner: null };
    const result = leaveSeaOfMindLogic(gameStore.getState(), back);
    applyResult(featureCtx(), result);
    if (result.changes) setTimeout(() => setInnerRoomName(back.inner), 0);
  }, { feature: "narrator.leaveSeaOfMind" }), [captureUndo, setInnerRoomName]);

  return { handleComfort, handleSwitchCompanion, handleResolveTrauma, enterSeaOfMind, leaveSeaOfMind };
}
