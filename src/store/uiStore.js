import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const useUiStore = (selector) => useStore(uiStore, selector);

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
  LETTERS: "letters",
  PACTS: "pacts",
});

let noticeSequence = 0;

export const uiStore = createStore((set) => ({
  overlays: [],
  notice: null,
  showNotice: (text) => {
    const notice = { id: ++noticeSequence, text };
    set({ notice });
    return notice;
  },
  clearNotice: (id) => set((state) => (
    state.notice && (id == null || state.notice.id === id) ? { notice: null } : state
  )),
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


export const useOverlay = (name) => useUiStore((state) => state.overlays.includes(name));
export const useNotice = () => useUiStore((state) => state.notice);

export const openOverlay = (name) => uiStore.getState().openOverlay(name);
export const closeOverlay = (name) => uiStore.getState().closeOverlay(name);
export const toggleOverlay = (name) => uiStore.getState().toggleOverlay(name);
export const closeAll = () => uiStore.getState().closeAll();
export const showNotice = (text) => uiStore.getState().showNotice(text);
export const clearNotice = (id) => uiStore.getState().clearNotice(id);

export const initializeUiOverlays = (names) => {
  const overlays = [...new Set(names)];
  uiStore.setState((state) => (
    state.overlays.length === overlays.length
      && state.overlays.every((name, index) => name === overlays[index])
      ? state
      : { overlays }
  ));
};
