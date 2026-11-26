import React from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import { BOUNTY_QUESTS } from "../../../domain/data/quests/bountyQuests.js";
export { BOUNTY_QUESTS } from "../../../domain/data/quests/bountyQuests.js";

// 悬赏任务列表：官府发布的通缉/清剿任务
// 完成条件通过 flags 判断（击败目标时由 DuelScreen 写入）
export default function BountyScreen({ building, flags, questProgress, zoneTheme, onClose, inline, onAcceptBounty, onClaimBounty }) {
  const available = BOUNTY_QUESTS.filter(q => !flags.includes(`quest_done_${q.id}`) && !questProgress[q.id]?.active);
  const active = BOUNTY_QUESTS.filter(q => questProgress[q.id]?.active);
  const claimable = active.filter(q => {
    const prog = questProgress[q.id];
    return prog?.count >= (q.requiredCount || 1);
  });

  return (
    <Overlay onClose={onClose} inline={inline}>
      <Header name="官府告示栏" onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginBottom: 12 }}>
          官府发布的悬赏任务，完成后来此领赏。赏金丰厚，功德亦有增益。
        </div>

        {claimable.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: "var(--ink-fern)", fontSize: "var(--fs-xs)", marginBottom: 6 }}>可领取赏金：</div>
            {claimable.map(q => (
              <div key={q.id} style={{ padding: "8px 10px", background: "var(--quest-success-bg)", borderRadius: 0, border: "1px solid var(--ink-accent)", marginBottom: 6 }}>
                <div style={{ color: "var(--ink-leaf)", fontSize: "var(--fs-sm)" }}>{q.title} · {q.reward} 两 · +{q.karmaBonus} 功德</div>
                <Btn label="领取赏金" onClick={() => onClaimBounty(q)} />
              </div>
            ))}
          </div>
        )}

        {active.filter(q => !claimable.includes(q)).map(q => {
          const prog = questProgress[q.id];
          const cur = prog?.count || 0;
          const need = q.requiredCount || 1;
          return (
            <div key={q.id} style={{ padding: "8px 10px", background: "var(--bounty-card-bg)", borderRadius: 0, border: "1px solid var(--bounty-card-edge)", marginBottom: 8 }}>
              <div style={{ color: "var(--ink-warn)", fontSize: "var(--fs-sm)" }}>{q.title}</div>
              <div style={{ color: "var(--bounty-progress)", fontSize: "var(--fs-xs)" }}>进度：{cur}/{need}</div>
            </div>
          );
        })}

        <div style={{ color: zoneTheme.accentDim, fontSize: "var(--fs-xs)", marginBottom: 8 }}>
          可接任务（{available.length}）：
        </div>
        {available.map(q => (
          <div key={q.id} style={{ marginBottom: 10, padding: "10px 12px", background: "var(--bg-ink)", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "var(--ink-text)", fontSize: "var(--fs-md)" }}>{q.title}</span>
              <span style={{ color: "var(--ink-fern)", fontSize: "var(--fs-sm)" }}>{q.reward} 两 +{q.karmaBonus}功德</span>
            </div>
            <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginBottom: 8 }}>{q.desc}</div>
            <Btn label="接受" onClick={() => onAcceptBounty(q)} />
          </div>
        ))}
      </div>
    </Overlay>
  );
}
