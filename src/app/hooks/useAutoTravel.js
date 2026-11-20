import { useCallback, useEffect, useRef } from "react";
import { planAutoTravel, shouldDispatchQueuedAutoTravel } from "../../features/map/logic.js";
import { DIRS } from "../../utils/mudHelpers.js";

export function useAutoTravel({
  room, loading, mapData, flags, questProgress, addLog, pendingQueue,
  autoTravelRef, setQueueCount, act, teleportLookRef, innerRoomName, setInteractMode,
}) {
  // Travel reuses the command queue so every path step still consumes a turn and can stop on encounters.
  const autoTravelTo = useCallback((destName) => {
    if (!destName || destName === room.name) return;
    if (loading) { addLog([{ t: "sys", text: `  正忙着，稍候再另择去处。` }]); return; }
    const route = planAutoTravel({ room, mapData, flags, questProgress }, destName);
    if (route.locked) { addLog([{ t: "sys", text: `  「${destName}」此刻还去不得，路未通。` }]); return; }
    const path = route.path;
    if (!path) { addLog([{ t: "sys", text: `  「${destName}」尚无已探明、可通行的路径。` }]); return; }
    if (path.length === 0) return;
    addLog([{ t: "sys", text: `  ⇢ 起身前往「${destName}」，需行 ${path.length} 程（每程一个时辰）……` }]);
    const words = path.map(d => DIRS[d] || d);
    const [first, ...rest] = words;
    // Outer-layer options keep the route from being intercepted by an inner-room movement check.
    rest.forEach(w => pendingQueue.current.push({
      cmd: w,
      extraReplies: [],
      opts: { forceLayer: "outer", autoTravel: true },
    }));
    autoTravelRef.current = rest.length > 0;
    setQueueCount(pendingQueue.current.length);
    act(first, [], { forceLayer: "outer", autoTravel: true });
  }, [room.name, loading, mapData, flags, questProgress, act, addLog]);

  // The teleport follow-up waits for both the district and inner room to update before looking.
  useEffect(() => {
    const pend = teleportLookRef.current;
    if (!pend) return;
    if (room.name !== pend.dist) return;
    if (pend.inner && innerRoomName !== pend.inner) return;
    teleportLookRef.current = null;
    setInteractMode("action");
    act("环顾四周");
  }, [room.name, innerRoomName, act]);

  return autoTravelTo;
}

export function useTurnQueue({ loading, act, queueCount, pendingQueue, setQueueCount, autoTravelRef }) {
  const actRef = useRef(act);
  actRef.current = act;

  useEffect(() => {
    if (shouldDispatchQueuedAutoTravel({
      loading,
      queueCount,
      hasQueuedCommands: pendingQueue.current.length > 0,
    })) {
      const timer = setTimeout(() => {
        const next = pendingQueue.current.shift();
        if (!next) return;
        setQueueCount(pendingQueue.current.length);
        if (pendingQueue.current.length === 0) autoTravelRef.current = false;
        actRef.current(next.cmd, next.extraReplies, next.opts || {});
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, queueCount, pendingQueue, setQueueCount, autoTravelRef]);
}
