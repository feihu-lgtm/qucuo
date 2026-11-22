// 建筑屏共享件：遮罩容器 / 标题栏 / 按钮。
// ---------------------------------------------------------------------------
// 从 InnScreen.jsx 抽出：原来寄生在"客栈屏"里的这三件被 16 个建筑屏 + 任务日志
// 复用，业务屏不该兼当共享库。新建筑屏要用就直接从这里 import。
import { useOverlayCloseGuard } from "../../../utils/overlayClose.js";
import { RADIUS } from "../../theme.js";

// ── 共用子组件 ──
export function Overlay({ children, onClose, zoneTheme, inline }) {
  // 遮罩误触修复见 ../utils/overlayClose.js。这是全项目共享组件，13个建筑面板
  // （当铺/武馆/钱庄/医馆/悬赏/镖局/寺庙/赌坊/藏书阁/铁匠铺/茶馆/运镖+任务日志）
  // 都复用它——这一处改好，等于一次性修好全部13处同款"选字拖拽误关闭"的问题。
  const closeGuard = useOverlayCloseGuard(onClose);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  if (inline) {
    return (
      <div className="mobile-building-content" style={{ borderTop: `1px solid ${zoneTheme.border}`, background: zoneTheme.panelBg || "#14161f", height: "100%", overflowY: "auto" }}>
        {children}
      </div>
    );
  }
  return (
    <div
      className="mobile-overlay-root"
      style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.88)", zIndex: 120, display: "flex",
        alignItems: isMobile ? "flex-end" : "center", justifyContent: "center" }}
      onMouseDown={closeGuard.onMouseDown}
      onClick={closeGuard.onClick}
    >
      <div
        className="mobile-overlay-panel mobile-building-panel"
        style={isMobile
          ? { background: zoneTheme.panelBg || "#14161f", border: `1px solid ${zoneTheme.border}`,
              borderRadius: `${RADIUS.modal}px ${RADIUS.modal}px 0 0`, width: "100%", maxWidth: "100vw", maxHeight: "92vh",
              overflowY: "auto", WebkitOverflowScrolling: "touch" }
          : { background: zoneTheme.panelBg || "#14161f", border: `1px solid ${zoneTheme.border}`,
              borderRadius: RADIUS.modal, width: 440, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Header({ name, zoneTheme, onClose }) {
  return (
    <div className="mobile-overlay-header" style={{
      padding: "12px 16px", borderBottom: `1px solid ${zoneTheme.border}`, display: "flex",
      justifyContent: "space-between", alignItems: "center",
      // 吸顶：Header 所在的父容器（Overlay 的 inline 分支）自己是可滚动区域，
      // 面板内容一长（比如武馆秘籍列表）玩家往下滚，Header 之前只是普通文档流
      // 里的第一个元素，会跟着内容一起被滚出视野——关闭按钮消失，只能回滚一格
      // 或者刷新页面才能退出。position:sticky + top:0 让它始终钉在这层滚动区域
      // 顶部，不管滚多远都看得见、点得到。zIndex 避免被下面滚上来的内容盖住。
      position: "sticky", top: 0, zIndex: 1, background: zoneTheme.panelBg || "#14161f",
    }}>
      <span style={{ fontSize: 14, color: zoneTheme.text || "var(--ink-text)" }}>{name}</span>
      <span
        className="mobile-overlay-close"
        onClick={onClose}
        style={{ color: zoneTheme.textDim, fontSize: 12, cursor: "pointer", padding: "2px 8px", borderRadius: RADIUS.btn, transition: "color 0.15s, background 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.color = zoneTheme.accent; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = zoneTheme.textDim; e.currentTarget.style.background = "transparent"; }}
      >× 关闭</span>
    </div>
  );
}

export function Btn({ label, onClick, disabled, zoneTheme, secondary }) {
  return (
    <span
      className="mobile-touch-target"
      onClick={disabled ? undefined : onClick}
      style={{
        fontSize: 12, padding: "5px 14px", borderRadius: RADIUS.btn, cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "#4a4a4a" : secondary ? zoneTheme.accentDim : zoneTheme.bg,
        background: disabled ? "#1a1a1a" : secondary ? "transparent" : zoneTheme.accent,
        border: `1px solid ${disabled ? "#2a2a2a" : secondary ? zoneTheme.border : zoneTheme.accent}`,
        opacity: disabled ? 0.5 : 1,
        userSelect: "none",
        display: "inline-block",
        transition: "transform 0.1s, filter 0.15s, border-color 0.15s",
      }}
      onMouseEnter={e => { if (disabled) return; e.currentTarget.style.filter = "brightness(1.15)"; if (secondary) e.currentTarget.style.borderColor = zoneTheme.accent; }}
      onMouseLeave={e => { if (disabled) return; e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "scale(1)"; if (secondary) e.currentTarget.style.borderColor = zoneTheme.border; }}
      onMouseDown={e => { if (disabled) return; e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={e => { if (disabled) return; e.currentTarget.style.transform = "scale(1)"; }}
    >{label}</span>
  );
}
