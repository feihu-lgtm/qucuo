import React, { useState } from "react";

// 客栈：花银两住宿，气血回满，时间推进24单位（一天）
// healOnly=true 时作为医馆使用：不推时间，按 healPerLiang 换算回血
export default function InnScreen({ building, char, time, zoneTheme, onClose, onRest, onHeal, inline }) {
  const [choice, setChoice] = useState(null); // null | "普通" | "上等"

  const isHospital = building.type === "hospital";
  const innPrice = building.innPrice || 10;
  const superPrice = innPrice * 3;
  const healPerLiang = building.healPerLiang || 3;
  const [healAmount, setHealAmount] = useState(30);

  const hp = char.hp[0];
  const maxHp = char.hp[1];
  const money = char.money || 0;

  if (isHospital) {
    const cost = Math.ceil((maxHp - hp) / healPerLiang);
    return (
      <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
        <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
        <div style={{ padding: 16 }}>
          <p style={{ color: zoneTheme.text, marginBottom: 12, fontSize: 13 }}>{building.desc}</p>
          <div style={{ color: "#8a8a7a", marginBottom: 12 }}>
            气血 {hp}/{maxHp} · 银两 {money} 两 · 每两回 {healPerLiang} 点气血
          </div>
          <div style={{ color: "#c8bfa0", marginBottom: 8 }}>回满需花 {cost} 两</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn label={`回满（${cost}两）`} disabled={money < cost || hp >= maxHp}
              zoneTheme={zoneTheme} onClick={() => onHeal(cost, maxHp - hp, "解毒治疗")} />
            <Btn label="关闭" zoneTheme={zoneTheme} secondary onClick={onClose} />
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <p style={{ color: zoneTheme.text, marginBottom: 12, fontSize: 13 }}>{building.desc}</p>
        <div style={{ color: "#8a8a7a", marginBottom: 16 }}>
          气血 {hp}/{maxHp} · 银两 {money} 两
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn
            label={`普通客房（${innPrice}两）`}
            disabled={money < innPrice}
            zoneTheme={zoneTheme}
            onClick={() => onRest(innPrice, "普通客房")}
          />
          <Btn
            label={`上等厢房（${superPrice}两）`}
            disabled={money < superPrice}
            zoneTheme={zoneTheme}
            onClick={() => onRest(superPrice, "上等厢房")}
          />
          <Btn label="关闭" zoneTheme={zoneTheme} secondary onClick={onClose} />
        </div>
        <div style={{ color: "#5a5a4a", fontSize: 11, marginTop: 12 }}>
          住宿后气血回满，时间推进一天（24单位）
        </div>
      </div>
    </Overlay>
  );
}

// ── 共用子组件 ──
export function Overlay({ children, onClose, zoneTheme, inline }) {
  if (inline) {
    return (
      <div style={{ borderTop: `1px solid ${zoneTheme.border}`, background: zoneTheme.panelBg || "#14161f", flexShrink: 0, maxHeight: "50vh", overflowY: "auto" }}>
        {children}
      </div>
    );
  }
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.88)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: zoneTheme.panelBg || "#14161f", border: `1px solid ${zoneTheme.border}`, borderRadius: 8, width: 440, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Header({ name, zoneTheme, onClose }) {
  return (
    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${zoneTheme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 14, color: zoneTheme.text || "#c8bfa0" }}>{name}</span>
      <span onClick={onClose} style={{ color: "#5a5a4a", fontSize: 12, cursor: "pointer", padding: "2px 8px" }}>× 关闭</span>
    </div>
  );
}

export function Btn({ label, onClick, disabled, zoneTheme, secondary }) {
  return (
    <span
      onClick={disabled ? undefined : onClick}
      style={{
        fontSize: 12, padding: "5px 14px", borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "#4a4a4a" : secondary ? zoneTheme.accentDim : zoneTheme.bg,
        background: disabled ? "#1a1a1a" : secondary ? "transparent" : zoneTheme.accent,
        border: `1px solid ${disabled ? "#2a2a2a" : secondary ? zoneTheme.border : zoneTheme.accent}`,
        opacity: disabled ? 0.5 : 1,
        userSelect: "none",
      }}
    >{label}</span>
  );
}
