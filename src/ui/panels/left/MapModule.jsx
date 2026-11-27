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

export function OuterMapModule({ room, questProgress, mapData, flags, autoTravelTo, act, onGoOuter }) {
  const loading = useSessionUi(s => s.loading);
  const mapBig = useSessionUi(s => s.mapBig);
  const { exitByDir, cells: outerCells } = renderOuterCells(room.name, mapData || {});
  const outerPassable = passableExits(exitByDir, { layer: "outer", questProgress, flags });
  const fallbackGo = (dir) => {
    if (loading) return;
    const dest = exitByDir[dir];
    if (dest && mapData?.[dest] && outerPassable[dir]) { autoTravelTo(dest); return; }
    setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "outer" });
  };
  return (
    <div className="left-map-module">
      <div className="left-map-block">
        <div className="left-map-head">
          <span className="left-map-title">舆图·外</span>
          <button type="button" className="left-map-zoom" onClick={() => { setMapView("outer"); setMapBig(true); }}>放大</button>
        </div>
        <NineGridMap centerLabel={room.name} cells={outerCells} onGo={onGoOuter || fallbackGo} loading={loading} big={mapBig} />
      </div>
    </div>
  );
}

export function InnerMapModule({ room, innerRoomName, questProgress, flags, act, inv, char, varTree }) {
  const loading = useSessionUi(s => s.loading);
  const mapBig = useSessionUi(s => s.mapBig);
  if (!hasInnerMap(room.name)) return null;
  const innerState = renderInnerCells(room.name, innerRoomName, { questProgress, flags, inv, char, varTree });
  const innerPassable = passableExits(innerState.curExits, { layer: "inner", districtName: room.name, questProgress, flags, inv, char, varTree });
  const goInner = (dir) => {
    if (loading) return;
    if (innerState.curExits[dir]) { setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "inner" }); }
    else if (!innerState.rawExits[dir]) showNotice(blockedNoticeText(dir, innerPassable));
  };
  return (
    <div className="left-map-module">
      <div className="left-map-block">
        <div className="left-map-head">
          <span className="left-map-title">村图·内</span>
          <button type="button" className="left-map-zoom" onClick={() => { setMapView("inner"); setMapBig(true); }}>放大</button>
        </div>
        <NineGridMap centerLabel={innerState.curRoom} cells={innerState.cells} onGo={goInner} loading={loading} big={mapBig} />
      </div>
    </div>
  );
}

export default function MapModule(props) {
  return (
    <>
      <OuterMapModule {...props} />
      <InnerMapModule {...props} />
    </>
  );
}
