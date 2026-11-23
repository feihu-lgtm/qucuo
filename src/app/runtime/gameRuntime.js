// 模块级游戏运行时原语：不依赖 React 生命周期，任何地方可直接调用。
// featureCtx / hook 传参应逐步收敛到这里——游戏状态读写统一走 gameStore。
import { gameActions } from "../../store/gameStore.js";
import { burnSquare, consumeArrival } from "../../domain/rules/map/mapSquares.js";

export const addLog = (lines) =>
  gameActions.setLog((prev) => [...(prev || []), ...lines]);

export const applySquareOps = (ops) => {
  for (const { op, key, day } of ops) {
    if (op === "consume") consumeArrival(key, day);
    else if (op === "burn") burnSquare(key);
  }
};
