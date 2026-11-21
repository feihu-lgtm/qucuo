import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

// 行动识别中置信度时挂起的确认（「你是要把100两给才旦吗？」）：{ text, onConfirm, onCancel } | null
// 以及条件步骤挂起的触发器：{ step, on, detail, status: "armed" }，
// 行程结束或玩家又输入一句话时整体过期（web/CLI 共用）。
export const intentPendingStore = createStore(() => ({ pending: null, triggers: [] }));

export function setIntentPending(pending) {
  intentPendingStore.setState({ pending: pending || null });
}

export function useIntentPending() {
  return useStore(intentPendingStore, (state) => state.pending);
}

export function intentTriggers() {
  return intentPendingStore.getState().triggers;
}

// 计划结算后把条件步挂起；返回挂起的条目（含 on 的便捷键）。
export function armIntentTriggers(steps) {
  const armed = (steps || []).map((step) => ({ step, on: step.condition?.on, detail: step.condition?.detail || "", status: "armed" }));
  if (armed.length) intentPendingStore.setState({ triggers: armed });
  return armed;
}

// 某类事件发生时取出并移除匹配的触发器。arrive 只在行程走完、或前提里点了目的地名时才算命中。
export function fireIntentTriggers(on, { dest, travelDone = true } = {}) {
  const match = (entry) => entry.on === on
    && (on !== "arrive" || travelDone || (dest && entry.detail.includes(dest)));
  const fired = intentTriggers().filter(match);
  if (fired.length) {
    intentPendingStore.setState({ triggers: intentTriggers().filter((entry) => !match(entry)) });
  }
  return fired;
}

// 剩余触发器整体过期；返回被清掉的条目供记日志。
export function expireIntentTriggers() {
  const expired = intentTriggers();
  if (expired.length) intentPendingStore.setState({ triggers: [] });
  return expired;
}
