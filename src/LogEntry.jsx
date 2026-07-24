import React from "react";

// 参照酒馆预设的视觉层级：叙述是底色，对话高亮跳出，心理*斜体*
function renderMixed(text, baseColor) {
  if (!text) return text;
  // 先按「...」分割
  const segments = text.split(/(「[^」]+」)/g);
  return segments.flatMap((seg, i) => {
    // 「」对话：亮粉加粗，最抢眼
    if (seg.startsWith("「") && seg.endsWith("」")) {
      return <span key={i} style={{ color: "#e8a0d8", fontWeight: 600 }}>{seg}</span>;
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
        return <span key={`${i}-${j}`} style={{ color: "#d4a853" }}>{sub}</span>;
      }
      // 旁白叙述：正常字体，原色
      return <span key={`${i}-${j}`} style={{ color: baseColor }}>{sub}</span>;
    });
  });
}

export default function LogEntry({ entry, color, onAction }) {
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
        {isDesc ? renderMixed(text, color) : text}
      </span>
    </div>
  );
}
