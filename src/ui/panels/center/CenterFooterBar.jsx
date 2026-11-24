import CenterControlRows from "../CenterControlRows.jsx";
import { useGameStore } from "../../../store/gameStore.js";
import {
  useSessionUi, setInteractMode, setActiveTarget, setTalkTarget,
  setActiveGroundItem, setPigeonTarget, setInput, setNsfwOn,
} from "../../../store/sessionUiStore.js";
import { isQuestChoiceOpen } from "../../../domain/rules/quests/questEngine.js";

export default function CenterFooterBar({ ui, turn, handlers }) {
  const room = useGameStore(s => s.room);
  const innerRoomName = useGameStore(s => s.innerRoomName);
  const questProgress = useGameStore(s => s.questProgress);
  const flags = useGameStore(s => s.flags);
  const varTree = useGameStore(s => s.varTree);
  const inv = useGameStore(s => s.inv);
  const {
    zoneTheme,
    availableQuestsHere,
    inputRef, composingRef,
  } = ui;
  const isMobile = useSessionUi(s => s.isMobile);
  const mobileColumn = useSessionUi(s => s.mobileColumn);
  const nsfwOn = useSessionUi(s => s.nsfwOn);
  const loading = useSessionUi(s => s.loading);
  const pendingTalks = useSessionUi(s => s.pendingTalks);
  const waitSecs = useSessionUi(s => s.waitSecs);
  const interactMode = useSessionUi(s => s.interactMode);
  const activeTarget = useSessionUi(s => s.activeTarget);
  const activeGroundItem = useSessionUi(s => s.activeGroundItem);
  const pigeonTarget = useSessionUi(s => s.pigeonTarget);
  const input = useSessionUi(s => s.input);
  const justMeditated = useSessionUi(s => s.justMeditated);
  const { questPanel, screenHandlers, progressionHandlers, pigeonHandlers } = handlers;

  return (
    <>
      {(loading || pendingTalks > 0) && waitSecs > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 14px",
          borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0,
          background: waitSecs >= 30 ? "var(--footer-stalled-bg)" : waitSecs >= 12 ? "var(--footer-slow-bg)" : "var(--bg-panel)",
          fontSize: "11.5px",
          color: waitSecs >= 30 ? "var(--footer-stalled-text)" : waitSecs >= 12 ? "var(--warn)" : zoneTheme.textDim,
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
        <div style={{ padding: "6px 14px", borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0, background: "var(--footer-hint-bg)" }}>
          {availableQuestsHere.filter(e => e.stage.playerHint).map(entry => (
            <div key={entry.quest.id} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: "10.5px", lineHeight: 1.6 }}>
              <span style={{ color: "var(--footer-hint-title)", flexShrink: 0 }}>💡 {entry.quest.title}</span>
              <span style={{ color: "var(--footer-hint-text)" }}>{entry.stage.playerHint}</span>
            </div>
          ))}
        </div>
      )}

      {availableQuestsHere.some(e => !e.stage.choices?.length) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
          borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0, flexWrap: "wrap", rowGap: 6,
          background: "var(--footer-progress-bg)",
        }}>
          <span style={{ color: "var(--ember)", fontSize: "11px", flexShrink: 0 }}>❢ 此处可推进</span>
          {availableQuestsHere.filter(e => !e.stage.choices?.length).map(entry => (
            <span
              key={entry.quest.id}
              onClick={() => questPanel.triggerQuestFromPanel(entry)}
              title={entry.stage.playerHint ?? entry.stage.description}
              style={{
                cursor: "pointer", color: "var(--ember)", padding: "2px 10px",
                border: "1px solid var(--gold-deep)", borderRadius: 0, fontSize: "10.5px",
                background: "var(--footer-progress-button)", whiteSpace: "nowrap",
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
          background: "var(--footer-choice-bg)",
        }}>
          <span style={{ color: "var(--clay)", fontSize: "11px", flexShrink: 0 }}>◈ 行动抉择</span>
          {availableQuestsHere.filter(e => e.stage.choices?.length).map(entry => (
            <span key={entry.quest.id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ color: "var(--text)", fontSize: "10.5px" }}>{entry.quest.title}：</span>
              {entry.stage.choices
                .filter(choice => isQuestChoiceOpen(choice, { questProgress, flags, varTree, inv }))
                .map(choice => {
                  const icon = choice.resolve === "combat" ? "⚔ " : choice.resolve === "talk" ? "💬 " : "";
                  return (
                    <span
                      key={choice.flag}
                      onClick={() => questPanel.triggerQuestChoice(entry, choice)}
                      title={choice.resolve === "combat" ? "会进入切磋，打赢才算数" : choice.resolve === "talk" ? "会进入对话，说赢才算数" : ""}
                      style={{
                        cursor: "pointer", color: "var(--clay)", padding: "2px 10px",
                        border: "1px solid var(--accent)", borderRadius: 0, fontSize: "10.5px",
                        background: "var(--ink-tier-bg)", whiteSpace: "nowrap",
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

      <div className="mobile-input-bar" style={{
        borderTop: interactMode === "whisper" ? "1px solid var(--footer-whisper-edge)" : interactMode === "pigeon" ? "1px solid var(--gold-deep)" : `1px solid ${zoneTheme.border}`,
        background: interactMode === "whisper" ? "rgba(224,160,208,0.06)" : interactMode === "pigeon" ? "rgba(196,160,64,0.06)" : "transparent",
        padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <span style={{
          color: interactMode === "whisper" ? "var(--pink)" : interactMode === "pigeon" ? "var(--gold)" : zoneTheme.accent,
          flexShrink: 0, fontSize: "13px",
        }}>{interactMode === "pigeon" ? "🕊" : "▸"}</span>
        <input
          className="game-input"
          ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={turn.onKey}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          placeholder={
            interactMode === "pigeon" ? `提笔给「${pigeonTarget || "…"}」写信，写罢按回车放飞信鸽…` :
            interactMode === "whisper" ? (pendingTalks > 0 ? "旁白回话中…可先打字，待她说完再发" : "对旁白说些什么…（不消耗回合）") :
            (interactMode === "action" || interactMode === "talk") && loading ? "..." :
            (pendingTalks > 0 ? `说话、做事都行，括号能分着写…（${pendingTalks}条回话处理中）` : "说话、做事都行——纯搭话、纯看不耗回合，括号可分段")
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
