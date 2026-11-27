import { getBuildingsForLocation, BUILDING_TYPE_LABEL } from "../../../domain/data/buildings/qucuoBuildings.js";
import { hasInnerMap, getBuildingIdForInnerRoom } from "../../../domain/rules/map/innerMap.js";
import { useSessionUi, setActiveBuilding } from "../../../store/sessionUiStore.js";
import { buildingArtUrl } from "../../art/art.js";

export function visibleBuildings(room, innerRoomName) {
  const all = getBuildingsForLocation(room.name);
  if (!hasInnerMap(room.name) || !innerRoomName) return all;
  const bid = getBuildingIdForInnerRoom(room.name, innerRoomName);
  return bid ? all.filter(b => b.id === bid) : [];
}

export default function BuildingsModule({ room, innerRoomName }) {
  const activeBuilding = useSessionUi(s => s.activeBuilding);
  const list = visibleBuildings(room, innerRoomName);

  return (
    <div className="left-buildings">
      <div className="panel-sec-label">此地建筑</div>
      {list.length > 0 ? (
        <div className="left-building-grid">
          {list.map(b => {
            const artSrc = buildingArtUrl(b);
            const isSelected = Boolean(activeBuilding?.id === b.id);
            const typeLabel = BUILDING_TYPE_LABEL[b.type];
            return (
              <button
                key={b.id}
                type="button"
                className={`left-building-card${list.length === 1 ? " is-single" : ""}`}
                data-on={isSelected}
                data-has-art={Boolean(artSrc)}
                onClick={() => setActiveBuilding(isSelected ? null : { ...b, district: room.name })}
              >
                {artSrc && (
                  <>
                    <img src={artSrc} alt={b.name} className="left-thumb-img" loading="lazy" decoding="async" />
                    <span className="left-thumb-scrim" aria-hidden="true" />
                  </>
                )}
                <span className="left-building-meta">
                  {typeLabel && <span className="left-building-type">{typeLabel}</span>}
                  <span className="left-building-name">{b.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="panel-empty-dim">此处暂无建筑</div>
      )}
    </div>
  );
}
