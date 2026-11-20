import { useCallback, useMemo, useRef } from "react";

export function createUndoController({
  undoSnapshotRef, buildCurrentSnapshot, applySnapshot, addLog, pendingQueue,
  setQueueCount, autoTravelRef, queueTimerRef, setDuelPending, setDuelingNpc, setActiveBuilding,
  pendingTalksRef, changePendingTalks, talkBusyRef, setLoading, waitTimerRef,
  setWaitSecs, turnGenerationRef, confirmRollback = () => true,
}) {
  const invalidateTurns = () => { turnGenerationRef.current += 1; };
  const captureUndo = () => {
    try { undoSnapshotRef.current = structuredClone(buildCurrentSnapshot()); } catch { undoSnapshotRef.current = null; }
  };

  const rollbackOneStep = () => {
    const snapshot = undoSnapshotRef.current;
    if (!snapshot) {
      addLog([{ t: "sys", text: "  没有可回滚的上一步。" }]);
      return false;
    }
    if (!confirmRollback()) return false;
    invalidateTurns();
    applySnapshot(snapshot);
    undoSnapshotRef.current = null;
    setActiveBuilding(null);
    pendingQueue.current = [];
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
    return true;
  };

  return { captureUndo, rollbackOneStep };
}

export function createTurnStaleCheck(turnGenerationRef) {
  const generation = turnGenerationRef.current;
  return () => turnGenerationRef.current !== generation;
}

export function useUndo(deps) {
  const turnGenerationRef = useRef(0);
  const confirmRollback = useCallback(
    () => window.confirm("回滚到上一步行动之前？当前这步的结果会被撤销。"),
    [],
  );
  const { captureUndo, rollbackOneStep } = useMemo(
    () => createUndoController({ ...deps, turnGenerationRef, confirmRollback }),
    [
      deps.undoSnapshotRef, deps.buildCurrentSnapshot, deps.applySnapshot, deps.addLog,
      deps.pendingQueue, deps.setQueueCount, deps.autoTravelRef, deps.queueTimerRef,
      deps.setDuelPending, deps.setDuelingNpc, deps.pendingTalksRef,
      deps.setActiveBuilding,
      deps.changePendingTalks, deps.talkBusyRef, deps.setLoading, deps.waitTimerRef,
      deps.setWaitSecs, confirmRollback,
    ],
  );
  return { captureUndo, rollbackOneStep, turnGenerationRef };
}
