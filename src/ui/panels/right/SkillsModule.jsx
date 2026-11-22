import { useState } from "react";
import { QUALITY_COLOR } from "../../../domain/rules/economy/equipment.js";
import { STAGES, STAGE_UP_COST } from "../../../utils/mudHelpers.js";
import { deriveMoveFromSkill } from "../../../domain/rules/npc/npcGeneration.js";
import { moveStatLabel, moveEffectBrief } from "../../../domain/rules/economy/itemEffectText.js";
import { skillDetail } from "../../../domain/rules/kungfu/skillDetail.js";

export default function SkillsModule({ zoneTheme, skills, setSkills, inspectItem, inspecting, pot, breakthroughSkill }) {
  const [showIdleSkills, setShowIdleSkills] = useState(false);
  const [openSkill, setOpenSkill] = useState(null);
  return (
    <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
      {/* 武学：未上阵的默认收起。玩家学的招会越攒越多（拜师/偷师/自练），
          全铺开之后上阵那几门反而被埋在中间——而真正每回合要看的只有上阵的。
          收起来的仍可一键展开，不是隐藏功能。 */}
      <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <span>武学</span>
        <span style={{ color: zoneTheme.textDim, fontSize: "10px", flex: 1 }}>点名字看介绍 · 点圈运功上阵（每类只运一门，▶已上阵）</span>
        {(() => {
          const idle = skills.filter(s => !s.active).length;
          if (!idle) return null;
          return (
            <span
              onClick={() => setShowIdleSkills(v => !v)}
              style={{ cursor: "pointer", fontSize: "9.5px", color: zoneTheme.accent, border: `1px solid ${zoneTheme.border}`, borderRadius: 0, padding: "0 4px", flexShrink: 0 }}
            >{showIdleSkills ? `收起未上阵 ${idle}` : `未上阵 ${idle} ▾`}</span>
          );
        })()}
      </div>
      {skills.filter(s => s.active || showIdleSkills).map((s) => {
        const i = skills.indexOf(s);
        const q = s.quality || "白";
        const qc = QUALITY_COLOR[q] || "var(--text)";
        // 真实招式本体：fixed（拜师/偷师完整招）直接取 s.move，可修炼武学按当前
        // 阶段 deriveMoveFromSkill 派生。moveStatLabel/moveEffectBrief 认的是招式
        // 字段（baseDamageMultiplier/forceFirst…），这些都在 move 上、不在技能外壳 s 上，
        // 直接传 s 会全读空——这正是此前右栏看不到特效的原因。
        const mv = (s.fixed && s.move) ? s.move : deriveMoveFromSkill(s);
        // 详情开合认武学自身身份：有 id 用 id；拜师完整招无 id，用名字加招式类型，
        // 同名但不同来源的两门不会一起开合，读档换了武学也不会错开别人的详情。
        const detailKey = s.id || `${s.fixed ? "fixed" : "skill"}:${s.name}:${s.moveType || mv.type || ""}`;
        const TYPE_SHORT = { 攻击: "攻", 防御: "防", 状态: "状" };
        const mType = s.moveType || mv.type;
        return (
          <div key={i} style={{ marginBottom: 4, padding: "3px 0", borderLeft: s.active ? `2px solid ${qc}` : "2px solid transparent", paddingLeft: 6, opacity: s.active ? 1 : 0.62 }}>
            <div style={{ fontSize: "11.5px", display: "flex", alignItems: "center", gap: 4 }}>
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
                style={{ cursor: "pointer", color: s.active ? qc : "#6a6a5a" }}
                title={s.active ? "已上阵，点击卸下" : "运功上阵"}
              >{s.active ? "▶" : "○"}</span>
              {mType && <span title={`${mType}类武学`} style={{ fontSize: "9px", color: "var(--bg-deep)", background: qc, borderRadius: 0, padding: "0 3px", fontWeight: 700, flexShrink: 0 }}>{TYPE_SHORT[mType] || "?"}</span>}
              <span
                onClick={() => {
                  const opening = openSkill !== detailKey;
                  setOpenSkill(opening ? detailKey : null);
                  if (opening) inspectItem("skill", s.name, s.fixed ? `${q}品·完整招式` : `${q}品·${s.stage}`, null, { worldLook: true });
                }}
                style={{ cursor: inspecting === s.name ? "wait" : "pointer", color: qc, fontWeight: s.active ? "bold" : "normal", textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: zoneTheme.textDim, opacity: inspecting === s.name ? 0.6 : 1 }}
              >{s.name}{s.fixed ? "" : `·${s.stage}`}{inspecting === s.name ? "…" : ""}</span>
              <span style={{ fontSize: "9.5px", color: qc, opacity: 0.9 }}>（{q}品）</span>
              {/* 伤害倍率与耗气。显示倍率而非绝对伤害：绝对值要乘外功/装备/
                  对手根骨才算得出，面板上给个"×1.3"比给一个随时会变的数字诚实。 */}
              {(() => {
                const lbl = moveStatLabel(mv);
                return lbl ? <span style={{ fontSize: "9px", color: zoneTheme.textDim, flexShrink: 0 }}>{lbl}</span> : null;
              })()}
            </div>
            {(() => {
              const eff = moveEffectBrief(mv);
              return eff ? <div style={{ paddingLeft: 18, fontSize: "9.5px", color: s.active ? "var(--clay)" : "#4a5a4a" }}>{eff}</div> : null;
            })()}
            {openSkill === detailKey && (() => {
              const d = skillDetail(s, mv);
              return (
                <div style={{ margin: "3px 0 4px 18px", padding: "5px 7px", border: `1px solid ${zoneTheme.border}`, background: zoneTheme.bgPanel, fontSize: "10px", lineHeight: 1.7 }}>
                  {d.desc && <div style={{ color: zoneTheme.textDim, marginBottom: 4 }}>{d.desc}</div>}
                  {d.rows.map((r) => (
                    <div key={r.label}><span style={{ color: qc }}>{r.label}</span>　{r.value}</div>
                  ))}
                  {d.effects.map((e, k) => (
                    <div key={k} style={{ color: e.warn ? "var(--warn)" : "var(--clay)" }}>· {e.text}</div>
                  ))}
                </div>
              );
            })()}
            {s.fixed
              ? (openSkill !== detailKey && s.move?.desc ? <div style={{ paddingLeft: 18 }}>
                  <div style={{ fontSize: "10px", color: zoneTheme.textDim, marginTop: 2, lineHeight: 1.65 }}>{s.move.desc}</div>
                </div> : null)
              : (() => {
                  const curIdx = STAGES.indexOf(s.stage);
                  const maxed = curIdx >= STAGES.length - 1;
                  const nextStage = maxed ? null : STAGES[curIdx + 1];
                  const cost = nextStage ? (STAGE_UP_COST[nextStage] ?? 12) : 0;
                  const afford = pot >= cost;
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 18, marginTop: 1 }}>
                      <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                        阶段 {curIdx + 1}/5 · {s.stage}
                      </span>
                      {maxed
                        ? <span style={{ fontSize: "10px", color: qc }}>✦ 登峰造极</span>
                        : <span
                            onClick={() => afford && breakthroughSkill(s.id ?? s.name)}
                            title={afford ? `潜心修炼：花${cost}潜能，${s.stage}→${nextStage}（现有潜能${pot}）` : `潜能不足，突破${nextStage}需${cost}点（现有${pot}）`}
                            style={{
                              cursor: afford ? "pointer" : "not-allowed", fontSize: "10px", padding: "1px 7px", borderRadius: 0,
                              color: afford ? "var(--violet)" : "var(--ink-text-dim)",
                              background: afford ? zoneTheme.bgPanel : "transparent",
                              border: `1px solid ${afford ? "#4a3a5a" : zoneTheme.border}`, userSelect: "none",
                            }}
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
