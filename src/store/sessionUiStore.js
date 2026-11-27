import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { loadConfig, saveConfig } from "../infra/apiConfig.js";
import { readMobileColumn, writeMobileColumn } from "../utils/mobileColumn.js";
import { isMobileViewport } from "../utils/viewport.js";

const useSessionUiStore = (selector) => useStore(sessionUiStore, selector);

// node 环境（vitest/CLI 单测）没有 localStorage/document，全部包 try。
const lsGet = (key) => { try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; } };
const lsSet = (key, value) => { try { globalThis.localStorage?.setItem(key, value); } catch { /* ignore */ } };
const loadApiCfg = () => { try { return loadConfig(); } catch { return {}; } };
const setDomDataset = (key, value) => { if (typeof document !== "undefined") document.documentElement.dataset[key] = value; };

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
  // W-INPUT 一次性胶囊：{kind:"whisper"|"target"|"pigeon", name}——单条发送完成即焚，
  // 替代旧模式按钮/选人芯片的跨回合粘连态。
  inputCapsule: null,
  cmdHistory: [],
  histIdx: -1,
  // 模态/战斗/建筑态（PR-2B）
  forcedDuelNpc: null,
  duelingNpc: null,
  duelPending: null,
  pendingQuestBranch: null,
  activePersuasion: null,
  activeBuilding: null,
  gambleNegotiation: {},
  // 赌石谈价语境：玩家与买家谈价这一轮的事实底（baseOffer/cash/carry/stoneId/bidderName），
  // 谈完即清空——跨层传递走本 store，不再用 React ref。
  gambleSession: null,
  buildingPanelMinimized: false,
  justMeditated: false,
  tradingShop: null,
  // 偏好设置/面板态（PR-2C）——apiCfg/uiScale/font/isDayMode/mobileColumn 带持久化
  apiCfg: loadApiCfg(),
  uiScale: (() => { const s = lsGet("wuxia_mud_ui_scale"); return s ? parseFloat(s) : 1; })(),
  // 夜色精修：正文默认宋体；像素字体保留为设置里的可选项（玩家主动选过才用）。
  font: lsGet("wuxia_mud_ui_font_v2") === "pixel" ? "pixel" : "song",
  isDayMode: lsGet("wuxia_mud_day_mode") === "1",
  nsfwOn: true,
  gm: false,
  isMobile: isMobileViewport(),
  mobileColumn: readMobileColumn(),
  mobileTopMenu: false,
  settingsInitialTab: null,
  activeNpcMenu: null,
  activeItemMenu: null,
  characterPageTarget: null,
  portraitTarget: null,
  // 面板本地态（PR-2D）：无 ref 耦合的纯 UI 折叠/视图开关
  collapsedGroups: new Set(),
  // 江湖栏视图：story=正文（读故事），journal=卷宗（一行一事地查账、查错、看机器明细）
  centerView: "story",
  // 中栏对白头像落点：gutter=书页落像（默认），inline=行内小像，off=纯文
  dialoguePortraitMode: (() => {
    const v = lsGet("qucuo_dialogue_portrait_mode");
    return v === "inline" || v === "off" ? v : "gutter";
  })(),
  mapBig: false,
  mapView: "outer",
  // 不在此地默认收起：曾遇人物会越攒越多，把在场的人挤出视野
  peoplePanel: { present: true, nearby: true, absent: false },
}));

// 持久化与 DOM 副作用收编进 store（原 MudRPG/useGameUi 的 useEffect）：字段真变才写回；
// dataset.font/theme 原 effect 挂载即跑一次，建仓后立即补一次初始同步。
setDomDataset("font", sessionUiStore.getState().font);
setDomDataset("theme", sessionUiStore.getState().isDayMode ? "day" : "night");
sessionUiStore.subscribe((state, prev) => {
  if (state.apiCfg !== prev.apiCfg) { try { saveConfig(state.apiCfg); } catch { /* ignore */ } }
  if (state.uiScale !== prev.uiScale) lsSet("wuxia_mud_ui_scale", String(state.uiScale));
  if (state.font !== prev.font) { lsSet("wuxia_mud_ui_font_v2", state.font); setDomDataset("font", state.font); }
  if (state.isDayMode !== prev.isDayMode) {
    lsSet("wuxia_mud_day_mode", state.isDayMode ? "1" : "0");
    setDomDataset("theme", state.isDayMode ? "day" : "night");
  }
  if (state.mobileColumn !== prev.mobileColumn) writeMobileColumn(undefined, state.mobileColumn);
  if (state.dialoguePortraitMode !== prev.dialoguePortraitMode) lsSet("qucuo_dialogue_portrait_mode", state.dialoguePortraitMode);
});

export const useSessionUi = useSessionUiStore;

// 模块建仓早于主菜单：开局时回读一遍 localStorage，对齐主菜单上可能改过的 API 配置。
export const refreshApiCfg = () => sessionUiStore.setState({ apiCfg: loadApiCfg() });

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
export const setInputCapsule = fieldSetter("inputCapsule");
export const setCmdHistory = fieldSetter("cmdHistory");
export const setHistIdx = fieldSetter("histIdx");
export const setForcedDuelNpc = fieldSetter("forcedDuelNpc");
export const setDuelingNpc = fieldSetter("duelingNpc");
export const setDuelPending = fieldSetter("duelPending");
export const setPendingQuestBranch = fieldSetter("pendingQuestBranch");
export const setActivePersuasion = fieldSetter("activePersuasion");
export const setActiveBuilding = fieldSetter("activeBuilding");
export const setGambleNegotiation = fieldSetter("gambleNegotiation");
export const setGambleSession = fieldSetter("gambleSession");
export const setBuildingPanelMinimized = fieldSetter("buildingPanelMinimized");
export const setJustMeditated = fieldSetter("justMeditated");
export const setTradingShop = fieldSetter("tradingShop");
export const setApiCfg = fieldSetter("apiCfg");
export const setUiScale = fieldSetter("uiScale");
export const setFont = fieldSetter("font");
export const setIsDayMode = fieldSetter("isDayMode");
export const setNsfwOn = fieldSetter("nsfwOn");
export const setGm = fieldSetter("gm");
export const setIsMobile = fieldSetter("isMobile");
export const setMobileColumn = fieldSetter("mobileColumn");
export const setMobileTopMenu = fieldSetter("mobileTopMenu");
export const setSettingsInitialTab = fieldSetter("settingsInitialTab");
export const setActiveNpcMenu = fieldSetter("activeNpcMenu");
export const setActiveItemMenu = fieldSetter("activeItemMenu");
export const setCharacterPageTarget = fieldSetter("characterPageTarget");
export const setPortraitTarget = fieldSetter("portraitTarget");
export const setCollapsedGroups = fieldSetter("collapsedGroups");
export const setCenterView = fieldSetter("centerView");
export const setDialoguePortraitMode = fieldSetter("dialoguePortraitMode");
export const setMapBig = fieldSetter("mapBig");
export const setMapView = fieldSetter("mapView");
export const setPeoplePanel = fieldSetter("peoplePanel");
