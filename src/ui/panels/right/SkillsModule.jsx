import { useState } from "react";
import { STAGES, STAGE_UP_COST } from "../../../utils/mudHelpers.js";
import { deriveMoveFromSkill } from "../../../domain/rules/npc/npcGeneration.js";
import { moveEffectBrief } from "../../../domain/rules/economy/itemEffectText.js";
import { skillDetail } from "../../../domain/rules/kungfu/skillDetail.js";
import { QUALITY_COLOR } from "../../../domain/data/items/qualityColor.js";
import { moveStatLabel } from "../../format/itemStats.js";
import { Icon } from "../../primitives/index.js";

export default function SkillsModule({ skills, setSkills, inspectItem, inspecting, pot, breakthroughSkill }) {
  const [showIdleSkills, setShowIdleSkills] = useState(false);
  const [openSkill, setOpenSkill] = useState(null);
  return (
    <div className="right-section">
      {/* 武学：未上阵的默认收起。 */}
      <div className="panel-sec-head">
        <span className="panel-sec-label">武学</span>
        <span className="panel-sec-sub panel-sec-sub--grow">点名字看介绍 · 点圈运功上阵</span>
        {(() => {
          const idle = skills.filter(s => !s.active).length;
          if (!idle) return null;
          return (
            <span
              onClick={() => setShowIdleSkills(v => !v)} className="skills-idle-toggle"
            >{showIdleSkills ? `收起未上阵 ${idle}` : `未上阵 ${idle} ▾`}</span>
          );
        })()}
      </div>
      {skills.filter(s => s.active || showIdleSkills).map((s) => {
        const i = skills.indexOf(s);
        const q = s.quality || "白";
        const qc = QUALITY_COLOR[q] || "var(--text)";
        const mv = (s.fixed && s.move) ? s.move : deriveMoveFromSkill(s);
        const detailKey = s.id || `${s.fixed ? "fixed" : "skill"}:${s.name}:${s.moveType || mv.type || ""}`;
        const mType = s.moveType || mv.type;
        const kindIcon = s.type && ["招式", "内功", "轻功"].includes(s.type) ? s.type : "招式";
        return (
          <div key={i} className="skill-row" data-active={Boolean(s.active)} style={{ borderLeftColor: s.active ? qc : "transparent" }}>
            <div className="skill-row-head">
              <span
                onClick={() => setSkills(sk => {
                  const tgt = sk[i];
                  const tType = tgt.moveType;
                  const turningOn = !tgt.active;
                  return sk.map((ss, j) => {
                    if (j === i) return { ...ss, active: turningOn };
                    if (turningOn && tType && ss.moveType === tType) return { ...ss, active: false };
                    return ss;
                  });
                })}
                className="skill-active-btn"
                title={s.active ? "已上阵，点击卸下" : "运功上阵"}
              ><Icon name={s.active ? "已上阵" : "未上阵"} size={12} /></span>
              <span className="skill-kind-icon" title={mType ? `${mType}类武学` : kindIcon}>
                <Icon name={mType || kindIcon} size={13} />
              </span>
              <span
                onClick={() => {
                  const opening = openSkill !== detailKey;
                  setOpenSkill(opening ? detailKey : null);
                  if (opening) inspectItem("skill", s.name, s.fixed ? `${q}品·完整招式` : `${q}品·${s.stage}`, null, { worldLook: true });
                }}
                className="skill-name-btn"
                style={{ color: qc, fontWeight: s.active ? 600 : 400, opacity: inspecting === s.name ? 0.6 : 1 }}
              >{s.name}{s.fixed ? "" : `·${s.stage}`}{inspecting === s.name ? "…" : ""}</span>
              <span className="skill-quality" style={{ color: qc }}>（{q}品）</span>
              {(() => {
                const lbl = moveStatLabel(mv);
                return lbl ? <span className="skill-stat-lbl">{lbl}</span> : null;
              })()}
            </div>
            {(() => {
              const eff = moveEffectBrief(mv);
              return eff ? <div className="skill-eff-line">{eff}</div> : null;
            })()}
            {openSkill === detailKey && (() => {
              const d = skillDetail(s, mv);
              return (
                <div className="skill-detail-box">
                  {d.desc && <div className="skill-detail-desc">{d.desc}</div>}
                  {d.rows.map((r) => (
                    <div key={r.label}><span style={{ color: qc }}>{r.label}</span>　{r.value}</div>
                  ))}
                  {d.effects.map((e, k) => (
                    <div key={k} className={e.warn ? "skill-detail-warn" : "skill-detail-eff"}>· {e.text}</div>
                  ))}
                </div>
              );
            })()}
            {s.fixed
              ? (openSkill !== detailKey && s.move?.desc ? <div className="skill-fixed-desc">{s.move.desc}</div> : null)
              : (() => {
                  const curIdx = STAGES.indexOf(s.stage);
                  const maxed = curIdx >= STAGES.length - 1;
                  const nextStage = maxed ? null : STAGES[curIdx + 1];
                  const cost = nextStage ? (STAGE_UP_COST[nextStage] ?? 12) : 0;
                  const afford = pot >= cost;
                  return (
                    <div className="skill-stage-row">
                      <span className="skill-stage-text">
                        <Icon name={s.stage} size={12} /> 阶段 {curIdx + 1}/5 · {s.stage}
                      </span>
                      {maxed
                        ? <span className="skill-maxed" style={{ color: qc }}><Icon name="登峰造极" size={12} /> 登峰造极</span>
                        : <span
                            onClick={() => afford && breakthroughSkill(s.id ?? s.name)}
                            title={afford ? `潜心修炼：花${cost}潜能，${s.stage}→${nextStage}（现有潜能${pot}）` : `潜能不足，突破${nextStage}需${cost}点（现有${pot}）`} className="skills-train-btn" data-on={Boolean(afford)}
                          >↑修炼·{nextStage}（{cost}潜能）</span>}
                    </div>
                  );
                })()}
          </div>
        );
      })}
    </div>
  );
}
