import { getHomestead } from "../../domain/rules/map/homestead.js";
import { hasInnerMap } from "../../domain/rules/map/innerMap.js";
import { passableExits } from "../../domain/rules/map/blockedNotice.js";
import { QUCUO_MAP } from "../../domain/data/map/qucuoMap.js";
import { useSessionUi, setInteractMode } from "../../store/sessionUiStore.js";
import { DIRS } from "../../utils/mudHelpers.js";
import FacePanel from "../components/FacePanel.jsx";
import LocationModule from "./left/LocationModule.jsx";
import ExitsModule from "./left/ExitsModule.jsx";
import HomesteadModule from "./left/HomesteadModule.jsx";
import BuildingsModule, { visibleBuildings } from "./left/BuildingsModule.jsx";
import NpcsModule from "./left/NpcsModule.jsx";
import MapModule, { OuterMapModule, InnerMapModule } from "./left/MapModule.jsx";
import { THEME_VARS } from "../../utils/theme.js";

const MODULES = {
  location: LocationModule,
  exits: ExitsModule,
  outerMap: OuterMapModule,
  buildings: BuildingsModule,
  homestead: HomesteadModule,
  innerMap: InnerMapModule,
  npcs: NpcsModule,
  map: MapModule,
};

export default function LeftPanel(props) {
  const { isMobile, mobileColumn, faces, room, innerRoomName, mapData, questProgress, flags, autoTravelTo, act } = props;
  const loading = useSessionUi(s => s.loading);
  const exitByDir = QUCUO_MAP[room.name]?.exits || {};
  const outerPassable = passableExits(exitByDir, { layer: "outer", questProgress, flags });

  const onGoOuter = (dir) => {
    if (loading) return;
    const dest = exitByDir[dir];
    if (dest && mapData?.[dest] && outerPassable[dir]) {
      autoTravelTo?.(dest);
      return;
    }
    setInteractMode("action");
    act?.(DIRS[dir] || dir, [], { forceLayer: "outer" });
  };

  const isModuleVisible = id => {
    if (id === "homestead") return !!(innerRoomName && getHomestead(innerRoomName));
    if (id === "buildings") return visibleBuildings(room, innerRoomName).length > 0 || hasInnerMap(room.name) || !(innerRoomName && getHomestead(innerRoomName));
    if (id === "innerMap") return hasInnerMap(room.name);
    return true;
  };
  const renderModule = id => {
    const Component = MODULES[id];
    return <Component {...props} loading={loading} onGoOuter={onGoOuter} />;
  };
  return (
    <div
      data-testid="left-panel"
      className={`left-panel-col${isMobile && mobileColumn !== "left" ? " mobile-col-hidden" : ""}`}
      data-mobile={Boolean(isMobile)}
    >
      <FacePanel faces={faces} theme={THEME_VARS} label="天地" isMobile={isMobile}
        renderModule={renderModule} isModuleVisible={isModuleVisible} />
    </div>
  );
}
