import { getHomestead } from "../../domain/rules/map/homestead.js";
import FacePanel from "../components/FacePanel.jsx";
import { VersionHistoryButton } from "./TopBar.jsx";
import LocationModule from "./left/LocationModule.jsx";
import ExitsModule from "./left/ExitsModule.jsx";
import HomesteadModule from "./left/HomesteadModule.jsx";
import BuildingsModule, { visibleBuildings } from "./left/BuildingsModule.jsx";
import NpcsModule from "./left/NpcsModule.jsx";
import MapModule from "./left/MapModule.jsx";

const MODULES = { location: LocationModule, exits: ExitsModule, homestead: HomesteadModule, buildings: BuildingsModule, npcs: NpcsModule, map: MapModule };

export default function LeftPanel(props) {
  const { isMobile, mobileColumn, faces, zoneTheme, zoneName, S, room, innerRoomName } = props;
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
    <div data-testid="left-panel" style={isMobile
      ? { ...S.panel, flex: 1, minHeight: 0, borderRight: "none", display: mobileColumn === "left" ? "flex" : "none" }
      : { flex: 25, ...S.panel, minHeight: 0 }}>
      <div style={{ ...S.label, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>天地 <span style={{ fontSize: "var(--fs-2xs)", color: zoneTheme.textDim, letterSpacing: "1px" }}>· {zoneName}</span><VersionHistoryButton theme={zoneTheme} /></div>
      <FacePanel faces={faces} theme={zoneTheme} label="天地" isMobile={isMobile}
        renderModule={renderModule} isModuleVisible={isModuleVisible} />
    </div>
  );
}
