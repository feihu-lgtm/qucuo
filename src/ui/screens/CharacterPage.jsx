import React, { useState } from "react";
import { listCharacters, npcAffectionLabel } from "../../domain/rules/prompt/mvu.js";
import { getAvailableMilestone, getAllMilestonesForChar } from "../../domain/data/character/characterMilestones.js";
import {
  HEART_LEDGER_TAGS,
  normalizeLedgerEntries,
  groupHeartLedgerByTag,
} from "../../domain/rules/memory/npcLedger.js";
import ModalShell from "../primitives/ModalShell.jsx";

const cardStyle = {
  background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0,
  padding: 14, cursor: "pointer", transition: "border-color 0.2s",
};

export default function CharacterPage({ varTree, claimedMilestones, onClaimMilestone, onClose, onGift, initialSelected }) {
  // 遮罩、防拖选误关、Esc 由 ModalShell 负责。
  const [selected, setSelected] = useState(initialSelected || null); // 当前打开详情的角色名；左侧"面板"按钮可以指定直接打开谁
  const characters = listCharacters(varTree).filter(c => typeof c.attrs.好感度 === "number");

  const selectedChar = selected ? characters.find(c => c.name === selected) : null;

  // 标题栏沿用自己的（下边距 14）；详情弹窗挂在本面板里，按 Esc 先关详情、再关本页。
  return (
    <ModalShell onClose={onClose} layer="screen-high" showClose={false} ariaLabel="人物关系"
      panelClassName="mobile-character-panel" panelStyle={{ width: 640, maxWidth: "92vw" }}>
      <div className="mobile-overlay-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ color: "var(--accent)", fontSize: "var(--fs-base)" }}>人物关系</span>
        <span className="mobile-overlay-close" style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
      </div>

      {characters.length === 0 && (
        <div style={{ color: "var(--ink-dim-deep)", textAlign: "center", padding: "40px 0" }}>尚未结识任何人，先去游戏里闯闯吧</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
        {characters.map(({ name, attrs }) => {
          const affection = attrs.好感度 ?? 0;
          const milestone = getAvailableMilestone(name, affection, claimedMilestones);
          return (
            <div
              key={name}
              style={{ ...cardStyle, borderColor: milestone ? "var(--ember)" : "var(--ink-border)" }}
              onClick={() => setSelected(name)}
            >
              <div style={{ color: "var(--text)", fontSize: "var(--fs-md)", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{name}</span>
                {milestone && <span style={{ color: "var(--ember)", fontSize: "var(--fs-2xs)" }}>● 任务</span>}
              </div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--pink)", marginBottom: 3 }}>{npcAffectionLabel(affection)}</div>
              <div style={{ height: 6, background: "var(--bg-panel)", borderRadius: 0, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, affection)}%`, background: "linear-gradient(90deg, var(--pink), var(--ember))" }} />
              </div>
              <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", marginTop: 3, textAlign: "right" }}>{affection}/100</div>
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
    </ModalShell>
  );
}

function CharacterDetail({ name, attrs, claimedMilestones, onClaimMilestone, onGift, onClose }) {
  const affection = attrs.好感度 ?? 0;
  const allMilestones = getAllMilestonesForChar(name);
  const [viewingMilestone, setViewingMilestone] = useState(null);
  const [ledgerTagFilter, setLedgerTagFilter] = useState("全部");

  const ledgerEntries = normalizeLedgerEntries(attrs.心账);
  const { groups, unknown } = groupHeartLedgerByTag(ledgerEntries);
  const visibleLedger = ledgerTagFilter === "全部"
    ? ledgerEntries
    : ledgerTagFilter === "旧类"
      ? unknown
      : (groups[ledgerTagFilter] || []);

  const handleClaim = (m) => {
    setViewingMilestone(m);
    onClaimMilestone(name, m.threshold);
  };

  // 原 z 400、遮罩 0.85，并入 dialog 档与 --ink-overlay；它挂在人物页面板内部，层级只在人物页里比较。
  return (
    <ModalShell onClose={onClose} layer="dialog" showClose={false} ariaLabel={name}
      panelClassName="character-detail-panel" panelStyle={{ width: 460, maxHeight: "80vh" }}>
      {!viewingMilestone ? (
        <>
          <div className="mobile-overlay-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ color: "var(--accent)", fontSize: "var(--fs-base)" }}>{name}</span>
            <span className="mobile-overlay-close" style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
          </div>

          <div style={{ fontSize: "var(--fs-sm)", color: "var(--pink)", marginBottom: 4 }}>{npcAffectionLabel(affection)}</div>
          <div style={{ height: 8, background: "var(--bg-panel)", borderRadius: 0, overflow: "hidden", marginBottom: 4 }}>
            <div style={{ height: "100%", width: `${Math.min(100, affection)}%`, background: "linear-gradient(90deg, var(--pink), var(--ember))" }} />
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 14 }}>{affection}/100</div>

          {attrs.态度 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 14, fontStyle: "italic" }}>「{attrs.态度}」</div>
          )}

          <div
            onClick={() => onGift(name)}
            style={{ cursor: "pointer", color: "var(--bg-panel)", background: "var(--accent)", borderRadius: 0, padding: "8px 0", textAlign: "center", marginBottom: 16, fontWeight: "bold" }}
          >
            送礼
          </div>

          <div style={{ borderTop: "1px solid var(--ink-divider)", paddingTop: 12, marginBottom: 14 }}>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--accent)", marginBottom: 8 }}>心账</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {["全部", ...HEART_LEDGER_TAGS, ...(unknown.length ? ["旧类"] : [])].map((tab) => {
                const count = tab === "全部" ? ledgerEntries.length : tab === "旧类" ? unknown.length : (groups[tab]?.length || 0);
                const active = ledgerTagFilter === tab;
                return (
                  <span
                    key={tab}
                    onClick={() => setLedgerTagFilter(tab)}
                    style={{
                      cursor: "pointer",
                      fontSize: "var(--fs-2xs)",
                      padding: "2px 6px",
                      border: `1px solid ${active ? "var(--accent)" : "var(--ink-divider)"}`,
                      color: active ? "var(--accent)" : "var(--text-dim)",
                    }}
                  >
                    {tab}{count > 0 ? ` ${count}` : ""}
                  </span>
                );
              })}
            </div>
            {visibleLedger.length === 0 ? (
              <div style={{ color: "var(--ink-dim-deep)", fontSize: "var(--fs-xs)" }}>此项下暂无心账记录</div>
            ) : (
              visibleLedger.map((entry) => (
                <div
                  key={entry.id}
                  data-ledger-id={entry.id}
                  style={{
                    padding: "6px 8px",
                    marginBottom: 6,
                    border: "1px solid var(--ink-divider)",
                    background: "var(--bg-panel)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-2xs)", color: "var(--text-dim)", marginBottom: 2 }}>
                    <span style={{ color: "var(--accent)" }}>[{entry.tag}]</span>
                    {entry.turn > 0 && <span>第{entry.turn}回合</span>}
                    {entry.place && <span>{entry.place}</span>}
                  </div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--text)" }}>{entry.summary || "（无摘要）"}</div>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--ink-divider)", paddingTop: 12 }}>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--good)", marginBottom: 8 }}>专属任务</div>
            {allMilestones.length === 0 && (
              <div style={{ color: "var(--ink-dim-deep)", fontSize: "var(--fs-xs)" }}>此人暂无专属任务</div>
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
                    padding: "8px 10px", marginBottom: 6, borderRadius: 0,
                    background: unlocked && !claimed ? "rgba(240,192,96,0.1)" : "var(--bg-panel)",
                    border: `1px solid ${unlocked && !claimed ? "var(--gold-deep)" : "var(--ink-divider)"}`,
                  }}
                >
                  <div>
                    <div style={{ color: unlocked ? "var(--text)" : "var(--building-disabled-text)" }}>
                      好感度{m.threshold} · {m.title}
                    </div>
                    <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)" }}>{m.brief}</div>
                  </div>
                  {claimed ? (
                    <span
                      onClick={() => setViewingMilestone(m)}
                      style={{ fontSize: "var(--fs-xs)", color: "var(--good)", cursor: "pointer", whiteSpace: "nowrap" }}
                    >已领取 · 重看</span>
                  ) : unlocked ? (
                    <span
                      onClick={() => handleClaim(m)}
                      style={{ fontSize: "var(--fs-xs)", color: "var(--ember)", cursor: "pointer", border: "1px solid var(--gold-deep)", borderRadius: 0, padding: "3px 8px", whiteSpace: "nowrap" }}
                    >领取</span>
                  ) : (
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-dim-deep)", whiteSpace: "nowrap" }}>未解锁</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: "var(--ember)", fontSize: "var(--fs-base)" }}>{viewingMilestone.title}</span>
            <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", cursor: "pointer" }} onClick={() => setViewingMilestone(null)}>← 返回</span>
          </div>
          <div style={{ lineHeight: 1.9, color: "var(--text)" }}>
            {viewingMilestone.text.map((line, i) => (
              <p key={i} style={{ marginBottom: 10 }}>{line}</p>
            ))}
          </div>
        </>
      )}
    </ModalShell>
  );
}
