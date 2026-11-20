import { useCallback } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import {
  comfort,
  resolveTrauma,
  enterSeaOfMind as enterSeaOfMindLogic,
  leaveSeaOfMind as leaveSeaOfMindLogic,
} from "../../features/narrator/logic.js";
import { switchCompanion } from "../../features/companion/logic.js";
import { SEA_OF_MIND } from "../../domain/narrator/seaOfMind.js";

export function usePlayerActionHandlers({ featureCtxRef, noteAction, setInnerRoomName, seaReturnRef, captureUndo }) {
  const handleComfort = useCallback((actionKey) => {
    captureUndo();
    const result = comfort(gameStore.getState(), actionKey);
    applyResult(featureCtxRef.current, result);
    if (result.changes) noteAction("comfort");
  }, [captureUndo, noteAction]);

  const handleSwitchCompanion = useCallback((key) => {
    captureUndo();
    applyResult(featureCtxRef.current, switchCompanion(gameStore.getState(), key));
    noteAction("companionSwitch");
  }, [captureUndo, noteAction]);

  const handleResolveTrauma = useCallback(() => {
    captureUndo();
    applyResult(featureCtxRef.current, resolveTrauma(gameStore.getState()));
  }, [captureUndo]);

  const enterSeaOfMind = useCallback(() => {
    captureUndo();
    const state = gameStore.getState();
    const result = enterSeaOfMindLogic(state);
    if (result.changes) seaReturnRef.current = { room: state.room.name, inner: state.innerRoomName };
    applyResult(featureCtxRef.current, result);
    if (result.changes) {
      setTimeout(() => setInnerRoomName(SEA_OF_MIND.anchor), 0);
      noteAction("seaEnter");
    }
  }, [captureUndo, setInnerRoomName, noteAction]);

  const leaveSeaOfMind = useCallback(() => {
    captureUndo();
    const back = seaReturnRef.current || { room: "鱼定村", inner: null };
    const result = leaveSeaOfMindLogic(gameStore.getState(), back);
    applyResult(featureCtxRef.current, result);
    if (result.changes) setTimeout(() => setInnerRoomName(back.inner), 0);
  }, [captureUndo, setInnerRoomName]);

  return { handleComfort, handleSwitchCompanion, handleResolveTrauma, enterSeaOfMind, leaveSeaOfMind };
}
