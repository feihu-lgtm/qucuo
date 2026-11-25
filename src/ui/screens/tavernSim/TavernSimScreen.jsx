// 酒馆经营沙盒 · 独立界面
// 定位跟斗蛐蛐一样：脱离主线剧情与主存档的独立小游戏，开始界面直达。
// 界面三层——像素大堂（看店自转）、经营面板（决策）、滚动日志（系统+AI 夜报）。
// 这里只渲染与派发动作，所有数值都在 simEngine.js 的纯函数里；
// AI 叙事走 simNarrator.js 的令牌桶，失败静默落回模板文本。


import React, { useState, useEffect, useRef, useMemo } from "react";
import { getZoneTheme } from "../../../utils/theme.js";
import {
  TICK_LABELS,
} from "../../../domain/data/tavernSim/simData.js";
import {
  initSim, advanceTick, resolveEvent, getDailyCandidates, appendLog, setNightReport,
} from "../../../domain/rules/tavernSim/simEngine.js";
import { Btn, S, CSS_KEYFRAMES, SAVE_KEY } from "./tavernWidgets.jsx";
import { createNarrator } from "../../../engine/ports/simNarrator.js";
import { hasApiKey } from "../../../engine/ports/storyteller.js";
import { Scene } from "./Scene.jsx";
import { ManageTab, HireTab, MenuTab, LedgerTab } from "./Tabs.jsx";
import { LogPanel, EventModal } from "./Overlays.jsx";

const LEVEL_NAMES = ["破落小馆", "热闹酒肆", "闻名三江"];
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.version === 1 && typeof s.day === "number" ? s : null;
  } catch { return null; }
}

export default function TavernSimScreen({ onExit }) {
  const zoneTheme = useMemo(() => getZoneTheme("鱼定村", false), []);
  const [sim, setSim] = useState(() => loadSave() || initSim());
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1); // 1x=3s/tick, 3x=1s/tick
  const [tab, setTab] = useState("manage"); // manage | hire | menu | ledger
  const narratorRef = useRef(null);
  if (!narratorRef.current) narratorRef.current = createNarrator();
  const narrator = narratorRef.current;

  // ── 存档：state 变化 debounce 落 localStorage（独立档，不碰主存档体系）
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(sim)); } catch { /* 满则弃 */ }
    }, 400);
    return () => clearTimeout(t);
  }, [sim]);

  // ── 自转心跳：setInterval 驱动 advanceTick（纯函数 updater，StrictMode 双调安全）
  useEffect(() => {
    if (!playing || sim.pendingEvent) return;
    const ms = speed >= 3 ? 1000 : 3000;
    const timer = setInterval(() => setSim(s => advanceTick(s)), ms);
    return () => clearInterval(timer);
  }, [playing, speed, sim.pendingEvent]);

  // ── 事件出现：自动暂停，等玩家决策；有余量则补一句 AI 现场描写（进日志）
  useEffect(() => {
    if (!sim.pendingEvent) return;
    const ev = sim.pendingEvent;
    narrator.requestEventFlavor(ev.title, ev.desc).then(text => {
      if (text) setSim(s => appendLog(s, "event", `【说书】${text}`));
    });
  }, [sim.pendingEvent?.id]);

  // ── 跨天检测：日结发生后，攒批请 AI 写夜报；失败就留着引擎的模板夜报
  const prevDayRef = useRef(sim.day);
  useEffect(() => {
    if (sim.day === prevDayRef.current) return;
    const settledDay = prevDayRef.current; // 刚结算完的那一天
    prevDayRef.current = sim.day;
    const report = sim.ledger[sim.ledger.length - 1];
    if (!report || report.day !== settledDay) return;
    const eventTexts = sim.log
      .filter(l => l.day === settledDay && l.kind === "event")
      .map(l => l.text);
    narrator.requestNightReport(report, eventTexts).then(text => {
      if (!text) return;
      setSim(s => appendLog(setNightReport(s, settledDay, text), "gold", `【说书夜报】${text}`));
    });
  }, [sim.day]);

  const doAct = (fn) => setSim(s => fn(s));
  const candidates = useMemo(() => getDailyCandidates(sim), [sim.day, sim.seed, sim.heroDay]);
  const night = sim.tick >= 6;

  return (
    <div style={S.page(zoneTheme)}>
      <style>{CSS_KEYFRAMES}</style>

      {/* ── 顶栏 ── */}
      <div style={S.topbar(zoneTheme)}>
        <span style={{ color: zoneTheme.accent, fontSize: "var(--fs-lg)" }}>🍶 醉三江</span>
        <span style={S.chip(zoneTheme)}>{LEVEL_NAMES[sim.level]}</span>
        <span style={S.chip(zoneTheme)}>第 {sim.day} 日 · {TICK_LABELS[sim.tick]}</span>
        <span style={S.chip(zoneTheme)}>💰 {sim.funds} 两</span>
        <span style={S.chip(zoneTheme)}>⭐ 声望 {sim.reputation}</span>
        <span style={{ flex: 1 }} />
        <Btn label={playing ? "⏸ 暂停" : "▶ 开店"} zoneTheme={zoneTheme} onClick={() => setPlaying(p => !p)} />
        <Btn label={speed >= 3 ? "⏩ 3x" : "▶ 1x"} zoneTheme={zoneTheme} secondary
          onClick={() => setSpeed(v => v >= 3 ? 1 : 3)} />
        {hasApiKey() && <span style={S.chip(zoneTheme)} title="AI 夜报余量">🪙 {narrator.balance()}</span>}
        <Btn label="退出" zoneTheme={zoneTheme} secondary onClick={onExit} />
      </div>

      <div className="ts-main-row" style={S.mainRow}>
        {/* ── 像素大堂 ── */}
        <div className="ts-scene-wrap" style={S.sceneWrap(zoneTheme)}>
          <Scene sim={sim} night={night} zoneTheme={zoneTheme} />
        </div>

        {/* ── 经营面板 ── */}
        <div className="ts-side" style={S.side(zoneTheme)}>
          <div style={S.tabRow(zoneTheme)}>
            {[["manage", "经营"], ["hire", "招工"], ["menu", "菜单"], ["ledger", "账本"]].map(([k, label]) => (
              <span key={k} onClick={() => setTab(k)}
                style={S.tab(zoneTheme, tab === k)}>{label}</span>
            ))}
          </div>
          <div style={{ padding: 12, overflowY: "auto", flex: 1, minHeight: 0 }}>
            {tab === "manage" && <ManageTab sim={sim} doAct={doAct} zoneTheme={zoneTheme} setSim={setSim} />}
            {tab === "hire" && <HireTab sim={sim} candidates={candidates} doAct={doAct} zoneTheme={zoneTheme} />}
            {tab === "menu" && <MenuTab sim={sim} doAct={doAct} zoneTheme={zoneTheme} />}
            {tab === "ledger" && <LedgerTab sim={sim} zoneTheme={zoneTheme} />}
          </div>
        </div>
      </div>

      {/* ── 日志 ── */}
      <LogPanel log={sim.log} zoneTheme={zoneTheme} />

      {/* ── 事件弹窗 ── */}
      {sim.pendingEvent && (
        <EventModal sim={sim} zoneTheme={zoneTheme}
          onResolve={(optId) => { doAct(s => resolveEvent(s, optId)); setPlaying(true); }} />
      )}
    </div>
  );
}
