import React from "react";
import { Overlay, Header, Btn } from "./buildings/common.jsx";
import { Icon } from "../primitives/index.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { SNOW_QUEST_ID, SNOW_SPIRITS, snowSpiritCount } from "../../domain/rules/quests/snowLeopardQuest.js";
import { getCurrentStage } from "../../domain/rules/quests/questEngine.js";

// 任务面板——参照 Bethesda 系 RPG 的任务日志：玩家能看到自己接了什么、
// 现在卡在哪个阶段、上一步做了什么选择，而不是只能靠聊天记录里翻旧的
// system 提示自己拼状态。分三组：进行中 / 已完成 / 被锁定（互斥线用）。
export function QuestList({ questProgress, flags = [] }) {
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
          <div className="panel-sec-label"><Icon name="进行中" size={12} /> 进行中（{active.length}）</div>
          {active.map(q => {
            const prog = questProgress[q.id];
            const stage = getCurrentStage(q, prog);
            const idx = (prog.currentStageIndex ?? 0) + 1;
            return (
              <div key={q.id} style={{ marginBottom: 10, padding: "10px 12px", background: "var(--bg-item)", borderRadius: 0, border: `1px solid var(--hairline)` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "var(--text)", fontSize: "var(--fs-md)" }}>{q.title}</span>
                  <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)" }}>{idx}/{q.stages.length}</span>
                </div>
                {q.id === SNOW_QUEST_ID && <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)" }}><div>{stage?.title} · {snowSpiritCount(flags)}/5</div>{SNOW_SPIRITS.map(({ flag, label }) => <div key={flag}>{flags.includes(flag) ? "✓" : "○"} {label}</div>)}</div>}
                {q.giver && <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", marginBottom: 4 }}><Icon name="委托人" size={12} /> 委托人：{q.giver}</div>}
                {stage && <div style={{ color: "var(--text-sub)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>{stage.playerHint ?? stage.description}</div>}
              </div>
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="panel-sec-label"><Icon name="已成" size={12} /> 已完成（{completed.length}）</div>
          {completed.map(q => {
            const negative = questProgress[q.id]?.outcome === "negative";
            return (
              <div key={q.id} style={{ marginBottom: 8, padding: "8px 10px", background: "var(--bg-item)", borderRadius: 0, border: `1px solid ${negative ? "var(--danger-text)" : "var(--good)"}` }}>
                <div style={{ color: negative ? "var(--danger-text)" : "var(--good)", fontSize: "var(--fs-sm)", marginBottom: 3 }}><Icon name={negative ? "已了" : "已成"} size={12} /> {q.title}</div>
                {q.rewardText && <div style={{ color: "var(--text-sub)", fontSize: "var(--fs-xs)", lineHeight: 1.5 }}>{q.rewardText}</div>}
              </div>
            );
          })}
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <div className="panel-sec-label"><Icon name="已错过" size={12} /> 已错过（{locked.length}）</div>
          {locked.map(q => (
            <div key={q.id} style={{ marginBottom: 8, padding: "8px 10px", background: "var(--bg-item)", borderRadius: 0, border: "1px solid var(--hairline)" }}>
              <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-sm)" }}>{q.title}</div>
              <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)" }}>因其他抉择而不再可行。</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function QuestLogScreen({ questProgress, flags = [], onClose, inline }) {
  return (
    <Overlay onClose={onClose} inline={inline}>
      <Header name="任务" onClose={onClose} />
      <div className="mobile-overlay-content" style={{ padding: 16 }}>
        <QuestList questProgress={questProgress} flags={flags} />
        <div style={{ marginTop: 14, textAlign: "right" }}>
          <Btn label="关闭" onClick={onClose} secondary />
        </div>
      </div>
    </Overlay>
  );
}
