import { getBuildingsForLocation, BUILDING_TYPE_LABEL } from "../../../domain/data/buildings/qucuoBuildings.js";
import { hasInnerMap, getBuildingIdForInnerRoom } from "../../../domain/rules/map/innerMap.js";
import { chromeBtn } from "../../../utils/theme.js";
import { useSessionUi, setActiveBuilding } from "../../../store/sessionUiStore.js";

export function visibleBuildings(room, innerRoomName) {
  const all = getBuildingsForLocation(room.name);
  if (!hasInnerMap(room.name) || !innerRoomName) return all;
  const bid = getBuildingIdForInnerRoom(room.name, innerRoomName);
  return bid ? all.filter(b => b.id === bid) : [];
}

export default function BuildingsModule({ zoneTheme, room, innerRoomName }) {
  const activeBuilding = useSessionUi(s => s.activeBuilding);
  const list = visibleBuildings(room, innerRoomName);
  if (!list.length) return null;
  return <div>
    <div style={{ color: zoneTheme.accentDim, fontSize: "10.5px", marginBottom: 5 }}>此地建筑</div>
    {list.map(b => <div key={b.id} style={{ marginBottom: 3 }}>
      <button type="button" onClick={() => setActiveBuilding(activeBuilding?.id === b.id ? null : { ...b, district: room.name })} style={chromeBtn(zoneTheme, { active: activeBuilding?.id === b.id })}>{b.name}</button>
      <span style={{ color: zoneTheme.textDim, fontSize: "10.5px", marginLeft: 6 }}>{BUILDING_TYPE_LABEL[b.type] || ""}</span>
    </div>)}
  </div>;
}
