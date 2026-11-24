import { useCallback, useEffect, useRef } from "react";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";
import { writeNote } from "../../engine/ports/noteMemory.js";
import { tallyAdd } from "../../domain/rules/memory/tally.js";
import { QUCUO_MAP } from "../../domain/data/map/qucuoMap.js";
import { gameStore, subscribeGameReplaced } from "../../store/gameStore.js";

let activeDayMaterialRef = null;

export function snapshotDayMaterial() {
  return [...(activeDayMaterialRef?.current || [])];
}

export function restoreDayMaterial(items) {
  if (activeDayMaterialRef) activeDayMaterialRef.current = [...(items || [])];
}

export function useNotes({ apiCfg, setVarTree }) {
  const noteEnvRef = useRef({});
  useEffect(() => {
    noteEnvRef.current = { apiCfg };
  });
  const dayMaterialRef = useRef([]);
  useEffect(() => {
    activeDayMaterialRef = dayMaterialRef;
    const unsub = subscribeGameReplaced(({ isUndo } = {}) => {
      if (!isUndo) dayMaterialRef.current = [];
    });
    return () => {
      unsub();
      if (activeDayMaterialRef === dayMaterialRef) activeDayMaterialRef = null;
    };
  }, []);
  const noteAction = useCallback((kind, n = 1) => {
    setVarTree(prev => {
      const next = JSON.parse(JSON.stringify(prev || {}));
      if (!next.世界) next.世界 = { 威望: 0 };
      next.世界.起居注 = tallyAdd(next.世界.起居注, kind, gameStore.getState().time, n);
      return next;
    });
  }, [setVarTree]);

  const jotNote = useCallback(({ text, owner = [], source = NOTE_SOURCE.DUMB }) => {
    const env = noteEnvRef.current;
    if (!text || !env.apiCfg) return;
    // Store 直读：写纸条时现取 time/room/varTree，不经 hook 参数透传（路线一）。
    const { time, room, varTree } = gameStore.getState();
    dayMaterialRef.current.push({ turn: time, text });
    const knownNames = Array.from(new Set([
      ...(room?.npcs || []).map(n => n.name),
      ...Object.keys(varTree?.角色 || {}),
      ...Object.keys(QUCUO_MAP),
    ]));
    writeNote({ cfg: env.apiCfg, text, turn: time, owner, source, place: room?.name, knownNames })
      .catch(() => {});
  }, []);

  return { noteAction, jotNote, dayMaterialRef };
}
