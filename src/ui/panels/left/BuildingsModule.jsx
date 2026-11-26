import { getBuildingsForLocation, BUILDING_TYPE_LABEL } from "../../../domain/data/buildings/qucuoBuildings.js";
import { hasInnerMap, getBuildingIdForInnerRoom } from "../../../domain/rules/map/innerMap.js";
import { useSessionUi, setActiveBuilding } from "../../../store/sessionUiStore.js";
import { Button } from "../../primitives/index.js";

export function visibleBuildings(room, innerRoomName) {
  const all = getBuildingsForLocation(room.name);
  if (!hasInnerMap(room.name) || !innerRoomName) return all;
  const bid = getBuildingIdForInnerRoom(room.name, innerRoomName);
  return bid ? all.filter(b => b.id === bid) : [];
}

export default function BuildingsModule({ room, innerRoomName }) {
  const activeBuilding = useSessionUi(s => s.activeBuilding);
  const list = visibleBuildings(room, innerRoomName);
  if (!list.length) return null;
  return <div>
    <div style={{ color: "var(--accent-dim)", fontSize: "var(--fs-xs)", marginBottom: 5 }}>此地建筑</div>
    {list.map(b => <div key={b.id} style={{ marginBottom: 3 }}>
      <Button variant="chrome" font="native" active={activeBuilding?.id === b.id} type="button" onClick={() => setActiveBuilding(activeBuilding?.id === b.id ? null : { ...b, district: room.name })}>{b.name}</Button>
      <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", marginLeft: 6 }}>{BUILDING_TYPE_LABEL[b.type] || ""}</span>
    </div>)}
  </div>;
}
