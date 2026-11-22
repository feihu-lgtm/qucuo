// 血条 + 气力圆点（纯展示组件，TeamDuelScreen.jsx 也经 DuelScreen 转发复用）。

import React from "react";

export function HpBar({ pct, color }) {
  return (
    <div style={{ width: "100%", height: 8, background: "rgba(0,0,0,0.3)", borderRadius: 0, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s ease" }} />
    </div>
  );
}

export function EnergyDots({ value, color, right }) {
  return (
    <div style={{ display: "flex", gap: 3, marginTop: 4, justifyContent: right ? "flex-end" : "flex-start" }}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: i < value ? color : "rgba(255,255,255,0.15)",
        }} />
      ))}
    </div>
  );
}
