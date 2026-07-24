// 开始界面
// 游戏启动后第一个看到的界面，四个入口：开始、加载存档、设置、退出
// 视觉上延续 theme.js 的水墨留白美学——不用大量图片元素堆砌，
// 而是一张氛围背景图 + 克制的排版留白，让文字和印章式按钮自己撑起质感

import React, { useState, useEffect } from "react";
import { ZONE_THEMES } from "./theme.js";
import { listSlots, loadAutoSave } from "./saves.js";

const theme = ZONE_THEMES.village; // 开场定调：鱼定村的暖黄烟火气

export default function StartScreen({ onStart, onLoadSlot, onOpenSettings, onExit }) {
  const [hasAutoSave, setHasAutoSave] = useState(false);
  const [slots, setSlots] = useState([]);
  const [hovered, setHovered] = useState(null);
  const [showLoadPanel, setShowLoadPanel] = useState(false);

  useEffect(() => {
    setHasAutoSave(!!loadAutoSave());
    setSlots(listSlots());
  }, []);

  const slotCount = slots.length;
  const hasAnySave = hasAutoSave || slotCount > 0;

  const menuItems = [
    { key: "start", label: "开始", sub: "踏入曲措乡", action: onStart, always: true },
    {
      key: "load",
      label: "加载存档",
      sub: hasAnySave ? `${slotCount + (hasAutoSave ? 1 : 0)} 份存档` : "暂无存档",
      action: () => setShowLoadPanel(true),
      always: hasAnySave,
    },
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
        <div style={styles.sealRow}>
          <span style={styles.seal(theme)}>曲</span>
          <span style={styles.seal(theme)}>措</span>
          <span style={styles.seal(theme)}>乡</span>
        </div>
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
        <span>MUD引擎 · 曲措乡</span>
      </div>
    </div>
  );
}

const styles = {
  container: (t) => ({
    position: "fixed",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.bg,
    backgroundImage: "url('/start-bg.jpg')",
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
    marginBottom: "64px",
    textAlign: "center",
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
    color: t.text,
    opacity: 0.75,
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
    alignItems: "center",
    gap: "4px",
    padding: "16px 12px",
    background: isHover && !disabled ? "rgba(20,16,10,0.55)" : "transparent",
    border: "none",
    borderTop: `1px solid ${isHover && !disabled ? t.accentDim : "rgba(255,255,255,0.08)"}`,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
    transition: "all 0.25s ease",
  }),
  menuLabel: {
    fontSize: "17px",
    letterSpacing: "6px",
    color: "#ece3d0",
  },
  menuSub: (t) => ({
    fontSize: "11px",
    letterSpacing: "1px",
    color: t.textDim,
  }),
  footer: (t) => ({
    position: "absolute",
    bottom: "20px",
    fontSize: "10px",
    letterSpacing: "2px",
    color: t.textDim,
    opacity: 0.6,
    zIndex: 1,
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
