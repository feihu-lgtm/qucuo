// 团战切磋界面（TeamDuelScreen）的内联样式表。
export const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(4,4,10,0.85)",
    zIndex: 450, display: "flex", alignItems: "center", justifyContent: "center",
  },
  container: {
    width: 560, maxWidth: "94vw", maxHeight: "92vh", borderRadius: 0, padding: 16,
    display: "flex", flexDirection: "column", gap: 12, overflowY: "auto",
  },
  teamsRow: { display: "flex", alignItems: "flex-start", gap: 12 },
  teamCol: { flex: 1, minWidth: 0 },
  vsCol: (t) => ({
    fontSize: "10px", color: t.accent, border: `1px solid ${t.accent}`,
    borderRadius: 0, padding: "3px 8px", flexShrink: 0, whiteSpace: "nowrap", marginTop: 18,
  }),
  opSection: { display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 },
  sectionLabel: (t) => ({ fontSize: "12px", color: t.accent, letterSpacing: "1px" }),
  moveGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: "26vh", overflowY: "auto" },
  targetRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  warnLine: { textAlign: "center", color: "var(--red-soft)", fontSize: "11px", padding: "4px 0" },
  hintLine: (t) => ({ fontSize: "11px", color: t.textDim, textAlign: "center", marginBottom: 6 }),
  enemyStripLabel: (t) => ({ fontSize: "10.5px", color: t.textDim, marginTop: 4 }),
  enemyStrip: { display: "flex", flexWrap: "wrap", gap: 6 },
  enemyChip: (t, revealed) => ({
    fontSize: "11px", padding: "4px 8px", borderRadius: 0,
    border: `1px dashed ${revealed ? t.accentDim : "rgba(255,255,255,0.15)"}`,
    color: revealed ? t.text : t.textDim,
    cursor: revealed ? "pointer" : "default",
    background: revealed ? "rgba(255,255,255,0.04)" : "transparent",
  }),
  logSection: {
    borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10,
    maxHeight: "30vh", overflowY: "auto", fontFamily: "inherit",
  },
  logHint: (t) => ({ fontSize: "12px", color: t.textDim, textAlign: "center", padding: "16px 0" }),
  continueRow: { textAlign: "center", marginTop: 6 },
  continueBtn: (t) => ({
    cursor: "pointer", display: "inline-block", padding: "8px 24px",
    color: t.accent, border: `1px solid ${t.accent}`, borderRadius: 0, fontSize: "12px",
  }),
};
