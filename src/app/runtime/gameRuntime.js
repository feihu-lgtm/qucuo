// 模块级游戏运行时原语：不依赖 React 生命周期，任何地方可直接调用。
// featureCtx / hook 传参应逐步收敛到这里——游戏状态读写统一走 gameStore。
import { gameActions, gameStore } from "../../store/gameStore.js";
import { burnSquare, consumeArrival } from "../../domain/rules/map/mapSquares.js";
import { stampLogEntries } from "../../domain/rules/log/logTypes.js";

export const addLog = (lines) => {
  const time = gameStore.getState().time;
  return gameActions.setLog((prev) => [...(prev || []), ...stampLogEntries(lines, time)]);
};

export const applySquareOps = (ops) => {
  for (const { op, key, day } of ops) {
    if (op === "consume") consumeArrival(key, day);
    else if (op === "burn") burnSquare(key);
  }
};

// useTurn 挂载时把 act 与后台任务注册进来；hook 不再经 featureCtxRef 参数拿它。
const registered = {};
export const registerRuntime = (fns) => Object.assign(registered, fns);
export const resetRuntime = () => { for (const k of Object.keys(registered)) delete registered[k]; };

// featureCtxRef 的模块级替身：形状与 useTurn 组装的 featureCtx 一致。
// 注册值（act/jotNote/后台任务，或测试注入的替身）覆盖默认实现。
export const featureCtx = () => ({
  addLog,
  applySquareOps,
  gameActions,
  setVarTree: gameActions.setVarTree,
  ...registered,
});
