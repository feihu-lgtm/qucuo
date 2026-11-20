import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export const OVERLAY = Object.freeze({
  DEBUG: "debug",
  PRESETS: "presets",
  TUTORIAL: "tutorial",
  CODEX: "codex",
  BUG_REPORT: "bugReport",
  SETTINGS: "settings",
  OPENING: "opening",
  CHAR_CREATE: "charCreate",
  BODY: "body",
  VERSION_HISTORY: "versionHistory",
  CHARACTER_PAGE: "characterPage",
  AVATAR_PICKER: "avatarPicker",
  MUSIC_PANEL: "musicPanel",
  HOMESTEAD: "homestead",
  QUEST_LOG: "questLog",
  LORE: "lore",
  QIJUZHU: "qijuzhu",
  CARD_IMPORT: "cardImport",
  PORTRAIT_MANAGER: "portraitManager",
  TRACE: "trace",
  BASEMENT: "basement",
});

export const uiStore = createStore((set) => ({
  overlays: [],
  openOverlay: (name) => set((state) => (
    state.overlays.includes(name)
      ? state
      : { overlays: [...state.overlays, name] }
  )),
  closeOverlay: (name) => set((state) => (
    state.overlays.includes(name)
      ? { overlays: state.overlays.filter((overlay) => overlay !== name) }
      : state
  )),
  toggleOverlay: (name) => set((state) => (
    state.overlays.includes(name)
      ? { overlays: state.overlays.filter((overlay) => overlay !== name) }
      : { overlays: [...state.overlays, name] }
  )),
  closeAll: () => set((state) => (
    state.overlays.length ? { overlays: [] } : state
  )),
}));

export const useUiStore = (selector) => useStore(uiStore, selector);
useUiStore.getState = uiStore.getState;
useUiStore.setState = uiStore.setState;

export const useOverlay = (name) => useUiStore((state) => state.overlays.includes(name));

export const openOverlay = (name) => uiStore.getState().openOverlay(name);
export const closeOverlay = (name) => uiStore.getState().closeOverlay(name);
export const toggleOverlay = (name) => uiStore.getState().toggleOverlay(name);
export const closeAll = () => uiStore.getState().closeAll();

export const initializeUiOverlays = (names) => {
  const overlays = [...new Set(names)];
  uiStore.setState((state) => (
    state.overlays.length === overlays.length
      && state.overlays.every((name, index) => name === overlays[index])
      ? state
      : { overlays }
  ));
};
