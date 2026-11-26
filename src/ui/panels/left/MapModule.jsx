import { hasInnerMap, getDistrictAnchor, getInnerRoom, visibleInnerExits } from "../../../domain/rules/map/innerMap.js";
import { QUCUO_MAP } from "../../../domain/data/map/qucuoMap.js";
import { blockedNoticeText, passableExits } from "../../../domain/rules/map/blockedNotice.js";
import { showNotice } from "../../../store/uiStore.js";
import { useSessionUi, setInteractMode, setMapView, setMapBig } from "../../../store/sessionUiStore.js";
import { DIRS } from "../../../utils/mudHelpers.js";
import NineGridMap from "../../components/NineGridMap.jsx";
import { Button } from "../../primitives/index.js";

export default function MapModule({ room, innerRoomName, questProgress, mapData, flags, autoTravelTo, act, inv, char, varTree }) {
  const loading = useSessionUi(s => s.loading);
  const mapView = useSessionUi(s => s.mapView);
  const mapBig = useSessionUi(s => s.mapBig);
  // 没有内景的据点（乡外新节点）只能看外图，否则内图视图下连「外/内」切换都没有
  const view = hasInnerMap(room.name) ? mapView : "outer";
  return (
    <div style={{ borderTop: `1px solid var(--border)`, padding: "6px 12px", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ color: "var(--accent-dim)", fontSize: "var(--fs-2xs)", cursor: "pointer" }} onClick={() => setMapBig(true)} title="点击放大">
          {view === "inner" ? "村图·内" : "舆图·外"} <span style={{ color: "var(--text-dim)" }}>⤢放大{view === "outer" ? " · 点已探明据点自动前往" : ""}</span>
        </span>
        {hasInnerMap(room.name) && (
          <span style={{ display: "flex", fontSize: "var(--fs-2xs)", flexShrink: 0 }}>
            {[["outer", "外"], ["inner", "内"]].map(([v, lb]) => (
              <Button variant="chrome" active={view === v} key={v} onClick={() => setMapView(v)}>{lb}</Button>
            ))}
          </span>
        )}
      </div>
      {view === "outer" && (() => {
        const exitByDir = QUCUO_MAP[room.name]?.exits || {};
        const passableExitByDir = passableExits(exitByDir, { layer: "outer", questProgress, flags });
        const DIRS8 = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
        const cells = {};
        for (const dir of DIRS8) {
          const dest = exitByDir[dir];
          const explored = !!(dest && mapData[dest]);
          cells[dir] = dest
            ? explored ? { explored: true, name: dest, dir } : { explored: false, dir }
            : QUCUO_MAP[room.name] ? { blocked: true, dir } : { explored: false, dir };
        }
        const go = (dir) => {
          if (loading) return;
          const dest = exitByDir[dir];
          if (dest && mapData[dest] && passableExitByDir[dir]) { autoTravelTo(dest); return; }
          setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "outer" });
        };
        return <NineGridMap centerLabel={room.name} cells={cells} onGo={go} accent={"var(--accent)"} textDim={"var(--text-dim)"} loading={loading} big={mapBig} />;
      })()}
      {view === "inner" && (() => {
        if (!hasInnerMap(room.name)) return <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)" }}>此地无内景可绘。</div>;
        const curRoom = innerRoomName || getDistrictAnchor(room.name);
        // 上锁的房间不出现在九宫格里（此前这里直接读裸 exits，锁着的安全屋照样是可点格子）
        const curExits = (curRoom && visibleInnerExits(room.name, curRoom, { questProgress, flags, inv, char, varTree })) || {};
        const passableExitByDir = passableExits(curExits, { layer: "inner", districtName: room.name, questProgress, flags, inv, char, varTree });
        const rawExits = getInnerRoom(room.name, curRoom)?.exits || {};
        const DIRS8 = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
        const cells = {};
        for (const dir of DIRS8) {
          const dest = curExits[dir];
          cells[dir] = dest ? { explored: true, name: dest, dir } : rawExits[dir] ? { explored: false, dir } : { blocked: true, dir };
        }
        const go = (dir) => {
          if (loading) return;
          if (curExits[dir]) { setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "inner" }); }
          else if (!rawExits[dir]) showNotice(blockedNoticeText(dir, passableExitByDir));
        };
        return <NineGridMap centerLabel={curRoom} cells={cells} onGo={go} accent={"var(--accent)"} textDim={"var(--text-dim)"} loading={loading} big={mapBig} />;
      })()}
    </div>
  );
}
