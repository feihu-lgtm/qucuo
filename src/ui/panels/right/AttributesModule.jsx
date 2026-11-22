import { bar } from "../../../utils/mudHelpers.js";

export default function AttributesModule({ zoneTheme, char, trainNeigong, trainWaigong, trainCost, pot, effectiveSpecialNow, activeBuffs }) {
  return (
    <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10, display: "flex", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>内功外功</div>
        <div style={{ fontSize: "11.5px", display: "flex", alignItems: "center", gap: 6 }}>
          <span>内功 <span style={{ color: "var(--violet)" }}>{bar(char.neigong ?? 0, 100, 6)}</span> <span style={{ color: "#888" }}>{char.neigong ?? 0}</span></span>
          <span
            onClick={trainNeigong}
            title={`运气打坐：消耗${trainCost(char.neigong ?? 0)}点潜能，内功+1（现有潜能${pot}）`}
            style={{
              cursor: "pointer", fontSize: "10px", padding: "1px 5px", borderRadius: 0,
              color: "#8ab4d4", background: zoneTheme.bgPanel, border: "1px solid #1d2d3a", whiteSpace: "nowrap",
            }}
          >+1（{trainCost(char.neigong ?? 0)}潜能）</span>
        </div>
        <div style={{ fontSize: "11.5px", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <span>外功 <span style={{ color: "#d85a30" }}>{bar(char.waigong ?? 0, 100, 6)}</span> <span style={{ color: "#888" }}>{char.waigong ?? 0}</span></span>
          <span
            onClick={trainWaigong}
            title={`拆招练武：消耗${trainCost(char.waigong ?? 0)}点潜能，外功+1（现有潜能${pot}）`}
            style={{
              cursor: "pointer", fontSize: "10px", padding: "1px 5px", borderRadius: 0,
              color: "#d88a5a", background: zoneTheme.bgPanel, border: "1px solid #3a2a1d", whiteSpace: "nowrap",
            }}
          >+1（{trainCost(char.waigong ?? 0)}潜能）</span>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>七维</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px", fontSize: "11px" }}>
          {Object.entries(char.special || {}).map(([k, v]) => {
            const eff = effectiveSpecialNow?.[k];
            const buffed = typeof eff === "number" && eff !== v;
            return (
              <div key={k} title={buffed ? `基础${v}，药力/buff生效中` : undefined}>
                {k}
                <span style={{ color: buffed ? "var(--clay)" : "var(--text)" }}>{buffed ? eff : v}</span>
                {buffed && <span style={{ color: "var(--text-dim)", fontSize: "9.5px" }}> ({v}+{eff - v})</span>}
              </div>
            );
          })}
        </div>
        {activeBuffs.length > 0 && (
          <div style={{ marginTop: 4, fontSize: "9.5px", color: "var(--clay)", lineHeight: 1.5 }}>
            {activeBuffs.map((b, i) => (
              <div key={i}>药力·{b.attr}+{b.val}（余{b.remaining}）</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
