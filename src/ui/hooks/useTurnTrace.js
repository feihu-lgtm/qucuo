// 界面读全流程追踪（turnMonitor）的唯一入口：状态灯和卷宗都从这里订阅，
// 界面层对 infra 的直连只留这一处。
import { useSyncExternalStore } from "react";
import { PHASE, formatTurnStatus, turnMonitor } from "../../infra/turnMonitor.js";

export { PHASE, formatTurnStatus };

export function useTurnTrace() {
  return useSyncExternalStore(turnMonitor.subscribe, turnMonitor.getSnapshot, turnMonitor.getSnapshot);
}
