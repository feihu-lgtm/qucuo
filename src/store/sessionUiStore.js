import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const useSessionUiStore = (selector) => useStore(sessionUiStore, selector);

// UI 会话状态（交互/输入态）：原 useGameUi 顶层的 useState 迁到这里，
// 面板用 useSessionUi(selector) 按需订阅，非 React 侧可读 sessionUiStore.getState()。
export const sessionUiStore = createStore(() => ({
  input: "",
  loading: false,
  waitSecs: 0,
  pendingTalks: 0,
  queueCount: 0,
  interactMode: "action",
  talkTarget: null,
  activeTarget: null,
  activeGroundItem: null,
  pigeonTarget: null,
  cmdHistory: [],
  histIdx: -1,
}));

export const useSessionUi = useSessionUiStore;

// 与 React setState 同形：setX(v) 或 setX(prev => next)
const fieldSetter = (key) => (value) => sessionUiStore.setState((state) => (
  { [key]: typeof value === "function" ? value(state[key]) : value }
));

export const setInput = fieldSetter("input");
export const setLoading = fieldSetter("loading");
export const setWaitSecs = fieldSetter("waitSecs");
export const setPendingTalks = fieldSetter("pendingTalks");
export const setQueueCount = fieldSetter("queueCount");
export const setInteractMode = fieldSetter("interactMode");
export const setTalkTarget = fieldSetter("talkTarget");
export const setActiveTarget = fieldSetter("activeTarget");
export const setActiveGroundItem = fieldSetter("activeGroundItem");
export const setPigeonTarget = fieldSetter("pigeonTarget");
export const setCmdHistory = fieldSetter("cmdHistory");
export const setHistIdx = fieldSetter("histIdx");
