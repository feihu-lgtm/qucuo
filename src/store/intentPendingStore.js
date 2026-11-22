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

// 回合 ctx 显式携带的挂起态快照：{ pending, triggers }。
// 调用方把它放进 TurnContext 明传，代替各段自行探入 store 的隐式读取；
// store 本体仍是 IntentConfirmBar/useIntentRouter/CLI 的响应式来源。
export function snapshotIntentPending() {
  const { pending, triggers } = intentPendingStore.getState();
  return { pending, triggers };
}

// 计划结算后把条件步挂起；返回挂起的条目（含 on 的便捷键）。
export function armIntentTriggers(steps) {
  const armed = (steps || []).map((step) => ({ step, on: step.condition?.on, detail: step.condition?.detail || "", status: "armed" }));
  if (armed.length) intentPendingStore.setState({ triggers: armed });
  return armed;
}

// 「到达」：前提点了地名 → 只在到那儿时应验；没点地名 → 行程走完才应验。
// 「从X出发/离开X」里的 X 是起点，不算目的地。
// 地名清单由调用方注入（web 传 QUCUO_MAP 的键），store 不反向依赖 domain。
const originPattern = (placeNames) =>
  new RegExp(`(?:从|离开|出了)(?:${[...placeNames].sort((a, b) => b.length - a.length).join("|")})`, "g");

function arriveMatches(detail, dest, travelDone, placeNames) {
  const goal = detail.replace(originPattern(placeNames), "");
  if (dest && goal.includes(dest)) return true;
  return travelDone && !placeNames.some((name) => goal.includes(name));
}

// 某类事件发生时取出并移除匹配的触发器。「遇敌」只认 hostile 路遇，和气的过路人不算。
export function fireIntentTriggers(on, { dest, travelDone = true, hostile = false, placeNames = [] } = {}) {
  const match = (entry) => entry.on === on &&
    (on !== "arrive" || arriveMatches(entry.detail, dest, travelDone, placeNames)) &&
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
