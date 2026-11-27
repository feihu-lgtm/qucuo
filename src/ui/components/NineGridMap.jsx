import { useRef } from "react";
// 固定九宫格视窗地图：玩家永远居中不动，走一步「世界卷一格」（周围八格内容刷新）。内外层通用。
// props:
//   centerLabel — 中心格显示（我当前所在地名）
//   cells — { n,ne,e,se,s,sw,w,nw: {name?,explored,blocked,dir} }
//   onGo(dir) — 点某方向格；loading 时不响应；big — 放大态（格子更高、字更大）
// 夜色精修：格子全用代码画，不再铺石纹/卷轴贴图（禁用清单）。四种状态由 data-state 交给样式表：
//   current 所在（朱红框 + 每 2.6 秒一次波纹）、explored 已探明（实底 + 地名）、
//   fog 未探明（虚线框 + 问号）、blocked 此方向不通（极淡的叉）。
const LAYOUT = ["nw", "n", "ne", "w", "center", "e", "sw", "s", "se"];
const DIR_CN = { n: "北", s: "南", e: "东", w: "西", ne: "东北", nw: "西北", se: "东南", sw: "西南" };
const short = (nm) => (nm ? (nm.includes("·") ? nm.split("·").pop() : nm) : "");
// 走一步时整格「卷」过去：记住刚点的方向，中心地名一变就以新地名为 key 重挂九宫格，
// data-from 告诉样式表格子从哪一侧滑进来（motion.css 的 .ngm[data-from]）。

export default function NineGridMap({ centerLabel, cells, onGo, loading, big = false }) {
  const clickable = !loading;
  const lastDir = useRef(null);
  const go = (key) => { if (clickable) { lastDir.current = key; onGo(key); } };
  const keyGo = (key) => (event) => {
    if (clickable && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); go(key); }
  };
  return (
    <div key={centerLabel || "center"} className="mobile-mini-map ngm" data-big={big} data-from={lastDir.current || undefined}>
      {LAYOUT.map((key) => {
        if (key === "center") {
          return (
            <div key="center" className="mobile-mini-map-cell ngm-cell" data-state="current">
              <span className="ngm-name">{short(centerLabel) || "我"}</span>
            </div>
          );
        }
        const c = cells[key] || { explored: false };
        const state = c.blocked ? "blocked" : c.explored ? "explored" : "fog";
        const label = c.blocked ? `${DIR_CN[c.dir || key]}不通` : c.explored ? `往${DIR_CN[key]}去${short(c.name)}` : `${DIR_CN[key]}方尚未探明`;
        return (
          <div key={key} className="mobile-mini-map-cell ngm-cell" data-state={state} data-clickable={clickable}
            role="button" aria-label={label} aria-disabled={!clickable} tabIndex={clickable ? 0 : -1}
            onClick={() => go(key)} onKeyDown={keyGo(key)}>
            {state === "explored" && <span className="ngm-name">{short(c.name)}</span>}
            {state === "fog" && <span className="ngm-mark" aria-hidden="true">？</span>}
            {state === "blocked" && <span className="ngm-mark" aria-hidden="true">✕</span>}
          </div>
        );
      })}
    </div>
  );
}
