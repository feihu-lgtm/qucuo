import React from "react";
import { SPECIAL_KEYS } from "../../domain/rules/character/starterBuild.js";

export default function StatAllocator({ special, remaining, onAdjust, onRandomize, onContinue, theme }) {
  const buttonStyle = {
    width: 36, height: 36, border: `1px solid ${theme.border}`, background: theme.bgPanel,
    color: theme.text, fontSize: 18, cursor: "pointer",
  };
  return (
    <>
      <div style={{ color: theme.accent, textAlign: "center", marginBottom: 12 }}>七维分配 · 尚余 {remaining} 点</div>
      <div className="character-create-stat-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {SPECIAL_KEYS.map((key) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${theme.border}`, padding: "5px 7px" }}>
            <span style={{ flex: 1, color: theme.text, fontSize: 12 }}>{key}</span>
            <button type="button" aria-label={`${key}减一`} disabled={special[key] <= 0} onClick={() => onAdjust(key, -1)} style={buttonStyle}>−</button>
            <span style={{ width: 20, textAlign: "center", color: theme.accent }}>{special[key]}</span>
            <button type="button" aria-label={`${key}加一`} disabled={special[key] >= 10 || remaining <= 0} onClick={() => onAdjust(key, 1)} style={buttonStyle}>+</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={onRandomize} style={{ width: "100%", marginTop: 10, padding: 8, border: `1px solid ${theme.border}`, background: theme.bgPanel, color: theme.text, cursor: "pointer" }}>
        随机分配
      </button>
      <button type="button" onClick={onContinue} disabled={remaining !== 0} style={{ ...continueStyle(theme), opacity: remaining === 0 ? 1 : 0.4, cursor: remaining === 0 ? "pointer" : "not-allowed" }}>
        选好了 ▸
      </button>
    </>
  );
}

function continueStyle(theme) {
  return { width: "100%", marginTop: 10, padding: "11px 0", border: `1px solid ${theme.accent}`, background: theme.accent, color: theme.bg, fontWeight: "bold", letterSpacing: 2 };
}
