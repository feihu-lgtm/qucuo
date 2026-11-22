import React, { useState } from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import { QUALITY_COLOR } from "../../../domain/economy/equipment.js";
import { FREE_BOOKS, LIBRARY_BOOKS_JINGGUAN } from "../../../domain/buildings/libraryData.js";

export default function LibraryScreen({ building, char, skills, zoneTheme, onClose, inline, onReadBook, onBuyBook }) {
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
        <div style={{ color: "#8f8a7c", marginBottom: 12, fontSize: 11 }}>银两 {money} 两</div>

        {tab === "free" && FREE_BOOKS.map(book => (
          <div key={book.id} style={{ marginBottom: 10, padding: "10px 12px", background: "#161510", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
            <div style={{ color: "#e8e4d6", fontSize: 13, marginBottom: 4 }}>{book.name}</div>
            <div style={{ color: "#8f8a7c", fontSize: 11, marginBottom: 6 }}>{book.desc}</div>
            <Btn label="阅读" zoneTheme={zoneTheme} onClick={() => onReadBook(book)} />
          </div>
        ))}

        {tab === "paid" && paidBooks.map(book => {
          const owned = skills.some(s => s.id === book.skillEntry?.id);
          return (
            <div key={book.id} style={{ marginBottom: 10, padding: "10px 12px", background: "#161510", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: QUALITY_COLOR[book.skillEntry?.quality] || "#e8e4d6", fontSize: 13 }}>{book.name}</span>
                <span style={{ color: "#e8c468", fontSize: 12 }}>{book.price} 两</span>
              </div>
              <div style={{ color: "#8f8a7c", fontSize: 11, marginBottom: 6 }}>{book.desc}</div>
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
