import FacePanel from "../components/FacePanel.jsx";
import { uiStore } from "../../store/uiStore.js";
import { unlockedCompanions } from "../../domain/rules/companion/companion.js";
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
import QuestModule from "./right/QuestModule.jsx";

const MODULES = {
  profile: ProfileModule, equipmentBonus: EquipmentBonusModule, attributes: AttributesModule,
  team: TeamModule, skills: SkillsModule, combatMoves: CombatMovesModule,
  equipment: EquipmentModule, inventory: InventoryModule, narrator: NarratorModule, jianghu: JianghuModule,
  quest: QuestModule,
};

const isKeyboardBlocked = () => uiStore.getState().overlays.length > 0;

export default function RightPanel(props) {
  const { isMobile, mobileColumn, faces, zoneTheme, S, companionState, char } = props;
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
    <div data-testid="right-panel" style={isMobile
      ? { ...S.panel, flex: 1, minHeight: 0, borderRight: "none", display: mobileColumn === "right" ? "flex" : "none" }
      : { flex: 30, ...S.panel, borderRight: "none", minHeight: 0 }}>
      <div style={S.label}>侠客</div>
      <FacePanel faces={faces} theme={zoneTheme} label="侠客" isMobile={isMobile}
        renderModule={renderModule} isModuleVisible={isModuleVisible} isKeyboardBlocked={isKeyboardBlocked} />
    </div>
  );
}
