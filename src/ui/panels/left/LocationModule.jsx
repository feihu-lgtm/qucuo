import { hasInnerMap } from "../../../domain/map/innerMap.js";
import { getTimeStr } from "../../../utils/mudHelpers.js";

export default function LocationModule({ zoneTheme, room, innerRoomName, time }) {
  return (
    <div>
      <div style={{ color: zoneTheme.accent, fontWeight: "bold", fontSize: "14px", marginBottom: 4, letterSpacing: "1px" }}>
        {room.name}
        {hasInnerMap(room.name) && innerRoomName && (
          <span style={{ color: zoneTheme.accentDim, fontWeight: "normal", fontSize: "11px", marginLeft: 6, letterSpacing: 0 }}>· {innerRoomName}</span>
        )}
      </div>
      <div style={{ color: zoneTheme.textDim, fontSize: "10.5px", marginBottom: 10 }}>{getTimeStr(time)}</div>
      <div style={{ color: zoneTheme.text, fontSize: "12px", marginBottom: 14, lineHeight: "var(--lh-narrative)" }}>{room.desc}</div>
    </div>
  );
}
