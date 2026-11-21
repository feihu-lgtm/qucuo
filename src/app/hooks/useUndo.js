import { useCallback, useMemo, useRef } from "react";
import { getTurnContext, PHASE, turnMonitor, withTurnContext } from "../../core/turnMonitor.js";

const undoOwners = new WeakMap();

export function createUndoController({
  undoSnapshotRef, buildCurrentSnapshot, applySnapshot, addLog,
  setQueueCount, autoTravelRef, queueTimerRef, clearCommandQueue = () => {},
  setDuelPending, setDuelingNpc, setActiveBuilding,
  pendingTalksRef, changePendingTalks, talkBusyRef, setLoading, waitTimerRef,
  setWaitSecs, turnGenerationRef, turnInvalidationListeners = new Set(), confirmRollback = () => true,
}) {
  const onTurnsInvalidated = (listener) => {
    if (typeof listener !== "function") return () => {};
    turnInvalidationListeners.add(listener);
    return () => turnInvalidationListeners.delete(listener);
  };
  const invalidateTurns = () => {
    turnGenerationRef.current += 1;
    const listeners = [...turnInvalidationListeners];
    turnInvalidationListeners.clear();
    for (const listener of listeners) {
      try { listener(); } catch {}
    }
  };
  const captureUndo = (turn = getTurnContext()) => {
    try {
      undoSnapshotRef.current = structuredClone(buildCurrentSnapshot());
      if (turn && undoSnapshotRef.current) {
        undoOwners.set(undoSnapshotRef.current, turn.id);
        turnMonitor.add(turn, "app", "保存撤销点", { kind: "undo" });
      }
    } catch { undoSnapshotRef.current = null; }
  };

  const rollbackOneStep = () => {
    const snapshot = undoSnapshotRef.current;
    const turn = getTurnContext() || turnMonitor.start("回滚一步", {
      source: "button", commandId: "rollback",
    });
    turn.parentId = undoOwners.get(snapshot) ?? turn.parentId;
    if (!snapshot) {
      addLog([{ t: "sys", text: "  没有可回滚的上一步。" }]);
      turnMonitor.finish(turn, "没有可回滚的上一步");
      return false;
    }
    if (!confirmRollback()) {
      turnMonitor.transition(turn, PHASE.DISCARDED, "取消回滚");
      return false;
    }
    invalidateTurns();
    try {
      withTurnContext(turn, () => applySnapshot(snapshot));
    } catch (error) {
      turnMonitor.transition(turn, PHASE.ERROR, String(error));
      throw error;
    }
    undoSnapshotRef.current = null;
    setActiveBuilding(null);
    clearCommandQueue();
    setQueueCount(0);
    autoTravelRef.current = false;
    if (queueTimerRef.current != null) clearTimeout(queueTimerRef.current);
    queueTimerRef.current = null;
    setDuelPending(null);
    setDuelingNpc(null);
    changePendingTalks(-pendingTalksRef.current);
    talkBusyRef.current = false;
    if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    waitTimerRef.current = null;
    setWaitSecs(0);
    setLoading(false);
    addLog([{ t: "sys", text: "  ↩ 已回滚到上一步之前。" }]);
    turnMonitor.add(turn, "app", "还原撤销点", { kind: "undo" });
    turnMonitor.transition(turn, PHASE.ROLLED_BACK, "已回滚到上一步之前");
    return true;
  };

  return { captureUndo, rollbackOneStep, invalidateTurns, onTurnsInvalidated };
}

export function createTurnStaleCheck(turnGenerationRef) {
  const generation = turnGenerationRef.current;
  return () => turnGenerationRef.current !== generation;
}

export function useUndo(deps) {
  const turnGenerationRef = useRef(0);
  const turnInvalidationListenersRef = useRef(new Set());
  const confirmRollback = useCallback(
    () => window.confirm("回滚到上一步行动之前？当前这步的结果会被撤销。"),
    [],
  );
  const { captureUndo, rollbackOneStep, invalidateTurns, onTurnsInvalidated } = useMemo(
    () => createUndoController({
      ...deps, turnGenerationRef, turnInvalidationListeners: turnInvalidationListenersRef.current, confirmRollback,
    }),
    [
      deps.undoSnapshotRef, deps.buildCurrentSnapshot, deps.applySnapshot, deps.addLog,
      deps.setQueueCount, deps.autoTravelRef, deps.queueTimerRef,
      deps.clearCommandQueue,
      deps.setDuelPending, deps.setDuelingNpc, deps.pendingTalksRef,
      deps.setActiveBuilding,
      deps.changePendingTalks, deps.talkBusyRef, deps.setLoading, deps.waitTimerRef,
      deps.setWaitSecs, confirmRollback,
    ],
  );
  return { captureUndo, rollbackOneStep, invalidateTurns, onTurnsInvalidated, turnGenerationRef };
}
