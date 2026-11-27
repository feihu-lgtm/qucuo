import ClickableMap from "./ClickableMap.jsx";
import { QUCUO_MAP, isNodeUnlocked } from "../../domain/data/map/qucuoMap.js";
import {
  hasInnerMap, getDistrictAnchor, getInnerRoom, visibleInnerExits,
  getInnerRoomNames, isInnerExitUnlocked,
} from "../../domain/rules/map/innerMap.js";
import { DIRS } from "../../utils/mudHelpers.js";
import { mapArtUrl } from "../art/art.js";
import { useGameStore } from "../../store/gameStore.js";
import { useSessionUi, setInteractMode, setMapBig } from "../../store/sessionUiStore.js";
import ModalShell from "../primitives/ModalShell.jsx";

export default function BigMapModal({  act, autoTravelTo,
}) {
  const loading = useSessionUi(s => s.loading);
  const mapView = useSessionUi(s => s.mapView);
  const room = useGameStore(s => s.room);
  const innerRoomName = useGameStore(s => s.innerRoomName);
  const mapData = useGameStore(s => s.mapData);
  const questProgress = useGameStore(s => s.questProgress);
  const flags = useGameStore(s => s.flags);
  const inv = useGameStore(s => s.inv);
  const char = useGameStore(s => s.char);
  const varTree = useGameStore(s => s.varTree);
  const view = hasInnerMap(room.name) ? mapView : "outer";

  // chrome={false} 去掉外壳默认面板样式，面板底色与描边在下面自己给；手机上原本就不全屏，保持 mobile="none"。
  return (
    <ModalShell
      onClose={() => setMapBig(false)}
      layer="map"
      mobile="none"
      chrome={false}
      showClose={false}
      ariaLabel="大地图"
      panelStyle={{
        // 夜色精修：撤掉卷轴贴图。外层视图有舆图底卷（M01）就铺在节点底下，没有就是纯夜色底，节点与连线由代码画。
        background: view === "outer" && mapArtUrl()
          ? `var(--bg) url("${mapArtUrl()}") center/cover no-repeat`
          : "var(--bg)",
        border: "1px solid var(--border)",
        minWidth: 300, width: "70vw", maxWidth: 980, maxHeight: "86vh", overflowY: "auto",
        padding: "18px 22px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ color: "var(--map-title-text)", fontSize: "var(--fs-md)", fontWeight: "bold" }}>
          {view === "inner" ? `村图·${room.name}内景全图` : "舆图·曲措乡全境"}{" "}
          <span style={{ color: "var(--map-path)", fontSize: "var(--fs-2xs)", fontWeight: "normal" }}>
            {view === "inner" ? "朱红为当前所在 · 点相邻房间前往" : "朱红为当前所在 · 点已探明据点自动前往 · 🔒需前置"}
          </span>
        </span>
        <span role="button" style={{ color: "var(--codex-desc)", fontSize: "var(--fs-xs)", cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap", minWidth: 56, flexShrink: 0, padding: "15px 0", margin: "-15px 0" }} onClick={() => setMapBig(false)}>× 关闭</span>
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
        return <ClickableMap nodes={nodes} onGo={go} accent={"var(--accent)"} loading={loading} maxHeight="66vh" />;
      })()}
      {view === "inner" && (() => {
        if (!hasInnerMap(room.name)) return <div style={{ color: "var(--text-dim)" }}>此地无内景可绘。</div>;
        const curRoom = innerRoomName || getDistrictAnchor(room.name);
        const curExits = visibleInnerExits(room.name, curRoom, { questProgress, flags, inv, char, varTree });
        const adjacent = new Set(Object.values(curExits));
        const nodes = getInnerRoomNames(room.name).filter((rn) => {
          const rr = getInnerRoom(room.name, rn);
          return !rr?.unlockCondition || rr.unlockCondition.type === "stat" || isInnerExitUnlocked(rr.unlockCondition, { questProgress, flags, inv, char, varTree });
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
    </ModalShell>
  );
}
