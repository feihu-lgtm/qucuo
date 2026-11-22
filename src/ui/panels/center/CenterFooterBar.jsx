import TurnStatusPill from "../../components/TurnStatusPill.jsx";
import CenterControlRows from "../CenterControlRows.jsx";
import { useGameStore } from "../../../store/gameStore.js";

export default function CenterFooterBar({ ui, turn, handlers }) {
  const room = useGameStore(s => s.room);
  const innerRoomName = useGameStore(s => s.innerRoomName);
  const questProgress = useGameStore(s => s.questProgress);
  const {
    isMobile, mobileColumn, zoneTheme, loading, pendingTalks, waitSecs,
    availableQuestsHere, nsfwOn, setNsfwOn, justMeditated,
    interactMode, setInteractMode, activeTarget, setActiveTarget, setTalkTarget,
    activeGroundItem, setActiveGroundItem, pigeonTarget, setPigeonTarget,
    input, setInput, inputRef, composingRef,
  } = ui;
  const { questPanel, screenHandlers, progressionHandlers, pigeonHandlers } = handlers;

  return (
    <>
      {(loading || pendingTalks > 0) && waitSecs > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 14px",
          borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0,
          background: waitSecs >= 30 ? "#3a1a1a" : waitSecs >= 12 ? "#3a2a12" : "var(--bg-panel)",
          fontSize: "11.5px",
          color: waitSecs >= 30 ? "#e08a6a" : waitSecs >= 12 ? "var(--warn)" : zoneTheme.textDim,
        }}>
          <span>{waitSecs >= 30 ? "🐢" : "⏳"}</span>
          <span>
            {waitSecs < 12 ? `思索中… 已等待 ${waitSecs}s`
              : waitSecs < 30 ? `有点慢，已等待 ${waitSecs}s（网络或模型繁忙，请再稍候）`
              : `已等待 ${waitSecs}s，可能卡住了——超过 60s 会自动超时报错，届时可重试或去设置换更快的模型`}
          </span>
        </div>
      )}

      {availableQuestsHere.some(e => e.stage.playerHint) && (
        <div style={{ padding: "6px 14px", borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0, background: "#0c0f14" }}>
          {availableQuestsHere.filter(e => e.stage.playerHint).map(entry => (
            <div key={entry.quest.id} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: "10.5px", lineHeight: 1.6 }}>
              <span style={{ color: "#6a90c0", flexShrink: 0 }}>💡 {entry.quest.title}</span>
              <span style={{ color: "#8a94a8" }}>{entry.stage.playerHint}</span>
            </div>
          ))}
        </div>
      )}

      {availableQuestsHere.some(e => !e.stage.choices?.length) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
          borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0, flexWrap: "wrap", rowGap: 6,
          background: "#141008",
        }}>
          <span style={{ color: "var(--ember)", fontSize: "11px", flexShrink: 0 }}>❢ 此处可推进</span>
          {availableQuestsHere.filter(e => !e.stage.choices?.length).map(entry => (
            <span
              key={entry.quest.id}
              onClick={() => questPanel.triggerQuestFromPanel(entry)}
              title={entry.stage.playerHint ?? entry.stage.description}
              style={{
                cursor: "pointer", color: "#c8663a", padding: "2px 10px",
                border: "1px solid var(--gold-deep)", borderRadius: 0, fontSize: "10.5px",
                background: "#1a1408", whiteSpace: "nowrap",
              }}
            >
              ❢ {entry.quest.title}{entry.stage.giver !== null && entry.quest.giver ? `（${entry.quest.giver}）` : ""}
            </span>
          ))}
        </div>
      )}

      {availableQuestsHere.some(e => e.stage.choices?.length) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
          borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0, flexWrap: "wrap", rowGap: 6,
          background: "#0e1410",
        }}>
          <span style={{ color: "var(--clay)", fontSize: "11px", flexShrink: 0 }}>◈ 行动抉择</span>
          {availableQuestsHere.filter(e => e.stage.choices?.length).map(entry => (
            <span key={entry.quest.id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ color: "var(--text)", fontSize: "10.5px" }}>{entry.quest.title}：</span>
              {entry.stage.choices
                .filter(choice => {
                  const isDone = (qid) => questProgress[qid]?.status === "completed";
                  if (choice.requiresQuestCompleted) {
                    const need = Array.isArray(choice.requiresQuestCompleted) ? choice.requiresQuestCompleted : [choice.requiresQuestCompleted];
                    if (!need.every(isDone)) return false;
                  }
                  if (choice.requiresAnyOf?.length && !choice.requiresAnyOf.some(isDone)) return false;
                  return true;
                })
                .map(choice => {
                  const icon = choice.resolve === "combat" ? "⚔ " : choice.resolve === "talk" ? "💬 " : "";
                  return (
                    <span
                      key={choice.flag}
                      onClick={() => questPanel.triggerQuestChoice(entry, choice)}
                      title={choice.resolve === "combat" ? "会进入切磋，打赢才算数" : choice.resolve === "talk" ? "会进入对话，说赢才算数" : ""}
                      style={{
                        cursor: "pointer", color: "#c07050", padding: "2px 10px",
                        border: "1px solid var(--accent)", borderRadius: 0, fontSize: "10.5px",
                        background: "#241211", whiteSpace: "nowrap",
                      }}
                    >
                      {icon}{choice.label}
                    </span>
                  );
                })}
            </span>
          ))}
        </div>
      )}

      <CenterControlRows
        isMobile={isMobile} mobileColumn={mobileColumn} zoneTheme={zoneTheme}
        room={room} innerRoomName={innerRoomName}
        handleCollectGround={screenHandlers.handleCollectGround}
        setInteractMode={setInteractMode} interactMode={interactMode} activeTarget={activeTarget}
        setActiveTarget={setActiveTarget} setTalkTarget={setTalkTarget} setPigeonTarget={setPigeonTarget}
        activeGroundItem={activeGroundItem} setActiveGroundItem={setActiveGroundItem}
        nsfwOn={nsfwOn} setNsfwOn={setNsfwOn} meditate={progressionHandlers.meditate} justMeditated={justMeditated}
      >
        {interactMode === "pigeon" && pigeonTarget && (() => {
          const { delay, loc } = pigeonHandlers.pigeonDelayShichen(pigeonTarget);
          return (
            <div style={{ padding: "6px 16px 0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, fontSize: "11px" }}>
              <span style={{ color: "var(--gold)" }}>🕊 飞鸽传书 · 致「{pigeonTarget}」</span>
              <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>信往{loc}，约 {delay} 时辰后有回音</span>
              <span style={{ flex: 1 }} />
              <span className="mobile-touch-target" onClick={() => { setPigeonTarget(null); setInteractMode("action"); }} style={{ cursor: "pointer", color: zoneTheme.textDim, fontSize: "10px" }}>× 取消</span>
            </div>
          );
        })()}
      </CenterControlRows>

      {!isMobile && <TurnStatusPill theme={zoneTheme} />}
      <div className="mobile-input-bar" style={{
        borderTop: interactMode === "whisper" ? "1px solid #4a2a4a" : interactMode === "talk" ? "1px solid #1a3a1a" : interactMode === "pigeon" ? "1px solid var(--gold-deep)" : `1px solid ${zoneTheme.border}`,
        background: interactMode === "whisper" ? "rgba(224,160,208,0.06)" : interactMode === "talk" ? "rgba(138,196,138,0.06)" : interactMode === "pigeon" ? "rgba(196,160,64,0.06)" : "transparent",
        padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <span style={{
          color: interactMode === "whisper" ? "var(--pink)" : interactMode === "talk" ? "var(--clay)" : interactMode === "pigeon" ? "var(--gold)" : zoneTheme.accent,
          flexShrink: 0, fontSize: "13px",
        }}>{interactMode === "pigeon" ? "🕊" : "▸"}</span>
        <input
          className="game-input"
          ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={turn.onKey}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          placeholder={
            interactMode === "action" && loading ? "..." :
            interactMode === "pigeon" ? `提笔给「${pigeonTarget || "…"}」写信，写罢按回车放飞信鸽…` :
            interactMode === "whisper" ? (pendingTalks > 0 ? "旁白回话中…可先打字，待她说完再发" : "对旁白说些什么…（不消耗回合）") :
            interactMode === "talk" ? (pendingTalks > 0 ? `跟房间里的人说句话…（${pendingTalks}条处理中，可继续发）` : "跟房间里的人说句话…（不消耗回合）") :
            "输入行动指令…（消耗1回合）"
          }
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: zoneTheme.text, fontFamily: "inherit", fontSize: "13px" }}
        />
        {/* 发送按钮：和回车同一个提交入口。手机上按回车不顺手，这里给一个看得见的按钮。
            pointerdown 时 preventDefault，点按钮不让输入框失焦，iOS 键盘不会收起。 */}
        <button
          type="button"
          className="game-send-button mobile-touch-target"
          disabled={!input.trim()}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => turn.onKey.submit?.()}
          aria-label={interactMode === "pigeon" ? "放飞信鸽" : "发送"}
          style={{
            flexShrink: 0, minWidth: 52, minHeight: 32, padding: "4px 12px",
            border: `1px solid ${input.trim() ? zoneTheme.accent : zoneTheme.border}`, borderRadius: 0,
            background: "transparent", color: input.trim() ? zoneTheme.accent : zoneTheme.textDim,
            fontFamily: "inherit", fontSize: "13px", letterSpacing: "2px",
            cursor: input.trim() ? "pointer" : "default", opacity: input.trim() ? 1 : 0.5,
          }}
        >{interactMode === "pigeon" ? "放飞" : "发送"}</button>
      </div>
    </>
  );
}
