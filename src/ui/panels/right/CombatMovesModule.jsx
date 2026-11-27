import { QUALITY_COLOR } from "../../../domain/data/items/qualityColor.js";
import { Icon } from "../../primitives/index.js";

export default function CombatMovesModule({ char, inspectItem, inspecting }) {
  const extras = (char.moveset || []).filter(m => !m.sourceSkill);
  if (!extras.length) return null;
  return (
    <div className="right-section">
      <div className="panel-sec-label">
        <Icon name="临阵招式" size={13} /> 临阵招式 <span className="panel-sec-sub">切磋自带补位</span>
      </div>
      {extras.map((m, i) => {
        const q = m.quality || "白";
        const qc = QUALITY_COLOR[q] || "var(--text)";
        const origin = m.learnedFromMaster ? "授" : "基础";
        return (
          <div key={i} className="combat-move-row">
            <span className="skill-kind-icon"><Icon name={m.type || "招式"} size={13} /></span>
            <span
              onClick={() => inspectItem("skill", m.name, `${q}品·临阵招式（${origin}）`, null, { worldLook: true })}
              className="skill-name-btn"
              style={{ color: qc, opacity: inspecting === m.name ? 0.6 : 1 }}
            >{m.name}{inspecting === m.name ? "…" : ""}</span>
            <span className="skill-quality" style={{ color: qc }}>（{q}品）</span>
            <span className="combat-move-origin">{origin}</span>
          </div>
        );
      })}
    </div>
  );
}
