// 入册界面共用零件 · 运行日志与可点控件（从 widgets.jsx 拆出）
// ============================================================================

import React, { useState, useRef, useEffect } from "react";

// ── 运行日志 ──────────────────────────────────────────────────────────────────

export const TERM_MONO = "ui-monospace,Menlo,Consolas,monospace";
const TERM_TONE = {
  start: { mark: "▸", color: "var(--ink-info)" },
  done: { mark: "✓", color: "var(--green-soft)" },
  fail: { mark: "✕", color: "var(--lore-amber)" },
  retry: { mark: "↻", color: "var(--tutorial-time)" },
  wait: { mark: "⧗", color: "var(--inject-user-text)" },
  info: { mark: "·", color: "var(--tavern-steam)" },
};

/**
 * 终端样式的运行日志。视觉照 TraceViewer 来（var(--bg-ink) 底、var(--tavern-steam) 字、
 * var(--ink-info) 高亮、等宽、pre-wrap），因为两处要看的是同一类东西：带时序的机器动作。
 * 【为什么不用一行「实调 N 次」】那只有结果没有过程。5 次/分钟的额度下，玩家
 * 最需要看见的是"现在卡在哪、为什么等、哪一批降级了"。
 */
export function Terminal({ lines, height = 132, onExpand }) {
  const boxRef = useRef(null);
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <div style={{ borderTop: "1px solid var(--ink-border)", background: "var(--bg-ink)" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "3px 8px",
        borderBottom: "1px solid var(--bg-slate)", fontFamily: TERM_MONO, fontSize: 9,
        color: "var(--inject-kind-fallback)", letterSpacing: 1,
      }}>
        <span style={{ color: "var(--ink-info)" }}>●</span>
        <span>入册运行日志</span>
        <span style={{ flex: 1 }} />
        <span>{lines.length} 行</span>
        {onExpand && <span onClick={onExpand} title="放大看" style={{ cursor: "pointer", color: "var(--ink-info)" }}>⤢</span>}
      </div>
      <div ref={boxRef} style={{
        height, overflowY: "auto", padding: "5px 8px",
        fontFamily: TERM_MONO, fontSize: 9.5, lineHeight: 1.55,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {!lines.length && <span style={{ color: "var(--music-idle-icon)" }}>（尚无动作）</span>}
        {lines.map((l, i) => {
          const t = TERM_TONE[l.kind] || TERM_TONE.info;
          return (
            <div key={i} style={{ color: t.color }}>
              <span style={{ color: "var(--music-idle-icon)" }}>{l.at} </span>
              <span>{t.mark} </span>
              {l.tag ? <span style={{ color: "var(--ink-sage)" }}>[{l.tag}] </span> : null}
              <span>{l.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 带 hover 高亮 + 过渡的可点小控件。入册新加的几处（选主角、批量按钮）统一用它——
// 项目其余按钮多是静态内联样式，这里给交互加一层反馈：hover 时提亮描边并上浮 1px，
// 选中(on)时描边与字都用高亮色。手感顺一点。
export function TapSpan({ on, onClick, title, children, baseStyle, hi = "var(--warn)" }) {
  const [hov, setHov] = useState(false);
  return (
    <span onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        cursor: "pointer", userSelect: "none", transition: "all .14s ease",
        ...baseStyle,
        ...(on ? { borderColor: hi, color: hi, background: "rgba(212,168,83,.14)" } : {}),
        ...(hov && !on ? { borderColor: hi, color: "var(--paper)", transform: "translateY(-1px)" } : {}),
      }}>{children}</span>
  );
}
