import { getHomestead } from "../../../domain/rules/map/homestead.js";
import { OVERLAY, openOverlay } from "../../../store/uiStore.js";
import { Button } from "../../primitives/index.js";

export default function HomesteadModule({ innerRoomName }) {
  const home = innerRoomName ? getHomestead(innerRoomName) : null;
  if (!home) return null;
  return <div>
    <div style={{ color: "var(--accent-dim)", fontSize: "var(--fs-xs)", marginBottom: 5 }}>家园设施</div>
    <Button variant="chrome" font="native" active={false} type="button" onClick={() => openOverlay(OVERLAY.HOMESTEAD)}>🏠 {home.label || "家园"}</Button>
    <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", marginTop: 4 }}>{home.features.map(f => f.name).join("·")}</div>
  </div>;
}
