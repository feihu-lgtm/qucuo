import { bar } from "../../../utils/mudHelpers.js";

export default function AttributesModule({ zoneTheme, char, trainNeigong, trainWaigong, trainCost, pot, effectiveSpecialNow, activeBuffs }) {
  return (
    <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10, display: "flex", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--fs-xs)", color: zoneTheme.accentDim, marginBottom: 4 }}>内功外功</div>
        <div style={{ fontSize: "var(--fs-sm)", display: "flex", alignItems: "center", gap: 6 }}>
          <span>内功 <span style={{ color: "var(--violet)" }}>{bar(char.neigong ?? 0, 100, 6)}</span> <span style={{ color: "var(--attr-value)" }}>{char.neigong ?? 0}</span></span>
          <span
            onClick={trainNeigong}
            title={`运气打坐：消耗${trainCost(char.neigong ?? 0)}点潜能，内功+1（现有潜能${pot}）`}
            style={{
              cursor: "pointer", fontSize: "10px", padding: "1px 5px", borderRadius: 0,
              color: "var(--attr-neigong-tag)", background: zoneTheme.bgPanel, border: "1px solid var(--attr-neigong-edge)", whiteSpace: "nowrap",
            }}
          >+1（{trainCost(char.neigong ?? 0)}潜能）</span>
        </div>
        <div style={{ fontSize: "var(--fs-sm)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <span>外功 <span style={{ color: "var(--attr-waigong-bar)" }}>{bar(char.waigong ?? 0, 100, 6)}</span> <span style={{ color: "var(--attr-value)" }}>{char.waigong ?? 0}</span></span>
          <span
            onClick={trainWaigong}
            title={`拆招练武：消耗${trainCost(char.waigong ?? 0)}点潜能，外功+1（现有潜能${pot}）`}
            style={{
              cursor: "pointer", fontSize: "10px", padding: "1px 5px", borderRadius: 0,
              color: "var(--attr-waigong-tag)", background: zoneTheme.bgPanel, border: "1px solid var(--attr-waigong-edge)", whiteSpace: "nowrap",
            }}
          >+1（{trainCost(char.waigong ?? 0)}潜能）</span>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--fs-xs)", color: zoneTheme.accentDim, marginBottom: 4 }}>七维</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px", fontSize: "var(--fs-xs)" }}>
          {Object.entries(char.special || {}).map(([k, v]) => {
            const eff = effectiveSpecialNow?.[k];
            const buffed = typeof eff === "number" && eff !== v;
            return (
              <div key={k} title={buffed ? `基础${v}，药力/buff生效中` : undefined}>
                {k}
                <span style={{ color: buffed ? "var(--clay)" : "var(--ink-text)" }}>{buffed ? eff : v}</span>
                {buffed && <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)" }}> ({v}+{eff - v})</span>}
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
