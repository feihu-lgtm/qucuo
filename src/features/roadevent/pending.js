import { createStore } from "zustand/vanilla";

// WO-25O：挂起的路遇——照面回合由 rollMovementEvents 分流写入，
// 玩家的下一句输入若命中可行之事则由 resolveIntent 拦截结算；
// 不命中即视为时过境迁自动作废（leave 也不补叙）。会话级不落档：
// 读档/重开后挂起自然消散，那一刻的抉择不再追讨。
export const roadEventPendingStore = createStore(() => ({ pending: null }));

export function setRoadEventPending(pending) {
  roadEventPendingStore.setState({ pending: pending || null });
}

export function clearRoadEventPending() {
  roadEventPendingStore.setState({ pending: null });
}

export function getRoadEventPending() {
  return roadEventPendingStore.getState().pending;
}

// React hook 不在此出口——features 层禁用非 vanilla zustand；
// UI 侧自行 useStore(roadEventPendingStore, …) 订阅（见 RoadEventBar）。
