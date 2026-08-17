import React from "react";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

// 悬赏任务列表：官府发布的通缉/清剿任务
// 完成条件通过 flags 判断（击败目标时由 DuelScreen 写入）
export const BOUNTY_QUESTS = [
  { id: "bounty_daluma", title: "缉拿大路马", desc: "大草甸出没的匪首，官府悬赏，生擒者另行重赏。", target: "大路马", reward: 150, karmaBonus: 5 },
  { id: "bounty_wolves3", title: "清剿狼患", desc: "清剿近期袭击牧民的狼群，击败3只以上方可领赏。", target: "野狼", requiredCount: 3, reward: 80, karmaBonus: 3 },
  { id: "bounty_bandit", title: "驱散流匪", desc: "鱼定村附近出现流匪团伙，击败2名以上方可来此领赏。", target: "流匪", requiredCount: 2, reward: 100, karmaBonus: 4 },
];

export default function BountyScreen({ building, flags, questProgress, zoneTheme, onClose, inline, onAcceptBounty, onClaimBounty }) {
  const available = BOUNTY_QUESTS.filter(q => !flags.includes(`quest_done_${q.id}`) && !questProgress[q.id]?.active);
  const active = BOUNTY_QUESTS.filter(q => questProgress[q.id]?.active);
  const claimable = active.filter(q => {
    const prog = questProgress[q.id];
    return prog?.count >= (q.requiredCount || 1);
  });

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name="官府告示栏" zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "#8f8a7c", fontSize: 11, marginBottom: 12 }}>
          官府发布的悬赏任务，完成后来此领赏。赏金丰厚，功德亦有增益。
        </div>

        {claimable.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: "#4a8a4a", fontSize: 11, marginBottom: 6 }}>可领取赏金：</div>
            {claimable.map(q => (
              <div key={q.id} style={{ padding: "8px 10px", background: "#0a140a", borderRadius: 0, border: "1px solid #c8323a", marginBottom: 6 }}>
                <div style={{ color: "#6aaa6a", fontSize: 12 }}>{q.title} · {q.reward} 两 · +{q.karmaBonus} 功德</div>
                <Btn label="领取赏金" zoneTheme={zoneTheme} onClick={() => onClaimBounty(q)} />
              </div>
            ))}
          </div>
        )}

        {active.filter(q => !claimable.includes(q)).map(q => {
          const prog = questProgress[q.id];
          const cur = prog?.count || 0;
          const need = q.requiredCount || 1;
          return (
            <div key={q.id} style={{ padding: "8px 10px", background: "#12140a", borderRadius: 0, border: "1px solid #3a3a1a", marginBottom: 8 }}>
              <div style={{ color: "#d4a853", fontSize: 12 }}>{q.title}</div>
              <div style={{ color: "#7a6a4a", fontSize: 11 }}>进度：{cur}/{need}</div>
            </div>
          );
        })}

        <div style={{ color: zoneTheme.accentDim, fontSize: 11, marginBottom: 8 }}>
          可接任务（{available.length}）：
        </div>
        {available.map(q => (
          <div key={q.id} style={{ marginBottom: 10, padding: "10px 12px", background: "#161510", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#e8e4d6", fontSize: 13 }}>{q.title}</span>
              <span style={{ color: "#4a8a4a", fontSize: 12 }}>{q.reward} 两 +{q.karmaBonus}功德</span>
            </div>
            <div style={{ color: "#8f8a7c", fontSize: 11, marginBottom: 8 }}>{q.desc}</div>
            <Btn label="接受" zoneTheme={zoneTheme} onClick={() => onAcceptBounty(q)} />
          </div>
        ))}
      </div>
    </Overlay>
  );
}
