// 阶段二：选人布阵（两队阵容条 + 候选名单）。

import React, { useState } from "react";
import TextBtn from "./TextBtn.jsx";
import { MAX_TEAM, PORTRAIT, tierColor, tierName, sx } from "./qbShared.js";

export default function PickScreen({ mode, candidates, allyIds, foeIds, setAllyIds, setFoeIds, onBack, onStart }) {
  const [tab, setTab] = useState("ally"); // 当前在给哪一队选人
  const cap = mode === "1v1" ? 1 : MAX_TEAM;
  const curIds = tab === "ally" ? allyIds : foeIds;
  const setCur = tab === "ally" ? setAllyIds : setFoeIds;
  const otherIds = tab === "ally" ? foeIds : allyIds;

  const toggle = (id) => {
    if (curIds.includes(id)) { setCur(curIds.filter(x => x !== id)); return; }
    if (curIds.length >= cap) {
      if (mode === "1v1") { setCur([id]); return; } // 1v1 直接替换
      return; // 团战满员不再加
    }
    setCur([...curIds, id]);
  };

  const canStart = allyIds.length > 0 && foeIds.length > 0;

  return (
    <div style={sx.pickWrap}>
      <div style={sx.pickHeader}>
        <TextBtn onClick={onBack}>← 换模式</TextBtn>
        <div style={{ fontSize: "clamp(15px, 4vw, 20px)", letterSpacing: 2, color: "var(--gold-light)", whiteSpace: "nowrap" }}>
          布阵 · {mode === "1v1" ? "单挑" : "团战"}
        </div>
        <button
          onClick={canStart ? onStart : undefined}
          disabled={!canStart}
          style={{ ...sx.startBtn, opacity: canStart ? 1 : 0.35, cursor: canStart ? "pointer" : "default", whiteSpace: "nowrap" }}
        >
          开打 →
        </button>
      </div>

      {/* 两队当前阵容条 */}
      <div style={sx.teamsRow}>
        <TeamBar label="我方" ids={allyIds} candidates={candidates} active={tab === "ally"} onClick={() => setTab("ally")} onRemove={(id) => setAllyIds(allyIds.filter(x => x !== id))} accent="var(--blue)" />
        <div style={sx.vs}>VS</div>
        <TeamBar label="敌方" ids={foeIds} candidates={candidates} active={tab === "foe"} onClick={() => setTab("foe")} onRemove={(id) => setFoeIds(foeIds.filter(x => x !== id))} accent="var(--qb-foe)" />
      </div>
      <div style={sx.pickHint}>
        正在挑选<b style={{ color: tab === "ally" ? "var(--blue)" : "var(--qb-foe)" }}>{tab === "ally" ? "我方" : "敌方"}</b>
        （{curIds.length}/{cap}）· 点头像加入本队，再点一次移出 · 点上方队旗切换给哪队选
      </div>

      {/* 候选名单 */}
      <div className="qb-candgrid" style={sx.candidateGrid}>
        {candidates.map(c => {
          const inCur = curIds.includes(c.id);
          const inOther = otherIds.includes(c.id);
          return (
            <CandidateCard
              key={c.id} c={c}
              picked={inCur} disabled={inOther}
              accent={tab === "ally" ? "var(--blue)" : "var(--qb-foe)"}
              onClick={() => !inOther && toggle(c.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function TeamBar({ label, ids, candidates, active, onClick, onRemove, accent }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, minHeight: 92, padding: "10px 14px", cursor: "pointer",
        background: "rgba(20,16,10,.55)",
        border: `2px solid ${active ? accent : "rgba(255,255,255,.12)"}`,
        borderRadius: 0, transition: "border-color .2s",
      }}
    >
      <div style={{ fontSize: "var(--fs-md)", letterSpacing: 2, color: accent, marginBottom: 8 }}>
        {label}（{ids.length}）{active && <span style={{ color: "var(--parchment)", fontSize: "var(--fs-xs)" }}> · 挑选中</span>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {ids.length === 0 && <span style={{ color: "var(--qb-border)", fontSize: "var(--fs-sm)" }}>还没人上阵</span>}
        {ids.map(id => {
          const c = candidates.find(x => x.id === id);
          if (!c) return null;
          return (
            <div key={id} onClick={(e) => { e.stopPropagation(); onRemove(id); }}
              title="点击移出"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
                background: "rgba(0,0,0,.35)", border: `1px solid ${tierColor(c.levelCap)}`,
                borderRadius: 0, fontSize: "var(--fs-sm)", color: "var(--qb-text)", cursor: "pointer" }}>
              {c.name} <span style={{ color: "var(--qb-border)" }}>✕</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CandidateCard({ c, picked, disabled, accent, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      className="qb-candidate-card"
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", width: "100%", aspectRatio: "108/148", padding: 0, cursor: disabled ? "not-allowed" : "pointer",
        border: `2px solid ${picked ? accent : tierColor(c.levelCap)}`,
        borderRadius: 0, overflow: "hidden", background: "var(--qb-felt)", boxSizing: "border-box",
        opacity: disabled ? 0.3 : 1,
        boxShadow: picked ? `0 0 14px ${accent}` : (hover && !disabled ? "0 4px 14px rgba(0,0,0,.6)" : "none"),
        transform: hover && !disabled ? "translateY(-3px)" : "none", transition: "all .18s ease",
      }}
    >
      {/* 有立绘用真图，没有的用品阶色底 + 大字名 */}
      {c.portrait ? (
        <img src={PORTRAIT(c.portrait)} alt={c.name}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px",
          background: `radial-gradient(120% 90% at 50% 20%, ${tierColor(c.levelCap)}22 0%, var(--qb-felt) 70%)` }}>
          <span style={{
            fontSize: c.name.length >= 4 ? 20 : c.name.length === 3 ? 24 : 30,
            lineHeight: 1.1, color: tierColor(c.levelCap), fontWeight: "bold", textAlign: "center",
            writingMode: c.name.length > 4 ? "vertical-rl" : "horizontal-tb",
            wordBreak: "break-word", maxHeight: "100%", overflow: "hidden" }}>{c.name}</span>
        </div>
      )}
      {/* 底部名条 */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "4px 6px",
        background: "linear-gradient(0deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.55) 60%, transparent 100%)" }}>
        <div style={{ fontSize: "var(--fs-md)", color: "var(--qb-text)", fontWeight: "bold", textShadow: "0 1px 2px var(--black)" }}>{c.name}</div>
        <div style={{ fontSize: "var(--fs-2xs)", color: tierColor(c.levelCap), letterSpacing: 1 }}>
          {tierName(c.levelCap)}品{c.beast ? " · 兽" : ""}
        </div>
      </div>
      {picked && <div style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%",
        background: accent, color: "var(--white)", fontSize: "var(--fs-md)", display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>}
    </button>
  );
}
