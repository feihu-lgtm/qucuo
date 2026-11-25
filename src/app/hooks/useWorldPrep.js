// WO-24C world.prep 后台备料 hook（React 薄壳——全部时序/校验逻辑在 worldPrepRunner）
// 触发三处由 handler 显式调用 maybePrep（lodging/meditate/reading），
// 第四处 travel 在本壳内监听 room.name 变化（跨据点抵达即赶路成功）。
// 低档思考说明：withAI/modelOptions 链路不支持按调用指定思考档（思考档位是
// 用户全局 cfg 配置），按协调会话退路在此声明，不强行变形。
import { useCallback, useEffect, useMemo, useRef } from "react";
import { featureCtx } from "../runtime/gameRuntime.js";
import { gameStore, getGameEpoch, isGameEpochStale, useGameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { withAI } from "../../engine/ports/withAI.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { createWorldPrepRunner } from "./worldPrepRunner.js";

const webAi = createWebAi();

export function useWorldPrep({ apiCfg }) {
  const apiCfgRef = useRef(apiCfg);
  apiCfgRef.current = apiCfg;

  const runner = useMemo(() => createWorldPrepRunner({
    getState: () => gameStore.getState(),
    callAI: ({ prepInput, state, isStale }) => withAI("world.prep", {
      prep: prepInput, state, preset: state.preset,
    }, { ai: webAi, apiCfg: apiCfgRef.current, isStale }),
    // 落账走单一写边界 applyResult；只写顶层 prepSeeds，不走 varTree——备料是缓存不是事实。
    applySeeds: (prepSeeds) => applyResult(featureCtx(), {
      changes: { prepSeeds },
    }, { feature: "world.prep", background: true }),
    getEpoch: getGameEpoch,
    isEpochStale: isGameEpochStale,
  }), []);

  const maybePrep = useCallback((trigger) => runner.maybePrep(trigger), [runner]);

  // 跨据点赶路成功：room.name 变化即抵达新据点（首帧/读档不算——ref 初值吃掉首帧，
  // 读档换 epoch 由 runner 内 stale 闸兜底）。内层房走动不动 room.name，不误触。
  const roomName = useGameStore((s) => s.room?.name);
  const prevRoom = useRef(roomName);
  useEffect(() => {
    if (prevRoom.current === roomName) return;
    prevRoom.current = roomName;
    if (roomName) maybePrep("travel");
  }, [roomName, maybePrep]);

  useEffect(() => () => runner.dispose(), [runner]);

  return { maybePrep };
}
