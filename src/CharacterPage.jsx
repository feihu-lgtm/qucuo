import React, { useState } from "react";
import { listCharacters, npcAffectionLabel } from "./mvu.js";
import { getAvailableMilestone, getAllMilestonesForChar } from "./characterMilestones.js";

const cardStyle = {
  background: "#10121a", border: "1px solid #1a2d2a", borderRadius: 8,
  padding: 14, cursor: "pointer", transition: "border-color 0.2s",
};

export default function CharacterPage({ varTree, claimedMilestones, onClaimMilestone, onClose, onGift, initialSelected }) {
  const [selected, setSelected] = useState(initialSelected || null); // 当前打开详情的角色名；左侧"面板"按钮可以指定直接打开谁
  const characters = listCharacters(varTree).filter(c => typeof c.attrs.好感度 === "number");

  const selectedChar = selected ? characters.find(c => c.name === selected) : null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(4,4,10,0.92)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div
        style={{ background: "#0a0c14", border: "1px solid #2a3a3a", borderRadius: 6, padding: 20, width: 640, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto", fontFamily: "inherit", fontSize: "12.5px", color: "#c8bfa0" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ color: "#6ec6c6", fontSize: "14px" }}>人物关系</span>
          <span style={{ color: "#5a5a4a", fontSize: "11px", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
        </div>

        {characters.length === 0 && (
          <div style={{ color: "#3a3830", textAlign: "center", padding: "40px 0" }}>尚未结识任何人，先去游戏里闯闯吧</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {characters.map(({ name, attrs }) => {
            const affection = attrs.好感度 ?? 0;
            const milestone = getAvailableMilestone(name, affection, claimedMilestones);
            return (
              <div
                key={name}
                style={{ ...cardStyle, borderColor: milestone ? "#f0c060" : "#1a2d2a" }}
                onClick={() => setSelected(name)}
              >
                <div style={{ color: "#c8bfa0", fontSize: "13px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{name}</span>
                  {milestone && <span style={{ color: "#f0c060", fontSize: "10px" }}>● 任务</span>}
                </div>
                <div style={{ fontSize: "10.5px", color: "#e0a0d0", marginBottom: 3 }}>{npcAffectionLabel(affection)}</div>
                <div style={{ height: 6, background: "#1a1420", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, affection)}%`, background: "linear-gradient(90deg, #e0a0d0, #f0c060)" }} />
                </div>
                <div style={{ fontSize: "10px", color: "#5a5a4a", marginTop: 3, textAlign: "right" }}>{affection}/100</div>
              </div>
            );
          })}
        </div>

        {selectedChar && (
          <CharacterDetail
            name={selectedChar.name}
            attrs={selectedChar.attrs}
            claimedMilestones={claimedMilestones}
            onClaimMilestone={onClaimMilestone}
            onGift={onGift}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}

function CharacterDetail({ name, attrs, claimedMilestones, onClaimMilestone, onGift, onClose }) {
  const affection = attrs.好感度 ?? 0;
  const allMilestones = getAllMilestonesForChar(name);
  const [viewingMilestone, setViewingMilestone] = useState(null);

  const handleClaim = (m) => {
    setViewingMilestone(m);
    onClaimMilestone(name, m.threshold);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(4,4,10,0.85)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div
        style={{ background: "#0c0e16", border: "1px solid #2a3a3a", borderRadius: 6, padding: 20, width: 460, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto", color: "#c8bfa0", fontSize: "12.5px" }}
        onClick={e => e.stopPropagation()}
      >
        {!viewingMilestone ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ color: "#6ec6c6", fontSize: "14px" }}>{name}</span>
              <span style={{ color: "#5a5a4a", fontSize: "11px", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
            </div>

            <div style={{ fontSize: "11.5px", color: "#e0a0d0", marginBottom: 4 }}>{npcAffectionLabel(affection)}</div>
            <div style={{ height: 8, background: "#1a1420", borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
              <div style={{ height: "100%", width: `${Math.min(100, affection)}%`, background: "linear-gradient(90deg, #e0a0d0, #f0c060)" }} />
            </div>
            <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginBottom: 14 }}>{affection}/100</div>

            {attrs.态度 && (
              <div style={{ fontSize: "11px", color: "#8a8a7a", marginBottom: 14, fontStyle: "italic" }}>「{attrs.态度}」</div>
            )}

            <div
              onClick={() => onGift(name)}
              style={{ cursor: "pointer", color: "#0a0c14", background: "#6ec6c6", borderRadius: 4, padding: "8px 0", textAlign: "center", marginBottom: 16, fontWeight: "bold" }}
            >
              送礼
            </div>

            <div style={{ borderTop: "1px solid #1a1d2e", paddingTop: 12 }}>
              <div style={{ fontSize: "11px", color: "#5a8a5a", marginBottom: 8 }}>专属任务</div>
              {allMilestones.length === 0 && (
                <div style={{ color: "#3a3830", fontSize: "11px" }}>此人暂无专属任务</div>
              )}
              {allMilestones.map(m => {
                const key = `${name}:${m.threshold}`;
                const claimed = claimedMilestones.has(key);
                const unlocked = affection >= m.threshold;
                return (
                  <div
                    key={m.threshold}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 10px", marginBottom: 6, borderRadius: 4,
                      background: unlocked && !claimed ? "rgba(240,192,96,0.1)" : "#10121a",
                      border: `1px solid ${unlocked && !claimed ? "#4a3a1a" : "#1a1d2e"}`,
                    }}
                  >
                    <div>
                      <div style={{ color: unlocked ? "#c8bfa0" : "#4a4a4a" }}>
                        好感度{m.threshold} · {m.title}
                      </div>
                      <div style={{ fontSize: "10px", color: "#5a5a4a" }}>{m.brief}</div>
                    </div>
                    {claimed ? (
                      <span
                        onClick={() => setViewingMilestone(m)}
                        style={{ fontSize: "10.5px", color: "#5a8a5a", cursor: "pointer", whiteSpace: "nowrap" }}
                      >已领取 · 重看</span>
                    ) : unlocked ? (
                      <span
                        onClick={() => handleClaim(m)}
                        style={{ fontSize: "10.5px", color: "#f0c060", cursor: "pointer", border: "1px solid #4a3a1a", borderRadius: 3, padding: "3px 8px", whiteSpace: "nowrap" }}
                      >领取</span>
                    ) : (
                      <span style={{ fontSize: "10.5px", color: "#3a3830", whiteSpace: "nowrap" }}>未解锁</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ color: "#f0c060", fontSize: "13.5px" }}>{viewingMilestone.title}</span>
              <span style={{ color: "#5a5a4a", fontSize: "11px", cursor: "pointer" }} onClick={() => setViewingMilestone(null)}>← 返回</span>
            </div>
            <div style={{ lineHeight: 1.9, color: "#c8bfa0" }}>
              {viewingMilestone.text.map((line, i) => (
                <p key={i} style={{ marginBottom: 10 }}>{line}</p>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
