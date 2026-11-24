// 入册审改 · 原卡正文对照（从 ReviewNpc.jsx 拆出）
import React, { useState } from "react";

// 原卡正文对照。
// 【为什么默认摊开而不是折叠】它存在的唯一理由就是让玩家判断上面那段重写得准不准。
// 折起来就得多点一下，多点一下就不会有人看，那这一份数据留着也没意义。
// 限高滚动是必须的：中文卡池里正文上千字很常见，实测一张普通卡 397 字、动漫角色
// 卡三千字的也有，摊开会把下面十几个 Section 全推走。
export default function RawEntryCompare({ raw }) {
  const [open, setOpen] = useState(true);
  const n = String(raw || "").length;
  return (
    <div style={{ marginTop: 8 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          fontSize: 10.5, color: "var(--ink-muted)", userSelect: "none",
          padding: "3px 0", borderTop: "1px solid var(--bg-card)",
        }}>
        <span style={{ color: "var(--ink-text-dim)", width: 10 }}>{open ? "▾" : "▸"}</span>
        <span>对照原卡正文</span>
        <span style={{ color: "var(--muted)" }}>{n} 字</span>
        <span style={{ fontSize: "var(--fs-2xs)", color: "var(--bug-dim-dark)", border: "1px solid var(--border-deep)",
        borderRadius: 0, padding: "0 4px", }}>不注入</span>
      </div>
      {open && (
        <div style={{
          maxHeight: "min(26vh, 280px)", overflowY: "auto",
          padding: "7px 10px", marginTop: 4,
          background: "rgba(0,0,0,.3)", border: "1px solid var(--bg-card)", borderRadius: 0,
          fontSize: 10.5, lineHeight: 1.75, color: "var(--tutorial-note)",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
          userSelect: "text",
        }}>{raw}</div>
      )}
    </div>
  );
}

