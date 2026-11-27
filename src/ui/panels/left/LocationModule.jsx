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
  // 小图固定用外层据点图，与江湖栏进场横幅同一张、同一构图；内层走动不换图（理由见 ui/art/art.js）。
  const artSrc = placeArtUrl(room.name);
  return (
    <div className="left-location">
      {artSrc && (
        <div className="left-location-art">
          <ArtImage key={artSrc} src={artSrc} alt={room.name} variant="thumb" />
        </div>
      )}
      <div className="left-location-name">
        <span className="left-location-tag">外层</span>{room.name}
      </div>
      {inner && (
        <div className="left-location-inner">
          <span className="left-location-tag">内层</span>{inner}
          {isAnchor && <span className="left-location-anchor">（进出口）</span>}
        </div>
      )}
      <div className="left-location-clock">
        <div>游戏 {getTimeStr(time)} · 第{time}回合</div>
        <div>现实 <LiveClockText /></div>
      </div>
      <div className="left-location-desc">{innerRoom?.desc || room.desc}</div>
    </div>
  );
}
