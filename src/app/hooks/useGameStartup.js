import { useEffect, useRef, useState } from "react";
import { useInitialRestore } from "./useAutosave.js";
import { buildInitialGameState } from "../../core/newGame.js";
import { initGameStore } from "../../store/gameStore.js";
import { OVERLAY, initializeUiOverlays, toggleOverlay } from "../../store/uiStore.js";
import { attachImportedRegistry } from "../../domain/data/character/characterMilestones.js";
import * as importedRegistry from "../../domain/rules/cards/importedRegistry.js";
import { getDistrictAnchor, hasInnerMap, isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { detectNewFaces, markAsSeen, updateLastSeen } from "../../domain/rules/npc/npcAwareness.js";

export function useGameStartup({ initialLoadSlotId, initialOpenSettings }) {
  const restored = useInitialRestore({ initialLoadSlotId });
  const overlaysInitializedRef = useRef(false);
  if (!overlaysInitializedRef.current) {
    const initialOverlays = [];
    try {
      if (!initialOpenSettings && localStorage.getItem("qucuo_tutorial_seen") !== "1") initialOverlays.push(OVERLAY.TUTORIAL);
    } catch { /* unavailable storage means no automatic tutorial */ }
    if (initialOpenSettings) initialOverlays.push(OVERLAY.SETTINGS);
    if (initialLoadSlotId === "new" && !restored) {
      initialOverlays.push(OVERLAY.OPENING, OVERLAY.CHAR_CREATE);
    }
    initializeUiOverlays(initialOverlays);
    overlaysInitializedRef.current = true;
  }

  useState(() => {
    initGameStore(buildInitialGameState(restored));
    return true;
  });
  return { restored };
}

export function useGameStartupBindings({
  room, prevRoomNameRef, restoredInnerRef, setInnerRoomName, companionState,
  companionStateRef, loading, loadingRef, time, timeRef, setIsMobile,
  setMobileTopMenu,
}) {
  useEffect(() => {
    if (prevRoomNameRef.current === room.name) return;
    prevRoomNameRef.current = room.name;
    if (restoredInnerRef.current !== null) { restoredInnerRef.current = null; return; }
    setInnerRoomName(hasInnerMap(room.name) ? getDistrictAnchor(room.name) : null);
  }, [room.name]);
  useEffect(() => { companionStateRef.current = companionState; }, [companionState]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { timeRef.current = time; }, [time]);
  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth < 768;
      setIsMobile(m);
      if (!m) setMobileTopMenu(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
}

export function useGameStartupRegistry() {
  useEffect(() => {
    importedRegistry.init().then(() => {
      attachImportedRegistry(importedRegistry);
    });
  }, []);
}

export function useGameStartupShortcut() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      const tag = (t?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
      if (e.key === "i" || e.key === "I") { e.preventDefault(); toggleOverlay(OVERLAY.CARD_IMPORT); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function useGameStartupOpeningFaces({
  restored, showOpening, showCharCreate, room, innerRoomName, varTreeRef,
  addLog, setVarTree, time, schedulerRef,
}) {
  const openingFacesRef = useRef(false);
  useEffect(() => {
    if (openingFacesRef.current) return;
    if (restored) { openingFacesRef.current = true; return; }
    if (showOpening || showCharCreate) return;
    openingFacesRef.current = true;
    const visible = (room.npcs || []).filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n));
    const newFaces = detectNewFaces(varTreeRef.current, visible);
    if (newFaces.length) {
      const recordOpeningFaces = () => {
        addLog(newFaces.map(n => ({ t: "sys", text: `  ※ 新人物出现：${n.name}（点击可细看其人）` })));
        setVarTree(prev => markAsSeen(prev, newFaces.map(n => n.name)));
        setVarTree(prev => updateLastSeen(prev, visible.map(n => n.name), time));
      };
      const scheduler = schedulerRef.current;
      if (scheduler) scheduler.runSilently(recordOpeningFaces);
      else recordOpeningFaces();
    }
  }, [showOpening, showCharCreate]);
}
