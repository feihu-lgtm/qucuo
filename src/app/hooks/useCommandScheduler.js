import { useCallback, useEffect, useRef, useState } from "react";
import { createScheduler } from "../../core/commandScheduler.js";
import { COMMANDS } from "../../core/commands.js";
import { HOOK_COMMANDS } from "../../engine/commands/index.js";

export function useCommandScheduler({ addLog, setQueueCount }) {
  const addLogRef = useRef(addLog);
  addLogRef.current = addLog;
  const schedulerRef = useRef(null);
  if (!schedulerRef.current) {
    schedulerRef.current = createScheduler({
      onReject: (command, running) => {
        const label = running?.label || "当前操作";
        const message = command.id === "load" || command.id === "newGame"
          ? `  ${label}尚未落盘，请稍候再${command.id === "load" ? "读取" : "开始新游戏"}。`
          : `  正在${label}，请稍候。`;
        addLogRef.current([{ t: "sys", text: message, standalone: true }]);
        return message;
      },
      onQueue: (command, position) => {
        const label = command.meta.displayText || command.label;
        addLogRef.current([{ t: "sys", text: `  ⏳ 「${label}」已入队（排队中 ${position}）`, standalone: true }]);
      },
    });
  }
  const scheduler = schedulerRef.current;
  const [state, setState] = useState({ running: null, queue: [], rollbackBlocked: false });

  useEffect(() => scheduler.subscribe(({ running, queue, rollbackBlocked }) => {
    setState({
      running: running ? { id: running.id, category: running.category, phase: running.phase, label: running.label } : null,
      queue,
      rollbackBlocked,
    });
    setQueueCount(queue.length);
  }), [scheduler, setQueueCount]);

  const dispatch = useCallback((commandId, fn, meta) => scheduler.dispatch(commandId, fn, meta), [scheduler]);
  const enqueue = useCallback((commandId, fn, meta) => scheduler.enqueue(commandId, fn, meta), [scheduler]);
  const clearQueue = useCallback(() => scheduler.clearQueue(), [scheduler]);
  const clearRouteQueue = useCallback(() => scheduler.clearRouteQueue(), [scheduler]);
  const stopRunning = useCallback(() => scheduler.stopRunning(), [scheduler]);
  const setPhase = useCallback((phase, trace) => scheduler.setPhase(phase, trace), [scheduler]);

  const wrapHandlers = useCallback((group, handlers) => {
    const mappings = HOOK_COMMANDS[group];
    if (!mappings) throw new Error(`No command mapping for ${group}`);
    const wrapped = {};
    for (const [key, handler] of Object.entries(handlers)) {
      if (typeof handler !== "function") {
        wrapped[key] = handler;
        continue;
      }
      const commandId = mappings[key];
      if (!commandId || !COMMANDS[commandId]) throw new Error(`Unregistered handler: ${group}.${key}`);
      if (group === "usePigeonHandlers" && key === "pigeonDelayShichen") {
        wrapped[key] = handler;
        continue;
      }
      wrapped[key] = (...args) => dispatch(commandId, () => handler(...args));
    }
    return wrapped;
  }, [dispatch]);

  return {
    dispatch,
    enqueue,
    clearQueue,
    clearRouteQueue,
    stopRunning,
    setPhase,
    wrapHandlers,
    running: state.running,
    queue: state.queue,
    rollbackBlocked: state.rollbackBlocked,
    canRun: scheduler.canRun,
    scheduler,
  };
}
