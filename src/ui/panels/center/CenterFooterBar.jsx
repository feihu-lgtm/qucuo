import { useEffect, useRef, useState } from "react";
import GroundItemStrip from "../../components/GroundItemStrip.jsx";
import { Icon } from "../../primitives/index.js";
import { useGameStore } from "../../../store/gameStore.js";
import {
  useSessionUi, setInput, setInputCapsule,
} from "../../../store/sessionUiStore.js";
import { isQuestChoiceOpen } from "../../../domain/rules/quests/questEngine.js";
import { partitionPeople } from "../left/peopleRoster.js";
import { getGroundItems } from "../../../domain/rules/map/groundScope.js";
import { THEME_VARS } from "../../../utils/theme.js";

export default function CenterFooterBar({ ui, turn, handlers }) {
  const room = useGameStore(s => s.room);
  const innerRoomName = useGameStore(s => s.innerRoomName);
  const questProgress = useGameStore(s => s.questProgress);
  const flags = useGameStore(s => s.flags);
  const varTree = useGameStore(s => s.varTree);
  const inv = useGameStore(s => s.inv);
  const {
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
        <div
          className="footer-wait-bar"
          data-tone={waitSecs >= 30 ? "stalled" : waitSecs >= 12 ? "slow" : "idle"}
        >
          <span className="footer-wait-dot" aria-hidden="true" />
          <span>
            {waitSecs < 12 ? `思索中… 已等待 ${waitSecs}s`
              : waitSecs < 30 ? `有点慢，已等待 ${waitSecs}s（网络或模型繁忙，请再稍候）`
              : `已等待 ${waitSecs}s，可能卡住了——超过 60s 会自动超时报错，届时可重试或去设置换更快的模型`}
          </span>
        </div>
      )}

      {availableQuestsHere.some(e => e.stage.playerHint) && (
        <div className="footer-hint-bar">
          {availableQuestsHere.filter(e => e.stage.playerHint).map(entry => (
            <div key={entry.quest.id} className="footer-hint-row">
              <span className="footer-hint-title"><Icon name="任务" size={12} /> {entry.quest.title}</span>
              <span className="footer-hint-text">{entry.stage.playerHint}</span>
            </div>
          ))}
        </div>
      )}

      {availableQuestsHere.some(e => !e.quest.hintOnly && !e.stage.choices?.length) && (
        <div className="footer-action-bar">
          <span className="footer-progress-tag"><Icon name="任务" size={12} /> 此处可推进</span>
          {availableQuestsHere.filter(e => !e.quest.hintOnly && !e.stage.choices?.length).map(entry => (
            <span
              key={entry.quest.id}
              onClick={() => questPanel.triggerQuestFromPanel(entry)}
              title={entry.stage.playerHint ?? entry.stage.description}
              className="quest-progress-btn"
            >
              {entry.quest.title}{entry.stage.giver !== null && entry.quest.giver ? `（${entry.stage.giver}）` : ""}
            </span>
          ))}
        </div>
      )}

      {availableQuestsHere.some(e => e.stage.choices?.length) && (
        <div className="footer-action-bar">
          <span className="footer-choice-tag">行动抉择</span>
          {availableQuestsHere.filter(e => e.stage.choices?.length).map(entry => (
            <span key={entry.quest.id} className="footer-choice-group">
              <span className="footer-choice-title">{entry.quest.title}：</span>
              {entry.stage.choices
                .filter(choice => isQuestChoiceOpen(choice, { questProgress, flags, varTree, inv }))
                .map(choice => {
                  const iconName = choice.resolve === "combat" ? "招式" : choice.resolve === "talk" ? "羁绊" : null;
                  return (
                    <span
                      key={choice.flag}
                      onClick={() => questPanel.triggerQuestChoice(entry, choice)}
                      title={choice.resolve === "combat" ? "会进入切磋，打赢才算数" : choice.resolve === "talk" ? "会进入对话，说赢才算数" : ""}
                      className="quest-choice-btn"
                    >
                      {iconName && <Icon name={iconName} size={11} />}{choice.label}
                    </span>
                  );
                })}
            </span>
          ))}
        </div>
      )}

      <GroundItemStrip items={groundItems} onPickUp={screenHandlers.handleCollectGround} />

      <div className="mobile-input-bar footer-input-bar">
        <div className="footer-input-inner">
          <div className="footer-input-box">
            {/* W-INPUT @ 触发点：与输入框融为一体，点按或框首敲 @ 唤起浮层 */}
            <span
              role="button"
              aria-label="指定对象或私聊旁白"
              aria-expanded={atMenuOpen}
              data-at-trigger="true"
              data-active={Boolean(atMenuOpen || capsule)}
              className="footer-at-btn"
              onClick={() => setAtMenuOpen(v => !v)}
            >@</span>
            {atMenuOpen && (
              <div
                ref={atMenuRef}
                role="menu"
                data-at-menu="true"
                className="footer-at-menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  data-at-option="whisper"
                  onClick={() => pickCapsule({ kind: "whisper", name: narratorName })}
                  className="at-menu-item"
                >{narratorName}（旁白私语 · 不耗回合）</button>
                {visibleNpcs.map(npc => (
                  <button
                    key={npc.name}
                    type="button"
                    role="menuitem"
                    data-at-option={`npc-${npc.name}`}
                    onClick={() => pickCapsule({ kind: "target", name: npc.name })}
                    className="at-menu-item"
                  >{npc.name}</button>
                ))}
              </div>
            )}
            {capsule && (
              <span data-input-capsule={capsule.kind} className="footer-capsule">
                {capsuleLabel}
                <span
                  role="button"
                  aria-label="取消指定"
                  data-capsule-clear="true"
                  onClick={() => setInputCapsule(null)}
                  className="footer-capsule-clear"
                >×</span>
              </span>
            )}
            <input
              className="game-input footer-input-field"
              ref={inputRef} value={input} onChange={onInputChange} onKeyDown={onInputKeyDown}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              placeholder={
                capsule?.kind === "pigeon" ? `提笔给「${capsule.name}」写信，写罢按回车放飞信鸽…` :
                capsule?.kind === "whisper" ? (pendingTalks > 0 ? "旁白回话中…可先打字，待她说完再发" : `对${capsule.name || narratorName}说些什么…（不消耗回合）`) :
                loading ? "..." :
                "说话做事直接写，敲 @ 或 // 可私聊旁白与指定对象"
              }
            />
          </div>
          {/* 发送按钮：和回车同一个提交入口。手机上按回车不顺手，这里给一个看得见的按钮。
              pointerdown 时 preventDefault，点按钮不让输入框失焦，iOS 键盘不会收起。 */}
          <button
            type="button"
            className="game-send-button mobile-touch-target"
            data-on={Boolean(input.trim())}
            disabled={!input.trim()}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => turn.onKey.submit?.()}
            aria-label={capsule?.kind === "pigeon" ? "放飞信鸽" : "发送"}
          >{capsule?.kind === "pigeon" ? "放飞" : "发送"}</button>
        </div>
      </div>
    </>
  );
}
