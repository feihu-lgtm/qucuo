import { getHomestead } from "../../../domain/rules/map/homestead.js";
import { OVERLAY, openOverlay } from "../../../store/uiStore.js";
import { Button } from "../../primitives/index.js";

export default function HomesteadModule({ innerRoomName }) {
  const home = innerRoomName ? getHomestead(innerRoomName) : null;
  if (!home) return null;
  return (
    <div className="left-homestead">
      <div className="panel-sec-label">家园设施</div>
      <Button variant="chrome" font="native" active={false} type="button" className="chip-btn" onClick={() => openOverlay(OVERLAY.HOMESTEAD)}>
        {home.label || "家园"}
      </Button>
      <div className="panel-sub-note">{home.features.map(f => f.name).join("·")}</div>
    </div>
  );
}
