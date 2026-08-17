import React, { useState } from "react";
import { useOverlayCloseGuard } from "../utils/overlayClose.js";
import { loadChest, saveChest } from "../homestead.js";

// 库房木箱：存取物件。开局预填全套食材+调味料（见 homestead.js defaultChestStock）。
// 原是右上角家园面板里的一个图标，现挪成左栏建筑——站在据点就能进库房，不必先回小屋。
// UI 沿用 stones/ui 木质贴图，与烹饪台同一套调子。
const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
const UI = (f) => `${BASE}stones/ui/${f}`;

const QUAL_COLOR = { 白: "#e8e4d6", 绿: "#6aaa6a", 蓝: "#5a9adf", 紫: "#b48adf", 橙: "#e0913a", 红: "#d4756a" };

export default function ChestScreen({ building, inv, setInv, zoneTheme, inline, onClose }) {
  const closeGuard = useOverlayCloseGuard(onClose);
  const house = building?.house || building?.name || "库房";
  const [chest, setChest] = useState(() => loadChest(house));
  const persist = (items) => { setChest(items); saveChest(house, items); };

  const nameOf = (it) => (typeof it === "string" ? it : it?.name) || "未知物件";
  const qualOf = (it) => (typeof it === "object" ? it?.quality : null);

  const storeItem = (idx) => {
    const item = inv[idx];
    if (!item) return;
    const nextInv = [...inv]; nextInv.splice(idx, 1);
    setInv(nextInv);
    persist([...chest, item]);
  };
  const retrieveItem = (idx) => {
    const item = chest[idx];
    if (!item) return;
    const nextChest = [...chest]; nextChest.splice(idx, 1);
    persist(nextChest);
    setInv([...inv, item]);
  };

  // 单件物品条：木牌底，点右侧按钮存取
  const ItemRow = ({ it, side, idx }) => {
    const q = qualOf(it);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", marginBottom: 5,
        backgroundImage: `url(${UI("bar_wood.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }}>
        {q && <span style={{ color: QUAL_COLOR[q] || "#e8e4d6", fontSize: 10 }}>●</span>}
        <span style={{ flex: 1, color: "#f0e0b8", fontSize: 12.5, textShadow: "0 1px 2px #000" }}>{nameOf(it)}</span>
        <span onClick={() => (side === "chest" ? retrieveItem(idx) : storeItem(idx))}
          style={{ cursor: "pointer", padding: "3px 12px", fontSize: 11, fontWeight: "bold",
            backgroundImage: `url(${UI("bar_paper.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
            color: "#4a2d0a", textShadow: "0 1px 0 rgba(255,255,255,.3)" }}>
          {side === "chest" ? "取出" : "存入"}
        </span>
      </div>
    );
  };

  const panel = (
    <div style={{ position: "relative", background: "linear-gradient(180deg,#1d1309 0%, #140c06 55%, #0d0805 100%)",
      minHeight: "100%", color: "#e8d5b0", fontFamily: "inherit" }}
      onMouseDown={inline ? undefined : closeGuard.onMouseDown}
      onClick={inline ? undefined : closeGuard.onClick}>
      {/* 木匾抬头 */}
      <div style={{ position: "relative", margin: "14px 16px 0", padding: "10px 18px",
        backgroundImage: `url(${UI("bar_wood.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#f5e2b8", fontSize: 15, fontWeight: "bold", letterSpacing: 3, textShadow: "0 1px 2px #000" }}>
          📦 {building?.name || "库房"}
        </span>
        <span onClick={onClose} title="关闭" style={{ cursor: "pointer", width: 26, height: 26, flexShrink: 0,
          backgroundImage: `url(${UI("btn_close.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }} />
      </div>

      <div style={{ padding: "12px 18px 26px" }}>
        <div style={{ color: "#8a7040", fontSize: 11, marginBottom: 12, lineHeight: 1.6, fontStyle: "italic" }}>
          {building?.desc || "点击物品存入或取出。"}
        </div>

        {/* 库房 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#a08a5a", fontSize: 11.5, letterSpacing: 2, marginBottom: 8 }}>🗃 库房（{chest.length}）</div>
          <div style={{ maxHeight: "34vh", overflowY: "auto", paddingRight: 4 }}>
            {chest.length === 0
              ? <div style={{ color: "#5a4a30", fontSize: 11.5, fontStyle: "italic", padding: "6px 10px" }}>箱子空了。</div>
              : chest.map((it, i) => <ItemRow key={(typeof it === "object" ? it.id : it) + i} it={it} side="chest" idx={i} />)}
          </div>
        </div>

        {/* 行囊 */}
        <div>
          <div style={{ color: "#a08a5a", fontSize: 11.5, letterSpacing: 2, marginBottom: 8 }}>🎒 行囊（{inv.length}）</div>
          <div style={{ maxHeight: "34vh", overflowY: "auto", paddingRight: 4 }}>
            {inv.length === 0
              ? <div style={{ color: "#5a4a30", fontSize: 11.5, fontStyle: "italic", padding: "6px 10px" }}>行囊空空。</div>
              : inv.map((it, i) => <ItemRow key={(typeof it === "object" ? it.id : it) + i} it={it} side="inv" idx={i} />)}
          </div>
        </div>
      </div>
    </div>
  );

  if (inline) return panel;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.88)", zIndex: 120,
      display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div style={{ width: 520, maxWidth: "92vw", maxHeight: "86vh", overflowY: "auto",
        border: "1px solid #4a3a20", borderRadius: 0 }} onClick={e => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
