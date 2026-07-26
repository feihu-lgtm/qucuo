import React from "react";
import LootCard from "./LootCard.jsx";

// 参照酒馆预设的视觉层级：叙述是底色，对话高亮跳出，心理*斜体*
//
// 日夜双色（本轮补齐）：对话粉「」和引语金 之前写死成暗夜配色，
// WCAG对比度实测在日间米色背景下只有约1.7~1.9（需要4.5+），比暗夜正文
// desc 的问题还严重——对话是叙事里最想让人一眼看到的内容，看不清对话
// 反而最影响体验。保留色相基因（对话依然是粉系、引语依然是金系），
// 拉深明度后日间对比度分别到 6.1 / 5.5，达标。
const DIALOGUE_COLOR = { night: "#e8a0d8", day: "#8a1e6a" };
const QUOTE_COLOR = { night: "#d4a853", day: "#7a5c14" };

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

export default function LogEntry({ entry, color, onAction, isDayMode = false }) {
  // 得物卡（切磋掉落/偷窃成功）：整条换成像素卡渲染，不走纯文本。
  if (entry.t === "loot" && entry.item) {
    return <LootCard entry={entry} />;
  }
  const text = entry.text || "";
  const isDesc = entry.t === "desc";

  return (
    <div
      className={entry.streaming ? "log-streaming" : undefined}
      style={{
        whiteSpace: "pre-wrap", wordBreak: "break-all", color,
        lineHeight: 2.2,
        marginBottom: entry.t === "room" ? 8 : 4,
        fontWeight: entry.t === "room" ? "bold" : "normal",
        textIndent: isDesc ? "2em" : "0",
      }}
    >
      <span style={{ cursor: entry.action ? "pointer" : undefined }} onClick={entry.action ? () => onAction(entry.action) : undefined}>
        {isDesc ? renderMixed(text, color, isDayMode) : text}
      </span>
    </div>
  );
}
