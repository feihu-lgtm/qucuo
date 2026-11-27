import { DIRS } from "../../../utils/mudHelpers.js";
import { QUCUO_MAP } from "../../../domain/data/map/qucuoMap.js";
import { placeArtUrl } from "../../art/art.js";

export default function ExitsModule({
  room, mapData, onGoOuter, loading = false,
  inSeaOfMind, seaGate, enterSeaOfMind, leaveSeaOfMind,
}) {
  const destMap = QUCUO_MAP[room.name]?.exits || {};
  const exits = Array.isArray(room.exits) ? room.exits : Object.keys(destMap);

  return (
    <div className="left-exits">
      <div className="panel-sec-label">
        邻近地点 <span className="panel-sec-sub">点击卡片前往或探索</span>
      </div>
      {exits.length > 0 ? (
        <div className="left-exit-grid">
          {exits.map(dir => {
            const dest = destMap[dir];
            const explored = Boolean(dest && mapData?.[dest]);
            const artSrc = explored ? placeArtUrl(dest) : null;
            const dirLabel = DIRS[dir] || dir;
            return (
              <button
                key={dir}
                type="button"
                className={`left-exit-card${exits.length === 1 ? " is-single" : ""}`}
                data-explored={Boolean(explored)}
                data-has-art={Boolean(artSrc)}
                disabled={Boolean(loading)}
                onClick={() => onGoOuter?.(dir)}
                title={explored ? `往${dirLabel}前往「${dest}」` : `往${dirLabel}探索未知之地`}
              >
                {artSrc && (
                  <>
                    <img src={artSrc} alt={dest} className="left-thumb-img" loading="lazy" decoding="async" />
                    <span className="left-thumb-scrim" aria-hidden="true" />
                  </>
                )}
                <span className="left-thumb-dir">{dirLabel}</span>
                <span className="left-thumb-name">{explored ? dest : "未探明"}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="panel-empty-dim">无路可走</div>
      )}

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
