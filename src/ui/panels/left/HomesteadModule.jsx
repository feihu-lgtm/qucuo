import { getHomestead } from "../../../domain/map/homestead.js";
import { OVERLAY, openOverlay } from "../../../store/uiStore.js";
import { chromeBtn } from "../../theme.js";

export default function HomesteadModule({ zoneTheme, innerRoomName }) {
  const home = innerRoomName ? getHomestead(innerRoomName) : null;
  if (!home) return null;
  return <div>
    <div style={{ color: zoneTheme.accentDim, fontSize: "10.5px", marginBottom: 5 }}>家园设施</div>
    <button type="button" onClick={() => openOverlay(OVERLAY.HOMESTEAD)} style={chromeBtn(zoneTheme, { active: false })}>🏠 {home.label || "家园"}</button>
    <div style={{ color: zoneTheme.textDim, fontSize: "10.5px", marginTop: 4 }}>{home.features.map(f => f.name).join("·")}</div>
  </div>;
}
