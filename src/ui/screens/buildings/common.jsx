// 建筑屏共享件：遮罩容器 / 标题栏 / 按钮。
// ---------------------------------------------------------------------------
// 从 InnScreen.jsx 抽出：原来寄生在"客栈屏"里的这三件被 16 个建筑屏 + 任务日志
// 复用，业务屏不该兼当共享库。新建筑屏要用就直接从这里 import。
import ModalShell from "../../primitives/ModalShell.jsx";
import { RADIUS } from "../../../utils/theme.js";

// ── 共用子组件 ──
export function Overlay({ children, onClose, inline }) {
  // 这是全项目共享组件，13个建筑面板（当铺/武馆/钱庄/医馆/悬赏/镖局/寺庙/赌坊/
  // 藏书阁/铁匠铺/茶馆/运镖+任务日志）都复用它。浮出时套 ModalShell：遮罩、防拖选误关、
  // Esc、焦点锁定都由外壳负责，这一处接入等于 13 个面板一起接入。
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  if (inline) {
    return (
      <div className="mobile-building-content" style={{ borderTop: `1px solid var(--border)`, background: "var(--building-panel-bg)", height: "100%", overflowY: "auto" }}>
        {children}
      </div>
    );
  }
  // 遮罩原透明度 0.88，并入 --ink-overlay（0.92）；原 z 120 即 building 档。
  // 面板底色与零内边距在 tokens.css 的 .building-panel；手机上由 mobile-overlay-* 全屏接管。
  return (
    <ModalShell
      onClose={onClose}
      layer="building"
      showClose={false}
      ariaLabel="建筑面板"
      panelClassName="mobile-building-panel building-panel"
      rootStyle={isMobile ? { alignItems: "flex-end" } : undefined}
      panelStyle={isMobile
        ? { width: "100%", maxWidth: "100vw", maxHeight: "92vh", WebkitOverflowScrolling: "touch" }
        : { width: 440, maxHeight: "80vh" }}
    >
      {children}
    </ModalShell>
  );
}

export function Header({ name, onClose }) {
  return (
    <div className="mobile-overlay-header" style={{
      padding: "12px 16px", borderBottom: `1px solid var(--border)`, display: "flex",
      justifyContent: "space-between", alignItems: "center",
      // 吸顶：Header 所在的父容器（Overlay 的 inline 分支）自己是可滚动区域，
      // 面板内容一长（比如武馆秘籍列表）玩家往下滚，Header 之前只是普通文档流
      // 里的第一个元素，会跟着内容一起被滚出视野——关闭按钮消失，只能回滚一格
      // 或者刷新页面才能退出。position:sticky + top:0 让它始终钉在这层滚动区域
      // 顶部，不管滚多远都看得见、点得到。zIndex 避免被下面滚上来的内容盖住。
      position: "sticky", top: 0, zIndex: 1, background: "var(--building-panel-bg)",
    }}>
      <span style={{ fontSize: "var(--fs-base)", color: "var(--text)" }}>{name}</span>
      <span
        className="mobile-overlay-close"
        onClick={onClose}
        style={{ color: "var(--text-dim)", fontSize: "var(--fs-sm)", cursor: "pointer", padding: "2px 8px", borderRadius: RADIUS.btn, transition: "color 0.15s, background 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.background = "transparent"; }}
      >× 关闭</span>
    </div>
  );
}

export function Btn({ label, onClick, disabled, secondary }) {
  return (
    <span
      className="mobile-touch-target"
      onClick={disabled ? undefined : onClick}
      style={{ fontSize: "var(--fs-sm)", padding: "5px 14px", borderRadius: RADIUS.btn, cursor: disabled ? "not-allowed" : "pointer",
      color: disabled ? "var(--building-disabled-text)" : secondary ? "var(--accent-dim)" : "var(--bg)",
      background: disabled ? "var(--building-disabled-bg)" : secondary ? "transparent" : "var(--accent)",
      border: `1px solid ${disabled ? "var(--building-disabled-edge)" : secondary ? "var(--border)" : "var(--accent)"}`,
      opacity: disabled ? 0.5 : 1,
      userSelect: "none",
      display: "inline-block",
      transition: "transform 0.1s, filter 0.15s, border-color 0.15s", }}
      onMouseEnter={e => { if (disabled) return; e.currentTarget.style.filter = "brightness(1.15)"; if (secondary) e.currentTarget.style.borderColor = "var(--accent)"; }}
      onMouseLeave={e => { if (disabled) return; e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "scale(1)"; if (secondary) e.currentTarget.style.borderColor = "var(--border)"; }}
      onMouseDown={e => { if (disabled) return; e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={e => { if (disabled) return; e.currentTarget.style.transform = "scale(1)"; }}
    >{label}</span>
  );
}
