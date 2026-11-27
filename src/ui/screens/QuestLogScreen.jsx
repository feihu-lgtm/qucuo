import React, { useState } from "react";
import { Overlay, Header, Btn } from "./buildings/common.jsx";
import { Icon } from "../primitives/index.js";
import NpcAvatar from "../components/NpcAvatar.jsx";
import { questArtUrl } from "../art/art.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { SNOW_QUEST_ID, SNOW_SPIRITS, snowSpiritCount } from "../../domain/rules/quests/snowLeopardQuest.js";
import { getCurrentStage } from "../../domain/rules/quests/questEngine.js";

// 任务面板——分三组：进行中 / 已完成 / 被锁定（互斥线用），附带委托人小像与任务插图。
export function QuestList({ questProgress, flags = [] }) {
  const [hiddenArt, setHiddenArt] = useState({});
  const stageQuests = QUCUO_QUESTS.filter(q => q.stages?.length);
  const active = stageQuests.filter(q => questProgress[q.id]?.status === "active");
  const completed = stageQuests.filter(q => questProgress[q.id]?.status === "completed");
  const locked = stageQuests.filter(q => questProgress[q.id]?.status === "locked_by_exclusive");

  return (
    <>
      {!active.length && !completed.length && !locked.length && (
        <div className="quest-empty-hint">尚无已接取的任务。与故事中的人物深入交谈，也许会有委托。</div>
      )}

      {active.length > 0 && (
        <div className="quest-group">
          <div className="panel-sec-label"><Icon name="进行中" size={12} /> 进行中（{active.length}）</div>
          {active.map(q => {
            const prog = questProgress[q.id];
            const stage = getCurrentStage(q, prog);
            const idx = (prog.currentStageIndex ?? 0) + 1;
            const art = questArtUrl(q.id);
            const artOpen = art && !hiddenArt[q.id];
            return (
              <div key={q.id} className="quest-card">
                <div className="quest-card-head">
                  <span className="quest-card-title">{q.title}</span>
                  <span className="quest-card-count">{idx}/{q.stages.length}</span>
                </div>
                {q.id === SNOW_QUEST_ID && (
                  <div className="quest-snow-block">
                    <div>{stage?.title} · {snowSpiritCount(flags)}/5</div>
                    {SNOW_SPIRITS.map(({ flag, label }) => <div key={flag}>{flags.includes(flag) ? "✓" : "○"} {label}</div>)}
                  </div>
                )}
                {q.giver && (
                  <div className="quest-giver-row">
                    <NpcAvatar name={q.giver} size="xs" />
                    <Icon name="委托人" size={12} />
                    <span>委托人：{q.giver}</span>
                  </div>
                )}
                {stage && <div className="quest-card-desc">{stage.playerHint ?? stage.description}</div>}
                {art && (
                  <div className="quest-art-wrap">
                    <button
                      type="button"
                      className="quest-art-toggle"
                      onClick={() => setHiddenArt(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                    >
                      {artOpen ? "收起插图 ▴" : "查看插图 ▾"}
                    </button>
                    {artOpen && <img src={art} alt={q.title} className="quest-art-banner" loading="lazy" />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <div className="quest-group">
          <div className="panel-sec-label"><Icon name="已成" size={12} /> 已完成（{completed.length}）</div>
          {completed.map(q => {
            const negative = questProgress[q.id]?.outcome === "negative";
            return (
              <div key={q.id} className="quest-card quest-card--done" data-negative={Boolean(negative)}>
                <div className="quest-done-title" data-negative={Boolean(negative)}>
                  <Icon name={negative ? "已了" : "已成"} size={12} /> {q.title}
                </div>
                {q.rewardText && <div className="quest-done-reward">{q.rewardText}</div>}
              </div>
            );
          })}
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <div className="panel-sec-label"><Icon name="已错过" size={12} /> 已错过（{locked.length}）</div>
          {locked.map(q => (
            <div key={q.id} className="quest-card quest-card--locked">
              <div className="quest-locked-title">{q.title}</div>
              <div className="quest-locked-desc">因其他抉择而不再可行。</div>
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
