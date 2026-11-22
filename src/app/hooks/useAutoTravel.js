import { useCallback, useEffect, useRef } from "react";
import { planAutoTravel } from "../../features/map/logic.js";
import { QUCUO_MAP } from "../../domain/data/map/qucuoMap.js";
import { DIRS } from "../../utils/mudHelpers.js";

const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

// 各程跑之前等 act 闭包落地：腿的队列项在上一程结束的微任务链里就执行，
// React 往往还没把"新房间"重渲染进 act——此时 actRef.current 还是带着旧 room
// 闭包的 act，方向判定拿旧房间解析出口，路就断了（"两段只走第一段就停"的根因）。
// roomNameRef 随渲染更新（与 actRef 在同一次 render 里刷新），等到它反映本程的
// 出发房再继续；expectedRooms[i] = 第 i 程的出发房名。最多等 ~2s 兜底（上一程
// 没走成/被拦时不再死等，照常放 act 走它自己的失败分支）。
async function waitForActRoom(roomNameRef, expectedRoom, { tries = 500 } = {}) {
  if (!roomNameRef || !expectedRoom) { await nextTick(); return; }
  for (let i = 0; i < tries && roomNameRef.current !== expectedRoom; i += 1) await nextTick();
}

// 由起点与方向序列推出每一程的出发房：rooms[i] 是第 i 程的出发房，末元素是终点。
export function routeRooms(startName, path) {
  const rooms = [startName];
  for (const dir of path) rooms.push(QUCUO_MAP[rooms[rooms.length - 1]]?.exits?.[dir]);
  return rooms;
}

export function enqueueAutoTravelLegs(path, { scheduler, actRef, autoTravelRef, onTravelEnd, roomNameRef, expectedRooms }) {
  path.map(d => DIRS[d] || d).forEach((w, i) => scheduler.enqueue("autoTravel", async (entry) => {
    // 调度上下文（turnMonitor 的 synchronousTurn）只在本函数的同步前缀里存在：
    // 等闭包落地的 await 一挂起，act 就接不回本程 trace（会另起一棵游离的 trace 树）。
    // 调度器把 entry 传进来，本程 trace 先抓住、await 之后以 opts.turn 传回 act。
    const legTrace = entry?.trace;
    try {
      await waitForActRoom(roomNameRef, expectedRooms?.[i]);
      return await actRef.current(w, [], {
        forceLayer: "outer",
        autoTravel: true,
        schedulerManaged: true,
        turn: legTrace,
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
  // 与 actRef 同一次 render 更新的当前房间名：各程用它判断 act 闭包是否已落地（见 waitForActRoom）。
  const roomNameRef = useRef(room.name);
  roomNameRef.current = room.name;

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
        scheduler, actRef, autoTravelRef, roomNameRef,
        expectedRooms: routeRooms(room.name, path),
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
