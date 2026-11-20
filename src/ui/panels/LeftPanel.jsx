import { getHomestead } from "../../domain/map/homestead.js";
import FacePanel from "../components/FacePanel.jsx";
import useFaces from "../components/faces/useFaces.js";
import { VersionHistoryButton } from "./TopBar.jsx";
import LocationModule from "./left/LocationModule.jsx";
import ExitsModule from "./left/ExitsModule.jsx";
import HomesteadModule from "./left/HomesteadModule.jsx";
import BuildingsModule, { visibleBuildings } from "./left/BuildingsModule.jsx";
import NpcsModule from "./left/NpcsModule.jsx";
import MapModule from "./left/MapModule.jsx";
import { LEFT_FACE_PREF_KEY, LEFT_MODULES, LEFT_FACE_DEFAULTS } from "./left/leftFaces.js";

const MODULES = { location: LocationModule, exits: ExitsModule, homestead: HomesteadModule, buildings: BuildingsModule, npcs: NpcsModule, map: MapModule };

export default function LeftPanel(props) {
  const { isMobile, mobileDrawer, setMobileDrawer, zoneTheme, S, room, innerRoomName } = props;
  const faces = useFaces(LEFT_FACE_PREF_KEY, LEFT_FACE_DEFAULTS, {
    availableModules: LEFT_MODULES, editable: false, enableKeyboard: false,
  });
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
    <div data-testid="left-panel" className={isMobile ? "mobile-drawer-panel" : undefined} style={isMobile
      ? { position: "fixed", top: 0, bottom: 0, left: 0, width: "82vw", maxWidth: 340, zIndex: 41,
          transform: mobileDrawer === "left" ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .28s ease", boxShadow: mobileDrawer === "left" ? "4px 0 24px rgba(0,0,0,.6)" : "none",
          background: zoneTheme.bg, display: "flex", flexDirection: "column", overflow: "hidden" }
      : { flex: 25, ...S.panel, minHeight: 0 }}>
      {isMobile && (
        <div className="mobile-drawer-close" onClick={() => setMobileDrawer(null)} style={{ textAlign: "right", padding: "8px 12px", color: zoneTheme.textDim, cursor: "pointer", fontSize: "13px", flexShrink: 0 }}>关闭 ✕</div>
      )}
      <div style={{ ...S.label, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>天地 <span style={{ fontSize: "9.5px", color: zoneTheme.textDim, letterSpacing: "1px" }}>· {zoneTheme.name}</span><VersionHistoryButton theme={zoneTheme} /></div>
      <FacePanel faces={faces} theme={zoneTheme} label="天地" isMobile={isMobile}
        renderModule={renderModule} isModuleVisible={isModuleVisible} />
    </div>
  );
}
