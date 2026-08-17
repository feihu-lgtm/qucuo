import React from "react";

// 小地图缩放：最稳的实现——只用 +/− 按钮改缩放（不用 wheel、不用手动拖拽，
// 因为游戏整体套了 CSS zoom，wheel 常被外层截、pointer 的 clientX 坐标会错乱）。
// 缩放靠"内层 div 变宽"，外层 overflow:auto 出滚动条，平移就拖滚动条/双指滑动
// （原生滚动不受 zoom 影响）。按钮 z-index 拉满，保证任何时候可点。
export default function ZoomableMap({ children, maxHeight = 100 }) {
  const [scale, setScale] = React.useState(1);
  const zoomBy = (f) => setScale(s => Math.max(1, Math.min(5, Math.round(s * f * 100) / 100)));
  return (
    <div style={{ position: "relative" }}>
      <div style={{ overflow: scale > 1 ? "auto" : "hidden", maxHeight }}>
        <div style={{ width: `${scale * 100}%`, transition: "width 0.12s" }}>
          {children}
        </div>
      </div>
      <div style={{ position: "absolute", right: 2, bottom: 2, display: "flex", flexDirection: "column", gap: 3, zIndex: 20 }}>
        <button onClick={() => zoomBy(1.5)} style={zmBtn}>＋</button>
        <button onClick={() => zoomBy(1 / 1.5)} style={zmBtn}>－</button>
        {scale > 1 && <button onClick={() => setScale(1)} title="复位" style={{ ...zmBtn, fontSize: "10px" }}>⤢</button>}
      </div>
    </div>
  );
}
const zmBtn = {
  cursor: "pointer", width: 20, height: 20, padding: 0, lineHeight: "18px", textAlign: "center",
  fontSize: "14px", color: "#8ac8b8", background: "rgba(10,12,18,0.92)",
  border: "1px solid #3a4a4a", borderRadius: 0, userSelect: "none", display: "block",
};
