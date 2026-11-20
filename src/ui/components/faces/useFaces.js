import { useCallback, useEffect, useState } from "react";
import {
  cloneDefaults, parseFacePreferences, rotateFace, renameFace, toggleModule,
  moveModule, addFace, removeFace,
} from "./facePreferences.js";

export function readFacePreferences(storage, storageKey, defaults, options) {
  try { return parseFacePreferences(storage.getItem(storageKey), defaults, options); }
  catch { return cloneDefaults(defaults); }
}

export function writeFacePreferences(storage, storageKey, preferences) {
  try {
    storage.setItem(storageKey, JSON.stringify({
      ...preferences, faces: preferences.faces.map(face => ({ ...face, name: face.name.trim() || "未命名" })),
    }));
    return true;
  } catch { return false; }
}

export default function useFaces(storageKey, defaults, options) {
  const { availableModules, editable = true, minFaces = 1, maxFaces = 6, enableKeyboard = false } = options;
  const [preferences, setPreferences] = useState(() => {
    try { return readFacePreferences(window.localStorage, storageKey, defaults, options); }
    catch { return cloneDefaults(defaults); }
  });
  const [direction, setDirection] = useState(1);
  useEffect(() => {
    try { writeFacePreferences(window.localStorage, storageKey, preferences); }
    catch { /* Storage may be disabled; keep session preferences. */ }
  }, [storageKey, preferences]);
  const rotate = useCallback(delta => {
    setDirection(delta);
    setPreferences(state => rotateFace(state, delta));
  }, []);
  const select = index => {
    if (!Number.isInteger(index) || index < 0 || index >= preferences.faces.length) return;
    setDirection(index < preferences.currentIndex ? -1 : 1);
    setPreferences(state => ({ ...state, currentIndex: index }));
  };
  const edit = operation => { if (editable) setPreferences(operation); };
  return {
    preferences, face: preferences.faces[preferences.currentIndex], direction,
    index: preferences.currentIndex, count: preferences.faces.length,
    availableModules, editable, minFaces, maxFaces, enableKeyboard, rotate, select,
    rename: name => edit(state => renameFace(state, name)),
    toggleModule: id => edit(state => toggleModule(state, id, availableModules)),
    moveModule: (id, delta) => edit(state => moveModule(state, id, delta)),
    add: () => edit(state => addFace(state, maxFaces)),
    remove: () => edit(state => removeFace(state, minFaces)),
    reset: () => edit(() => cloneDefaults(defaults)),
  };
}
