import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { QUCUO_MAP } from "../domain/map/qucuoMap.js";

const PLACE_NAMES = Object.keys(QUCUO_MAP);

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

// 「到达」：前提点了地名 → 只在到那儿时应验；没点地名 → 行程走完才应验。
// 「从X出发/离开X」里的 X 是起点，不算目的地。
const ORIGIN = new RegExp(`(?:从|离开|出了)(?:${[...PLACE_NAMES].sort((a, b) => b.length - a.length).join("|")})`, "g");

function arriveMatches(detail, dest, travelDone) {
  const goal = detail.replace(ORIGIN, "");
  if (dest && goal.includes(dest)) return true;
  return travelDone && !PLACE_NAMES.some((name) => goal.includes(name));
}

// 某类事件发生时取出并移除匹配的触发器。「遇敌」只认 hostile 路遇，和气的过路人不算。
export function fireIntentTriggers(on, { dest, travelDone = true, hostile = false } = {}) {
  const match = (entry) => entry.on === on &&
    (on !== "arrive" || arriveMatches(entry.detail, dest, travelDone)) &&
    (on !== "encounter" || hostile);
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
