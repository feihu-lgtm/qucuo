import FacePanel from "../components/FacePanel.jsx";
import useFaces from "../components/faces/useFaces.js";
import { uiStore } from "../../store/uiStore.js";
import { unlockedCompanions } from "../../domain/companion/companion.js";
import ProfileModule from "./right/ProfileModule.jsx";
import EquipmentBonusModule from "./right/EquipmentBonusModule.jsx";
import AttributesModule from "./right/AttributesModule.jsx";
import TeamModule from "./right/TeamModule.jsx";
import SkillsModule from "./right/SkillsModule.jsx";
import CombatMovesModule from "./right/CombatMovesModule.jsx";
import EquipmentModule from "./right/EquipmentModule.jsx";
import InventoryModule from "./right/InventoryModule.jsx";
import NarratorModule from "./right/NarratorModule.jsx";
import JianghuModule from "./right/JianghuModule.jsx";
import { FACE_PREF_KEY, RIGHT_MODULES, RIGHT_FACE_DEFAULTS } from "./right/rightFaces.js";

const MODULES = {
  profile: ProfileModule, equipmentBonus: EquipmentBonusModule, attributes: AttributesModule,
  team: TeamModule, skills: SkillsModule, combatMoves: CombatMovesModule,
  equipment: EquipmentModule, inventory: InventoryModule, narrator: NarratorModule, jianghu: JianghuModule,
};

const isKeyboardBlocked = () => uiStore.getState().overlays.length > 0;

export default function RightPanel(props) {
  const { isMobile, mobileDrawer, setMobileDrawer, zoneTheme, S, companionState, char } = props;
  const faces = useFaces(FACE_PREF_KEY, RIGHT_FACE_DEFAULTS, { availableModules: RIGHT_MODULES, enableKeyboard: true });
  const isModuleVisible = id => {
    if (id === "team") return unlockedCompanions(companionState).length > 0;
    if (id === "combatMoves") return (char.moveset || []).some(move => !move.sourceSkill);
    return true;
  };
  const renderModule = id => {
    const Component = MODULES[id];
    return <Component {...props} />;
  };
  return (
    <div data-testid="right-panel" className={isMobile ? "mobile-drawer-panel" : undefined} style={isMobile
      ? { position: "fixed", top: 0, bottom: 0, right: 0, width: "82vw", maxWidth: 340, zIndex: 41,
          transform: mobileDrawer === "right" ? "translateX(0)" : "translateX(100%)",
          transition: "transform .28s ease", boxShadow: mobileDrawer === "right" ? "-4px 0 24px rgba(0,0,0,.6)" : "none",
          background: zoneTheme.bg, display: "flex", flexDirection: "column", overflow: "hidden" }
      : { flex: 30, ...S.panel, borderRight: "none", minHeight: 0 }}>
      {isMobile && (
        <div className="mobile-drawer-close" onClick={() => setMobileDrawer(null)} style={{ padding: "8px 12px", color: zoneTheme.textDim, cursor: "pointer", fontSize: "13px", flexShrink: 0 }}>✕ 关闭</div>
      )}
      <div style={S.label}>侠客</div>
      <FacePanel faces={faces} theme={zoneTheme} label="侠客" isMobile={isMobile}
        renderModule={renderModule} isModuleVisible={isModuleVisible} isKeyboardBlocked={isKeyboardBlocked} />
    </div>
  );
}
