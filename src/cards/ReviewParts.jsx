// 入册界面的共用零件
// ============================================================================
// CardImportScreen / ReviewNpc / ReviewPlayer 三处共用。抽出来的理由很直接：
// 审改界面要按映射表覆盖全字段，NPC 那边十五项、玩家那边十二项，零件如果各写
// 一份，改一个输入框的样式要改三处。
//
// 视觉素材全部取自 public/stones/（原本给赌石玩法做的）。其中六档玉色
// jade_1_bai 到 jade_6_hong 正好对上品阶白绿蓝紫橙红，品阶徽记直接用玉石图。

import React, { useRef, useEffect } from "react";

const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";
export const S = (p) => `${BASE}stones/${p}`;
export const PORTRAIT = (f) => `${BASE}portraits/${f}`;

// levelCap 0-5 → 玉色文件名与档位标签
export const TIERS = [
  { key: "bai", label: "白", jade: "jade_1_bai_chun.webp", color: "#d8d4c8" },
  { key: "lv", label: "绿", jade: "jade_2_lv_chun.webp", color: "#8ab070" },
  { key: "lan", label: "蓝", jade: "jade_3_lan_chun.webp", color: "#6a9ac4" },
  { key: "zi", label: "紫", jade: "jade_4_zi_chun.webp", color: "#a078c0" },
  { key: "cheng", label: "橙", jade: "jade_5_cheng_chun.webp", color: "#d89050" },
  { key: "hong", label: "红", jade: "jade_6_hong_chun.webp", color: "#c85850" },
];

export const KIND_META = {
  person: { label: "人物", icon: "👤", color: "#d4a853" },
  faction: { label: "势力", icon: "⚔", color: "#c07850" },
  place: { label: "地方", icon: "⛰", color: "#7a9a70" },
  rule: { label: "规矩", icon: "⚖", color: "#8a8ab0" },
  item: { label: "物件", icon: "◈", color: "#b09060" },
  player: { label: "我自己", icon: "☯", color: "#c8a0c0" },
  meta: { label: "框架", icon: "⚙", color: "#5a6a70" },
  unknown: { label: "待定", icon: "?", color: "#8a8270" },
  drop: { label: "弃用", icon: "✕", color: "#4a4a44" },
};

export const SEVEN = ["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"];

// bodyProfile 的两层。字段名与 bodyProfile.js 完全一致，顺序也照它的。
export const BODY_PUBLIC = [
  ["height", "身量"], ["build", "体型"], ["face", "面容"], ["skin", "肤色"],
  ["hair", "发式"], ["voice", "声音"], ["clothing", "惯常穿着"],
];
export const BODY_PRIVATE = [
  ["scars", "疤痕印记"], ["scent", "体味"], ["intimate", "身体细节"],
  ["sensitive", "敏感处"], ["habit", "习惯癖好"],
];

export const selStyle = {
  boxSizing: "border-box", width: "100%", background: "rgba(0,0,0,.4)",
  border: "1px solid #3a3428", borderRadius: 3, padding: "5px 7px",
  color: "#e8dcc0", fontSize: 11.5, outline: "none", fontFamily: "inherit",
  textAlign: "center", textAlignLast: "center",
};

// ── 木牌标题条 ────────────────────────────────────────────────────────────────

export function Bar({ children, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      backgroundImage: `url('${S("ui/bar_wood.webp")}')`,
      backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
      padding: "9px 16px", minHeight: 34,
    }}>
      <span style={{ color: "#f0e0c0", fontSize: 13, letterSpacing: 2, textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>
        {children}
      </span>
      <span style={{ flex: 1 }} />
      {right}
    </div>
  );
}

// ── 品阶徽记 ──────────────────────────────────────────────────────────────────

