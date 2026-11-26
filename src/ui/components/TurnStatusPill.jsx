import { useEffect, useState, useSyncExternalStore } from "react";
import { PHASE, formatTurnStatus, turnMonitor } from "../../infra/turnMonitor.js";
import { OVERLAY, openOverlay, useOverlay } from "../../store/uiStore.js";
import { chromeBtn } from "../../utils/theme.js";

export default function TurnStatusPill({ theme, mobile, docked }) {
  const snapshot = useSyncExternalStore(turnMonitor.subscribe, turnMonitor.getSnapshot);
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
      <button type="button" title={label} aria-label={`全流程日志：${label}`}
        className={`mobile-touch-target status-light${busy ? " status-light-busy" : ""}`}
        onClick={() => openOverlay(OVERLAY.TRACE)}
        style={{ ...chromeBtn(theme, { active }), width: 29, minWidth: 29, height: 29, padding: 0, borderRadius: "50%", justifyContent: "center", flexShrink: 0, ...(failed ? { border: `2px solid ${theme.accent}` } : {}) }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: color, boxShadow: busy ? `0 0 6px ${color}` : "none" }} />
      </button>
    );
  }
  return (
    <div className={mobile || docked ? undefined : "turn-status-float"} style={mobile
      ? { display: "flex", justifyContent: "flex-end", padding: "3px 10px", flexShrink: 0 }
      : docked ? { display: "flex" }
      : undefined /* 悬浮态的定位与层级在 tokens.css 的 .turn-status-float（--z-hud） */}>
      <button type="button" title={label} aria-label={`全流程日志：${label}`}
        onClick={() => openOverlay(OVERLAY.TRACE)}
        style={{
          // 与顶栏其它入口同一副骨架（高度/圆角/字距都取 --ctl-* 与 --fs-xs），
          // 这样「日志」和回合计时并排时像同一组控件，而不是一颗凸出来的圆药丸。
          ...chromeBtn(theme, { active }), height: "var(--ctl-h)", borderRadius: "var(--radius-none)",
          maxWidth: "100%",
          background: active ? `color-mix(in srgb, ${theme.accent} 14%, transparent)` : "transparent",
          fontFamily: "inherit",
        }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </button>
    </div>
  );
}
