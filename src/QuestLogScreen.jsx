import React from "react";
import { Overlay, Header, Btn } from "./buildings/InnScreen.jsx";
import { QUCUO_QUESTS } from "./quests/qucuoQuests.js";
import { getCurrentStage } from "./quests/questEngine.js";

// 任务面板——参照 Bethesda 系 RPG 的任务日志：玩家能看到自己接了什么、
// 现在卡在哪个阶段、上一步做了什么选择，而不是只能靠聊天记录里翻旧的
// system 提示自己拼状态。分三组：进行中 / 已完成 / 被锁定（互斥线用）。
export default function QuestLogScreen({ questProgress, zoneTheme, onClose, inline }) {
  const stageQuests = QUCUO_QUESTS.filter(q => q.stages?.length);
  const active = stageQuests.filter(q => questProgress[q.id]?.status === "active");
  const completed = stageQuests.filter(q => questProgress[q.id]?.status === "completed");
  const locked = stageQuests.filter(q => questProgress[q.id]?.status === "locked_by_exclusive");

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name="任务" zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        {!active.length && !completed.length && !locked.length && (
          <div style={{ color: "#8f8a7c", fontSize: 11 }}>尚无已接取的任务。与故事中的人物深入交谈，也许会有委托。</div>
        )}

        {active.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: zoneTheme.accentDim, fontSize: 11, marginBottom: 8 }}>进行中（{active.length}）</div>
            {active.map(q => {
              const prog = questProgress[q.id];
              const stage = getCurrentStage(q, prog);
              const idx = (prog.currentStageIndex ?? 0) + 1;
              return (
                <div key={q.id} style={{ marginBottom: 10, padding: "10px 12px", background: "#161510", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#e8e4d6", fontSize: 13 }}>{q.title}</span>
                    <span style={{ color: "#6a8aaa", fontSize: 11 }}>{idx}/{q.stages.length}</span>
                  </div>
                  {q.giver && <div style={{ color: "#8f8a7c", fontSize: 10.5, marginBottom: 4 }}>委托人：{q.giver}</div>}
                  {stage && <div style={{ color: "#a89a6a", fontSize: 11.5, lineHeight: 1.6 }}>{stage.description}</div>}
                </div>
              );
            })}
          </div>
        )}

        {completed.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: zoneTheme.accentDim, fontSize: 11, marginBottom: 8 }}>已完成（{completed.length}）</div>
            {completed.map(q => {
              const negative = questProgress[q.id]?.outcome === "negative";
              return (
                <div key={q.id} style={{ marginBottom: 8, padding: "8px 10px", background: negative ? "#140a0a" : "#0a140a", borderRadius: 0, border: `1px solid ${negative ? "#4a2a2a" : "#c8323a"}` }}>
                  <div style={{ color: negative ? "#aa6a6a" : "#6aaa6a", fontSize: 12, marginBottom: 3 }}>{negative ? "✗" : "✓"} {q.title}</div>
                  {q.rewardText && <div style={{ color: negative ? "#8a6a6a" : "#7a8a6a", fontSize: 10.5, lineHeight: 1.5 }}>{q.rewardText}</div>}
                </div>
              );
            })}
          </div>
        )}

        {locked.length > 0 && (
          <div>
            <div style={{ color: zoneTheme.accentDim, fontSize: 11, marginBottom: 8 }}>已错过（{locked.length}）</div>
            {locked.map(q => (
              <div key={q.id} style={{ marginBottom: 8, padding: "8px 10px", background: "#140a0a", borderRadius: 0, border: "1px solid #4a2a2a" }}>
                <div style={{ color: "#8a6a6a", fontSize: 12 }}>{q.title}</div>
                <div style={{ color: "#6a5a5a", fontSize: 10.5 }}>因其他抉择而不再可行。</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, textAlign: "right" }}>
          <Btn label="关闭" zoneTheme={zoneTheme} onClick={onClose} secondary />
        </div>
      </div>
    </Overlay>
  );
}
