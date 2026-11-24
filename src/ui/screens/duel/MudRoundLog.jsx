// 一个回合的MUD式结算文字。

import React from "react";

export default function MudRoundLog({ entry, npcName, zoneTheme }) {
  const result = entry.result;
  const matchupText = result.matchup === "A" ? "你占了上风" : result.matchup === "B" ? `${npcName}占了上风` : "两招同门相撞";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: "var(--fs-xs)", color: zoneTheme.accent }}>▸ 第 {entry.round} 回合</div>
      <div style={{ fontSize: "var(--fs-sm)", color: zoneTheme.text, marginTop: 2 }}>
        你使「{entry.playerMove.name}」，{npcName}使「{entry.npcMove.name}」——{matchupText}。
      </div>
      {result.notes.map((n, i) => (
        <div key={i} style={{ fontSize: "var(--fs-sm)", color: zoneTheme.textDim, marginTop: 1 }}>{n}。</div>
      ))}
      {(result.damageToB > 0 || result.damageToA > 0) && (
        <div style={{ fontSize: "var(--fs-sm)", marginTop: 2 }}>
          {result.damageToB > 0 && <span style={{ color: "var(--footer-stalled-text)" }}>{npcName}受创 {result.damageToB}　</span>}
          {result.damageToA > 0 && <span style={{ color: "var(--red-soft)" }}>你受创 {result.damageToA}</span>}
        </div>
      )}
      {[...result.statusLogA, ...result.statusLogB].map((l, i) => (
        <div key={"s" + i} style={{ fontSize: "var(--fs-xs)", color: zoneTheme.textDim, marginTop: 1 }}>{l}</div>
      ))}
      {/* AI 说书：另起一行润色，不覆盖上面的系统结算文字（斜体+左边框区分） */}
      {entry.narration && (
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-tan)", lineHeight: 1.8, marginTop: 4, paddingLeft: 8,
          borderLeft: `2px solid ${zoneTheme.accentDim}`, fontStyle: "italic" }}>
          <span style={{ fontStyle: "normal", fontSize: "10px", color: zoneTheme.accentDim, marginRight: 5 }}>说书</span>
          {entry.narration}
        </div>
      )}
      <div style={{ fontSize: "var(--fs-xs)", color: zoneTheme.accentDim, marginTop: 2 }}>
        余·你 能量{entry.playerEnergyLeft}／{npcName} 能量{entry.npcEnergyLeft}
      </div>
    </div>
  );
}
