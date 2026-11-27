import { getDistrictAnchor, getInnerRoom, hasInnerMap } from "../../../domain/rules/map/innerMap.js";
import { getTimeStr } from "../../../utils/mudHelpers.js";
import LiveClockText from "../../components/LiveClockText.jsx";
import ArtImage from "../../components/ArtImage.jsx";
import { placeArtUrl } from "../../art/art.js";

// 左栏位置：外层据点与内层房间分两行写清，描写取此刻所在的内层房间。
// 此前只在据点名后面挂一个小字「· 房间」，描写却是外层据点的，玩家分不清自己在哪。
export default function LocationModule({ room, innerRoomName, time }) {
  const inner = hasInnerMap(room.name) && innerRoomName ? innerRoomName : null;
  const innerRoom = inner ? getInnerRoom(room.name, inner) : null;
  const isAnchor = inner && inner === getDistrictAnchor(room.name);
  const label = { color: "var(--text-dim)", fontSize: "var(--fs-xs)", fontWeight: "normal", marginRight: 6, letterSpacing: 0 };
  // 小图固定用外层据点图，与江湖栏进场横幅同一张、同一构图；内层走动不换图（理由见 ui/art/art.js）。
  const artSrc = placeArtUrl(room.name);
  return (
    <div>
      {artSrc && (
        <div className="left-location-art">
          <ArtImage src={artSrc} alt={room.name} variant="thumb" />
        </div>
      )}
      <div style={{ color: "var(--text)", fontWeight: "bold", fontSize: "var(--fs-base)", marginBottom: 2, letterSpacing: "1px" }}>
        <span style={label}>外层</span>{room.name}
      </div>
      {inner && (
        <div style={{ color: "var(--text)", fontSize: "var(--fs-md)", marginBottom: 4, letterSpacing: "1px" }}>
          <span style={label}>内层</span>{inner}
          {isAnchor && <span style={{ ...label, marginLeft: 6 }}>（进出口）</span>}
        </div>
      )}
      <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", lineHeight: 1.5, marginBottom: 10 }}>
        <div>游戏 {getTimeStr(time)} · 第{time}回合</div>
        <div>现实 <LiveClockText /></div>
      </div>
      <div style={{ color: "var(--text)", fontSize: "var(--fs-sm)", marginBottom: 14, lineHeight: "var(--lh-narrative)" }}>{innerRoom?.desc || room.desc}</div>
    </div>
  );
}
