import ClickableMap from "./ClickableMap.jsx";
import { QUCUO_MAP, isNodeUnlocked } from "../../domain/data/map/qucuoMap.js";
import {
  hasInnerMap, getDistrictAnchor, getInnerRoom, visibleInnerExits,
  getInnerRoomNames, isInnerExitUnlocked,
} from "../../domain/rules/map/innerMap.js";
import { DIRS } from "../../utils/mudHelpers.js";
import { MAP_UI } from "../mapUi.js";
import { useGameStore } from "../../store/gameStore.js";

export default function BigMapModal({
  mapView, setMapBig, mapBigCloseGuard, zoneTheme, loading, setInteractMode, act, autoTravelTo,
}) {
  const room = useGameStore(s => s.room);
  const innerRoomName = useGameStore(s => s.innerRoomName);
  const mapData = useGameStore(s => s.mapData);
  const questProgress = useGameStore(s => s.questProgress);
  const flags = useGameStore(s => s.flags);
  const inv = useGameStore(s => s.inv);
  const char = useGameStore(s => s.char);
  const view = hasInnerMap(room.name) ? mapView : "outer";

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(4,4,10,0.92)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={mapBigCloseGuard.onMouseDown}
      onClick={mapBigCloseGuard.onClick}
    >
      <div
        style={{
          background: `url("${MAP_UI.scroll}") center/100% 100% no-repeat`,
          borderRadius: 0, minWidth: 300, width: "70vw", maxWidth: 980, maxHeight: "86vh", overflowY: "auto",
          padding: "14% 11% 9% 11%", boxSizing: "border-box",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: "#4a3520", fontSize: "13px", fontWeight: "bold" }}>
            {view === "inner" ? `村图·${room.name}内景全图` : "舆图·曲措乡全境"}{" "}
            <span style={{ color: "#7a6448", fontSize: "10px", fontWeight: "normal" }}>
              {view === "inner" ? "朱红为当前所在 · 点相邻房间前往" : "朱红为当前所在 · 点已探明据点自动前往 · 🔒需前置"}
            </span>
          </span>
          <span style={{ color: "#6a4a2a", fontSize: "11px", cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap", minWidth: 56, flexShrink: 0 }} onClick={() => setMapBig(false)}>× 关闭</span>
        </div>
        {view === "outer" && (() => {
          const completed = new Set(Object.entries(questProgress || {}).filter(([, p]) => p?.status === "completed" || p?.done).map(([id]) => id));
          const exitByDir = QUCUO_MAP[room.name]?.exits || {};
          const reachableDests = new Set(Object.values(exitByDir));
          const explored = new Set(Object.keys(mapData || {}));
          explored.add(room.name);
          const nodes = Object.entries(QUCUO_MAP)
            .filter(([name]) => explored.has(name))
            .map(([name, node]) => {
              const dirTo = Object.entries(exitByDir).find(([, d]) => d === name)?.[0] || null;
              const unlocked = isNodeUnlocked(name, { completedQuests: completed, flags });
              return {
                name, x: node.x, y: node.y, explored: true,
                current: name === room.name,
                links: Object.values(node.exits || {}).filter(d => explored.has(d)),
                reachable: name !== room.name && unlocked,
                locked: reachableDests.has(name) && !unlocked,
                dir: dirTo, dest: name,
              };
            });
          const go = (dir, dest, locked) => {
            if (loading) return;
            setMapBig(false);
            if (locked) { setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "outer" }); return; }
            if (dest && mapData[dest] && dest !== room.name) { autoTravelTo(dest); return; }
            if (dir) { setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "outer" }); }
          };
          return <ClickableMap nodes={nodes} onGo={go} accent={zoneTheme.accent} loading={loading} maxHeight="66vh" />;
        })()}
        {view === "inner" && (() => {
          if (!hasInnerMap(room.name)) return <div style={{ color: zoneTheme.textDim }}>此地无内景可绘。</div>;
          const curRoom = innerRoomName || getDistrictAnchor(room.name);
          const curExits = visibleInnerExits(room.name, curRoom, { questProgress, flags, inv, char });
          const adjacent = new Set(Object.values(curExits));
          const nodes = getInnerRoomNames(room.name).filter((rn) => {
            const rr = getInnerRoom(room.name, rn);
            return !rr?.unlockCondition || rr.unlockCondition.type === "stat" || isInnerExitUnlocked(rr.unlockCondition, { questProgress, flags, inv, char });
          }).map((rn) => {
            const r = getInnerRoom(room.name, rn) || {};
            const dirTo = Object.entries(curExits).find(([, d]) => d === rn)?.[0] || null;
            return {
              name: rn, x: r.x ?? 0, y: r.y ?? 0, explored: true,
              current: rn === curRoom,
              links: Object.values(r.exits || {}).filter(d => typeof d === "string"),
              reachable: adjacent.has(rn),
              dir: dirTo, dest: rn,
            };
          });
          const go = (dir) => { if (!loading && dir) { setMapBig(false); setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "inner" }); } };
          return <ClickableMap nodes={nodes} onGo={go} accent="var(--clay)" loading={loading} maxHeight="66vh" />;
        })()}
      </div>
    </div>
  );
}
