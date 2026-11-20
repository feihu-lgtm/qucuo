import { useEffect, useState } from "react";
import { FACE_PREF_KEY, defaultFacePreferences, parseFacePreferences } from "./facePreferences.js";

export function readFacePreferences(storage) {
  try { return parseFacePreferences(storage.getItem(FACE_PREF_KEY)); }
  catch { return defaultFacePreferences(); }
}

export function writeFacePreferences(storage, preferences) {
  try {
    storage.setItem(FACE_PREF_KEY, JSON.stringify({
      ...preferences,
      faces: preferences.faces.map(face => ({ ...face, name: face.name.trim() || "未命名" })),
    }));
    return true;
  } catch { return false; }
}

export default function useFacePreferences() {
  const [preferences, setPreferences] = useState(() => {
    try { return readFacePreferences(window.localStorage); }
    catch { return defaultFacePreferences(); }
  });
  useEffect(() => {
    try { writeFacePreferences(window.localStorage, preferences); }
    catch { /* Storage may be disabled; keep session preferences. */ }
  }, [preferences]);
  return [preferences, setPreferences];
}
