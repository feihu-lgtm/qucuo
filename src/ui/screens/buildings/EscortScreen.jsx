import React from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import { ESCORT_QUESTS } from "../../../domain/data/quests/escortQuests.js";
export { ESCORT_QUESTS } from "../../../domain/data/quests/escortQuests.js";

export default function EscortScreen({ building, char, flags, questProgress, currentRoom, zoneTheme, onClose, inline, onAcceptEscort, time }) {
  const money = char.money || 0;

  // 过滤：只显示从当前据点出发的任务，且未接取也未完成的
  const available = ESCORT_QUESTS.filter(q => {
    if (q.fromLocations && !q.fromLocations.includes(currentRoom)) return false;
    const doneFlag = q.daily ? `${q.daily}${Math.floor((time || 0) / 24)}` : `quest_done_${q.id}`;
    if (flags.includes(doneFlag)) return false;
    if (questProgress[q.id]?.active) return false;
    return true;
  });

  const active = ESCORT_QUESTS.filter(q => questProgress[q.id]?.active);

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginBottom: 12 }}>
          {building.desc}
        </div>

        {active.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: "var(--ink-warn)", fontSize: "var(--fs-xs)", marginBottom: 6 }}>进行中的护镖任务：</div>
            {active.map(q => {
              const prog = questProgress[q.id];
              return (
                <div key={q.id} style={{ padding: "8px 10px", background: "var(--escort-card-bg)", borderRadius: 0, border: "1px solid var(--gold-deep)", marginBottom: 6 }}>
                  <div style={{ color: "var(--gold-bright)", fontSize: "var(--fs-sm)" }}>{q.title}</div>
                  <div style={{ color: "var(--escort-detail)", fontSize: "var(--fs-xs)", marginTop: 3 }}>
                    目标：前往 {q.targetLocation}，找到 {q.targetNpc} 交货
                  </div>
                  <div style={{ color: "var(--ink-fern)", fontSize: "var(--fs-xs)", marginTop: 2 }}>
                    报酬：{q.reward} 两（完成后自动结算）
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ color: zoneTheme.accentDim, fontSize: "var(--fs-xs)", marginBottom: 8 }}>
          可接任务（{available.length}）：
        </div>

        {available.length === 0 && (
          <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-sm)" }}>
            {active.length > 0 ? "先完成手头的护镖任务吧。" : "暂无从本地出发的护镖任务。"}
          </div>
        )}

        {available.map(q => (
          <div key={q.id} style={{ marginBottom: 10, padding: "10px 12px", background: "var(--bg-ink)", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "var(--ink-text)", fontSize: "var(--fs-md)" }}>{q.title}</span>
              <span style={{ color: "var(--ink-fern)", fontSize: "var(--fs-sm)" }}>报酬 {q.reward} 两</span>
            </div>
            <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginBottom: 4 }}>{q.desc}</div>
            <div style={{ color: "var(--escort-hint)", fontSize: "var(--fs-2xs)", marginBottom: 8 }}>
              → 前往 {q.targetLocation} · 找 {q.targetNpc} 完成交货
            </div>
            <Btn label="接受任务" zoneTheme={zoneTheme} onClick={() => onAcceptEscort(q)} />
          </div>
        ))}
      </div>
    </Overlay>
  );
}
