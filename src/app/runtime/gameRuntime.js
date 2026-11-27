// 模块级游戏运行时原语：不依赖 React 生命周期，任何地方可直接调用。
// featureCtx / hook 传参应逐步收敛到这里——游戏状态读写统一走 gameStore。
import { gameActions, gameStore } from "../../store/gameStore.js";
import { burnSquare, consumeArrival } from "../../domain/rules/map/mapSquares.js";
import { stampLogEntries } from "../../domain/rules/log/logTypes.js";
import { appendTurnError } from "../../domain/rules/log/turnErrors.js";

// 当前回合的追踪编号（turnMonitor 的 turn id）。useTurn / 行动识别在回合开始时登记，
// addLog 给这段时间写进主栏的条目都盖上 tid，卷宗据此把主栏条目和全流程追踪拼成同一回合。
let activeTraceId = null;
export const setActiveTraceId = (id) => { activeTraceId = id || null; };
export const clearActiveTraceId = (id) => { if (!id || activeTraceId === id) activeTraceId = null; };
const withTraceId = (lines) => (activeTraceId && Array.isArray(lines)
  ? lines.map((line) => (line && typeof line === "object" && line.tid == null ? { ...line, tid: activeTraceId } : line))
  : lines);

export const addLog = (lines) => {
  const time = gameStore.getState().time;
  const list = Array.isArray(lines) ? lines : (lines ? [lines] : []);
  return gameActions.setLog((prev) => [...(prev || []), ...stampLogEntries(withTraceId(list), time)]);
};

// 回合失败：主栏只落一句话，同因连续失败合并成一条并计数（规则见 turnErrors.js）。
export const addTurnError = (entry) => {
  const time = gameStore.getState().time;
  const [stamped] = stampLogEntries(withTraceId([entry]), time);
  return gameActions.setLog((prev) => appendTurnError(prev || [], stamped));
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
  addTurnError,
  applySquareOps,
  gameActions,
  setVarTree: gameActions.setVarTree,
  ...registered,
});
