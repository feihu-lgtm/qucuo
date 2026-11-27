import { useEffect, useState } from "react";
import { PHASE, formatTurnStatus, useTurnTrace } from "../hooks/useTurnTrace.js";
import { OVERLAY, openOverlay, useOverlay } from "../../store/uiStore.js";
import { chromeBtn } from "../../utils/theme.js";
import { Button } from "../primitives/index.js";

export default function TurnStatusPill({ theme, mobile, docked }) {
  const snapshot = useTurnTrace();
  const active = useOverlay(OVERLAY.TRACE);
  const [now, setNow] = useState(Date.now);
  const running = snapshot.current && snapshot.current.totalMs == null;
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [running]);
  const status = formatTurnStatus(snapshot, Math.max(now, snapshot.current?.ts ?? 0));
  const label = `${status.label}${status.backgroundCount ? ` · 后台 AI ×${status.backgroundCount}` : ""}`;
  if (mobile) {
    // 手机：固定大小的信号灯，只靠颜色表示阶段，宽度不随文字变化
    const failed = status.phase === PHASE.ERROR;
    const busy = running && !failed;
    const color = busy || failed ? theme.accent : theme.textDim;
    return (
      <Button variant="chrome" font="native" active={active} type="button" title={label} aria-label={`全流程日志：${label}`}
        className={`mobile-touch-target status-light${busy ? " status-light-busy" : ""}`}
        onClick={() => openOverlay(OVERLAY.TRACE)} style={{ width: 29, minWidth: 29, height: 29, padding: 0, borderRadius: "50%", justifyContent: "center", flexShrink: 0, ...(failed ? { border: `2px solid ${theme.accent}` } : {}) }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: color, boxShadow: busy ? `0 0 6px ${color}` : "none" }} />
      </Button>
    );
  }
  const failed = status.phase === PHASE.ERROR;
  const busy = running && !failed;
  return (
    <div className={mobile || docked ? undefined : "turn-status-float"} style={mobile
      ? { display: "flex", justifyContent: "flex-end", padding: "3px 10px", flexShrink: 0 }
      : docked ? { display: "flex" }
      : undefined /* 悬浮态的定位与层级在 tokens.css 的 .turn-status-float（--z-hud） */}>
      <button type="button" title={label} aria-label={`全流程日志：${label}`}
        onClick={() => openOverlay(OVERLAY.TRACE)}
        className={`topbar-status-pill${active ? " is-active" : ""}`}
        data-state={failed ? "error" : busy ? "busy" : "idle"}
      >
        <span className="topbar-status-dot" aria-hidden="true" />
        <span className="topbar-status-text">{label}</span>
      </button>
    </div>
  );
}
