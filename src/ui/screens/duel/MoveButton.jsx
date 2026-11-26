// 出招按钮（TeamDuelScreen.jsx 经 DuelScreen 转发复用）。

import React from "react";
import { QUALITY_COLOR } from "../../../domain/rules/economy/equipment.js";
import { TYPE_ICON } from "./duelShared.js";

export function MoveButton({ move, disabled, onClick, onInspect }) {
  const color = QUALITY_COLOR[move.quality] || "var(--text)";
  return (
    <div
      className="mobile-duel-control"
      onClick={disabled ? undefined : onClick}
      style={{
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        background: "var(--bg)",
        border: `1px solid ${color}`,
        borderRadius: 0,
        padding: "10px 8px",
        textAlign: "center",
      }}
    >
      {/* 右上角"察看"：点它只看详情、不出招 */}
      <span onClick={(e) => { e.stopPropagation(); onInspect?.(); }}
        title="详细察看"
        style={{ position: "absolute", top: 2, right: 5, fontSize: "var(--fs-xs)", color: "var(--text-dim)", cursor: "pointer" }}>ⓘ</span>
      <div style={{ fontSize: "var(--fs-2xs)", color }}>{TYPE_ICON[move.type]} {move.quality}</div>
      <div style={{ fontSize: "var(--fs-md)", color: "var(--text)", marginTop: 2 }}>{move.name}</div>
      <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", marginTop: 2 }}>耗能{move.energyCost}</div>
    </div>
  );
}
