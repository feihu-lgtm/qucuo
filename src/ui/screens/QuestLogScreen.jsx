import React from "react";
import { Overlay, Header, Btn } from "./buildings/common.jsx";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { SNOW_QUEST_ID, SNOW_SPIRITS, snowSpiritCount } from "../../domain/rules/quests/snowLeopardQuest.js";
import { getCurrentStage } from "../../domain/rules/quests/questEngine.js";

// 任务面板——参照 Bethesda 系 RPG 的任务日志：玩家能看到自己接了什么、
// 现在卡在哪个阶段、上一步做了什么选择，而不是只能靠聊天记录里翻旧的
// system 提示自己拼状态。分三组：进行中 / 已完成 / 被锁定（互斥线用）。
export function QuestList({ questProgress, flags = [], zoneTheme }) {
  const stageQuests = QUCUO_QUESTS.filter(q => q.stages?.length);
  const active = stageQuests.filter(q => questProgress[q.id]?.status === "active");
  const completed = stageQuests.filter(q => questProgress[q.id]?.status === "completed");
  const locked = stageQuests.filter(q => questProgress[q.id]?.status === "locked_by_exclusive");

  return (
    <>
      {!active.length && !completed.length && !locked.length && (
        <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)" }}>尚无已接取的任务。与故事中的人物深入交谈，也许会有委托。</div>
      )}

      {active.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: zoneTheme.accentDim, fontSize: "var(--fs-xs)", marginBottom: 8 }}>进行中（{active.length}）</div>
          {active.map(q => {
            const prog = questProgress[q.id];
            const stage = getCurrentStage(q, prog);
            const idx = (prog.currentStageIndex ?? 0) + 1;
            return (
              <div key={q.id} style={{ marginBottom: 10, padding: "10px 12px", background: "var(--bg-panel)", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "var(--text)", fontSize: "var(--fs-md)" }}>{q.title}</span>
                  <span style={{ color: "var(--quest-stage-count)", fontSize: "var(--fs-xs)" }}>{idx}/{q.stages.length}</span>
                </div>
                {q.id === SNOW_QUEST_ID && <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)" }}><div>{stage?.title} · {snowSpiritCount(flags)}/5</div>{SNOW_SPIRITS.map(({ flag, label }) => <div key={flag}>{flags.includes(flag) ? "✓" : "○"} {label}</div>)}</div>}
                {q.giver && <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", marginBottom: 4 }}>委托人：{q.giver}</div>}
                {stage && <div style={{ color: "var(--quest-stage-desc)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>{stage.playerHint ?? stage.description}</div>}
              </div>
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: zoneTheme.accentDim, fontSize: "var(--fs-xs)", marginBottom: 8 }}>已完成（{completed.length}）</div>
          {completed.map(q => {
            const negative = questProgress[q.id]?.outcome === "negative";
            return (
              <div key={q.id} style={{ marginBottom: 8, padding: "8px 10px", background: negative ? "var(--quest-negative-bg)" : "var(--quest-success-bg)", borderRadius: 0, border: `1px solid ${negative ? "var(--quest-negative-edge)" : "var(--accent)"}` }}>
                <div style={{ color: negative ? "var(--quest-negative-title)" : "var(--ink-leaf)", fontSize: "var(--fs-sm)", marginBottom: 3 }}>{negative ? "✗" : "✓"} {q.title}</div>
                {q.rewardText && <div style={{ color: negative ? "var(--quest-negative-text)" : "var(--quest-success-text)", fontSize: "var(--fs-xs)", lineHeight: 1.5 }}>{q.rewardText}</div>}
              </div>
            );
          })}
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <div style={{ color: zoneTheme.accentDim, fontSize: "var(--fs-xs)", marginBottom: 8 }}>已错过（{locked.length}）</div>
          {locked.map(q => (
            <div key={q.id} style={{ marginBottom: 8, padding: "8px 10px", background: "var(--quest-negative-bg)", borderRadius: 0, border: "1px solid var(--quest-negative-edge)" }}>
              <div style={{ color: "var(--quest-negative-text)", fontSize: "var(--fs-sm)" }}>{q.title}</div>
              <div style={{ color: "var(--quest-missed-desc)", fontSize: "var(--fs-xs)" }}>因其他抉择而不再可行。</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function QuestLogScreen({ questProgress, flags = [], zoneTheme, onClose, inline }) {
  return (
    <Overlay onClose={onClose} inline={inline}>
      <Header name="任务" onClose={onClose} />
      <div className="mobile-overlay-content" style={{ padding: 16 }}>
        <QuestList questProgress={questProgress} flags={flags} zoneTheme={zoneTheme} />
        <div style={{ marginTop: 14, textAlign: "right" }}>
          <Btn label="关闭" onClick={onClose} secondary />
        </div>
      </div>
    </Overlay>
  );
}
