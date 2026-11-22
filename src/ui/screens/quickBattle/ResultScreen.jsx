// 阶段四：战报总结。

import React from "react";
import TextBtn from "./TextBtn.jsx";
import { sx } from "./qbShared.js";

export default function ResultScreen({ battle, onAgain, onExit }) {
  const win = battle.winner === "ally";
  const survivors = battle.allyTeam.filter(f => f.combatState.hp[0] > 0);
  const fallen = battle.allyTeam.filter(f => f.combatState.hp[0] <= 0);
  const foeFallen = battle.foeTeam.filter(f => f.combatState.hp[0] <= 0);

  return (
    <div style={sx.centerCol}>
      <div style={{ fontSize: 40, color: win ? "var(--blue)" : "var(--qb-foe)", fontWeight: "bold", letterSpacing: 8, marginBottom: 10 }}>
        {win ? "胜" : "败"}
      </div>
      <div style={{ fontSize: 15, color: "var(--parchment)", marginBottom: 30 }}>
        鏖战 {battle.round} 回合，{win ? "我方力克群雄" : "我方尽墨"}
      </div>
      <div style={{ display: "flex", gap: 40, marginBottom: 40, flexWrap: "wrap", justifyContent: "center" }}>
        <ResultCol title="我方存活" names={survivors.map(f => f.name)} color="var(--blue)" empty="无人生还" />
        <ResultCol title="我方阵亡" names={fallen.map(f => f.name)} color="var(--qb-border)" empty="全员无恙" />
        <ResultCol title="斩获敌方" names={foeFallen.map(f => f.name)} color="var(--ink-warn)" empty="未伤敌分毫" />
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <button onClick={onAgain} style={sx.startBtn}>再来一场</button>
        <TextBtn onClick={onExit}>返回主菜单</TextBtn>
      </div>
    </div>
  );
}

function ResultCol({ title, names, color, empty }) {
  return (
    <div style={{ minWidth: 130 }}>
      <div style={{ fontSize: 13, color, letterSpacing: 2, marginBottom: 8, borderBottom: `1px solid ${color}44`, paddingBottom: 4 }}>{title}</div>
      {names.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--qb-edge)" }}>{empty}</div>
      ) : names.map((n, i) => (
        <div key={i} style={{ fontSize: 13, color: "var(--qb-text-dim)", marginBottom: 3 }}>{n}</div>
      ))}
    </div>
  );
}
