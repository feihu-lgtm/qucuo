import React, { useState } from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import { QUALITY_COLOR } from "../../../domain/rules/economy/equipment.js";
import { FREE_BOOKS, LIBRARY_BOOKS_JINGGUAN } from "../../../domain/data/buildings/libraryData.js";
import { CHAOJING, chaojingStatus } from "../../../features/sect/chaojing.js";

function ChaojingPanel({ char, flags, time, zoneTheme, onChaojing }) {
  const status = chaojingStatus({ char, flags, time });
  if (!status.needed) return null;
  return (
    <div style={{ marginBottom: 12, padding: "10px 12px", border: `1px solid ${zoneTheme.border}`, background: "rgba(255,255,255,.02)" }}>
      <div style={{ color: zoneTheme.accentDim, fontSize: 11, marginBottom: 6 }}>男弟子入门礼 · 静心抄经三日（{Math.min(status.count, CHAOJING.days)}/{CHAOJING.days}）</div>
      {status.done
        ? <div style={{ color: "var(--clay)", fontSize: 12 }}>三日经已抄足，可去听竹轩拜师。</div>
        : <Btn label={status.today ? "今日已抄过" : "静心抄经（两个时辰）"} disabled={status.today} zoneTheme={zoneTheme} onClick={onChaojing} />}
    </div>
  );
}

export default function LibraryScreen({ building, char, skills, flags, time, zoneTheme, onClose, inline, onReadBook, onBuyBook, onChaojing }) {
  const [tab, setTab] = useState("free");
  const money = char.money || 0;
  const isBookshop = building.id?.includes("jingguan");
  const paidBooks = LIBRARY_BOOKS_JINGGUAN;

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${zoneTheme.border}` }}>
        {[["free", "免费阅读"], ["paid", "秘籍购买"]].map(([id, label]) => (
          <span key={id} onClick={() => setTab(id)}
            style={{ padding: "8px 18px", fontSize: 12, cursor: "pointer", userSelect: "none",
              color: tab === id ? zoneTheme.accent : zoneTheme.accentDim,
              borderBottom: tab === id ? `2px solid ${zoneTheme.accent}` : "2px solid transparent" }}
          >{label}</span>
        ))}
      </div>
      <div style={{ padding: 16 }}>
        {building.id === CHAOJING.buildingId && (
          <ChaojingPanel char={char} flags={flags} time={time} zoneTheme={zoneTheme} onChaojing={onChaojing} />
        )}
        <div style={{ color: "var(--ink-text-dim)", marginBottom: 12, fontSize: 11 }}>银两 {money} 两</div>

        {tab === "free" && FREE_BOOKS.map(book => (
          <div key={book.id} style={{ marginBottom: 10, padding: "10px 12px", background: "var(--bg-ink)", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
            <div style={{ color: "var(--ink-text)", fontSize: 13, marginBottom: 4 }}>{book.name}</div>
            <div style={{ color: "var(--ink-text-dim)", fontSize: 11, marginBottom: 6 }}>{book.desc}</div>
            <Btn label="阅读" zoneTheme={zoneTheme} onClick={() => onReadBook(book)} />
          </div>
        ))}

        {tab === "paid" && paidBooks.map(book => {
          const owned = skills.some(s => s.id === book.skillEntry?.id);
          return (
            <div key={book.id} style={{ marginBottom: 10, padding: "10px 12px", background: "var(--bg-ink)", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: QUALITY_COLOR[book.skillEntry?.quality] || "var(--ink-text)", fontSize: 13 }}>{book.name}</span>
                <span style={{ color: "var(--gold-bright)", fontSize: 12 }}>{book.price} 两</span>
              </div>
              <div style={{ color: "var(--ink-text-dim)", fontSize: 11, marginBottom: 6 }}>{book.desc}</div>
              {owned
                ? <span style={{ color: "#3a5a3a", fontSize: 11 }}>✓ 已习得</span>
                : <Btn label="购买" disabled={money < book.price} zoneTheme={zoneTheme} onClick={() => onBuyBook(book)} />
              }
            </div>
          );
        })}
      </div>
    </Overlay>
  );
}
