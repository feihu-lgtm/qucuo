// 入册审改 · 主角武学编辑器（从 ReviewPlayer.jsx 拆出）
// ============================================================================
// 一门武学 = 名字 + 路数（攻击/防御/状态）+ 品阶 + active + 一句描述。
// 【为什么主角用「武学」而不是 NPC 那套 5 槽招式】主角的战斗招式由武学(skills)派生
// （见 npcGeneration.deriveMovesetFromSkills）：切磋按攻击/防御/状态各取一门 active 的
// 武学出招，缺某路自动用白档制式招补上。武学能升级、能花潜能修炼，是主角专属的成长线。

import React from "react";
import { TIERS, selStyle } from "./widgets.jsx";

export default function SkillEditor({ skills, onChange, tierCap, accent, aiBusy, onAiScan }) {
  const list = Array.isArray(skills) ? skills : [];
  const setOne = (i, patch) => onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const del = (i) => onChange(list.filter((_, j) => j !== i));
  const add = () => onChange([...list, {
    name: "", quality: TIERS[tierCap]?.label || "白", level: 1, exp: 0, maxExp: 100,
    stage: "入门", active: true, moveType: "攻击",
  }]);
  return (
    <div>
      {!list.length && (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-text-dim)", marginBottom: 8, lineHeight: 1.7 }}>
          还没有武学。点「✨ AI 现编武学」让它照卡里的招式描写生成，或手动加一门。
        </div>
      )}
      {list.map((s, i) => (
        <div key={i} style={{ marginBottom: 7, padding: "7px 9px", borderRadius: 0, background: "rgba(0,0,0,.22)", border: "1px solid var(--bg-card)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <input value={s.name || ""} placeholder="武学名"
              onChange={e => setOne(i, { name: e.target.value.slice(0, 10) })}
              style={{ ...selStyle, flex: 1, textAlign: "center" }} />
            <select value={s.moveType || "攻击"} onChange={e => setOne(i, { moveType: e.target.value })}
              style={{ ...selStyle, width: 60 }}>
              {["攻击", "防御", "状态"].map(t => <option key={t} value={t} style={{ background: "var(--bg-deep)" }}>{t}</option>)}
            </select>
            <select value={s.quality || "白"} onChange={e => setOne(i, { quality: e.target.value })}
              style={{ ...selStyle, width: 62 }}>
              {TIERS.map(t => <option key={t.label} value={t.label} style={{ background: "var(--bg-deep)", color: t.color }}>{t.label}档</option>)}
            </select>
            <span onClick={() => setOne(i, { active: !s.active })}
              title={s.active ? "这门当前会出手（同路数只第一门生效）" : "点亮才会用它出招"}
              style={{ cursor: "pointer", fontSize: "var(--fs-2xs)", color: s.active ? accent : "var(--muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
              {s.active ? "◉ 用" : "○ 备"}
            </span>
            <span onClick={() => del(i)} title="删掉这门"
              style={{ cursor: "pointer", color: "var(--lore-amber)", fontSize: "var(--fs-xs)", flexShrink: 0 }}>✕</span>
          </div>
          <input value={s.desc || ""} placeholder="一句话写这门功夫使出来什么样（注入给说书人）"
            onChange={e => setOne(i, { desc: e.target.value.slice(0, 30) })}
            style={{ ...selStyle, textAlign: "left", fontSize: "var(--fs-xs)", color: "var(--ink-text)" }} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
        <span onClick={add} style={{ cursor: "pointer", fontSize: "var(--fs-xs)", color: "var(--ink-muted)" }}>＋ 加一门</span>
        <span style={{ flex: 1 }} />
        <span onClick={aiBusy ? undefined : onAiScan}
          title="让 AI 照卡里主角的招式/战斗描写现编武学"
          style={{
            cursor: aiBusy ? "wait" : "pointer", userSelect: "none",
            fontSize: "var(--fs-sm)", padding: "5px 12px", borderRadius: 0, whiteSpace: "nowrap",
            display: "inline-flex", alignItems: "center", gap: 5,
            color: aiBusy ? "var(--quest-success-text)" : "var(--ci-pick)", textShadow: "0 1px 2px rgba(0,0,0,.85)",
            border: `1px solid ${aiBusy ? "var(--music-idle-icon)" : "var(--ink-good)"}`,
            background: aiBusy ? "rgba(0,0,0,.3)" : "linear-gradient(180deg,rgba(74,120,64,.5),rgba(0,0,0,.45))",
          }}>✨ {aiBusy ? "现编中…" : "AI 现编武学"}</span>
      </div>
    </div>
  );
}
