// 阶段一：选模式（单挑 / 团战）。

import React, { useState } from "react";
import TextBtn from "./TextBtn.jsx";
import { UI, sx } from "./qbShared.js";

export default function ModePick({ onPick, onExit }) {
  return (
    <div style={sx.centerCol}>
      <h1 style={sx.title}>斗蛐蛐</h1>
      <div style={sx.subtitle}>从曲措乡众生里挑人下场，切磋见真章</div>
      <div style={{ display: "flex", gap: 16, marginTop: 40, flexWrap: "wrap", justifyContent: "center", width: "100%", padding: "0 12px", boxSizing: "border-box" }}>
        <WoodCard onClick={() => onPick("1v1")} title="单挑" sub="一对一，速战速决" />
        <WoodCard onClick={() => onPick("team")} title="团战" sub="各排一队，可临阵换人" />
      </div>
      <TextBtn onClick={onExit} style={{ marginTop: 48 }}>← 返回主菜单</TextBtn>
    </div>
  );
}

function WoodCard({ title, sub, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} className="mode-pick-1" data-on={Boolean(hover)}
    >
      <img src={UI("panel_big.webp")} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, padding: "0 8px" }}>
        <div style={{ fontSize: "clamp(20px, 6vw, 26px)", letterSpacing: 4, color: "var(--gold-light)", fontWeight: "bold" }}>{title}</div>
        <div style={{ fontSize: "clamp(10px, 3vw, 12px)", color: "var(--parchment)", letterSpacing: 1, textAlign: "center" }}>{sub}</div>
      </div>
    </button>
  );
}
