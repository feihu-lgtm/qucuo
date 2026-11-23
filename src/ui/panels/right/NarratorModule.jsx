import { bar } from "../../../utils/mudHelpers.js";
import { NNPC_STAGE, affectionLabel } from "../../../domain/rules/narrator/narrator.js";

export default function NarratorModule({ zoneTheme, narrator, confessToNarrator }) {
  return (
    <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8 }}>
      <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>旁白</div>
      {narrator.stage === NNPC_STAGE.CRASHED ? (
        <div style={{ fontSize: "11.5px", color: "var(--red-soft)" }}>信号已断开</div>
      ) : narrator.confessed ? (
        <div style={{ fontSize: "11.5px", color: "var(--ember)" }}>已告白 · 记忆碎片 {narrator.memoryFragments}/8</div>
      ) : (
        <>
          <div style={{ fontSize: "11.5px", color: "var(--pink)" }}>{affectionLabel(narrator.affection)}</div>
          <div style={{ fontSize: "11.5px" }}>{bar(narrator.affection, 100, 8)} {narrator.affection}/100</div>
          {narrator.affection >= 100 && (
            <div
              onClick={confessToNarrator}
              title="向旁白告白"
              style={{ marginTop: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 20, height: 20, borderRadius: "50%",
                background: "var(--log-affection)", color: "var(--footer-stalled-bg)", fontWeight: 700, fontSize: "14px",
                boxShadow: "0 0 6px var(--log-affection)", animation: "pulse 1.6s ease-in-out infinite",
              }}>!</span>
              <span style={{ color: "var(--log-affection)", fontSize: "11px" }}>心意已满，可向旁白告白</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
