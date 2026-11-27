import { NNPC_STAGE, affectionLabel } from "../../../domain/rules/narrator/narrator.js";
import NpcAvatar from "../../components/NpcAvatar.jsx";
import { narratorArtUrl } from "../../art/art.js";

export default function NarratorModule({ narrator, confessToNarrator }) {
  const pct = Math.min(100, Math.max(0, narrator.affection || 0));
  return (
    <div className="right-section">
      <div className="panel-sec-label">旁白</div>
      <div className="narrator-row">
        <NpcAvatar name="旁白" src={narratorArtUrl(narrator.affection)} size="md" lotus />
        <div className="narrator-row-body">
          {narrator.stage === NNPC_STAGE.CRASHED ? (
            <div className="narrator-crashed">信号已断开</div>
          ) : narrator.confessed ? (
            <div className="narrator-confessed">已告白 · 记忆碎片 {narrator.memoryFragments}/8</div>
          ) : (
            <>
              <div className="narrator-aff-head">
                <span className="narrator-aff-label">{affectionLabel(narrator.affection)}</span>
                <span className="narrator-aff-num">{narrator.affection}/100</span>
              </div>
              <div className="night-bar"><div className="night-bar-fill night-bar-fill--lotus" style={{ width: `${pct}%` }} /></div>
              {narrator.affection >= 100 && (
                <button type="button" onClick={confessToNarrator} title="向旁白告白" className="narrator-confess-btn">
                  心意已满，可向旁白告白
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
