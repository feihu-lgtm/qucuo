// 建筑屏共享件：遮罩容器 / 标题栏 / 按钮。
// ---------------------------------------------------------------------------
// 从 InnScreen.jsx 抽出：原来寄生在"客栈屏"里的这三件被 16 个建筑屏 + 任务日志
// 复用，业务屏不该兼当共享库。新建筑屏要用就直接从这里 import。
import ModalShell from "../../primitives/ModalShell.jsx";
import { Button } from "../../primitives/index.js";

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

// 建筑面板标题栏：吸顶（面板内容一长往下滚时，关闭按钮仍钉在滚动区顶部）。
// 样式在 primitives.css 的 .building-header*，关闭按钮是 Button。
export function Header({ name, onClose }) {
  return (
    <div className="mobile-overlay-header building-header">
      <span className="building-header-title">{name}</span>
      <Button variant="settings" className="mobile-overlay-close building-header-close" onClick={onClose}>× 关闭</Button>
    </div>
  );
}

// 建筑面板按钮：主按钮朱红实底，secondary 为描边。外观、悬停、按下、禁用态都在 Button 的
// primary / secondary 变体里，这里只保留建筑面板沿用已久的 label/secondary 写法。
export function Btn({ label, onClick, disabled, secondary }) {
  return (
    <Button variant={secondary ? "secondary" : "primary"} className="mobile-touch-target" onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
}
