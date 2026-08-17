import React from "react";
import { MAP_UI } from "./mapUi.js";

// 固定九宫格视窗地图：玩家永远居中不动，走一步"世界卷一格"（周围八格内容刷新）。
// 像老式 RPG 主角居中、地图卷动。内外层通用。
// props:
//   centerLabel — 中心格显示（我当前所在地名）
//   cells — { n,ne,e,se,s,sw,w,nw: {name?,explored,dir} }：八方向格数据
//           explored=false 显问号（战争迷雾，点了才知有没有路）；有 name 且 explored 显地名
//   onGo(dir) — 点某方向格
//   accent, loading, big
// explored=去过（亮·实心）; !explored=战争迷雾（问号·虚线）; reachable=当前有出口可点；
// locked=有路但未解锁（点了触发 AI 叙事拦截）。current=当前所在（金框脉冲）。
export default function NineGridMap({ centerLabel, cells, onGo, accent = "#c8323a", loading, big = false }) {
  const [hover, setHover] = React.useState(null);
  // 3×3 布局：行=北/中/南，列=西/中/东
  const layout = [
    ["nw", "n", "ne"],
    ["w", "center", "e"],
    ["sw", "s", "se"],
  ];
  const DIR_CN = { n: "北", s: "南", e: "东", w: "西", ne: "东北", nw: "西北", se: "东南", sw: "西南" };
  const gap = big ? 8 : 5;
  const cellH = big ? 62 : 42;
  const fontMain = big ? 14 : 11;
  const short = (nm) => nm ? (nm.includes("·") ? nm.split("·").pop() : nm) : "";
  // tile: 三态贴图之一（MAP_UI.idle/fog/current），铺满格底。三张贴图原始尺寸略有差异，
  // 统一用 backgroundSize:100% 100% 拉伸到等大格子里，不叠加任何外发光（避免光晕溢出到
  // 格缝，看起来像竖线）。hover 高亮改用贴图自身 brightness，不再用 boxShadow。
  const cellStyle = (extra = {}, tile = null) => ({
    height: cellH, display: "flex", alignItems: "center", justifyContent: "center",
    textAlign: "center", lineHeight: 1.2, padding: "2px 4px", overflow: "hidden",
    transition: "filter .15s", border: "none", background: "transparent",
    backgroundImage: tile ? `url("${tile}")` : "none",
    backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
    ...extra,
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap, width: "100%" }}>
      {layout.flat().map((key) => {
        if (key === "center") {
          return (
            <div key="center" style={cellStyle({}, MAP_UI.current)}>
              <span style={{ color: "#fff", fontWeight: "bold", fontSize: fontMain, textShadow: "0 1px 3px rgba(0,0,0,0.85)" }}>{short(centerLabel) || "我"}</span>
            </div>
          );
        }
        const c = cells[key] || { explored: false };
        const clickable = !loading;
        const hov = hover === key;
        // 未探索：战争迷雾（fog 贴图），只留一个问号，不显方向字
        if (!c.explored) {
          return (
            <div key={key} onClick={() => clickable && onGo(key)}
              onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)}
              style={cellStyle({ cursor: clickable ? "pointer" : "default", opacity: hov ? 1 : 0.82, filter: hov ? "brightness(1.25)" : "none" }, MAP_UI.fog)}>
              <span style={{ color: hov ? "#c0a060" : "#6a6a58", fontSize: big ? 18 : 14, fontWeight: "bold", textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}>?</span>
            </div>
          );
        }
        // 已探索：idle 贴图 + 地名（不显方向字）
        return (
          <div key={key} onClick={() => clickable && onGo(key)}
            onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)}
            style={cellStyle({ cursor: clickable ? "pointer" : "default", filter: hov ? "brightness(1.3)" : "none" }, MAP_UI.idle)}>
            <span style={{ color: hov ? "#eaf4ee" : "#cddcd4", fontSize: fontMain, fontWeight: hov ? "bold" : "normal", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{short(c.name)}</span>
          </div>
        );
      })}
    </div>
  );
}
