import React, { useState, useEffect } from "react";
import { getAllMemories } from "./memory/memoryStore.js";

// 见闻录：把两套记忆系统可视化——玩家可打开查看。
// ① 事实账本（knowledge.js，varTree.世界.知识域）：什么时候·什么事·谁知道·怎么知道的·能记多少·传闻怎么演变
// ② 记忆碎片（小纸条，IndexedDB 向量库）：AI 记下的≤50字往事，公共/私有
//
// props: varTree（读账本）、time（当前回合，算淡忘倒计时）、turnToStr（回合→"第X日·时辰"）、zoneTheme、onClose

const 途径色 = { 亲历: "#8ac48a", 目击: "#6ec6c6", 告知: "#c4a86a", 传闻: "#c08a6a", 剧本: "#9a8ac0" };
const 途径说明 = { 亲历: "亲身经历", 目击: "当场看见", 告知: "有人明说", 传闻: "道听途说", 剧本: "夙来知晓" };

export default function LoreScreen({ varTree, time = 0, turnToStr, zoneTheme, onClose }) {
  const [tab, setTab] = useState("account"); // account=事实账本 | notes=记忆碎片
  const [notes, setNotes] = useState(null);
  const T = zoneTheme || {};
  const accent = T.accent || "#c4a86a";
  const border = T.border || "#2a2d3a";
  const bgPanel = T.bgPanel || "#12141c";
  const textDim = T.textDim || "#6a6a5a";
  const fmtTurn = (t) => (turnToStr ? turnToStr(t) : `第${Math.floor(t / 24) + 1}日`);

  useEffect(() => {
    if (tab === "notes" && notes === null) {
      getAllMemories().then(list => setNotes(list || [])).catch(() => setNotes([]));
    }
  }, [tab, notes]);

  // 事实账本数据
  const 领域 = varTree?.世界?.知识领域 || {};
  const facts = Object.values(领域.事实 || {}).sort((a, b) => (b.诞生回合 || 0) - (a.诞生回合 || 0));

  const wrap = { position: "fixed", inset: 0, background: "rgba(4,4,8,0.9)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
  const card = { width: "100%", maxWidth: 720, maxHeight: "86vh", background: "#0b0d13", border: `1px solid ${border}`, borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'Songti SC','STSong','SimSun',serif", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" };

  return (
    <div style={wrap} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        {/* 顶栏 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${border}`, background: `linear-gradient(180deg, ${bgPanel}, transparent)` }}>
          <span style={{ fontSize: 18, color: accent, fontWeight: "bold", letterSpacing: 2 }}>📖 见闻录</span>
          <span style={{ fontSize: 11, color: textDim }}>江湖之事，谁人知晓，几时淡忘</span>
          <span style={{ flex: 1 }} />
          <span onClick={onClose} style={{ cursor: "pointer", color: textDim, fontSize: 13, padding: "2px 8px" }}>✕ 收起</span>
        </div>

        {/* Tab 切换 */}
        <div style={{ display: "flex", gap: 4, padding: "10px 20px 0" }}>
          {[["account", "事实账本", facts.length], ["notes", "记忆碎片", notes?.length]].map(([k, label, n]) => (
            <span key={k} onClick={() => setTab(k)}
              style={{ cursor: "pointer", padding: "6px 16px", borderRadius: "6px 6px 0 0", fontSize: 13,
                color: tab === k ? "#0b0d13" : accent, background: tab === k ? accent : "transparent",
                border: `1px solid ${tab === k ? accent : border}`, borderBottom: "none", fontWeight: tab === k ? "bold" : "normal" }}>
              {label}{n != null ? ` · ${n}` : ""}
            </span>
          ))}
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", borderTop: `1px solid ${border}`, marginTop: -1 }}>
          {tab === "account" && (
            facts.length === 0
              ? <Empty text="江湖尚且平静，还没有值得记下的事。" textDim={textDim} />
              : facts.map(f => <FactCard key={f.id} fact={f} time={time} fmtTurn={fmtTurn} accent={accent} border={border} bgPanel={bgPanel} textDim={textDim} />)
          )}
          {tab === "notes" && (
            notes === null
              ? <Empty text="正在翻检记忆……" textDim={textDim} />
              : notes.length === 0
                ? <Empty text="还没有记下的往事碎片。（需在设置里开启向量记忆才会积累）" textDim={textDim} />
                : [...notes].sort((a, b) => (b.turn || 0) - (a.turn || 0)).map(n =>
                    <NoteCard key={n.id} note={n} fmtTurn={fmtTurn} accent={accent} border={border} bgPanel={bgPanel} textDim={textDim} />)
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ text, textDim }) {
  return <div style={{ textAlign: "center", color: textDim, fontSize: 13, padding: "48px 20px", lineHeight: 2 }}>{text}</div>;
}

// 一条事实：什么时候 · 什么事 · 谁知道(怎么知道的·何时) · 能记多少(传闻淡忘倒计时)
function FactCard({ fact, time, fmtTurn, accent, border, bgPanel, textDim }) {
  const knowers = Object.entries(fact.知晓者 || {});
  return (
    <div style={{ background: bgPanel, border: `1px solid ${border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10.5, color: accent, flexShrink: 0 }}>{fmtTurn(fact.诞生回合 || 0)}</span>
        {fact.标签 && <span style={{ fontSize: 9.5, color: textDim, border: `1px solid ${border}`, borderRadius: 3, padding: "0 5px" }}>{fact.标签}</span>}
      </div>
      <div style={{ fontSize: 14, color: "#d8cfb0", lineHeight: 1.7, marginBottom: 8 }}>{fact.摘要 || "（此事尚无定论）"}</div>
      {/* 谁知道 */}
      <div style={{ borderTop: `1px dashed ${border}`, paddingTop: 8 }}>
        <div style={{ fontSize: 10, color: textDim, marginBottom: 5 }}>谁知道这事（{knowers.length} 人）</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {knowers.length === 0 && <span style={{ fontSize: 11, color: textDim }}>无人知晓</span>}
          {knowers.map(([name, info]) => {
            const 途 = info.途径 || "剧本";
            const 会淡忘 = 途 === "传闻" && fact.忘却回合数 != null;
            const 剩余 = 会淡忘 ? (info.得知回合 + fact.忘却回合数 - time) : null;
            return (
              <span key={name} title={`${途径说明[途] || 途}｜${fmtTurn(info.得知回合 || 0)}得知${会淡忘 ? `｜再过约 ${Math.max(0, 剩余)} 回合若无人再提便淡忘` : "｜记牢不忘"}`}
                style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${途径色[途] || border}55`, color: "#c8bfa0", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span>{name}</span>
                <span style={{ fontSize: 9, color: 途径色[途] || textDim }}>{途}</span>
                {会淡忘 && <span style={{ fontSize: 9, color: 剩余 <= 10 ? "#c08a6a" : textDim }}>◷{Math.max(0, 剩余)}</span>}
              </span>
            );
          })}
        </div>
        {/* 传闻演变说明 */}
        {knowers.some(([, i]) => (i.途径 || "") === "传闻") && (
          <div style={{ fontSize: 9.5, color: textDim, marginTop: 6, fontStyle: "italic" }}>
            ◷ 传闻会随时日淡忘；同处一地时，知情者也可能把它讲给旁人（越传越广，或悄然湮没）。
          </div>
        )}
      </div>
    </div>
  );
}

// 一条记忆碎片（小纸条）
function NoteCard({ note, fmtTurn, accent, border, bgPanel, textDim }) {
  const priv = note.visibility === "private";
  return (
    <div style={{ background: bgPanel, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 10.5, color: accent }}>{fmtTurn(note.turn || 0)}</span>
        <span style={{ fontSize: 9.5, padding: "0 6px", borderRadius: 3, border: `1px solid ${border}`, color: priv ? "#c08ac0" : "#8ac48a" }}>
          {priv ? "私己心事" : "公开见闻"}
        </span>
        {note.requiredFlag && <span style={{ fontSize: 9, color: textDim }}>🔒需机缘</span>}
      </div>
      <div style={{ fontSize: 13.5, color: "#d0c8ac", lineHeight: 1.7 }}>{note.text}</div>
      {note.entities?.length > 0 && (
        <div style={{ fontSize: 9.5, color: textDim, marginTop: 5 }}>牵涉：{note.entities.join("、")}</div>
      )}
    </div>
  );
}
