// 入册界面共用零件 · 字段层（从 widgets.jsx 拆出）
// ============================================================================
// 数值条/七维/来源标记/输入框/版式零件（Section/Note/Btn/Pills）。

import React, { useState } from "react";
import { S, SEVEN } from "./widgetsMeta.js";
import { Step } from "./widgetsChrome.jsx";

// ── 数值条（七维与内外功共用） ────────────────────────────────────────────────

/**
 * 一行可调数值：滑条 + 加减号 + 键入。
 * 三种改法都留着的原因：滑条快但精度差（在 30px 宽的条上找准 10% 很难），
 * 加减号准，键盘最准。
 */
export function StatRow({ label, value, min = 0, max = 10, step = 1, onChange, width = 30, unit }) {
  const set = (v) => onChange && onChange(Math.max(min, Math.min(max, v)));
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{ width, fontSize: 11, color: "var(--quest-stage-desc)", flexShrink: 0 }}>{label}</span>
      <div
        onClick={e => {
          if (!onChange) return;
          const r = e.currentTarget.getBoundingClientRect();
          set(Math.round(min + ((e.clientX - r.left) / r.width) * (max - min)));
        }}
        style={{
          flex: 1, height: 9, position: "relative", cursor: onChange ? "pointer" : "default",
          backgroundImage: `url('${S("ui/bar_paper2.webp")}')`,
          backgroundSize: "100% 100%", borderRadius: 0, overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, pct))}%`,
          background: "linear-gradient(90deg, var(--mind-button-edge), var(--ink-warn))", opacity: 0.85,
        }} />
      </div>
      {onChange ? (
        <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <Step onClick={() => set(value - step)} disabled={value <= min}>−</Step>
          <input value={value}
            onChange={e => {
              const n = e.target.value.replace(/[^0-9]/g, "");
              if (n !== "") set(Number(n));
            }}
            style={{
              width: max > 10 ? 32 : 26, textAlign: "center", background: "rgba(0,0,0,.4)",
              border: "1px solid var(--border-deep)", borderRadius: 0, padding: "2px 0",
              color: "var(--ink-warn)", fontSize: 11.5, outline: "none", fontFamily: "inherit",
            }} />
          <Step onClick={() => set(value + step)} disabled={value >= max}>＋</Step>
          {unit ? <span style={{ fontSize: 9.5, color: "var(--ink-text-dim)" }}>{unit}</span> : null}
        </span>
      ) : (
        <span style={{ width: 26, textAlign: "right", fontSize: 11, color: "var(--ink-warn)", flexShrink: 0 }}>{value}</span>
      )}
    </div>
  );
}

export function SevenDim({ special, onChange, why }) {
  return (
    <div>
      {SEVEN.map(k => (
        <StatRow key={k} label={k} value={special?.[k] ?? 5} max={10}
          onChange={onChange ? (v => onChange({ ...special, [k]: v })) : null} />
      ))}
      {why && <div style={{ fontSize: 10, color: "var(--ink-text-dim)", marginTop: 4, fontStyle: "italic" }}>据「{why}」</div>}
    </div>
  );
}

// ── 字段来源标记 ──────────────────────────────────────────────────────────────

export function Src({ source, why }) {
  if (source === "fallback") {
    return <span title="AI 没抽出来，这是默认值"
      style={{ fontSize: 9, color: "var(--ink-text-dim)", border: "1px solid var(--border-deep)", borderRadius: 0, padding: "0 3px", marginLeft: 5 }}>默认</span>;
  }
  if (source === "manual") {
    return <span title="只能你自己填，不从卡里抽"
      style={{ fontSize: 9, color: "var(--footer-hint-text)", border: "1px solid var(--bug-edge-dark)", borderRadius: 0, padding: "0 3px", marginLeft: 5 }}>手填</span>;
  }
  if (source === "drop") {
    return <span title="按规矩丢弃，不导入"
      style={{ fontSize: 9, color: "var(--bug-dim-dark)", border: "1px solid var(--border-deep)", borderRadius: 0, padding: "0 3px", marginLeft: 5 }}>已丢</span>;
  }
  return (
    <span title={why ? `AI 判断依据：${why}` : "AI 抽取"}
      style={{ fontSize: 9, color: "var(--quest-success-text)", border: "1px solid var(--music-idle-icon)", borderRadius: 0, padding: "0 3px", marginLeft: 5 }}>
      AI{why ? "·" + why.slice(0, 10) : ""}
    </span>
  );
}

// ── 输入框 ────────────────────────────────────────────────────────────────────

export function TextField({ label, value, onChange, placeholder, rows = 1, max, align, mono }) {
  // 单行居中：装的是名字、身份、数值这类短内容。多行左对齐：成段文字居中读不下去。
  const centered = align || (rows > 1 ? "left" : "center");
  const common = {
    width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,.35)",
    border: "1px solid var(--border-deep)", borderRadius: 0, padding: "5px 8px",
    color: "var(--paper)", fontSize: 11.5, outline: "none", resize: "vertical",
    textAlign: centered,
    fontFamily: mono ? "ui-monospace,Menlo,Consolas,monospace" : "inherit",
  };
  return (
    <label style={{ display: "block", marginBottom: 7 }}>
      {label != null && (
        <span style={{ display: "block", fontSize: 10.5, color: "var(--ink-muted)", marginBottom: 3, textAlign: centered === "center" ? "center" : "left" }}>
          {label}{max ? <span style={{ color: "var(--muted)" }}> ≤{max}字</span> : null}
        </span>
      )}
      {rows > 1
        ? <textarea rows={rows} value={value || ""} placeholder={placeholder}
            onChange={e => onChange(max ? e.target.value.slice(0, max) : e.target.value)} style={common} />
        : <input value={value || ""} placeholder={placeholder}
            onChange={e => onChange(max ? e.target.value.slice(0, max) : e.target.value)} style={common} />}
    </label>
  );
}

// ── 版式零件 ──────────────────────────────────────────────────────────────────

export function Stat({ label, v }) {
  return (
    <div style={{ display: "flex", fontSize: 11, marginBottom: 4, color: "var(--ink-muted)" }}>
      <span style={{ width: 84, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--ink-text)" }}>{v}</span>
    </div>
  );
}

export function Section({ title, children, dim }) {
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--bg-card)", paddingTop: 9, opacity: dim ? .55 : 1 }}>
      <div style={{ fontSize: 11, color: "var(--ink-tan)", letterSpacing: 1, marginBottom: 7 }}>{title}</div>
      {children}
    </div>
  );
}

export function Note({ tone = "info", children }) {
  const c = tone === "bad" ? "var(--ink-error-text)" : tone === "warn" ? "var(--tutorial-time)" : "var(--inject-user-text)";
  return (
    <div style={{
      fontSize: 10.5, lineHeight: 1.7, color: c, marginTop: 7,
      padding: "6px 9px", background: "rgba(0,0,0,.3)",
      borderLeft: `2px solid color-mix(in srgb, ${c} 40%, transparent)`, borderRadius: "0 3px 3px 0",
    }}>{children}</div>
  );
}

export function Btn({ children, onClick, tone = "dim", disabled, title }) {
  const main = tone === "main";
  const warn = tone === "warn";
  return (
    <span onClick={disabled ? undefined : onClick} title={title}
      style={{
        cursor: disabled ? "not-allowed" : "pointer", userSelect: "none",
        fontSize: 12, padding: "6px 16px", borderRadius: 0, whiteSpace: "nowrap",
        color: main ? "var(--bg-deep)" : warn ? "var(--tutorial-time)" : "var(--quest-stage-desc)",
        background: main ? "linear-gradient(180deg,var(--service-item-name),var(--mind-button-edge))" : "rgba(0,0,0,.3)",
        border: `1px solid ${main ? "var(--service-item-name)" : warn ? "var(--ink-wood-edge)" : "var(--border-deep)"}`,
        opacity: disabled ? .4 : 1,
        fontWeight: main ? 700 : 400, letterSpacing: main ? 1 : 0,
      }}>{children}</span>
  );
}

// 小号切换按钮组（主角/NPC、性别这类二三选一）
// 单个 pill 抽成带 hover 的子组件。
// 【为什么改配色】未选中态原来是暗灰字(var(--ink-muted))+暗边(var(--border-deep))+透明底，在深色面板
// 上看着就像「禁用的灰按钮」——实测有玩家因此以为落脚的驻场/游走钮点不了、只能靠
// AI 荐位。现在未选中也用亮米字+可见描边+微深底，明确「这是能点的」；hover 再镀
// 一层金边并提亮，选中态才是实心金。
function Pill({ label, on, onClick, title, accent }) {
  const [hov, setHov] = useState(false);
  return (
    <span onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        cursor: "pointer", userSelect: "none", fontSize: 11.5, padding: "4px 14px", borderRadius: 0,
        transition: "all .14s ease",
        border: `1px solid ${on || hov ? accent : "var(--ink-brass)"}`,
        background: on ? "rgba(212,168,83,.16)" : hov ? "rgba(212,168,83,.07)" : "rgba(0,0,0,.18)",
        color: on ? accent : hov ? "var(--create-input-text)" : "var(--qb-text-dim)",
      }}>{label}</span>
  );
}

export function Pills({ options, value, onChange, accent = "var(--ink-warn)" }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(o => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        return (
          <Pill key={v} label={label} on={v === value} onClick={() => onChange(v)}
            title={typeof o === "object" ? o.title : undefined} accent={accent} />
        );
      })}
    </div>
  );
}