export function JadeTier({ value, onChange, size = 30, title, withSelect = false }) {
  const idx = Math.max(0, Math.min(5, value ?? 0));
  const t = TIERS[idx];
  const jade = (
    <span
      title={title || `品阶 ${t.label}档`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, flexShrink: 0,
        backgroundImage: `url('${S(t.jade)}')`,
        backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat",
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))",
      }}
    >
      <span style={{ fontSize: size * 0.36, fontWeight: 700, color: "#1a1206", textShadow: `0 0 3px ${t.color}` }}>
        {t.label}
      </span>
    </span>
  );
  if (!withSelect || !onChange) return jade;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {jade}
      <div style={{
        position: "relative", width: 86, height: 30,
        backgroundImage: `url('${S("ui/box_wood.webp")}')`,
        backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <select value={idx} onChange={e => onChange(Number(e.target.value))}
          style={{
            appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
            width: "100%", height: "100%", background: "transparent", border: "none",
            textAlign: "center", textAlignLast: "center",
            color: t.color, fontSize: 12, fontWeight: 700, outline: "none",
            cursor: "pointer", fontFamily: "inherit", textShadow: "0 1px 2px rgba(0,0,0,.9)",
          }}>
          {TIERS.map((x, i) => (
            <option key={x.key} value={i} style={{ background: "#1a1206", color: x.color }}>
              {i}·{x.label}档
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── 加减号 ────────────────────────────────────────────────────────────────────

export function Step({ children, onClick, disabled }) {
  return (
    <span onClick={disabled ? undefined : onClick}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 18, height: 18, flexShrink: 0, userSelect: "none",
        backgroundImage: `url('${S("ui/btn_blank.webp")}')`,
        backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
        cursor: disabled ? "default" : "pointer",
        color: disabled ? "#4a4436" : "#e8dcc0", fontSize: 11, lineHeight: 1,
        opacity: disabled ? .35 : 1,
      }}>{children}</span>
  );
}

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
      <span style={{ width, fontSize: 11, color: "#a89870", flexShrink: 0 }}>{label}</span>
      <div
        onClick={e => {
          if (!onChange) return;
          const r = e.currentTarget.getBoundingClientRect();
          set(Math.round(min + ((e.clientX - r.left) / r.width) * (max - min)));
        }}
        style={{
          flex: 1, height: 9, position: "relative", cursor: onChange ? "pointer" : "default",
          backgroundImage: `url('${S("ui/bar_paper2.webp")}')`,
          backgroundSize: "100% 100%", borderRadius: 2, overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, pct))}%`,
          background: "linear-gradient(90deg, #8a6a2a, #d4a853)", opacity: 0.85,
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
              border: "1px solid #3a3428", borderRadius: 2, padding: "2px 0",
              color: "#d4a853", fontSize: 11.5, outline: "none", fontFamily: "inherit",
            }} />
          <Step onClick={() => set(value + step)} disabled={value >= max}>＋</Step>
          {unit ? <span style={{ fontSize: 9.5, color: "#6a6250" }}>{unit}</span> : null}
        </span>
      ) : (
        <span style={{ width: 26, textAlign: "right", fontSize: 11, color: "#d4a853", flexShrink: 0 }}>{value}</span>
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
      {why && <div style={{ fontSize: 10, color: "#6a6250", marginTop: 4, fontStyle: "italic" }}>据「{why}」</div>}
    </div>
  );
}

// ── 字段来源标记 ──────────────────────────────────────────────────────────────

export function Src({ source, why }) {
  if (source === "fallback") {
    return <span title="AI 没抽出来，这是默认值"
      style={{ fontSize: 9, color: "#6a6250", border: "1px solid #3a3428", borderRadius: 2, padding: "0 3px", marginLeft: 5 }}>默认</span>;
  }
  if (source === "manual") {
    return <span title="只能你自己填，不从卡里抽"
      style={{ fontSize: 9, color: "#8a8ab0", border: "1px solid #3a3a4a", borderRadius: 2, padding: "0 3px", marginLeft: 5 }}>手填</span>;
  }
  if (source === "drop") {
    return <span title="按规矩丢弃，不导入"
      style={{ fontSize: 9, color: "#7a6a60", border: "1px solid #3a3028", borderRadius: 2, padding: "0 3px", marginLeft: 5 }}>已丢</span>;
  }
  return (
    <span title={why ? `AI 判断依据：${why}` : "AI 抽取"}
      style={{ fontSize: 9, color: "#7a9a70", border: "1px solid #3a4a34", borderRadius: 2, padding: "0 3px", marginLeft: 5 }}>
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
    border: "1px solid #3a3428", borderRadius: 3, padding: "5px 8px",
    color: "#e8dcc0", fontSize: 11.5, outline: "none", resize: "vertical",
    textAlign: centered,
    fontFamily: mono ? "ui-monospace,Menlo,Consolas,monospace" : "inherit",
  };
  return (
    <label style={{ display: "block", marginBottom: 7 }}>
      {label != null && (
        <span style={{ display: "block", fontSize: 10.5, color: "#8a8270", marginBottom: 3, textAlign: centered === "center" ? "center" : "left" }}>
          {label}{max ? <span style={{ color: "#5a5448" }}> ≤{max}字</span> : null}
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
    <div style={{ display: "flex", fontSize: 11, marginBottom: 4, color: "#8a8270" }}>
      <span style={{ width: 84, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#c8bfa0" }}>{v}</span>
    </div>
  );
}

export function Section({ title, children, dim }) {
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid #2a2419", paddingTop: 9, opacity: dim ? .55 : 1 }}>
      <div style={{ fontSize: 11, color: "#d8c8a0", letterSpacing: 1, marginBottom: 7 }}>{title}</div>
      {children}
    </div>
  );
}

export function Note({ tone = "info", children }) {
  const c = tone === "bad" ? "#d89080" : tone === "warn" ? "#c0a870" : "#7a8a90";
  return (
    <div style={{
      fontSize: 10.5, lineHeight: 1.7, color: c, marginTop: 7,
      padding: "6px 9px", background: "rgba(0,0,0,.3)",
      borderLeft: `2px solid ${c}66`, borderRadius: "0 3px 3px 0",
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
        fontSize: 12, padding: "6px 16px", borderRadius: 4, whiteSpace: "nowrap",
        color: main ? "#1a1206" : warn ? "#c0a870" : "#a89870",
        background: main ? "linear-gradient(180deg,#e0b860,#8a6a2a)" : "rgba(0,0,0,.3)",
        border: `1px solid ${main ? "#e0b860" : warn ? "#5a4a28" : "#3a3428"}`,
        opacity: disabled ? .4 : 1,
        fontWeight: main ? 700 : 400, letterSpacing: main ? 1 : 0,
      }}>{children}</span>
  );
}

// 小号切换按钮组（主角/NPC、性别这类二三选一）
export function Pills({ options, value, onChange, accent = "#d4a853" }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(o => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const on = v === value;
        return (
          <span key={v} onClick={() => onChange(v)} title={typeof o === "object" ? o.title : undefined}
            style={{
              cursor: "pointer", fontSize: 11.5, padding: "4px 14px", borderRadius: 3,
              border: `1px solid ${on ? accent : "#3a3428"}`,
              background: on ? "rgba(212,168,83,.14)" : "transparent",
              color: on ? accent : "#8a8270",
            }}>{label}</span>
        );
      })}
    </div>
  );
}

// ── 运行日志 ──────────────────────────────────────────────────────────────────

export const TERM_MONO = "ui-monospace,Menlo,Consolas,monospace";
const TERM_TONE = {
  start: { mark: "▸", color: "#8ac8b8" },
  done: { mark: "✓", color: "#8ab070" },
  fail: { mark: "✕", color: "#c08870" },
  retry: { mark: "↻", color: "#c0a870" },
  wait: { mark: "⧗", color: "#7a8a90" },
  info: { mark: "·", color: "#9a9a8a" },
};

/**
 * 终端样式的运行日志。视觉照 TraceViewer 来（#0a0c10 底、#9a9a8a 字、
 * #8ac8b8 高亮、等宽、pre-wrap），因为两处要看的是同一类东西：带时序的机器动作。
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
    <div style={{ borderTop: "1px solid #1a2020", background: "#0a0c10" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "3px 8px",
        borderBottom: "1px solid #141a1a", fontFamily: TERM_MONO, fontSize: 9,
        color: "#5a6a6a", letterSpacing: 1,
      }}>
        <span style={{ color: "#8ac8b8" }}>●</span>
        <span>入册运行日志</span>
        <span style={{ flex: 1 }} />
        <span>{lines.length} 行</span>
        {onExpand && <span onClick={onExpand} title="放大看" style={{ cursor: "pointer", color: "#8ac8b8" }}>⤢</span>}
      </div>
      <div ref={boxRef} style={{
        height, overflowY: "auto", padding: "5px 8px",
        fontFamily: TERM_MONO, fontSize: 9.5, lineHeight: 1.55,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {!lines.length && <span style={{ color: "#3a4444" }}>（尚无动作）</span>}
        {lines.map((l, i) => {
          const t = TERM_TONE[l.kind] || TERM_TONE.info;
          return (
            <div key={i} style={{ color: t.color }}>
              <span style={{ color: "#3a4444" }}>{l.at} </span>
              <span>{t.mark} </span>
              {l.tag ? <span style={{ color: "#6a7a7a" }}>[{l.tag}] </span> : null}
              <span>{l.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
