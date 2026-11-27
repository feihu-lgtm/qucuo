import { Icon } from "../../primitives/index.js";

export default function AttributesModule({ char, trainNeigong, trainWaigong, trainCost, pot, effectiveSpecialNow, activeBuffs }) {
  const nei = char.neigong ?? 0;
  const wai = char.waigong ?? 0;
  return (
    <div className="right-section attr-grid-wrap">
      <div className="attr-col">
        <div className="panel-sec-label">内功外功</div>
        <div className="attr-gong-block">
          <div className="attr-gong-head">
            <span className="attr-gong-name"><Icon name="内功" size={13} /> 内功 <span className="attr-gong-num">{nei}</span></span>
            <span
              onClick={trainNeigong}
              title={`运气打坐：消耗${trainCost(nei)}点潜能，内功+1（现有潜能${pot}）`} className="attr-train-neigong"
            >+1（{trainCost(nei)}潜能）</span>
          </div>
          <div className="night-bar"><div className="night-bar-fill night-bar-fill--neigong" style={{ width: `${Math.min(100, Math.max(0, nei))}%` }} /></div>
        </div>
        <div className="attr-gong-block">
          <div className="attr-gong-head">
            <span className="attr-gong-name"><Icon name="外功" size={13} /> 外功 <span className="attr-gong-num">{wai}</span></span>
            <span
              onClick={trainWaigong}
              title={`拆招练武：消耗${trainCost(wai)}点潜能，外功+1（现有潜能${pot}）`} className="attr-train-waigong"
            >+1（{trainCost(wai)}潜能）</span>
          </div>
          <div className="night-bar"><div className="night-bar-fill night-bar-fill--waigong" style={{ width: `${Math.min(100, Math.max(0, wai))}%` }} /></div>
        </div>
      </div>
      <div className="attr-col">
        <div className="panel-sec-label">七维</div>
        <div className="attr-special-grid">
          {Object.entries(char.special || {}).map(([k, v]) => {
            const eff = effectiveSpecialNow?.[k];
            const buffed = typeof eff === "number" && eff !== v;
            return (
              <div key={k} className="attr-special-item" title={buffed ? `基础${v}，药力/buff生效中` : undefined}>
                <span className="attr-special-key"><Icon name={k} size={13} /> {k}</span>
                <span className={`attr-special-val${buffed ? " is-buffed" : ""}`}>{buffed ? eff : v}</span>
                {buffed && <span className="attr-special-delta">({v}+{eff - v})</span>}
              </div>
            );
          })}
        </div>
        {activeBuffs.length > 0 && (
          <div className="attr-buff-list">
            {activeBuffs.map((b, i) => (
              <div key={i}>药力·{b.attr}+{b.val}（余{b.remaining}）</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
