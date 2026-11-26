// 招式详细察看弹层（TeamDuelScreen.jsx 经 DuelScreen 转发复用）。

import React from "react";
import { useOverlayCloseGuard } from "../../../utils/overlayClose.js";
import { TYPE_ICON, describeMoveEffects, styles } from "./duelShared.js";
import { THEME_VARS } from "../../../utils/theme.js";
import { QUALITY_COLOR } from "../../../domain/data/items/qualityColor.js";

export function MoveInspect({ move, onClose }) {
  const closeGuard = useOverlayCloseGuard(onClose);
  const color = QUALITY_COLOR[move.quality] || "var(--text)";
  const effects = describeMoveEffects(move);
  return (
    <div style={styles.inspectOverlay} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div style={{ ...styles.inspectCard, background: "var(--bg-panel)", border: `1px solid ${color}` }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "var(--fs-2xs)", color }}>{TYPE_ICON[move.type]} {move.quality}袍 · {move.side}的招式</div>
        <div style={{ fontSize: "var(--fs-lg)", color: "var(--text)", margin: "4px 0 2px" }}>{move.name}</div>
        {move.desc && <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-dim)", lineHeight: 1.6, margin: "6px 0" }}>{move.desc}</div>}
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--accent-dim)", margin: "8px 0 4px" }}>耗能 {move.energyCost ?? 0}</div>
        <div style={{ borderTop: `1px solid var(--border)`, paddingTop: 6 }}>
          {effects.length ? effects.map((t, i) => (
            <div key={i} style={{ fontSize: "var(--fs-sm)", color: "var(--text)", marginBottom: 3 }}>· {t}</div>
          )) : <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-dim)" }}>· 无特殊机制，纯凭火候</div>}
        </div>
        <div style={styles.continueRow}><span onClick={onClose} style={styles.continueBtn(THEME_VARS)}>收起</span></div>
      </div>
    </div>
  );
}
