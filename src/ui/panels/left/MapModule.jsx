import { hasInnerMap, getDistrictAnchor, getInnerRoom, visibleInnerExits } from "../../../domain/map/innerMap.js";
import { QUCUO_MAP, isNodeUnlocked } from "../../../domain/map/qucuoMap.js";
import { blockedNoticeText } from "../../../domain/map/blockedNotice.js";
import { showNotice } from "../../../store/uiStore.js";
import { DIRS } from "../../../utils/mudHelpers.js";
import NineGridMap from "../../components/NineGridMap.jsx";
import { chromeBtn } from "../../theme.js";

export default function MapModule({ zoneTheme, room, innerRoomName, mapView, setMapView, mapBig, setMapBig, questProgress, mapData, loading, flags, autoTravelTo, setInteractMode, act, inv, char }) {
  return (
    <div style={{ borderTop: `1px solid ${zoneTheme.border}`, padding: "6px 12px", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ color: zoneTheme.accentDim, fontSize: "10px", cursor: "pointer" }} onClick={() => setMapBig(true)} title="点击放大">
          {mapView === "inner" ? "村图·内" : "舆图·外"} <span style={{ color: zoneTheme.textDim }}>⤢放大{mapView === "outer" ? " · 点已探明据点自动前往" : ""}</span>
        </span>
        {hasInnerMap(room.name) && (
          <span style={{ display: "flex", fontSize: "9.5px", flexShrink: 0 }}>
            {[["outer", "外"], ["inner", "内"]].map(([v, lb]) => (
              <span key={v} onClick={() => setMapView(v)}
                style={chromeBtn(zoneTheme, { active: mapView === v })}>{lb}</span>
            ))}
          </span>
        )}
      </div>
      {mapView === "outer" && (() => {
        const exitByDir = QUCUO_MAP[room.name]?.exits || {};
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
          const completed = new Set(Object.entries(questProgress || {}).filter(([, p]) => p?.status === "completed" || p?.done).map(([id]) => id));
          if (dest && mapData[dest] && isNodeUnlocked(dest, { completedQuests: completed, flags })) { autoTravelTo(dest); return; }
          setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "outer" });
        };
        return <NineGridMap centerLabel={room.name} cells={cells} onGo={go} accent={zoneTheme.accent} textDim={zoneTheme.textDim} loading={loading} big={mapBig} />;
      })()}
      {mapView === "inner" && (() => {
        if (!hasInnerMap(room.name)) return <div style={{ color: zoneTheme.textDim, fontSize: "10px" }}>此地无内景可绘。</div>;
        const curRoom = innerRoomName || getDistrictAnchor(room.name);
        // 上锁的房间不出现在九宫格里（此前这里直接读裸 exits，锁着的安全屋照样是可点格子）
        const curExits = (curRoom && visibleInnerExits(room.name, curRoom, { questProgress, flags, inv, char })) || {};
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
          else if (!rawExits[dir]) showNotice(blockedNoticeText(dir, curExits));
        };
        return <NineGridMap centerLabel={curRoom} cells={cells} onGo={go} accent={zoneTheme.accent} textDim={zoneTheme.textDim} loading={loading} big={mapBig} />;
      })()}
    </div>
  );
}
