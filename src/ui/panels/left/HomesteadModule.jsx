import { getHomestead } from "../../../domain/rules/map/homestead.js";
import { OVERLAY, openOverlay } from "../../../store/uiStore.js";
import { THEME_VARS, chromeBtn } from "../../../utils/theme.js";

export default function HomesteadModule({ innerRoomName }) {
  const home = innerRoomName ? getHomestead(innerRoomName) : null;
  if (!home) return null;
  return <div>
    <div style={{ color: "var(--accent-dim)", fontSize: "var(--fs-xs)", marginBottom: 5 }}>家园设施</div>
    <button type="button" onClick={() => openOverlay(OVERLAY.HOMESTEAD)} style={chromeBtn(THEME_VARS, { active: false })}>🏠 {home.label || "家园"}</button>
    <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", marginTop: 4 }}>{home.features.map(f => f.name).join("·")}</div>
  </div>;
}
