import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

// 行动识别中置信度时挂起的确认（「你是要把100两给才旦吗？」）：{ text, onConfirm, onCancel } | null
export const intentPendingStore = createStore(() => ({ pending: null }));

export function setIntentPending(pending) {
  intentPendingStore.setState({ pending: pending || null });
}

export function useIntentPending() {
  return useStore(intentPendingStore, (state) => state.pending);
}
