import { hasInnerMap, getDistrictAnchor, getInnerRoom, visibleInnerExits } from "../../../domain/rules/map/innerMap.js";
import { QUCUO_MAP } from "../../../domain/data/map/qucuoMap.js";
import { blockedNoticeText, passableExits } from "../../../domain/rules/map/blockedNotice.js";
import { showNotice } from "../../../store/uiStore.js";
import { useSessionUi, setInteractMode, setMapView, setMapBig } from "../../../store/sessionUiStore.js";
import { DIRS } from "../../../utils/mudHelpers.js";
import NineGridMap from "../../components/NineGridMap.jsx";

const DIRS8 = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

function renderOuterCells(roomName, mapData) {
  const exitByDir = QUCUO_MAP[roomName]?.exits || {};
  const cells = {};
  for (const dir of DIRS8) {
    const dest = exitByDir[dir];
    const explored = !!(dest && mapData[dest]);
    cells[dir] = dest
      ? explored ? { explored: true, name: dest, dir } : { explored: false, dir }
      : QUCUO_MAP[roomName] ? { blocked: true, dir } : { explored: false, dir };
  }
  return { exitByDir, cells };
}

function renderInnerCells(roomName, innerRoomName, ctx) {
  const curRoom = innerRoomName || getDistrictAnchor(roomName);
  // 上锁的房间不出现在九宫格里（此前这里直接读裸 exits，锁着的安全屋照样是可点格子）
  const curExits = (curRoom && visibleInnerExits(roomName, curRoom, ctx)) || {};
  const rawExits = getInnerRoom(roomName, curRoom)?.exits || {};
  const cells = {};
  for (const dir of DIRS8) {
    const dest = curExits[dir];
    cells[dir] = dest ? { explored: true, name: dest, dir } : rawExits[dir] ? { explored: false, dir } : { blocked: true, dir };
  }
  return { curRoom, curExits, rawExits, cells };
}

export default function MapModule({ room, innerRoomName, questProgress, mapData, flags, autoTravelTo, act, inv, char, varTree }) {
  const loading = useSessionUi(s => s.loading);
  const mapBig = useSessionUi(s => s.mapBig);
  const innerAvailable = hasInnerMap(room.name);

  const { exitByDir, cells: outerCells } = renderOuterCells(room.name, mapData);
  const outerPassable = passableExits(exitByDir, { layer: "outer", questProgress, flags });
  const goOuter = (dir) => {
    if (loading) return;
    const dest = exitByDir[dir];
    if (dest && mapData[dest] && outerPassable[dir]) { autoTravelTo(dest); return; }
    setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "outer" });
  };

  const innerState = innerAvailable
    ? renderInnerCells(room.name, innerRoomName, { questProgress, flags, inv, char, varTree })
    : null;
  const innerPassable = innerState
    ? passableExits(innerState.curExits, { layer: "inner", districtName: room.name, questProgress, flags, inv, char, varTree })
    : {};
  const goInner = (dir) => {
    if (loading || !innerState) return;
    if (innerState.curExits[dir]) { setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "inner" }); }
    else if (!innerState.rawExits[dir]) showNotice(blockedNoticeText(dir, innerPassable));
  };

  return (
    <div className="left-map-module">
      <div className="left-map-block">
        <div className="left-map-head">
          <span className="left-map-title" onClick={() => { setMapView("outer"); setMapBig(true); }} title="点击放大">
            舆图·外 <span className="left-map-hint">⤢放大 · 点已探明据点前往</span>
          </span>
        </div>
        <NineGridMap centerLabel={room.name} cells={outerCells} onGo={goOuter} loading={loading} big={mapBig} />
      </div>
      {innerState && (
        <div className="left-map-block">
          <div className="left-map-head">
            <span className="left-map-title" onClick={() => { setMapView("inner"); setMapBig(true); }} title="点击放大">
              村图·内 <span className="left-map-hint">⤢放大 · 点相邻房间前往</span>
            </span>
          </div>
          <NineGridMap centerLabel={innerState.curRoom} cells={innerState.cells} onGo={goInner} loading={loading} big={mapBig} />
        </div>
      )}
    </div>
  );
}
