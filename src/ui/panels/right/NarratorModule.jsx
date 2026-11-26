import { bar } from "../../../utils/mudHelpers.js";
import { NNPC_STAGE, affectionLabel } from "../../../domain/rules/narrator/narrator.js";

export default function NarratorModule({ narrator, confessToNarrator }) {
  return (
    <div style={{ borderTop: `1px solid var(--border)`, paddingTop: 8 }}>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--accent-dim)", marginBottom: 4 }}>旁白</div>
      {narrator.stage === NNPC_STAGE.CRASHED ? (
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--red-soft)" }}>信号已断开</div>
      ) : narrator.confessed ? (
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--ember)" }}>已告白 · 记忆碎片 {narrator.memoryFragments}/8</div>
      ) : (
        <>
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--pink)" }}>{affectionLabel(narrator.affection)}</div>
          <div style={{ fontSize: "var(--fs-sm)" }}>{bar(narrator.affection, 100, 8)} {narrator.affection}/100</div>
          {narrator.affection >= 100 && (
            <div
              onClick={confessToNarrator}
              title="向旁白告白"
              style={{ marginTop: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 20, height: 20, borderRadius: "50%",
                background: "var(--log-affection)", color: "var(--footer-stalled-bg)", fontWeight: 700, fontSize: "var(--fs-base)",
                boxShadow: "0 0 6px var(--log-affection)", animation: "pulse 1.6s ease-in-out infinite",
              }}>!</span>
              <span style={{ color: "var(--log-affection)", fontSize: "var(--fs-xs)" }}>心意已满，可向旁白告白</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
