// 开始界面
// 游戏启动后第一个看到的界面，四个入口：开始、加载存档、设置、退出
// 视觉上延续 theme.js 的水墨留白美学——不用大量图片元素堆砌，
// 而是一张氛围背景图 + 克制的排版留白，让文字和印章式按钮自己撑起质感

import React, { lazy, Suspense, useState, useEffect } from "react";
import { NIGHT_VARS } from "../../utils/theme.js";
import { listSlots, loadAutoSave } from "../../infra/saves.js";
import { registerVisit } from "../../infra/visitorCount.js";
import { CURRENT_VERSION } from "../../utils/version.js";
import LiveClockText from "../components/LiveClockText.jsx";
import { styles } from "./startScreenStyles.js";

const BugReportModal = lazy(() => import("./BugReportModal.jsx"));
const VersionHistoryPanel = lazy(() => import("./VersionHistoryPanel.jsx"));

const theme = NIGHT_VARS; // 固定暗夜，见 theme.js 的 NIGHT_VARS // 开场定调：鱼定村的暖黄烟火气

export default function StartScreen({ onStart, onStartImportSelf, onLoadSlot, onOpenSettings, onOpenCardImport, onQuickBattle, onTavernSim, onExit }) {
  const [hasAutoSave, setHasAutoSave] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false); // 意见信箱/上报bug
  const [showVersionHistory, setShowVersionHistory] = useState(false); // 版本日志（轻量按钮，跟内页共用同一份VersionHistoryPanel + 同一份version.js数据源）
  const [slots, setSlots] = useState([]);
  const [hovered, setHovered] = useState(null);
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const [showStartChoice, setShowStartChoice] = useState(false); // 开始游戏→二选一：新建 / 导入卡当自己
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
    { key: "start", label: "开始游戏", sub: "踏入曲措乡", action: () => setShowStartChoice(true), always: true },
    {
      key: "load",
      label: "加载游戏",
      sub: hasAnySave ? `${slotCount + (hasAutoSave ? 1 : 0)} 份存档` : "暂无存档",
      action: () => setShowLoadPanel(true),
      always: hasAnySave,
    },
    { key: "quickbattle", label: "斗蛐蛐", sub: "快速切磋 · 自选阵容", action: onQuickBattle, always: true },
    // 酒馆经营（醉三江）和角色入册暂时从首页关掉：hidden 只是不渲染，功能代码都在，删掉 hidden 即恢复。
    { key: "tavernsim", label: "酒馆经营", sub: "开间醉三江 · 看店自转 · 日进斗金", action: onTavernSim, always: true, hidden: true },
    // 入册放在开局之前：导入的卡要当主角，只能在角色还没创建的时候用。
    { key: "cards", label: "角色入册", sub: "游戏中用 · 导入外部角色卡成江湖人物", action: onOpenCardImport, always: true, hidden: true },
    { key: "settings", label: "设置", sub: "API · 显示 · 存档管理", action: onOpenSettings, always: true },
    { key: "exit", label: "退出", sub: "合上此卷", action: onExit, always: true },
  ];

  if (showStartChoice) {
    return (
      <div className="start-screen-root" style={styles.container(theme)}>
        <div style={styles.vignette} />
        <div className="start-screen-content start-screen-panel-content" style={styles.content}>
          <div className="start-screen-load-panel" style={styles.loadPanel(theme)}>
            <div style={styles.loadPanelTitle(theme)}>新的旅程</div>
            <div className="start-screen-load-panel-list" style={styles.loadPanelList}>
              <button
                className="start-screen-panel-item"
                style={styles.loadPanelItem(theme, hovered === "new")}
                onMouseEnter={() => setHovered("new")}
                onMouseLeave={() => setHovered(null)}
                onClick={() => { setShowStartChoice(false); onStart(); }}
              >
                <span style={styles.loadPanelLabel}>新建角色</span>
                <span style={styles.loadPanelMeta(theme)}>从头创建你的少侠</span>
              </button>
              <button
                className="start-screen-panel-item"
                style={styles.loadPanelItem(theme, hovered === "importself")}
                onMouseEnter={() => setHovered("importself")}
                onMouseLeave={() => setHovered(null)}
                onClick={() => { setShowStartChoice(false); onStartImportSelf?.(); }}
              >
                <span style={styles.loadPanelLabel}>导入角色卡当自己</span>
                <span style={styles.loadPanelMeta(theme)}>先看教程 → 选主角 → 设主角(AI 扫技能装备) → 选NPC逐个调 → 选同伴</span>
              </button>
            </div>
            <button className="start-screen-back-button" style={styles.backButton(theme)} onClick={() => setShowStartChoice(false)}>
              ← 返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showLoadPanel) {
    return (
      <div className="start-screen-root" style={styles.container(theme)}>
        <div style={styles.vignette} />
        <div className="start-screen-content start-screen-panel-content" style={styles.content}>
          <div className="start-screen-load-panel" style={styles.loadPanel(theme)}>
            <div style={styles.loadPanelTitle(theme)}>选择存档</div>
            <div className="start-screen-load-panel-list" style={styles.loadPanelList}>
              {hasAutoSave && (
                <button
                  className="start-screen-panel-item"
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
                  className="start-screen-panel-item"
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
            <button className="start-screen-back-button" style={styles.backButton(theme)} onClick={() => setShowLoadPanel(false)}>
              ← 返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="start-screen-root" style={styles.container(theme)}>
      <div style={styles.vignette} />

      <div className="start-screen-content" style={styles.content}>
      <div className="start-screen-title" style={styles.titleBlock}>
        <img src={`${((import.meta.env && import.meta.env.BASE_URL) || "/")}title_tianducuo_v3.webp`}
          alt="天都曲措" className="start-screen-title-image" style={styles.titleImg} />
        <div style={styles.subtitle(theme)}>—— 三曲交汇处的江湖 ——</div>
      </div>

      <nav className="start-screen-menu" style={styles.menu}>
        {menuItems.filter((item) => !item.hidden).map((item) => {
          const disabled = !item.always;
          return (
            <button
              key={item.key}
              className="start-screen-menu-item"
              disabled={disabled}
              onClick={() => !disabled && item.action && item.action()}
              onMouseEnter={() => setHovered(item.key)}
              onMouseLeave={() => setHovered(null)}
              style={styles.menuItem(theme, hovered === item.key, disabled)}
            >
              <span style={styles.menuLabel(disabled)}>{item.label}</span>
              <span style={styles.menuSub(theme, disabled)}>{item.sub}</span>
            </button>
          );
        })}
      </nav>

      <div className="start-screen-bottom-bar" style={styles.bottomBar}>
        <div className="start-screen-footer" style={styles.footer(theme)}>
          <span>天都·曲措 · MUD引擎</span>
          <span className="start-screen-footer-separator" style={styles.footerSep}>·</span>
          <a
            href="https://github.com/feihu-lgtm/qucuo"
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={() => setHovered("github")}
            onMouseLeave={() => setHovered(null)}
            style={styles.footerLink(theme, hovered === "github")}
          >
            开源代码 GitHub ↗
          </a>
          <span className="start-screen-footer-separator" style={styles.footerSep}>·</span>
          <span
            onClick={() => setShowBugReport(true)}
            onMouseEnter={() => setHovered("bug")}
            onMouseLeave={() => setHovered(null)}
            style={styles.footerLink(theme, hovered === "bug")}
          >
            🐞 意见信箱 / 上报bug
          </span>
          {(visitStats.hits != null || visitStats.todayActive != null) && (
            <>
              <span className="start-screen-footer-separator" style={styles.footerSep}>·</span>
              <span>
                {visitStats.hits != null && `共有 ${visitStats.hits.toLocaleString()} 人次踏足曲措乡`}
                {visitStats.hits != null && visitStats.todayActive != null && "，"}
                {visitStats.todayActive != null && `今日 ${visitStats.todayActive.toLocaleString()} 位侠客登录`}
              </span>
            </>
          )}
        </div>

        <div className="start-screen-corner-status" style={styles.cornerStatus(theme)}>
          <div style={styles.cornerClock}>
            现实时间 <LiveClockText withDate />
          </div>
          <button
            type="button"
            onClick={() => setShowVersionHistory(true)}
            onMouseEnter={() => setHovered("version")}
            onMouseLeave={() => setHovered(null)}
            title={`当前版本「${CURRENT_VERSION.codename}」，点击查看版本历史`}
            style={styles.cornerVersionBtn(theme, hovered === "version")}
          >
            版本 {CURRENT_VERSION.version || "v0.2.0"} · {CURRENT_VERSION.time}
          </button>
        </div>
      </div>
      </div>

      {showBugReport && (
        <Suspense fallback={null}>
          <BugReportModal
            turns={[]}
            pipelineData={null}
            getGameState={() => null}
            onClose={() => setShowBugReport(false)}
          />
        </Suspense>
      )}

      {showVersionHistory && (
        <Suspense fallback={null}>
          <VersionHistoryPanel onClose={() => setShowVersionHistory(false)} accentDim={theme.accentDim} />
        </Suspense>
      )}
    </div>
  );
}
