import { QUALITY_COLOR } from "../../../domain/rules/economy/equipment.js";

export default function CombatMovesModule({ zoneTheme, char, inspectItem, inspecting }) {
  const extras = (char.moveset || []).filter(m => !m.sourceSkill);
  if (!extras.length) return null;
  const TYPE_SHORT = { 攻击: "攻", 防御: "防", 状态: "状" };
  return (
    <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
      <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>临阵招式 <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>切磋自带补位 · 运功对应类型的武学即替换（回气永在，能量枯竭保命）</span></div>
      {extras.map((m, i) => {
        const q = m.quality || "白";
        const qc = QUALITY_COLOR[q] || "var(--text)";
        const origin = m.learnedFromMaster ? "授" : "基础";
        return (
          <div key={i} style={{ marginBottom: 3, fontSize: "11px", display: "flex", alignItems: "center", gap: 5, opacity: 0.92, paddingLeft: 6 }}>
            <span style={{ fontSize: "9px", color: "#1a1206", background: qc, borderRadius: 0, padding: "0 3px", fontWeight: 700 }}>{TYPE_SHORT[m.type] || "?"}</span>
            <span
              onClick={() => inspectItem("skill", m.name, `${q}品·临阵招式（${origin}）`, null, { worldLook: true })}
              style={{ cursor: inspecting === m.name ? "wait" : "pointer", color: qc, textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: zoneTheme.textDim, opacity: inspecting === m.name ? 0.6 : 1 }}
            >{m.name}{inspecting === m.name ? "…" : ""}</span>
            <span style={{ fontSize: "9.5px", color: qc, opacity: 0.9 }}>（{q}品）</span>
            <span style={{ fontSize: "9px", color: zoneTheme.textDim }}>{origin}</span>
          </div>
        );
      })}
    </div>
  );
}
