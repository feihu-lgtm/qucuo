import React, { useState } from "react";
import { useOverlayCloseGuard } from "../utils/overlayClose.js";
import { RADIUS } from "../theme.js";

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
          <div style={{ color: "#8f8a7c", marginBottom: 12 }}>
            气血 {hp}/{maxHp} · 银两 {money} 两 · 每两回 {healPerLiang} 点气血
          </div>
          <div style={{ color: "#e8e4d6", marginBottom: 8 }}>回满需花 {cost} 两</div>
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
        <div style={{ color: "#8f8a7c", marginBottom: 16 }}>
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
        <div style={{ color: "#8f8a7c", fontSize: 11, marginTop: 12 }}>
          住宿后气血回满，时间推进一天（24单位）
        </div>
      </div>
    </Overlay>
  );
}

// ── 共用子组件 ──
export function Overlay({ children, onClose, zoneTheme, inline }) {
  // 遮罩误触修复见 ../utils/overlayClose.js。这是全项目共享组件，13个建筑面板
  // （当铺/武馆/钱庄/医馆/悬赏/镖局/寺庙/赌坊/藏书阁/铁匠铺/茶馆/运镖+任务日志）
  // 都复用它——这一处改好，等于一次性修好全部13处同款"选字拖拽误关闭"的问题。
  const closeGuard = useOverlayCloseGuard(onClose);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  if (inline) {
    return (
      <div style={{ borderTop: `1px solid ${zoneTheme.border}`, background: zoneTheme.panelBg || "#14161f", height: "100%", overflowY: "auto" }}>
        {children}
      </div>
    );
  }
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.88)", zIndex: 120, display: "flex",
        alignItems: isMobile ? "flex-end" : "center", justifyContent: "center" }}
      onMouseDown={closeGuard.onMouseDown}
      onClick={closeGuard.onClick}
    >
      <div
        style={isMobile
          ? { background: zoneTheme.panelBg || "#14161f", border: `1px solid ${zoneTheme.border}`,
              borderRadius: `${RADIUS.modal}px ${RADIUS.modal}px 0 0`, width: "100%", maxWidth: "100vw", maxHeight: "92vh",
              overflowY: "auto", WebkitOverflowScrolling: "touch" }
          : { background: zoneTheme.panelBg || "#14161f", border: `1px solid ${zoneTheme.border}`,
              borderRadius: RADIUS.modal, width: 440, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Header({ name, zoneTheme, onClose }) {
  return (
    <div style={{
      padding: "12px 16px", borderBottom: `1px solid ${zoneTheme.border}`, display: "flex",
      justifyContent: "space-between", alignItems: "center",
      // 吸顶：Header 所在的父容器（Overlay 的 inline 分支）自己是可滚动区域，
      // 面板内容一长（比如武馆秘籍列表）玩家往下滚，Header 之前只是普通文档流
      // 里的第一个元素，会跟着内容一起被滚出视野——关闭按钮消失，只能回滚一格
      // 或者刷新页面才能退出。position:sticky + top:0 让它始终钉在这层滚动区域
      // 顶部，不管滚多远都看得见、点得到。zIndex 避免被下面滚上来的内容盖住。
      position: "sticky", top: 0, zIndex: 1, background: zoneTheme.panelBg || "#14161f",
    }}>
      <span style={{ fontSize: 14, color: zoneTheme.text || "#e8e4d6" }}>{name}</span>
      <span
        onClick={onClose}
        style={{ color: zoneTheme.textDim, fontSize: 12, cursor: "pointer", padding: "2px 8px", borderRadius: RADIUS.btn, transition: "color 0.15s, background 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.color = zoneTheme.accent; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = zoneTheme.textDim; e.currentTarget.style.background = "transparent"; }}
      >× 关闭</span>
    </div>
  );
}

export function Btn({ label, onClick, disabled, zoneTheme, secondary }) {
  return (
    <span
      onClick={disabled ? undefined : onClick}
      style={{
        fontSize: 12, padding: "5px 14px", borderRadius: RADIUS.btn, cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "#4a4a4a" : secondary ? zoneTheme.accentDim : zoneTheme.bg,
        background: disabled ? "#1a1a1a" : secondary ? "transparent" : zoneTheme.accent,
        border: `1px solid ${disabled ? "#2a2a2a" : secondary ? zoneTheme.border : zoneTheme.accent}`,
        opacity: disabled ? 0.5 : 1,
        userSelect: "none",
        display: "inline-block",
        transition: "transform 0.1s, filter 0.15s, border-color 0.15s",
      }}
      onMouseEnter={e => { if (disabled) return; e.currentTarget.style.filter = "brightness(1.15)"; if (secondary) e.currentTarget.style.borderColor = zoneTheme.accent; }}
      onMouseLeave={e => { if (disabled) return; e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "scale(1)"; if (secondary) e.currentTarget.style.borderColor = zoneTheme.border; }}
      onMouseDown={e => { if (disabled) return; e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={e => { if (disabled) return; e.currentTarget.style.transform = "scale(1)"; }}
    >{label}</span>
  );
}
