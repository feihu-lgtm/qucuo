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
  return (
    <div className="left-buildings">
      <div className="panel-sec-label">此地建筑</div>
      <div className="left-building-list">
        {list.map(b => (
          <button
            key={b.id}
            type="button"
            className="chip-btn"
            data-on={Boolean(activeBuilding?.id === b.id)}
            onClick={() => setActiveBuilding(activeBuilding?.id === b.id ? null : { ...b, district: room.name })}
          >
            <span>{b.name}</span>
            {BUILDING_TYPE_LABEL[b.type] && <span className="chip-btn-sub">{BUILDING_TYPE_LABEL[b.type]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
