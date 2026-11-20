import { useCallback, useRef, useState } from "react";
import { chromeBtn } from "../theme.js";
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
import FaceEditor from "./right/FaceEditor.jsx";
import FaceContent from "./right/FaceContent.jsx";
import useFacePreferences from "./right/useFacePreferences.js";
import useFaceNavigation from "./right/useFaceNavigation.js";
import { rotateFace } from "./right/facePreferences.js";
import "./right/rightFaces.css";

const MODULES = {
  profile: ProfileModule, equipmentBonus: EquipmentBonusModule, attributes: AttributesModule,
  team: TeamModule, skills: SkillsModule, combatMoves: CombatMovesModule,
  equipment: EquipmentModule, inventory: InventoryModule, narrator: NarratorModule,
};

export default function RightPanel(props) {
  const { isMobile, mobileDrawer, setMobileDrawer, zoneTheme, S, companionState, char } = props;
  const [preferences, setPreferences] = useFacePreferences();
  const [editing, setEditing] = useState(false);
  const [direction, setDirection] = useState(1);
  const contentRef = useRef(null);
  const rotate = useCallback(delta => {
    setDirection(delta);
    setPreferences(state => rotateFace(state, delta));
  }, [setPreferences]);
  useFaceNavigation({ isMobile, editing, contentRef, rotate });
  const face = preferences.faces[preferences.currentIndex];
  const modules = face.modules.filter(id => {
    if (id === "team") return unlockedCompanions(companionState).length > 0;
    if (id === "combatMoves") return (char.moveset || []).some(move => !move.sourceSkill);
    return true;
  }).map(id => ({ id, Component: MODULES[id] }));
  const selectFace = index => {
    setDirection(index < preferences.currentIndex ? -1 : 1);
    setPreferences(state => ({ ...state, currentIndex: index }));
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
      <nav className="right-face-bar" aria-label="侠客面切换" style={{ borderColor: zoneTheme.border }}>
        <div className="right-face-tabs" role="tablist" aria-label="侠客各面">
          {preferences.faces.map((item, index) => (
            <button key={item.id} type="button" role="tab" aria-selected={index === preferences.currentIndex}
              aria-controls={`right-face-${item.id}`} style={chromeBtn(zoneTheme, { active: index === preferences.currentIndex })}
              onClick={() => selectFace(index)}>{item.name || "未命名"}</button>
          ))}
        </div>
        <button type="button" aria-label="上一面" style={chromeBtn(zoneTheme)} onClick={() => rotate(-1)}>◀</button>
        <button type="button" aria-label="下一面" style={chromeBtn(zoneTheme)} onClick={() => rotate(1)}>▶</button>
        <button type="button" aria-expanded={editing} style={chromeBtn(zoneTheme, { active: editing })}
          onClick={() => setEditing(value => !value)}>编排</button>
      </nav>
      {editing && <FaceEditor preferences={preferences} setPreferences={setPreferences} theme={zoneTheme} />}
      <div className="right-face-stage" ref={contentRef}>
        <FaceContent key={face.id} face={face} direction={direction} modules={modules} moduleProps={props} />
      </div>
    </div>
  );
}
