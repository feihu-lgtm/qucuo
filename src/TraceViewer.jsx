import React, { useState, useEffect } from "react";
import { getTraceLog, clearTraceLog, formatTrace, fmtMs } from "./actionTrace.js";
import * as ENGINE from "./enginePrompts.js";

const LAW_CHECKS = [
  { key: "ENGINE_IDENTITY", label: "引擎身份" },
  { key: "FORMAT_LAW", label: "格式铁律" },
  { key: "MAP_LAW", label: "地图铁律" },
  { key: "ISOLATION", label: "认知隔离" },
  { key: "CATALOG_TAIL", label: "物件志尾" },
  { key: "GM_RULE", label: "创造模式" },
];

export default function TraceViewer({ onClose, onReport }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 400);
    return () => clearInterval(id);
  }, []);
  const traces = getTraceLog();
  const [copied, setCopied] = useState(false);
  const [plOpen, setPlOpen] = useState(null);
  const [exOpen, setExOpen] = useState(null);
  const ICON = { pass: "✓", block: "⛔", fail: "✗", skip: "·", info: "•" };
  const COLOR = { pass: "#8ac48a", block: "#c8a860", fail: "#c46060", skip: "#5a5a4a", info: "#7a9ab8" };
  const copyAll = () => {
    const text = traces.map((t, i) => formatTrace(t, traces.length - i)).join("\n\n");
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const renderPromptBody = (pl, respLabel) => {
    const sys = pl.systemPrompt || "";
    const usr = (pl.userMessages || []).map(m => `[${m.role}] ${m.content}`).join("\n\n");
    const resp = pl.response || pl.text || (pl.error ? `（无回复）报错：${pl.error}` : "（无回复）");
    return (
      <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
        {[["System Prompt（系统提示全文）", sys], ["输入（本轮 user 消息）", usr], [respLabel, resp]].map(([label, body]) => (
          <div key={label}>
            <div style={{ fontSize: "9.5px", color: "#6a8a8a", marginBottom: 2 }}>{label}</div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "9.5px", lineHeight: 1.5, color: "#9a9a8a", background: "#0a0c10", border: "1px solid #1a2020", borderRadius: 3, padding: "6px 8px", maxHeight: 220, overflowY: "auto" }}>{body || "（空）"}</pre>
          </div>
        ))}
      </div>
    );
  };

  const renderLawCheck = (sys, meta) => {
    const hasMeta = meta && typeof meta === "object";
    const expectLit = (key) => {
      if (!hasMeta) return null;
      if (key === "ISOLATION") return !!meta.wantIsolation;
      if (key === "CATALOG_TAIL") return !!meta.wantCatalog;
      return true;
    };
    const rows = LAW_CHECKS.map(c => {
      const present = typeof sys === "string" && sys.includes(ENGINE[c.key]);
      const exp = expectLit(c.key);
      let mark, color;
      if (present) { mark = "✓"; color = "#8ac48a"; }
      else if (exp === false) { mark = "✓灭"; color = "#6a7a6a"; }
      else if (exp === true) { mark = "✗漂移?"; color = "#c46060"; }
      else { mark = "·"; color = "#6a6555"; }
      return { ...c, present, mark, color };
    });
    const presentN = rows.filter(r => r.present).length;
    const metaLine = hasMeta
      ? `scope=${meta.scope ?? "?"} · ${meta.narrativeOnly ? "双调用主叙事" : "单调用"}${meta.isSettle ? " · settle" : ""}${meta.settleKind ? ` · ${meta.settleKind}` : ""} · 判据 want[隔离=${meta.wantIsolation ? 1 : 0}/物件志=${meta.wantCatalog ? 1 : 0}/MVU=${meta.wantMvu ? 1 : 0}]`
      : "（本条 trace 无注入快照判据，仅做存在性陈述——旧记录或快照未接通时如此）";
    return (
      <div style={{ marginTop: 6, border: "1px solid #20262e", borderRadius: 3, padding: "6px 8px", background: "#0a0d12" }}>
        <div style={{ fontSize: "9.5px", color: "#7a9ab8", marginBottom: 4 }}>
          引擎铁律核对（{presentN}/{rows.length} 段见于本轮 system · ✓=在 / ✓灭=按规则本就不注入 / ✗漂移?=规则说该亮却未见，疑似与单一真源脱节）
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", fontSize: "9.5px" }}>
          {rows.map(r => (
            <span key={r.key} style={{ color: r.color }}>
              {r.mark} {r.label}
            </span>
          ))}
        </div>
        <div style={{ fontSize: "9px", color: hasMeta ? "#5a7a6a" : "#4a5a5a", marginTop: 4, lineHeight: 1.6 }}>
          {metaLine}。判据来自 buildSysBase 本轮自记的 wantXxx 局部变量，与注入文本同源；完整亮灭规则与灭因见 设置 → Prompt 注入结构面板。
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(8,10,14,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 620, maxHeight: "84vh", background: "#0e1116", border: "1px solid #2a3a3a", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #1a2020" }}>
          <span style={{ color: "#8ac8b8", fontSize: "13px" }}>🧭 行动全流程日志（最近 {traces.length} 条 · 含各层耗时与 AI 请求）</span>
          <span style={{ marginLeft: "auto", cursor: "pointer", color: "#6a8a8a", fontSize: "11px" }} onClick={copyAll}>{copied ? "✓已复制" : "复制全部"}</span>
          {onReport && <span style={{ cursor: "pointer", color: "#e08a6a", fontSize: "11px" }} onClick={() => { onClose(); onReport(); }}>🐞 上报bug</span>}
          <span style={{ cursor: "pointer", color: "#8a6a4a", fontSize: "11px" }} onClick={() => { clearTraceLog(); onClose(); }}>清空</span>
          <span style={{ cursor: "pointer", color: "#8a8a7a", fontSize: "13px" }} onClick={onClose}>✕</span>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 12px" }}>
          {traces.length === 0 && <div style={{ color: "#5a5a4a", fontSize: "12px", padding: 12 }}>还没有行动记录。做点什么（移动、对话、行动）就会出现在这里，每一步花了多久也会实时显示。</div>}
          {traces.map((t, i) => (
            <div key={t.ts} style={{ borderBottom: "1px solid #14181c", padding: "8px 4px" }}>
              <div style={{ fontSize: "11px", color: "#c8bfa0", marginBottom: 4 }}>
                <span style={{ color: "#5a5a4a" }}>#{traces.length - i}</span>
                <span style={{ color: "#4a4a3a", marginLeft: 6, fontSize: "9.5px" }}>{new Date(t.ts).toLocaleTimeString()}</span>
                {t.totalMs != null && <span style={{ color: "#c8a860", marginLeft: 6, fontSize: "9.5px" }}>共 {fmtMs(t.totalMs)}</span>}
                {t._running && <span style={{ color: "#8ac8b8", marginLeft: 6, fontSize: "9.5px" }}>⏳ 进行中·当前「{t.steps.length ? t.steps[t.steps.length - 1].layer : "启动"}」</span>}
              </div>
              <div style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: "11px", color: "#8ac8b8", background: "#0a0c10", border: "1px solid #1a2430", borderRadius: 3, padding: "4px 8px", marginBottom: 6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                <span style={{ color: "#4a6a5a" }}>$ </span>{t.raw != null ? t.raw : t.cmd}
              </div>
              {t.steps.map((s, si) => {
                const isAI = /AI|召回|模型|生成|提取/.test(s.layer);
                return (
                  <div key={si} style={{ fontSize: "10.5px", lineHeight: 1.75, paddingLeft: 8, display: "flex", gap: 4 }}>
                    <span style={{ color: COLOR[s.status] || "#7a9ab8", width: 14, flexShrink: 0 }}>{ICON[s.status] || "•"}</span>
                    <span style={{ flexShrink: 0, fontSize: "9px", color: isAI ? "#c88ae0" : "#5a7a8a" }}>{isAI ? "🤖AI" : "⚙系统"}</span>
                    <span style={{ color: isAI ? "#c8a8d8" : "#8a8a7a", flexShrink: 0 }}>[{s.layer}]</span>
                    <span style={{ color: "#a8a898", flex: 1 }}>{s.detail}</span>
                    {s.dt != null && <span style={{ color: s.dt > 3000 ? "#c8a860" : "#4a5a4a", flexShrink: 0, fontSize: "9.5px" }}>{fmtMs(s.dt)}</span>}
                  </div>
                );
              })}
              {t._running
                ? <div style={{ fontSize: "10.5px", color: "#8ac8b8", paddingLeft: 22, marginTop: 2 }}>⏳ 正在进行……当前「{t.steps.length ? t.steps[t.steps.length - 1].layer : "启动"}」</div>
                : <div style={{ fontSize: "10.5px", color: "#8ac48a", paddingLeft: 22, marginTop: 2 }}>✓ 已完成{t.summary ? `：${t.summary}` : ""}（全程 {fmtMs(t.totalMs)}）</div>}
              {t.pipeline && (() => {
                const pl = t.pipeline;
                const open = plOpen === t.ts;
                const sys = pl.systemPrompt || "";
                return (
                  <div style={{ marginTop: 6, paddingLeft: 8 }}>
                    <div onClick={() => setPlOpen(open ? null : t.ts)} style={{ cursor: "pointer", fontSize: "10.5px", color: "#c8a860", userSelect: "none" }}>
                      {open ? "▾" : "▸"} 主叙事 AI 请求全文（总 prompt {Math.round((sys.length + (pl.userMessages || []).reduce((a, m) => a + (m.content || "").length, 0)))} 字 · 回复 {(pl.response || pl.text || "").length} 字{pl.error ? " · ✗有错误" : ""}）
                    </div>
                    {open && (
                      <>
                        {renderPromptBody(pl, "AI 回复")}
                        {renderLawCheck(sys, t.injectionSnapshot?.meta)}
                      </>
                    )}
                  </div>
                );
              })()}
              {t.extractionPipeline && (() => {
                const pl = t.extractionPipeline;
                const open = exOpen === t.ts;
                const sys = pl.systemPrompt || "";
                const usrLen = (pl.userMessages || []).reduce((a, m) => a + (m.content || "").length, 0);
                return (
                  <div style={{ marginTop: 6, paddingLeft: 8 }}>
                    <div onClick={() => setExOpen(open ? null : t.ts)} style={{ cursor: "pointer", fontSize: "10.5px", color: "#c88ae0", userSelect: "none" }}>
                      {open ? "▾" : "▸"} → 提取层调用全文（双调用·第二次 AI 调用 · prompt {Math.round(sys.length + usrLen)} 字 · 回复 {(pl.response || pl.text || "").length} 字{pl.error ? " · ✗有错误" : ""}）
                    </div>
                    {open && renderPromptBody(pl, "提取层回复")}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
