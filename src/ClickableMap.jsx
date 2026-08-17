import React from "react";
import { MAP_UI } from "./mapUi.js";

// 可点击移动地图：节点即操作。点相邻据点/房间 = 往那个方向走（复用 act 移动链）。
// nodes: [{name,x,y,explored,current,reachable,dir,dest,locked}]  onGo(dir,dest,locked)
// explored=去过（亮·实心）; !explored=战争迷雾（问号·虚线）; reachable=当前有出口可点；
// locked=有路但未解锁（点了触发 AI 叙事拦截）。current=当前所在（金框脉冲）。
export default function ClickableMap({ nodes, onGo, cell, pad = 40, maxHeight = "62vh", accent = "#c8323a", loading }) {
  const [hover, setHover] = React.useState(null);
  // 拖动+缩放状态：view = {tx, ty, scale}。tx/ty 是平移量，scale 是缩放倍数。
  // 开图即以当前所在为中心放大：地名大字是导航核心（长刀式），默认全览缩得太小看不清。
  const fitZoom = React.useMemo(() => {
    if (!nodes.length) return { tx: 0, ty: 0, scale: 1 };
    const C = cell || 132;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const W = (Math.max(...xs) - Math.min(...xs) + 1) * C + pad * 2, H = (Math.max(...ys) - Math.min(...ys) + 1) * C + pad * 2;
    const cur0 = nodes.find(n => n.current);
    const s = 1.5;
    const cx0 = (cur0.x - Math.min(...xs)) * C + pad + C / 2, cy0 = (cur0.y - Math.min(...ys)) * C + pad + C / 2;
    return { tx: (W / 2 - cx0) * s, ty: (H / 2 - cy0) * s, scale: s };
  }, [nodes, cell, pad]);
  const [view, setView] = React.useState(fitZoom);
  const dragRef = React.useRef(null); // 拖动中：{ startX, startY, baseTx, baseTy }
  const [dragging, setDragging] = React.useState(false);
  if (!nodes.length) return null;

  // 节点用固定尺寸的正方贴图格子（贴图是正方，显示也正方，统一比例）。
  const NW = 84, NH = 84; // 节点贴图显示宽高（正方）
  const CELL = cell || 132; // 格间距（含节点+留白），略大于节点保证连线看得清
  // 统一字号：取全图最长地名的字数当基准，所有节点用同一字号，大小一致不参差。
  const labelLen = (n) => [...(n.name ? (n.name.includes("·") ? n.name.split("·").pop() : n.name) : "")].length;
  const maxLabelLen = Math.max(2, ...nodes.map(labelLen));
  const uniformFs = maxLabelLen >= 5 ? 18 : maxLabelLen >= 4 ? 19 : 21;
  // 坐标防撞：数据里偶有两个节点坐标相同，展示层螺旋偏移到最近空格。
  const occupied = new Set();
  const SPIRAL = [[0,0],[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],[2,0],[0,2],[-2,0],[0,-2]];
  nodes = nodes.map(n => {
    for (const [dx, dy] of SPIRAL) {
      const nx = n.x + dx, ny = n.y + dy, k = nx + "," + ny;
      if (!occupied.has(k)) { occupied.add(k); return (dx || dy) ? { ...n, x: nx, y: ny } : n; }
    }
    return n;
  });
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const mnX = Math.min(...xs), mxX = Math.max(...xs), mnY = Math.min(...ys), mxY = Math.max(...ys);
  const w = (mxX - mnX + 1) * CELL + pad * 2, h = (mxY - mnY + 1) * CELL + pad * 2;
  const px = (x) => (x - mnX) * CELL + pad + CELL / 2;
  const py = (y) => (y - mnY) * CELL + pad + CELL / 2;
  const byName = {}; nodes.forEach(n => { if (n.name) byName[n.name] = n; });
  const cur = nodes.find(n => n.current);

  // ── 拖动 ──
  const onPointerDown = (e) => {
    // 只在点空白处开始拖动（点节点交给节点自己的 onClick）
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseTx: view.tx, baseTy: view.ty, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX, dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    setView(v => ({ ...v, tx: dragRef.current.baseTx + dx, ty: dragRef.current.baseTy + dy }));
  };
  const onPointerUp = () => { dragRef.current = null; setDragging(false); };
  // ── 缩放（滚轮）──
  const onWheel = (e) => {
    e.preventDefault();
    setView(v => {
      const next = Math.min(3, Math.max(0.4, v.scale * (e.deltaY < 0 ? 1.12 : 0.89)));
      return { ...v, scale: next };
    });
  };
  const zoomBtn = (factor) => setView(v => ({ ...v, scale: Math.min(3, Math.max(0.4, v.scale * factor)) }));
  const resetView = () => setView(fitZoom);

  return (
    <div style={{ position: "relative", width: "100%", maxHeight, overflow: "hidden" }}>
      {/* 缩放控制按钮 */}
      <div style={{ position: "absolute", top: 6, right: 6, zIndex: 3, display: "flex", flexDirection: "column", gap: 4 }}>
        <span onClick={() => zoomBtn(1.25)} style={cmZoomBtn}>＋</span>
        <span onClick={() => zoomBtn(0.8)} style={cmZoomBtn}>－</span>
        <span onClick={resetView} style={{ ...cmZoomBtn, fontSize: "10px" }}>⤢</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`}
        style={{ width: "100%", maxHeight, display: "block", cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
        onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
        onWheel={onWheel}>
        <defs>
          <style>{`@keyframes cmPulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`} style={{ transformOrigin: "center" }}>
          {/* 连线 */}
          {nodes.flatMap(n => (n.links || []).map(dest => {
            const d = byName[dest]; if (!d || !n.explored || !d.explored) return null;
            const diag = n.x !== d.x && n.y !== d.y;
            return <line key={`${n.name}-${dest}`.split("").sort().join("")} x1={px(n.x)} y1={py(n.y)} x2={px(d.x)} y2={py(d.y)}
              stroke="#7a6448" strokeWidth={2.5} strokeDasharray={diag ? "6,4" : "none"} opacity={0.75} />;
          }).filter(Boolean))}
          {cur && nodes.filter(n => n.reachable || n.locked).map(n => (
            <line key={`go-${n.dir}-${n.name || n.dest}`} x1={px(cur.x)} y1={py(cur.y)} x2={px(n.x)} y2={py(n.y)}
              stroke={n.locked ? "#8a6a3a" : accent} strokeWidth={2} strokeDasharray={n.explored ? "none" : "6,5"} opacity={0.6} />
          ))}
          {/* 节点：用九宫格三态贴图 */}
          {nodes.map(n => {
            const cx = px(n.x), cy = py(n.y);
            const label = n.name ? (n.name.includes("·") ? n.name.split("·").pop() : n.name) : "";
            const clickable = !loading && (n.reachable || n.locked);
            const hov = hover === (n.name || n.dir);
            const fs = uniformFs;
            // 名牌即节点：双线框+大字。当前所在=唯一朱红边。
            const pw = labelLen(n) * fs + 28, ph = fs + 24;
            const edge = n.current || (hov && clickable) ? accent : "#26221c";
            const onClickNode = (e) => {
              // 拖动过就不触发点击（避免拖完误跳转）
              if (dragRef.current?.moved) return;
              if (clickable) onGo(n.dir, n.explored ? n.name : n.dest, n.locked);
            };
            return <g key={n.name || n.dir} style={{ cursor: clickable ? "pointer" : "default" }}
              onClick={onClickNode}
              onMouseEnter={() => setHover(n.name || n.dir)} onMouseLeave={() => setHover(null)}>
              {!n.explored && (
                <image href={MAP_UI.fog} x={cx - NW/2} y={cy - NH/2} width={NW} height={NH} preserveAspectRatio="none"
                  style={{ filter: hov && clickable ? "brightness(1.25)" : "none" }} />
              )}
              {!n.explored ? (
                <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill={hov ? "#c0a060" : "#7a7a68"} fontSize="20" fontWeight="bold" style={{ pointerEvents: "none", textShadow: "0 1px 2px #000" }}>?</text>
              ) : (
                <g style={{ pointerEvents: "none" }}>
                  <g style={{ animation: n.current ? "cmPulse 2.4s ease-in-out infinite" : "none" }}>
                    <rect x={cx - pw / 2} y={cy - ph / 2} width={pw} height={ph} fill="#f2efe4" stroke={edge} strokeWidth={2} />
                    <rect x={cx - pw / 2 + 3} y={cy - ph / 2 + 3} width={pw - 6} height={ph - 6} fill="none" stroke={edge} strokeWidth={1} />
                  </g>
                  <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                    fill={n.current ? accent : "#201d18"} fontSize={fs} fontFamily="inherit" fontWeight="bold">{label}</text>
                </g>
              )}
              {n.locked && <text x={cx + pw / 2 - 8} y={cy - ph / 2 + 12} textAnchor="middle" fontSize="12" style={{ pointerEvents: "none" }}>🔒</text>}
            </g>;
          })}
        </g>
      </svg>
    </div>
  );
}

const cmZoomBtn = {
  cursor: "pointer", width: 22, height: 22, lineHeight: "20px", textAlign: "center",
  fontSize: "15px", color: "#4a3520", background: "rgba(240,232,210,0.85)",
  border: "1px solid #8a6a3a", borderRadius: 0, userSelect: "none", display: "block", fontWeight: "bold",
};
