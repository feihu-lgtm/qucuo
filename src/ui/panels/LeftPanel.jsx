import { getHomestead } from "../../domain/rules/map/homestead.js";
import FacePanel from "../components/FacePanel.jsx";
import { VersionHistoryButton } from "./TopBar.jsx";
import LocationModule from "./left/LocationModule.jsx";
import ExitsModule from "./left/ExitsModule.jsx";
import HomesteadModule from "./left/HomesteadModule.jsx";
import BuildingsModule, { visibleBuildings } from "./left/BuildingsModule.jsx";
import NpcsModule from "./left/NpcsModule.jsx";
import MapModule from "./left/MapModule.jsx";
import { THEME_VARS } from "../../utils/theme.js";

const MODULES = { location: LocationModule, exits: ExitsModule, homestead: HomesteadModule, buildings: BuildingsModule, npcs: NpcsModule, map: MapModule };

export default function LeftPanel(props) {
  const { isMobile, mobileColumn, faces, zoneName, S, room, innerRoomName } = props;
  const isModuleVisible = id => {
    if (id === "homestead") return !!(innerRoomName && getHomestead(innerRoomName));
    if (id === "buildings") return visibleBuildings(room, innerRoomName).length > 0;
    return true;
  };
  const renderModule = id => {
    const Component = MODULES[id];
    return <Component {...props} />;
  };
  return (
    <div
      data-testid="left-panel"
      className={`left-panel-col${isMobile && mobileColumn !== "left" ? " mobile-col-hidden" : ""}`}
      data-mobile={Boolean(isMobile)}
    >
      <div className="panel-col-head">
        <span className="left-head-title">
          <span>天地</span>
          <span className="left-zone-tag">· {zoneName}</span>
        </span>
        <VersionHistoryButton theme={THEME_VARS} />
      </div>
      <FacePanel faces={faces} theme={THEME_VARS} label="天地" isMobile={isMobile}
        renderModule={renderModule} isModuleVisible={isModuleVisible} />
    </div>
  );
}
