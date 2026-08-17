import React, { useState } from "react";
import { Overlay, Header, Btn } from "./InnScreen.jsx";
import { QUALITY_COLOR } from "../equipment.js";

// 藏经阁/文渊书肆：免费阅读经书（注入世界知识），付费秘籍直接入 skills
const FREE_BOOKS = [
  { id: "book_zangdi", name: "《藏地风物志》", topic: "藏地风俗", desc: "记录曲措乡各村寨的风俗习惯、节庆传统和民间传说，读后对本地文化有更深理解。" },
  { id: "book_jianghu", name: "《江湖小道消息》", topic: "江湖传闻", desc: "流传甚广的江湖八卦集，真假参半，但偶尔能听到几个有用的线索。" },
  { id: "book_wuxue", name: "《武学浅论》", topic: "武学基础", desc: "浅显的武学入门读物，解释了攻击、防御、状态三类招式的相互克制关系。" },
];

// 书肆专属书籍（武学秘籍 - 文渊书肆）
const LIBRARY_BOOKS_JINGGUAN = [
  { id: "book_wuying", name: "《无影步残篇》", topic: "轻功", skillEntry: { id: "kf_wuying", name: "无影步", type: "轻功", quality: "绿", moveType: "状态", passiveBonus: { speedBonus: 1 }, level: 1, exp: 0, maxExp: 100, stage: "入门", active: false }, price: 60, desc: "残缺的轻功秘籍，缺了关键章节，但基础仍在，练成后步法灵动。" },
  { id: "book_tiezhi", name: "《铁指功》", topic: "外功", skillEntry: { id: "kf_tiezhi", name: "铁指功", type: "招式", quality: "白", moveType: "攻击", passiveBonus: null, level: 1, exp: 0, maxExp: 100, stage: "入门", active: false }, price: 30, desc: "简单粗暴的指力练习，练成后攻击招式更为凌厉。" },
];

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
