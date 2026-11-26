import { useEffect, useRef, useState } from "react";
import GroundItemStrip from "../../components/GroundItemStrip.jsx";
import { useGameStore } from "../../../store/gameStore.js";
import {
  useSessionUi, setInput, setInputCapsule,
} from "../../../store/sessionUiStore.js";
import { isQuestChoiceOpen } from "../../../domain/rules/quests/questEngine.js";
import { partitionPeople } from "../left/peopleRoster.js";
import { getGroundItems } from "../../../domain/rules/map/groundScope.js";

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
  const loading = useSessionUi(s => s.loading);
  const pendingTalks = useSessionUi(s => s.pendingTalks);
  const waitSecs = useSessionUi(s => s.waitSecs);
  const input = useSessionUi(s => s.input);
  const capsule = useSessionUi(s => s.inputCapsule);
  const companionState = useGameStore(s => s.companionState);
  const narratorName = useGameStore(s => s.narrator?.name) || "旁白";
  const { questPanel, screenHandlers } = handlers;

  // W-INPUT 单框合一：@ 浮层（点 @ 钮或框首敲 @ 唤起）+ 一次性胶囊。
  // visibleNpcs 用 D6 同源口径（partitionPeople.present：内层过滤+随行+留守在此）。
  const [atMenuOpen, setAtMenuOpen] = useState(false);
  const atMenuRef = useRef(null);
  const visibleNpcs = partitionPeople({ room, innerRoomName, companionState }).present;
  const groundItems = getGroundItems({ room, innerRoomName });
  useEffect(() => {
    if (!atMenuOpen) return undefined;
    const closeOutside = (event) => {
      if (!atMenuRef.current?.contains(event.target)) setAtMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [atMenuOpen]);
  const pickCapsule = (cap) => {
    setInputCapsule(cap);
    setAtMenuOpen(false);
    // 框首敲 @ 唤起的，选人后顺手把那个 @ 吃掉
    if (input === "@") setInput("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const capsuleLabel = capsule?.kind === "whisper" ? `私语·${capsule.name || narratorName}`
    : capsule?.kind === "pigeon" ? `飞鸽·${capsule.name}`
    : capsule?.kind === "target" ? `@${capsule.name}` : "";
  const onInputKeyDown = (e) => {
    // 空框 Backspace 剥胶囊（与点 × 同效）
    if (e.key === "Backspace" && !input && capsule) {
      e.preventDefault();
      setInputCapsule(null);
      return;
    }
    turn.onKey(e);
  };
  const onInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    // 框首敲入 @ 唤起浮层；删掉了就收起
    if (value === "@") setAtMenuOpen(true);
    else if (atMenuOpen && !value.startsWith("@")) setAtMenuOpen(false);
  };

  return (
    <>
      {(loading || pendingTalks > 0) && waitSecs > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 14px",
          borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0,
          background: waitSecs >= 30 ? "var(--footer-stalled-bg)" : waitSecs >= 12 ? "var(--footer-slow-bg)" : "var(--bg-panel)",
          fontSize: "var(--fs-sm)",
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
            <div key={entry.quest.id} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: "var(--fs-xs)", lineHeight: 1.6 }}>
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
          <span style={{ color: "var(--ember)", fontSize: "var(--fs-xs)", flexShrink: 0 }}>❢ 此处可推进</span>
          {availableQuestsHere.filter(e => !e.stage.choices?.length).map(entry => (
            <span
              key={entry.quest.id}
              onClick={() => questPanel.triggerQuestFromPanel(entry)}
              title={entry.stage.playerHint ?? entry.stage.description}
              style={{
                cursor: "pointer", color: "var(--ember)", padding: "2px 10px",
                border: "1px solid var(--gold-deep)", borderRadius: 0, fontSize: "var(--fs-xs)",
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
          <span style={{ color: "var(--clay)", fontSize: "var(--fs-xs)", flexShrink: 0 }}>◈ 行动抉择</span>
          {availableQuestsHere.filter(e => e.stage.choices?.length).map(entry => (
            <span key={entry.quest.id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ color: "var(--text)", fontSize: "var(--fs-xs)" }}>{entry.quest.title}：</span>
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
                        border: "1px solid var(--accent)", borderRadius: 0, fontSize: "var(--fs-xs)",
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

      <GroundItemStrip items={groundItems} theme={zoneTheme} onPickUp={screenHandlers.handleCollectGround} />

      <div className="mobile-input-bar" style={{
        borderTop: `1px solid ${zoneTheme.border}`,
        padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        position: "relative",
      }}>
        {/* W-INPUT @ 触发点：与输入框融为一体，点按或框首敲 @ 唤起浮层 */}
        <span
          role="button"
          aria-label="指定对象或私聊旁白"
          aria-expanded={atMenuOpen}
          data-at-trigger="true"
          onClick={() => setAtMenuOpen(v => !v)}
          style={{
            color: atMenuOpen || capsule ? zoneTheme.accent : zoneTheme.textDim,
            flexShrink: 0, fontSize: "var(--fs-md)", cursor: "pointer", userSelect: "none",
          }}
        >@</span>
        {atMenuOpen && (
          <div
            ref={atMenuRef}
            role="menu"
            data-at-menu="true"
            style={{
              position: "absolute", bottom: "100%", left: 10, zIndex: 30, marginBottom: 4,
              display: "flex", flexDirection: "column", gap: 2, padding: 4,
              minWidth: 168, maxWidth: "calc(100vw - 28px)", maxHeight: "min(60vh, 315px)",
              overflowY: "auto", boxSizing: "border-box",
              background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`, color: zoneTheme.text,
            }}
          >
            <button
              type="button"
              role="menuitem"
              data-at-option="whisper"
              onClick={() => pickCapsule({ kind: "whisper", name: narratorName })}
              style={{
                background: "transparent", border: "none", color: zoneTheme.text,
                textAlign: "left", padding: "6px 10px", fontSize: "var(--fs-sm)",
                fontFamily: "inherit", cursor: "pointer",
              }}
            >◆ {narratorName}（旁白私语 · 不耗回合）</button>
            {visibleNpcs.map(npc => (
              <button
                key={npc.name}
                type="button"
                role="menuitem"
                data-at-option={`npc-${npc.name}`}
                onClick={() => pickCapsule({ kind: "target", name: npc.name })}
                style={{
                  background: "transparent", border: "none", color: zoneTheme.text,
                  textAlign: "left", padding: "6px 10px", fontSize: "var(--fs-sm)",
                  fontFamily: "inherit", cursor: "pointer",
                }}
              >{npc.name}</button>
            ))}
          </div>
        )}
        {capsule && (
          <span
            data-input-capsule={capsule.kind}
            style={{
              flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4,
              padding: "1px 8px", fontSize: "var(--fs-xs)", whiteSpace: "nowrap",
              color: zoneTheme.accent, border: `1px solid ${zoneTheme.accent}`,
              background: "transparent",
            }}
          >
            {capsuleLabel}
            <span
              role="button"
              aria-label="取消指定"
              data-capsule-clear="true"
              onClick={() => setInputCapsule(null)}
              style={{ cursor: "pointer", color: zoneTheme.textDim }}
            >×</span>
          </span>
        )}
        <input
          className="game-input"
          ref={inputRef} value={input} onChange={onInputChange} onKeyDown={onInputKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          placeholder={
            capsule?.kind === "pigeon" ? `提笔给「${capsule.name}」写信，写罢按回车放飞信鸽…` :
            capsule?.kind === "whisper" ? (pendingTalks > 0 ? "旁白回话中…可先打字，待她说完再发" : `对${capsule.name || narratorName}说些什么…（不消耗回合）`) :
            loading ? "..." :
            "说话做事直接写，敲 @ 或 // 可私聊旁白与指定对象"
          }
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: zoneTheme.text, fontFamily: "inherit", fontSize: "var(--fs-md)" }}
        />
        {/* 发送按钮：和回车同一个提交入口。手机上按回车不顺手，这里给一个看得见的按钮。
            pointerdown 时 preventDefault，点按钮不让输入框失焦，iOS 键盘不会收起。 */}
        <button
          type="button"
          className="game-send-button mobile-touch-target"
          disabled={!input.trim()}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => turn.onKey.submit?.()}
          aria-label={capsule?.kind === "pigeon" ? "放飞信鸽" : "发送"}
          style={{
            flexShrink: 0, minWidth: 52, minHeight: 32, padding: "4px 12px",
            border: `1px solid ${input.trim() ? zoneTheme.accent : zoneTheme.border}`, borderRadius: 0,
            background: "transparent", color: input.trim() ? zoneTheme.accent : zoneTheme.textDim,
            fontFamily: "inherit", fontSize: "var(--fs-md)", letterSpacing: "2px",
            cursor: input.trim() ? "pointer" : "default", opacity: input.trim() ? 1 : 0.5,
          }}
        >{capsule?.kind === "pigeon" ? "放飞" : "发送"}</button>
      </div>
    </>
  );
}
