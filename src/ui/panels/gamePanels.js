import useFaces from "../components/faces/useFaces.js";
import { LEFT_FACE_PREF_KEY, LEFT_FACE_DEFAULTS, LEFT_MODULES } from "./left/leftFaces.js";
import { FACE_PREF_KEY, RIGHT_FACE_DEFAULTS, RIGHT_MODULES, migrateRightFaces } from "./right/rightFaces.js";

export { default as LeftPanel } from "./LeftPanel.jsx";
export { default as CenterPanel } from "./CenterPanel.jsx";
export { default as RightPanel } from "./RightPanel.jsx";
export { default as MobileTabBar } from "../components/MobileTabBar.jsx";

export function usePanelFaces() {
  const leftFaces = useFaces(LEFT_FACE_PREF_KEY, LEFT_FACE_DEFAULTS, {
    availableModules: LEFT_MODULES, editable: false, enableKeyboard: false,
  });
  const rightFaces = useFaces(FACE_PREF_KEY, RIGHT_FACE_DEFAULTS, {
    availableModules: RIGHT_MODULES, enableKeyboard: true, migrate: migrateRightFaces,
  });
  return { leftFaces, rightFaces };
}
