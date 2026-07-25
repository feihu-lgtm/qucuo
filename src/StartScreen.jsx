// 开始界面
// 游戏启动后第一个看到的界面，四个入口：开始、加载存档、设置、退出
// 视觉上延续 theme.js 的水墨留白美学——不用大量图片元素堆砌，
// 而是一张氛围背景图 + 克制的排版留白，让文字和印章式按钮自己撑起质感

import React, { useState, useEffect } from "react";
import { ZONE_THEMES } from "./theme.js";
import { listSlots, loadAutoSave } from "./saves.js";
import { registerVisit } from "./visitorCount.js";
import BugReportModal from "./BugReportModal.jsx";

const theme = ZONE_THEMES.village; // 开场定调：鱼定村的暖黄烟火气

export default function StartScreen({ onStart, onLoadSlot, onOpenSettings, onQuickBattle, onExit }) {
  const [hasAutoSave, setHasAutoSave] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false); // 意见信箱/上报bug
  const [slots, setSlots] = useState([]);
  const [hovered, setHovered] = useState(null);
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  // 访客计数（图个乐呵，图个人气）：借已接好的 Supabase 当账本（见 visitorCount.js）。
  // 两个口径：侠客数（按浏览器本地 UUID 去重，同设备算一人）+ 总人次（每次访问 +1）。
  // 带失败降级：服务挂了/超时/被墙，数字保持 null，footer 那行静默不显示，
  // 绝不因为计数服务的故障拖累游戏本身。
  const [visitStats, setVisitStats] = useState({ visitors: null, hits: null });

  useEffect(() => {
    setHasAutoSave(!!loadAutoSave());
    setSlots(listSlots());
  }, []);

  useEffect(() => {
    let cancelled = false;
    registerVisit().then(stats => { if (!cancelled) setVisitStats(stats); });
    return () => { cancelled = true; };
  }, []);

  const slotCount = slots.length;
  const hasAnySave = hasAutoSave || slotCount > 0;

  const menuItems = [
    { key: "start", label: "开始游戏", sub: "踏入曲措乡", action: onStart, always: true },
    {
      key: "load",
      label: "加载游戏",
      sub: hasAnySave ? `${slotCount + (hasAutoSave ? 1 : 0)} 份存档` : "暂无存档",
      action: () => setShowLoadPanel(true),
      always: hasAnySave,
    },
    { key: "quickbattle", label: "斗蛐蛐", sub: "快速切磋 · 自选阵容", action: onQuickBattle, always: true },
    { key: "settings", label: "设置", sub: "API · 显示 · 存档管理", action: onOpenSettings, always: true },
    { key: "exit", label: "退出", sub: "合上此卷", action: onExit, always: true },
  ];

  if (showLoadPanel) {
    return (
      <div style={styles.container(theme)}>
        <div style={styles.vignette} />
        <div style={styles.loadPanel(theme)}>
          <div style={styles.loadPanelTitle(theme)}>选择存档</div>
          <div style={styles.loadPanelList}>
            {hasAutoSave && (
              <button
                style={styles.loadPanelItem(theme, hovered === "auto")}
                onMouseEnter={() => setHovered("auto")}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onLoadSlot(null)} // null 约定为"读取自动存档"，main.jsx 里转成 "auto"
              >
                <span style={styles.loadPanelLabel}>自动存档</span>
                <span style={styles.loadPanelMeta(theme)}>最近一次行动后</span>
              </button>
            )}
            {slots.map((s) => (
              <button
                key={s.id}
                style={styles.loadPanelItem(theme, hovered === s.id)}
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onLoadSlot(s.id)}
              >
                <span style={styles.loadPanelLabel}>{s.label}</span>
                <span style={styles.loadPanelMeta(theme)}>
                  {s.presetName} · {new Date(s.savedAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
          <button style={styles.backButton(theme)} onClick={() => setShowLoadPanel(false)}>
            ← 返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container(theme)}>
      <div style={styles.vignette} />

      <div style={styles.titleBlock}>
        <img src={`${((import.meta.env && import.meta.env.BASE_URL) || "/")}title_tianducuo_v3.png`}
          alt="天都曲措" style={styles.titleImg} />
        <div style={styles.subtitle(theme)}>—— 三曲交汇处的江湖 ——</div>
      </div>

      <nav style={styles.menu}>
        {menuItems.map((item) => {
          const disabled = !item.always;
          return (
            <button
              key={item.key}
              disabled={disabled}
              onClick={() => !disabled && item.action && item.action()}
              onMouseEnter={() => setHovered(item.key)}
              onMouseLeave={() => setHovered(null)}
              style={styles.menuItem(theme, hovered === item.key, disabled)}
            >
              <span style={styles.menuLabel}>{item.label}</span>
              <span style={styles.menuSub(theme)}>{item.sub}</span>
            </button>
          );
        })}
      </nav>

      <div style={styles.footer(theme)}>
        <span>天都·曲措 · MUD引擎</span>
        <span style={styles.footerSep}>·</span>
        <a href="https://github.com/feihu-lgtm/qucuo" target="_blank" rel="noopener noreferrer" style={styles.footerLink(theme)}>
          开源代码 GitHub ↗
        </a>
        <span style={styles.footerSep}>·</span>
        <span onClick={() => setShowBugReport(true)} style={{ ...styles.footerLink(theme), cursor: "pointer" }}>
          🐞 意见信箱 / 上报bug
        </span>
        {(visitStats.visitors != null || visitStats.hits != null) && (
          <>
            <span style={styles.footerSep}>·</span>
            <span>
              {visitStats.visitors != null && `已有 ${visitStats.visitors.toLocaleString()} 位侠客`}
              {visitStats.visitors != null && visitStats.hits != null && " · "}
              {visitStats.hits != null && `共 ${visitStats.hits.toLocaleString()} 人次`}
              踏足曲措乡
            </span>
          </>
        )}
      </div>

      {showBugReport && (
        <BugReportModal
          turns={[]}
          pipelineData={null}
          getGameState={() => null}
          onClose={() => setShowBugReport(false)}
        />
      )}
    </div>
  );
}

const styles = {
  container: (t) => ({
    position: "fixed",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "0 clamp(32px, 8vw, 120px)",
    boxSizing: "border-box",
    backgroundColor: t.bg,
    backgroundImage: `url('${((typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/")}start-bg.jpg')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    fontFamily: "'Noto Serif SC', 'Songti SC', serif",
    overflow: "hidden",
  }),
  vignette: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%), linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.6) 100%)",
    pointerEvents: "none",
  },
  titleBlock: {
    position: "relative",
    zIndex: 1,
    marginBottom: "48px",
    textAlign: "left",
  },
  titleImg: {
    display: "block",
    width: "min(460px, 70vw)",
    height: "auto",
    marginBottom: "12px",
    // 白色标题压在亮天空/雪峰上，用深色投影勾边，保证在任何亮处都清晰
    filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.55)) drop-shadow(0 1px 2px rgba(0,0,0,0.7))",
  },
  sealRow: {
    display: "flex",
    gap: "18px",
    justifyContent: "center",
    marginBottom: "14px",
  },
  seal: (t) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "58px",
    height: "58px",
    fontSize: "30px",
    color: "#e8dcc0",
    border: `1.5px solid ${t.accent}`,
    borderRadius: "2px",
    letterSpacing: 0,
    boxShadow: `0 0 0 1px rgba(0,0,0,0.3), 0 4px 18px rgba(0,0,0,0.5)`,
    backgroundColor: "rgba(10,8,5,0.35)",
    backdropFilter: "blur(1px)",
  }),
  subtitle: (t) => ({
    fontSize: "13px",
    letterSpacing: "4px",
    color: "#fff",
    opacity: 0.85,
    textShadow: "0 1px 4px rgba(0,0,0,0.7)",
    textAlign: "left",
  }),
  menu: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    width: "min(320px, 80vw)",
  },
  menuItem: (t, isHover, disabled) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "4px",
    padding: "14px 16px",
    background: isHover && !disabled ? "rgba(20,16,10,0.55)" : "rgba(10,8,5,0.25)",
    border: "none",
    borderLeft: `2px solid ${isHover && !disabled ? t.accent : "rgba(255,255,255,0.12)"}`,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
    transition: "all 0.25s ease",
    textAlign: "left",
  }),
  menuLabel: {
    fontSize: "17px",
    letterSpacing: "6px",
    color: "#ece3d0",
    textShadow: "0 1px 3px rgba(0,0,0,0.6)",
  },
  menuSub: (t) => ({
    fontSize: "11px",
    letterSpacing: "1px",
    color: t.textDim,
  }),
  footer: (t) => ({
    position: "absolute",
    bottom: "20px",
    left: "clamp(32px, 8vw, 120px)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "10px",
    letterSpacing: "2px",
    color: "#fff",
    opacity: 0.6,
    textShadow: "0 1px 3px rgba(0,0,0,0.7)",
    zIndex: 1,
  }),
  footerSep: {
    opacity: 0.5,
  },
  footerLink: (t) => ({
    color: "#fff",
    textDecoration: "none",
    borderBottom: `1px solid ${t.accent}`,
    paddingBottom: "1px",
    cursor: "pointer",
    transition: "opacity 0.2s ease",
  }),
  // ---- 存档加载子面板 ----
  loadPanel: (t) => ({
    position: "relative",
    zIndex: 1,
    width: "min(420px, 85vw)",
    maxHeight: "70vh",
    display: "flex",
    flexDirection: "column",
    padding: "28px 24px 20px",
    backgroundColor: "rgba(10,8,5,0.72)",
    border: `1px solid ${t.border}`,
    backdropFilter: "blur(2px)",
  }),
  loadPanelTitle: (t) => ({
    fontSize: "16px",
    letterSpacing: "4px",
    color: "#ece3d0",
    marginBottom: "16px",
    textAlign: "center",
  }),
  loadPanelList: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    overflowY: "auto",
    marginBottom: "16px",
  },
  loadPanelItem: (t, isHover) => ({
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    padding: "12px 14px",
    textAlign: "left",
    background: isHover ? "rgba(212,168,83,0.12)" : "transparent",
    border: "none",
    borderLeft: `2px solid ${isHover ? t.accent : "transparent"}`,
    cursor: "pointer",
    transition: "all 0.2s ease",
  }),
  loadPanelLabel: {
    fontSize: "14px",
    color: "#ece3d0",
  },
  loadPanelMeta: (t) => ({
    fontSize: "10px",
    color: t.textDim,
    letterSpacing: "0.5px",
  }),
  backButton: (t) => ({
    alignSelf: "center",
    fontSize: "12px",
    letterSpacing: "2px",
    color: t.textDim,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "6px 12px",
  }),
};
