// 共用小组件与样式（自 TavernSimScreen 拆出）：Btn/SectionTitle/S/CSS_KEYFRAMES。
import React from "react";

// 独立档存档键（localStorage，不碰主存档体系）
export const SAVE_KEY = "qucuo_tavern_sim_v1";

// ── 共用小组件 ─────────────────────────────────────────────────────────
export function Btn({ label, onClick, disabled, zoneTheme, secondary }) {
  return (
    <span onClick={disabled ? undefined : onClick}
      style={{
        fontSize: 12, padding: "4px 12px", borderRadius: 0, cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "var(--tavern-disabled-text)" : secondary ? zoneTheme.accentDim : zoneTheme.bg,
        background: disabled ? "var(--tavern-disabled-bg)" : secondary ? "transparent" : zoneTheme.accent,
        border: `1px solid ${disabled ? "var(--tavern-disabled-edge)" : secondary ? zoneTheme.border : zoneTheme.accent}`,
        opacity: disabled ? 0.5 : 1, userSelect: "none", whiteSpace: "nowrap",
      }}>{label}</span>
  );
}

export function SectionTitle({ children, zoneTheme }) {
  return <div style={{ color: zoneTheme.accentDim, fontSize: 11, margin: "12px 0 6px", borderBottom: `1px solid ${zoneTheme.border}`, paddingBottom: 3 }}>{children}</div>;
}

// ── 样式 ─────────────────────────────────────────────────────────────
export const S = {
  page: (t) => ({ height: "100vh", display: "flex", flexDirection: "column", background: t.bg || "var(--tavern-page-bg)", fontFamily: "inherit" }),
  topbar: (t) => ({ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${t.border}`, flexWrap: "wrap" }),
  chip: (t) => ({ color: "var(--ink-text)", fontSize: 12, border: `1px solid ${t.border}`, borderRadius: 0, padding: "3px 8px", background: "rgba(255,255,255,0.02)" }),
  mainRow: { flex: 1, display: "flex", minHeight: 0, flexWrap: "wrap" },
  sceneWrap: (t) => ({ flex: "1 1 58%", minWidth: 320, padding: 12, borderRight: `1px solid ${t.border}` }),
  scene: (night) => ({
    position: "relative", width: "100%", height: "100%", minHeight: 300, borderRadius: 0, overflow: "hidden",
    background: night
      ? "repeating-linear-gradient(90deg, var(--ink-wood-dark) 0px, var(--ink-wood-dark) 46px, var(--ink-wood-shade) 46px, var(--ink-wood-shade) 48px), linear-gradient(180deg, var(--tavern-wood-top-dark) 0%, var(--ink-wood-dark) 55%, var(--tavern-wood-bottom-dark) 100%)"
      : "repeating-linear-gradient(90deg, var(--ink-wood) 0px, var(--ink-wood) 46px, var(--ink-wood-mid) 46px, var(--ink-wood-mid) 48px), linear-gradient(180deg, var(--tavern-wood-top) 0%, var(--ink-wood) 55%, var(--ink-wood-dark) 100%)",
    border: "1px solid var(--ink-wood-line)",
  }),
  zoneLabel: { fontSize: 10, color: "var(--tavern-zone-label)", letterSpacing: 2, marginTop: 1 },
  side: (t) => ({ flex: "1 1 38%", minWidth: 280, display: "flex", flexDirection: "column", minHeight: 0 }),
  tabRow: (t) => ({ display: "flex", borderBottom: `1px solid ${t.border}` }),
  tab: (t, active) => ({
    flex: 1, textAlign: "center", padding: "8px 0", fontSize: 12, cursor: "pointer", userSelect: "none",
    color: active ? t.accent : "var(--ink-moss)", borderBottom: active ? `2px solid ${t.accent}` : "2px solid transparent",
  }),
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  box: (t) => ({ border: `1px solid ${t.border}`, borderRadius: 0, padding: "8px 10px", marginBottom: 8, background: "rgba(255,255,255,0.02)" }),
  logPanel: (t) => ({ height: 130, flex: "0 0 130px", minHeight: 0, overflowY: "auto", borderTop: `1px solid ${t.border}`, padding: "8px 14px", background: "rgba(0,0,0,0.25)" }),
  token: () => ({ fontSize: 20, marginTop: 2 }),
};

// CSS 动效：明灭灯笼 / 呼吸浮动 / 气泡 / 跑堂游走 / 灶台蒸汽
export const CSS_KEYFRAMES = `
@keyframes tsFlicker { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
.ts-lantern { animation: tsFlicker 2.4s ease-in-out infinite; font-size: 18px; }
@keyframes tsBreathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
.ts-breathe { animation: tsBreathe 2.8s ease-in-out infinite; }
.ts-bubble {
  position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%);
  background: rgba(20,18,10,0.92); border: 1px solid var(--gold-deep); border-radius: 6px;
  color: var(--ink-text); font-size: 10px; padding: 2px 8px; white-space: nowrap;
}
@keyframes tsRoam {
  0% { left: 20%; top: 40%; } 25% { left: 45%; top: 60%; }
  50% { left: 55%; top: 38%; } 75% { left: 30%; top: 66%; } 100% { left: 20%; top: 40%; }
}
.ts-runner { position: absolute; font-size: 20px; animation: tsRoam 18s linear infinite; } @media(max-width:767px){.ts-main-row{flex-direction:column;flex-wrap:nowrap;overflow:hidden}.ts-scene-wrap{flex:0 0 32vh!important;min-width:0!important;min-height:0!important;padding:8px!important;border-right:0!important}.ts-scene-wrap>div{min-height:0!important}.ts-side{flex:1 1 0!important;min-width:0!important;min-height:0!important}.ts-log-panel{position:relative;flex:0 0 130px!important;max-height:130px}}
@keyframes tsSteam { 0% { transform: translateY(0); opacity: 0.5; } 100% { transform: translateY(-14px); opacity: 0; } }
.ts-steam { position: absolute; left: 50%; top: -6px; }
.ts-steam i { display: inline-block; width: 3px; height: 3px; border-radius: 50%; background: var(--tavern-steam); margin: 0 2px; animation: tsSteam 1.8s ease-out infinite; }
.ts-steam i:nth-child(2) { animation-delay: 0.6s; }
.ts-steam i:nth-child(3) { animation-delay: 1.2s; }
`;
