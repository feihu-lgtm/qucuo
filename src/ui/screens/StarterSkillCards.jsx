import React from "react";
import { deriveMoveFromSkill } from "../../domain/rules/npc/npcGeneration.js";
import { explainMove, moveTypeGist, passiveBonusBrief } from "../../domain/rules/economy/itemEffectText.js";
import { SKILL_TYPE } from "../../domain/data/kungfu/qucuoKungfu.js";

function typeLabel(skill) {
  return skill.type === SKILL_TYPE.MOVE ? `招式·${skill.moveType}` : skill.type;
}

function effectLine(skill) {
  if (skill.passiveBonus) return passiveBonusBrief(skill.passiveBonus);
  const move = deriveMoveFromSkill({ ...skill, stage: "入门" });
  const lines = explainMove(move).filter((line) => !line.text.startsWith("造成 ") && !line.text.startsWith("防御生效"));
  return lines[0]?.text || moveTypeGist(move);
}

export default function StarterSkillCards({ skills, selectedId, rerolls, onSelect, onReroll, onConfirm, theme }) {
  return (
    <>
      <div style={{ color: theme.accent, textAlign: "center", marginBottom: 10 }}>初始武功 · 三选一</div>
      <div className="starter-skill-card-list" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7 }}>
        {skills.map((skill) => (
          <button
            type="button"
            key={skill.id}
            aria-pressed={selectedId === skill.id}
            onClick={() => onSelect(skill.id)}
            style={{
              minWidth: 0, minHeight: 140, textAlign: "left", padding: 8, cursor: "pointer",
              color: theme.text, background: selectedId === skill.id ? `${theme.accent}22` : theme.bgPanel,
              border: `1px solid ${selectedId === skill.id ? theme.accent : theme.border}`,
            }}
          >
            <span style={{ display: "block", color: theme.accent, fontWeight: "bold", fontSize: 13 }}>{skill.name}</span>
            <span style={{ display: "block", margin: "5px 0", fontSize: 10, color: theme.textDim }}>{typeLabel(skill)} · {skill.quality}</span>
            <span style={{ display: "block", fontSize: 10, lineHeight: 1.5 }}>{effectLine(skill)}</span>
            <span style={{ display: "block", marginTop: 5, fontSize: 10, lineHeight: 1.5, color: theme.textDim }}>{skill.desc}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onReroll} disabled={rerolls <= 0} style={{ width: "100%", marginTop: 9, padding: 8, border: `1px solid ${theme.border}`, background: theme.bgPanel, color: theme.text, opacity: rerolls > 0 ? 1 : 0.4, cursor: rerolls > 0 ? "pointer" : "not-allowed" }}>
        重抽（剩 {rerolls}）
      </button>
      <button type="button" onClick={onConfirm} disabled={!selectedId} style={{ width: "100%", marginTop: 9, padding: "11px 0", border: `1px solid ${theme.accent}`, background: theme.accent, color: theme.bg, fontWeight: "bold", letterSpacing: 2, opacity: selectedId ? 1 : 0.4, cursor: selectedId ? "pointer" : "not-allowed" }}>
        踏入曲措乡 ▸
      </button>
    </>
  );
}
