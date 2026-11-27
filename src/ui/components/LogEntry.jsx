import React from "react";
import LootCard from "./LootCard.jsx";
import EffectReceiptCard from "./EffectReceiptCard.jsx";
import { LOG_T } from "../../domain/data/log/logTypes.js";

// 参照酒馆预设的视觉层级：叙述是底色，对话高亮跳出，心理*斜体*
//
// 日夜双色（本轮补齐）：对话粉「」和引语金 之前写死成暗夜配色，
// WCAG对比度实测在日间米色背景下只有约1.7~1.9（需要4.5+），比暗夜正文
// desc 的问题还严重——对话是叙事里最想让人一眼看到的内容，看不清对话
// 反而最影响体验。保留色相基因（对话依然是粉系、引语依然是金系），
// 拉深明度后日间对比度分别到 6.1 / 5.5，达标。
const DIALOGUE_COLOR = { night: "var(--log-dialogue)", day: "var(--log-dialogue)" };
const QUOTE_COLOR = { night: "var(--warn)", day: "var(--warn)" };

function renderMixed(text, baseColor, isDayMode) {
  if (!text) return text;
  const dialogueColor = isDayMode ? DIALOGUE_COLOR.day : DIALOGUE_COLOR.night;
  const quoteColor = isDayMode ? QUOTE_COLOR.day : QUOTE_COLOR.night;
  // 先按「...」分割
  const segments = text.split(/(「[^」]+」)/g);
  return segments.flatMap((seg, i) => {
    // 「」对话：亮粉加粗，最抢眼
    if (seg.startsWith("「") && seg.endsWith("」")) {
      return <span key={i} style={{ color: dialogueColor, fontWeight: 600 }}>{seg}</span>;
    }
    // 普通叙述中再拆 "*...*" 心理描写 和 "..." 引语
    const subs = seg.split(/(\*[^*]+\*|"[^"]+")/g);
    return subs.map((sub, j) => {
      if (sub.startsWith('*') && sub.endsWith('*')) {
        // 心理描写：斜体
        return <span key={`${i}-${j}`} style={{ color: baseColor, fontStyle: "italic" }}>{sub}</span>;
      }
      if (sub.startsWith('"') && sub.endsWith('"')) {
        // 直接引语：琥珀
        return <span key={`${i}-${j}`} style={{ color: quoteColor }}>{sub}</span>;
      }
      // 旁白叙述：正常字体，原色
      return <span key={`${i}-${j}`} style={{ color: baseColor }}>{sub}</span>;
    });
  });
}

// WO-14：日志项携带 receipts（WO-11 判官落盘回执）时，在正文下方逐条渲染
// 水墨竹简天机落账卡。按钮回调与条目 action 共用同一个 onAction 透传口。
function ReceiptStrip({ receipts, onAction }) {
  if (!Array.isArray(receipts) || receipts.length === 0) return null;
  // 先在 JSX 外 map 成数组再插值：propsCheck 的作用域正则对 JSX 内联 map 的
  // 嵌套括号会误吞参数名（把 (r, i) 的 r 吃掉），提出来扫得准、读着也干净。
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

// 渲染层剥除系统/结算行前导参差空白（保留 store 原文不变，兼容所有单测快照），
// 让所有系统行、奖励行、气血品阶行都严丝合缝对齐同一条左边线。
function stripLeadingSpace(text) {
  return String(text || "").replace(/^[\s\u3000]+/, "");
}

const DUEL_BANNER_RE = /^[\s\u3000]*──\s*(.+?)\s*──[\s\u3000]*$/;
const SETTLE_BANNER_RE = /^[\s\u3000]*◈\s*.+?·\s*战斗结算[\s\u3000]*$/;
const LETTER_LINE_RE = /^[\s\u3000]*「([^」]+)来信」([\s\S]*)$/;

export default function LogEntry({ entry, color, onAction, isDayMode = false, onOpenLetters, onOpenJournal, onOpenSettings }) {
  // 得物卡（切磋掉落/偷窃成功/偷师得手）：整条换成像素卡渲染，不走纯文本。
  // 偷招传的是 entry.skill（无 item），偷物传 entry.item——两者都要放行，
  // 否则偷师得手会漏卡、退化成一行纯文本（此前正是这个 bug）。
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

  // 流式占位（▌ / 「旁白」▌）：原地在同一节点里渲染成水墨骨架屏，
  // 首字抵达时无需卸载/重建节点，彻底避免行错位跳动。
  if (isNarrativePlaceholder(entry)) {
    return (
      <div className={cls} style={{ color }}>
        <NarrativeSkeleton narratorPrefix={rawText.trim().startsWith("「旁白」")} />
      </div>
    );
  }

  // 主栏信件卡片：NPC 来信与回信统一折成素笺信卡，不再混作旁白亮粉字飘在日志里。
  const letterMatch = entry.t === LOG_T.NARRATOR ? rawText.match(LETTER_LINE_RE) : null;
  if (entry.letterFrom || letterMatch) {
    const sender = entry.letterFrom || letterMatch[1];
    const body = (entry.letterBody ?? letterMatch?.[2] ?? rawText).trim();
    return (
      <div className={`${baseCls} log-letter-card`}>
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
    );
  }

  // 接口/系统故障（带 kind）：主栏只有一句话，同因连续失败合成一条并标次数；
  // 详情在卷宗里看，额度、密钥、地址这类改设置才会好的，给一个「接口设置」入口。
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

  // 切磋分割条「── 与XX切磋 ──」居中配两侧细线
  const duelMatch = entry.t === LOG_T.SYS ? rawText.match(DUEL_BANNER_RE) : null;
  if (duelMatch) {
    return (
      <div className={`${cls} log-duel-banner`} style={{ color }}>
        <span className="log-duel-rule" />
        <span className="log-duel-label">{duelMatch[1]}</span>
        <span className="log-duel-rule" />
      </div>
    );
  }

  // 战斗结算小标题「◈ XX 切磋 YY · 战斗结算」做成整齐底线小标
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
  const shouldIndent = isDesc && (displayText.includes("\n") || displayText.trim().length >= 42);
  const renderedContent = isDesc
    ? renderMixed(displayText, color, isDayMode)
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
