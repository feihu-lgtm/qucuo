import { DIRS } from "../../../utils/mudHelpers.js";
import { chromeBtn } from "../../../utils/theme.js";

export default function ExitsModule({ zoneTheme, room, inSeaOfMind, seaGate, enterSeaOfMind, leaveSeaOfMind }) {
 return (
    <div>
      <div style={{ color: zoneTheme.accentDim, fontSize: "var(--fs-xs)", marginBottom: 5, letterSpacing: "1px" }}>出口 <span style={{ color: zoneTheme.textDim, fontSize: "var(--fs-2xs)" }}>（在下方输入框打字移动）</span></div>
      <div style={{ marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {room.exits.map(e => (<span key={e} style={{ color: zoneTheme.accent }}>{DIRS[e] || e}</span>))}
        {room.exits.length === 0 && <span style={{ color: zoneTheme.textDim }}>无路可走</span>}
      </div>

      {(inSeaOfMind || seaGate?.ok) && (
        <div
          onClick={inSeaOfMind ? leaveSeaOfMind : enterSeaOfMind}
          style={{
            marginBottom: 14, padding: "7px 10px", borderRadius: 0, cursor: "pointer", userSelect: "none",
            ...chromeBtn(zoneTheme, { active: inSeaOfMind }),
            color: zoneTheme.accent, fontSize: "var(--fs-sm)", textAlign: "center",
          }}
        >
          {inSeaOfMind ? "⟡ 睁开眼，回去" : "⟡ 闭上眼，进心灵之海"}
        </div>
      )}
    </div>
  );
}
