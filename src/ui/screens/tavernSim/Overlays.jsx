// 日志面板 + 事件弹窗（自 TavernSimScreen 拆出）。
import {
  TICK_LABELS, EVENTS,
} from "../../../domain/data/tavernSim/simData.js";
import { Btn, S } from "./tavernWidgets.jsx";

import React, { useEffect, useRef } from "react";

// ── 日志 ─────────────────────────────────────────────────────────────
export function LogPanel({ log, zoneTheme }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log.length]);
  return (
    <div ref={ref} className="ts-log-panel" style={S.logPanel(zoneTheme)}>
      {log.slice(-60).map((l, i) => (
        <div key={i} style={{
          fontSize: 12, lineHeight: 1.8,
          color: l.kind === "gold" ? "var(--ink-warn)" : l.kind === "event" ? "#b08ad4" : "var(--ink-text-dim)",
        }}>
          <span style={{ color: "#4a4a3a", fontSize: 10 }}>[{l.day}日·{TICK_LABELS[l.tick]}] </span>
          {l.text}
        </div>
      ))}
    </div>
  );
}

// ── 事件弹窗 ─────────────────────────────────────────────────────────
export function EventModal({ sim, zoneTheme, onResolve }) {
  const ev = sim.pendingEvent;
  const def = EVENTS.find(e => e.id === ev.id);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.8)", zIndex: 60,
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: zoneTheme.panelBg || "#14161f", border: `1px solid ${zoneTheme.border}`,
        borderRadius: 0, width: 400, maxWidth: "92vw", padding: 18 }}>
        <div style={{ color: "var(--ink-warn)", fontSize: 14, marginBottom: 8 }}>⚠ {ev.title}</div>
        <div style={{ color: "var(--ink-text)", fontSize: 12, lineHeight: 1.8, marginBottom: 14 }}>{ev.desc}</div>
        {(def?.options || ev.options).map(opt => {
          const needGuard = opt.needGuard && sim.guards.length === 0;
          const needFood = ev.id === "food_critic" && opt.id === "cook" && sim.pantry.food < 3;
          const needMoney = ev.id === "storyteller" && opt.id === "hire" && sim.funds < 10;
          const disabled = needGuard || needFood || needMoney;
          return (
            <div key={opt.id} style={{ marginBottom: 8 }}>
              <Btn label={opt.label} zoneTheme={zoneTheme} disabled={disabled} onClick={() => onResolve(opt.id)} />
              <span style={{ color: "var(--ink-moss)", fontSize: 10, marginLeft: 8 }}>
                {needGuard ? "（需雇有护院）" : needFood ? "（食材不足×3）" : needMoney ? "（银子不够）" : opt.hint}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

