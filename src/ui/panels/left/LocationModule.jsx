import { getDistrictAnchor, getInnerRoom, hasInnerMap } from "../../../domain/rules/map/innerMap.js";
import { getTimeStr } from "../../../utils/mudHelpers.js";

// 左栏位置：外层据点与内层房间分两行写清，描写取此刻所在的内层房间。
// 此前只在据点名后面挂一个小字「· 房间」，描写却是外层据点的，玩家分不清自己在哪。
export default function LocationModule({ zoneTheme, room, innerRoomName, time }) {
  const inner = hasInnerMap(room.name) && innerRoomName ? innerRoomName : null;
  const innerRoom = inner ? getInnerRoom(room.name, inner) : null;
  const isAnchor = inner && inner === getDistrictAnchor(room.name);
  const label = { color: zoneTheme.textDim, fontSize: "var(--fs-xs)", fontWeight: "normal", marginRight: 6, letterSpacing: 0 };
  return (
    <div>
      <div style={{ color: zoneTheme.accent, fontWeight: "bold", fontSize: "var(--fs-base)", marginBottom: 2, letterSpacing: "1px" }}>
        <span style={label}>外层</span>{room.name}
      </div>
      {inner && (
        <div style={{ color: zoneTheme.accent, fontSize: "var(--fs-md)", marginBottom: 4, letterSpacing: "1px" }}>
          <span style={label}>内层</span>{inner}
          {isAnchor && <span style={{ ...label, marginLeft: 6 }}>（进出口）</span>}
        </div>
      )}
      <div style={{ color: zoneTheme.textDim, fontSize: "10.5px", marginBottom: 10 }}>{getTimeStr(time)}</div>
      <div style={{ color: zoneTheme.text, fontSize: "12px", marginBottom: 14, lineHeight: "var(--lh-narrative)" }}>{innerRoom?.desc || room.desc}</div>
    </div>
  );
}
