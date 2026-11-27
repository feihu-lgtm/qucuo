import React from "react";
import LootCard from "./LootCard.jsx";
import EffectReceiptCard from "./EffectReceiptCard.jsx";
import NpcAvatar from "./NpcAvatar.jsx";
import { LOG_T } from "../../domain/data/log/logTypes.js";
import { parseDuelOpponent, splitNarrativeParagraphs } from "../panels/center/dialogueModel.js";

// 参照酒馆预设的视觉层级：叙述是底色，对话高亮跳出，心理*斜体*
const DIALOGUE_COLOR = { night: "var(--log-dialogue)", day: "var(--log-dialogue)" };
const QUOTE_COLOR = { night: "var(--warn)", day: "var(--warn)" };
const EMPTY_SPEAKERS = [];

function renderMixed(text, baseColor, isDayMode) {
  if (!text) return text;
  const dialogueColor = isDayMode ? DIALOGUE_COLOR.day : DIALOGUE_COLOR.night;
  const quoteColor = isDayMode ? QUOTE_COLOR.day : QUOTE_COLOR.night;
  // 先按「...」分割
  const segments = text.split(/(「[^」]+」)/g);
  return segments.flatMap((seg, i) => {
    // 「」对话：亮粉/亮字加粗，最抢眼
    if (seg.startsWith("「") && seg.endsWith("」")) {
      return <span key={i} style={{ color: dialogueColor, fontWeight: 600 }}>{seg}</span>;
    }
    // 普通叙述中再拆 "*...*" 心理描写 和 "..." 引语
    const subs = seg.split(/(\*[^*]+\*|"[^"]+")/g);
    return subs.map((sub, j) => {
      if (sub.startsWith('*') && sub.endsWith('*')) {
        return <span key={`${i}-${j}`} style={{ color: baseColor, fontStyle: "italic" }}>{sub}</span>;
      }
      if (sub.startsWith('"') && sub.endsWith('"')) {
        return <span key={`${i}-${j}`} style={{ color: quoteColor }}>{sub}</span>;
      }
      return <span key={`${i}-${j}`} style={{ color: baseColor }}>{sub}</span>;
    });
  });
}

// WO-14：日志项携带 receipts（WO-11 判官落盘回执）时，在正文下方逐条渲染水墨竹简天机落账卡。
function ReceiptStrip({ receipts, onAction }) {
  if (!Array.isArray(receipts) || receipts.length === 0) return null;
  const cards = receipts.map((r, i) => (
    <EffectReceiptCard key={r?.factId || i} receipt={r} onAction={onAction} />
  ));
  return (
    <div className="effect-receipt-strip">{cards}</div>
  );
}

export function isNarrativePlaceholder(entry) {
  if (!entry?.streaming) return false;
  const text = (entry.text || "").trim();
  return text === "▌" || text === "「旁白」▌";
}

export function NarrativeSkeleton({ narratorPrefix = false }) {
  return (
    <div className="narrative-skeleton" role="status" aria-label="叙事生成中">
      {narratorPrefix && <span className="narrative-skeleton-tag">「旁白」</span>}
      <span className="narrative-skeleton-bar" />
      <span className="narrative-skeleton-bar" />
      <span className="narrative-skeleton-bar" />
    </div>
  );
}

function stripLeadingSpace(text) {
  return String(text || "").replace(/^[\s\u3000]+/, "");
}

const DUEL_BANNER_RE = /^[\s\u3000]*──\s*(.+?)\s*──[\s\u3000]*$/;
const SETTLE_BANNER_RE = /^[\s\u3000]*◈\s*.+?·\s*战斗结算[\s\u3000]*$/;
const LETTER_LINE_RE = /^[\s\u3000]*「([^」]+)来信」([\s\S]*)$/;
const NARRATOR_PREFIX_RE = /^[\s\u3000]*「旁白」/;

export default function LogEntry({
  entry, color, onAction, isDayMode = false, onOpenLetters, onOpenJournal, onOpenSettings,
  dialoguePortraitMode = "gutter", knownSpeakers = EMPTY_SPEAKERS, onOpenNpc, narratorPortraitSrc = null, playerAvatar = null,
}) {
  if (entry.t === LOG_T.LOOT && (entry.item || entry.skill)) {
    return (
      <div className="log-entry log-entry--loot">
        <LootCard entry={entry} />
        <ReceiptStrip receipts={entry.receipts} onAction={onAction} />
      </div>
    );
  }
  const rawText = entry.text || "";
  const isDesc = entry.t === LOG_T.DESC;
  const isRoom = entry.t === LOG_T.ROOM;
  const isCmd = entry.t === LOG_T.CMD;
  const kindCls = isRoom
    ? "log-entry--room"
    : isCmd
      ? "log-entry--cmd"
      : isDesc
        ? "log-entry--prose"
        : "log-entry--fact";
  const baseCls = entry.streaming
    ? "log-entry log-streaming"
    : entry.streamed
      ? "log-entry log-entry-streamed"
      : "log-entry";
  const cls = `${baseCls} ${kindCls}`;

  if (isNarrativePlaceholder(entry)) {
    return (
      <div className={cls} style={{ color }}>
        <NarrativeSkeleton narratorPrefix={rawText.trim().startsWith("「旁白」")} />
      </div>
    );
  }

  // 主栏信件卡片：NPC 来信统一折成素笺信卡，附寄信人小像
  const letterMatch = entry.t === LOG_T.NARRATOR ? rawText.match(LETTER_LINE_RE) : null;
  if (entry.letterFrom || letterMatch) {
    const sender = entry.letterFrom || letterMatch[1];
    const body = (entry.letterBody ?? letterMatch?.[2] ?? rawText).trim();
    return (
      <div className={`${baseCls} log-letter-card log-letter-card--with-ava`}>
        {dialoguePortraitMode !== "off" && (
          <NpcAvatar name={sender} size="md" onClick={onOpenNpc ? () => onOpenNpc(sender) : undefined} title={sender} />
        )}
        <div className="log-letter-card-main">
          <div className="log-letter-card-head">
            <span className="log-letter-card-sender">✉ {sender} 来信</span>
            {onOpenLetters && (
              <button type="button" className="log-letter-card-link" onClick={onOpenLetters}>
                信箱
              </button>
            )}
          </div>
          <div className="log-letter-card-body">{renderMixed(body, "var(--center-letter-body)", isDayMode)}</div>
          <ReceiptStrip receipts={entry.receipts} onAction={onAction} />
        </div>
      </div>
    );
  }

  // 旁白私聊回应：按对白模式落像
  if (entry.t === LOG_T.NARRATOR && dialoguePortraitMode !== "off" && NARRATOR_PREFIX_RE.test(rawText)) {
    const cleanNarrator = rawText.replace(NARRATOR_PREFIX_RE, "").trim().replace(/\s*▌\s*$/, "");
    const openNarrator = onOpenNpc ? () => onOpenNpc("旁白") : undefined;
    if (dialoguePortraitMode === "inline") {
      return (
        <div className={`${cls} log-dlg-inline log-dlg-inline--lotus`} style={{ color }}>
          <NpcAvatar name="旁白" src={narratorPortraitSrc} size="xs" lotus onClick={openNarrator} title="点名私聊旁白" />
          <span className="log-dlg-speaker is-lotus" onClick={openNarrator}>旁白　</span>
          <span>{renderMixed(cleanNarrator, color, isDayMode)}</span>
          {entry.streaming && <span className="log-stream-caret" aria-hidden="true" />}
          <ReceiptStrip receipts={entry.receipts} onAction={onAction} />
        </div>
      );
    }
    return (
      <div className={`${cls} log-dlg-gutter log-dlg-gutter--lotus`} style={{ color }}>
        <NpcAvatar name="旁白" src={narratorPortraitSrc} size="md" lotus onClick={openNarrator} title="点名私聊旁白" />
        <div className="log-dlg-gutter-body">
          <div className="log-dlg-speaker-row">
            <span className="log-dlg-speaker is-lotus" onClick={openNarrator}>旁白</span>
          </div>
          <div className="log-dlg-text">
            {renderMixed(cleanNarrator, color, isDayMode)}
            {entry.streaming && <span className="log-stream-caret" aria-hidden="true" />}
          </div>
          <ReceiptStrip receipts={entry.receipts} onAction={onAction} />
        </div>
      </div>
    );
  }

  // 接口/系统故障（带 kind）
  if (entry.t === LOG_T.ERR && entry.kind) {
    const count = Number(entry.count) || 1;
    return (
      <div className={`${baseCls} log-turn-error`}>
        <span className="log-turn-error-text">{stripLeadingSpace(rawText)}</span>
        {count > 1 && <span className="log-turn-error-count">×{count}</span>}
        <span className="log-turn-error-actions">
          {entry.retryable === false && onOpenSettings && (
            <button type="button" className="log-inline-link" onClick={onOpenSettings}>接口设置</button>
          )}
          {onOpenJournal && (
            <button type="button" className="log-inline-link" onClick={onOpenJournal}>看卷宗</button>
          )}
        </span>
      </div>
    );
  }

  // 切磋分割条「── 与XX切磋 ──」：双方头像落于分隔标两侧
  const duelMatch = entry.t === LOG_T.SYS ? rawText.match(DUEL_BANNER_RE) : null;
  if (duelMatch) {
    const opp = parseDuelOpponent(duelMatch[1]);
    return (
      <div className={`${cls} log-duel-banner`} style={{ color }}>
        <span className="log-duel-rule" />
        {dialoguePortraitMode !== "off" && opp && playerAvatar && (
          <NpcAvatar name="你" src={playerAvatar} size="sm" />
        )}
        <span className="log-duel-label">{duelMatch[1]}</span>
        {dialoguePortraitMode !== "off" && opp && (
          <NpcAvatar name={opp} size="sm" onClick={onOpenNpc ? () => onOpenNpc(opp) : undefined} title={opp} />
        )}
        <span className="log-duel-rule" />
      </div>
    );
  }

  // 战斗结算小标题
  if (entry.t === LOG_T.AFFECTION && SETTLE_BANNER_RE.test(rawText)) {
    return (
      <div className={`${cls} log-settle-banner`} style={{ color }}>
        <span>{stripLeadingSpace(rawText)}</span>
        <ReceiptStrip receipts={entry.receipts} onAction={onAction} />
      </div>
    );
  }

  const trimmedForDisplay = (isDesc || isRoom || isCmd)
    ? rawText
    : stripLeadingSpace(rawText);
  const displayText = entry.streaming
    ? trimmedForDisplay.replace(/\s*▌\s*$/, "")
    : trimmedForDisplay;

  // 正文叙事段落切分：只有识别到明确说话人且未切成纯文时才给对白段挂头像，其余照常居中/缩进渲染
  if (isDesc && dialoguePortraitMode !== "off" && knownSpeakers.length > 0) {
    const blocks = splitNarrativeParagraphs(displayText, knownSpeakers);
    if (blocks.some((b) => b.kind === "dialogue")) {
      return (
        <div className={`${cls} log-dlg-group`} style={{ color }}>
          {blocks.map((block, bi) => {
            const isLast = bi === blocks.length - 1;
            const caret = isLast && entry.streaming ? <span className="log-stream-caret" aria-hidden="true" /> : null;
            if (block.kind === "dialogue") {
              const openSp = onOpenNpc ? () => onOpenNpc(block.speaker) : undefined;
              const cleanPara = block.text.trim();
              if (dialoguePortraitMode === "inline") {
                return (
                  <div key={bi} className="log-dlg-inline">
                    <NpcAvatar name={block.speaker} size="xs" onClick={openSp} title={block.speaker} />
                    <span>{renderMixed(cleanPara, color, isDayMode)}{caret}</span>
                  </div>
                );
              }
              return (
                <div key={bi} className="log-dlg-gutter">
                  <NpcAvatar name={block.speaker} size="md" onClick={openSp} title={`互动 · ${block.speaker}`} />
                  <div className="log-dlg-gutter-body">
                    <div className="log-dlg-speaker-row">
                      <span className="log-dlg-speaker" onClick={openSp}>{block.speaker}</span>
                    </div>
                    <div className="log-dlg-text">
                      {renderMixed(cleanPara, color, isDayMode)}
                      {caret}
                    </div>
                  </div>
                </div>
              );
            }
            const proseIndent = block.text.trim().length >= 42;
            return (
              <div
                key={bi}
                className="log-dlg-prose-line"
                style={{ textIndent: proseIndent ? "var(--center-prose-indent)" : "0" }}
              >
                {renderMixed(block.text, color, isDayMode)}
                {caret}
              </div>
            );
          })}
          <ReceiptStrip receipts={entry.receipts} onAction={onAction} />
        </div>
      );
    }
  }

  const shouldIndent = isDesc && (displayText.includes("\n") || displayText.trim().length >= 42);
  const renderedContent = isDesc
    ? renderMixed(displayText, color, isDayMode)
    : isCmd
      ? (() => {
          const clean = displayText.replace(/^>\s*/, "");
          return clean.startsWith("你") ? clean : <><span className="log-cmd-actor">你　</span>{clean}</>;
        })()
      : isRoom && displayText.trim()
        ? `— ${displayText.trim()} —`
        : displayText;

  return (
    <div
      className={cls}
      style={{
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        wordBreak: "normal",
        color,
        marginBottom: 4,
        fontWeight: isRoom ? "bold" : "normal",
        textIndent: shouldIndent ? "var(--center-prose-indent)" : "0",
        ...(isRoom ? { textAlign: "center", letterSpacing: "0.2em", opacity: 0.9 } : {}),
      }}
    >
      <span style={{ cursor: entry.action ? "pointer" : undefined }} onClick={entry.action ? () => onAction(entry.action) : undefined}>
        {renderedContent}
        {entry.streaming && <span className="log-stream-caret" aria-hidden="true" />}
      </span>
      <ReceiptStrip receipts={entry.receipts} onAction={onAction} />
    </div>
  );
}
