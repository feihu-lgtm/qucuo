// 日志面板 + 事件弹窗（自 TavernSimScreen 拆出）。
import {
  TICK_LABELS, EVENTS,
} from "../../../domain/data/tavernSim/simData.js";
import { Btn, S } from "./tavernWidgets.jsx";
import ModalShell from "../../primitives/ModalShell.jsx";

import React, { useEffect, useRef } from "react";
import { THEME_VARS } from "../../../utils/theme.js";

// ── 日志 ─────────────────────────────────────────────────────────────
export function LogPanel({ log }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log.length]);
  return (
    <div ref={ref} className="ts-log-panel" style={S.logPanel(THEME_VARS)}>
      {log.slice(-60).map((l, i) => (
        <div key={i} style={{ fontSize: "var(--fs-sm)", lineHeight: 1.8,
        color: l.kind === "gold" ? "var(--ink-warn)" : l.kind === "event" ? "var(--tavern-event)" : "var(--ink-text-dim)", }}>
          <span style={{ color: "var(--tavern-log-time)", fontSize: "var(--fs-2xs)" }}>[{l.day}日·{TICK_LABELS[l.tick]}] </span>
          {l.text}
        </div>
      ))}
    </div>
  );
}

// ── 事件弹窗 ─────────────────────────────────────────────────────────
export function EventModal({ sim, onResolve }) {
  const ev = sim.pendingEvent;
  const def = EVENTS.find(e => e.id === ev.id);
  // 事件必须选一项才能继续：不开放点遮罩与 Esc 关闭。遮罩原透明度 0.8，并入 soft（0.75）。
  return (
    <ModalShell layer="float" backdrop="soft" mobile="none" closeOnBackdrop={false} closeOnEsc={false} showClose={false}
      ariaLabel={ev.title} panelClassName="building-panel" panelStyle={{ width: 400, maxWidth: "92vw", padding: 18 }}>
      <div style={{ color: "var(--ink-warn)", fontSize: "var(--fs-base)", marginBottom: 8 }}>⚠ {ev.title}</div>
      <div style={{ color: "var(--ink-text)", fontSize: "var(--fs-sm)", lineHeight: 1.8, marginBottom: 14 }}>{ev.desc}</div>
      {(def?.options || ev.options).map(opt => {
        const needGuard = opt.needGuard && sim.guards.length === 0;
        const needFood = ev.id === "food_critic" && opt.id === "cook" && sim.pantry.food < 3;
        const needMoney = ev.id === "storyteller" && opt.id === "hire" && sim.funds < 10;
        const disabled = needGuard || needFood || needMoney;
        return (
          <div key={opt.id} style={{ marginBottom: 8 }}>
            <Btn label={opt.label} disabled={disabled} onClick={() => onResolve(opt.id)} />
            <span style={{ color: "var(--ink-moss)", fontSize: "var(--fs-2xs)", marginLeft: 8 }}>
              {needGuard ? "（需雇有护院）" : needFood ? "（食材不足×3）" : needMoney ? "（银子不够）" : opt.hint}
            </span>
          </div>
        );
      })}
    </ModalShell>
  );
}

