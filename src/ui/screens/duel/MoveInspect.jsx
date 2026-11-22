// 招式详细察看弹层（TeamDuelScreen.jsx 经 DuelScreen 转发复用）。

import React from "react";
import { QUALITY_COLOR } from "../../../domain/rules/economy/equipment.js";
import { useOverlayCloseGuard } from "../../../utils/overlayClose.js";
import { TYPE_ICON, describeMoveEffects, styles } from "./duelShared.js";

export function MoveInspect({ move, zoneTheme, onClose }) {
  const closeGuard = useOverlayCloseGuard(onClose);
  const color = QUALITY_COLOR[move.quality] || zoneTheme.text;
  const effects = describeMoveEffects(move);
  return (
    <div style={styles.inspectOverlay} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div style={{ ...styles.inspectCard, background: zoneTheme.bgPanel, border: `1px solid ${color}` }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "10px", color }}>{TYPE_ICON[move.type]} {move.quality}袍 · {move.side}的招式</div>
        <div style={{ fontSize: "16px", color: zoneTheme.text, margin: "4px 0 2px" }}>{move.name}</div>
        {move.desc && <div style={{ fontSize: "12px", color: zoneTheme.textDim, lineHeight: 1.6, margin: "6px 0" }}>{move.desc}</div>}
        <div style={{ fontSize: "11px", color: zoneTheme.accentDim, margin: "8px 0 4px" }}>耗能 {move.energyCost ?? 0}</div>
        <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 6 }}>
          {effects.length ? effects.map((t, i) => (
            <div key={i} style={{ fontSize: "12px", color: zoneTheme.text, marginBottom: 3 }}>· {t}</div>
          )) : <div style={{ fontSize: "12px", color: zoneTheme.textDim }}>· 无特殊机制，纯凭火候</div>}
        </div>
        <div style={styles.continueRow}><span onClick={onClose} style={styles.continueBtn(zoneTheme)}>收起</span></div>
      </div>
    </div>
  );
}
