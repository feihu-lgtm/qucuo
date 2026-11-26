import React from "react";
import { HpBar, EnergyDots } from "./DuelBars.jsx";

// 单个战斗单位的状态卡：名字 + 血条 + 能量点（倒下后整体置灰）
export default function TeamUnitCard({ unit, color, right }) {
  const pct = unit.hp[1] > 0 ? (unit.hp[0] / unit.hp[1]) * 100 : 0;
  return (
    <div style={{ opacity: unit.alive ? 1 : 0.38, marginBottom: 6, textAlign: right ? "right" : "left" }}>
      <div style={{ fontSize: "var(--fs-sm)", color: "var(--text)", marginBottom: 3 }}>
        {unit.name}{!unit.alive && <span style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)" }}>（倒下）</span>}
      </div>
      <HpBar pct={pct} color={color} />
      <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", marginTop: 2 }}>{unit.hp[0]}/{unit.hp[1]}</div>
      <EnergyDots value={unit.energy[0]} color={color} right={right} />
    </div>
  );
}
