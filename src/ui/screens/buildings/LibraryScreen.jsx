import React, { useState } from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import { FREE_BOOKS, LIBRARY_BOOKS_JINGGUAN } from "../../../domain/data/buildings/libraryData.js";
import { CHAOJING, chaojingStatus } from "../../../features/sect/chaojing.js";
import { QUALITY_COLOR } from "../../../domain/data/items/qualityColor.js";

function ChaojingPanel({ char, flags, time, onChaojing }) {
  const status = chaojingStatus({ char, flags, time });
  if (!status.needed) return null;
  return (
    <div style={{ marginBottom: 12, padding: "10px 12px", border: `1px solid var(--border)`, background: "rgba(255,255,255,.02)" }}>
      <div style={{ color: "var(--accent-dim)", fontSize: "var(--fs-xs)", marginBottom: 6 }}>男弟子入门礼 · 静心抄经三日（{Math.min(status.count, CHAOJING.days)}/{CHAOJING.days}）</div>
      {status.done
        ? <div style={{ color: "var(--clay)", fontSize: "var(--fs-sm)" }}>三日经已抄足，可去听竹轩拜师。</div>
        : <Btn label={status.today ? "今日已抄过" : "静心抄经（两个时辰）"} disabled={status.today} onClick={onChaojing} />}
    </div>
  );
}

export default function LibraryScreen({ building, char, skills, flags, time, onClose, inline, onReadBook, onBuyBook, onChaojing }) {
  const [tab, setTab] = useState("free");
  const money = char.money || 0;
  const isBookshop = building.id?.includes("jingguan");
  const paidBooks = LIBRARY_BOOKS_JINGGUAN;

  return (
    <Overlay onClose={onClose} inline={inline}>
      <Header name={building.name} onClose={onClose} />
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid var(--border)` }}>
        {[["free", "免费阅读"], ["paid", "秘籍购买"]].map(([id, label]) => (
          <span key={id} onClick={() => setTab(id)}
            style={{ padding: "8px 18px", fontSize: "var(--fs-sm)", cursor: "pointer", userSelect: "none",
              color: tab === id ? "var(--accent)" : "var(--accent-dim)",
              borderBottom: tab === id ? `2px solid var(--accent)` : "2px solid transparent" }}
          >{label}</span>
        ))}
      </div>
      <div style={{ padding: 16 }}>
        {building.id === CHAOJING.buildingId && (
          <ChaojingPanel char={char} flags={flags} time={time} onChaojing={onChaojing} />
        )}
        <div style={{ color: "var(--ink-text-dim)", marginBottom: 12, fontSize: "var(--fs-xs)" }}>银两 {money} 两</div>

        {tab === "free" && FREE_BOOKS.map(book => (
          <div key={book.id} style={{ marginBottom: 10, padding: "10px 12px", background: "var(--bg-ink)", borderRadius: 0, border: `1px solid var(--border)` }}>
            <div style={{ color: "var(--ink-text)", fontSize: "var(--fs-md)", marginBottom: 4 }}>{book.name}</div>
            <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginBottom: 6 }}>{book.desc}</div>
            <Btn label="阅读" onClick={() => onReadBook(book)} />
          </div>
        ))}

        {tab === "paid" && paidBooks.map(book => {
          const owned = skills.some(s => s.id === book.skillEntry?.id);
          return (
            <div key={book.id} style={{ marginBottom: 10, padding: "10px 12px", background: "var(--bg-ink)", borderRadius: 0, border: `1px solid var(--border)` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: QUALITY_COLOR[book.skillEntry?.quality] || "var(--ink-text)", fontSize: "var(--fs-md)" }}>{book.name}</span>
                <span style={{ color: "var(--gold-bright)", fontSize: "var(--fs-sm)" }}>{book.price} 两</span>
              </div>
              <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginBottom: 6 }}>{book.desc}</div>
              {owned
                ? <span style={{ color: "var(--skill-learned)", fontSize: "var(--fs-xs)" }}>✓ 已习得</span>
                : <Btn label="购买" disabled={money < book.price} onClick={() => onBuyBook(book)} />
              }
            </div>
          );
        })}
      </div>
    </Overlay>
  );
}
