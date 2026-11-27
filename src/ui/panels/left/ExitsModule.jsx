import { DIRS } from "../../../utils/mudHelpers.js";
import { QUCUO_MAP } from "../../../domain/data/map/qucuoMap.js";

export default function ExitsModule({ room, inSeaOfMind, seaGate, enterSeaOfMind, leaveSeaOfMind }) {
  const destMap = QUCUO_MAP[room.name]?.exits || {};
  return (
    <div className="left-exits">
      <div className="panel-sec-label">
        出口 <span className="panel-sec-sub">在下方输入框打字移动</span>
      </div>
      <div className="exit-chips">
        {room.exits.map(e => (
          <span key={e} className="exit-chip">
            <span className="exit-chip-dir">{DIRS[e] || e}</span>
            {destMap[e] && <span className="exit-chip-dest">{destMap[e]}</span>}
          </span>
        ))}
        {room.exits.length === 0 && <span className="panel-empty-dim">无路可走</span>}
      </div>

      {(inSeaOfMind || seaGate?.ok) && (
        <div
          onClick={inSeaOfMind ? leaveSeaOfMind : enterSeaOfMind}
          className={`sea-gate-btn${inSeaOfMind ? " is-active" : ""}`}
        >
          {inSeaOfMind ? "睁开眼，回去" : "闭上眼，进心灵之海"}
        </div>
      )}
    </div>
  );
}
