import { useCallback, useEffect, useRef } from "react";
import { planAutoTravel } from "../../features/map/logic.js";
import { DIRS } from "../../utils/mudHelpers.js";

export function enqueueAutoTravelLegs(path, { scheduler, actRef, autoTravelRef, onTravelEnd }) {
  path.map(d => DIRS[d] || d).forEach(w => scheduler.enqueue("autoTravel", async () => {
    try {
      return await actRef.current(w, [], {
        forceLayer: "outer",
        autoTravel: true,
        schedulerManaged: true,
      });
    } finally {
      if (!scheduler.queue.some(entry => entry.meta.routeQueue)) {
        autoTravelRef.current = false;
        onTravelEnd?.();
      }
    }
  }, { routeQueue: true, routeLeg: true }));
}

export function useAutoTravel({
  room, mapData, flags, questProgress, addLog, autoTravelRef, scheduler,
  act, teleportLookRef, innerRoomName, setInteractMode, intentRouterRef,
}) {
  const actRef = useRef(act);
  actRef.current = act;

  const autoTravelTo = useCallback((destName) => {
    if (!destName || destName === room.name) return;
    return scheduler.dispatch("autoTravel", () => {
      const route = planAutoTravel({ room, mapData, flags, questProgress }, destName);
      if (route.locked) { addLog([{ t: "sys", text: `  「${destName}」此刻还去不得，路未通。` }]); return; }
      const path = route.path;
      if (!path) { addLog([{ t: "sys", text: `  「${destName}」尚无已探明、可通行的路径。` }]); return; }
      if (path.length === 0) return;
      addLog([{ t: "sys", text: `  ⇢ 起身前往「${destName}」，需行 ${path.length} 程（每程一个时辰）……` }]);
      autoTravelRef.current = true;
      enqueueAutoTravelLegs(path, {
        scheduler, actRef, autoTravelRef,
        // 全程走完：「到达」条件步应验，其余触发器过期。
        onTravelEnd: () => intentRouterRef?.current?.settleTriggers?.({ dest: destName }),
      });
    }, { routeQueue: true, routePlanner: true });
  }, [room.name, mapData, flags, questProgress, scheduler, addLog, autoTravelRef, intentRouterRef]);

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
