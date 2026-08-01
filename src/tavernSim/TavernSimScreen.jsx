// 酒馆经营沙盒 · 独立界面
// 定位跟斗蛐蛐一样：脱离主线剧情与主存档的独立小游戏，开始界面直达。
// 界面三层——像素大堂（看店自转）、经营面板（决策）、滚动日志（系统+AI 夜报）。
// 这里只渲染与派发动作，所有数值都在 simEngine.js 的纯函数里；
// AI 叙事走 simNarrator.js 的令牌桶，失败静默落回模板文本。

import React, { useState, useEffect, useRef, useMemo } from "react";
import { getZoneTheme } from "../theme.js";
import {
  TICK_LABELS, MENU, STOCK_INFO, STOCK_BATCH, STAFF_ROLES,
  SEAT_COORDS, ZONES, LEVEL_UP, EVENTS, PRICE_MULT_MIN, PRICE_MULT_MAX,
} from "./simData.js";
import {
  initSim, advanceTick, buyStock, setPrice, hireStaff, fireStaff,
  hireGuard, fireGuard, upgradeLevel, resolveEvent, getDailyCandidates,
  appendLog, setNightReport,
} from "./simEngine.js";
import { createNarrator, hasApiKey } from "./simNarrator.js";

const SAVE_KEY = "qucuo_tavern_sim_v1";
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
  }, [sim.pendingEvent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [sim.day]); // eslint-disable-line react-hooks/exhaustive-deps

  const doAct = (fn) => setSim(s => fn(s));
  const candidates = useMemo(() => getDailyCandidates(sim), [sim.day, sim.seed, sim.heroDay]); // eslint-disable-line react-hooks/exhaustive-deps
  const night = sim.tick >= 6;

  return (
    <div style={S.page(zoneTheme)}>
      <style>{CSS_KEYFRAMES}</style>

      {/* ── 顶栏 ── */}
      <div style={S.topbar(zoneTheme)}>
        <span style={{ color: zoneTheme.accent, fontSize: 15 }}>🍶 醉三江</span>
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

      <div style={S.mainRow}>
        {/* ── 像素大堂 ── */}
        <div style={S.sceneWrap(zoneTheme)}>
          <Scene sim={sim} night={night} zoneTheme={zoneTheme} />
        </div>

        {/* ── 经营面板 ── */}
        <div style={S.side(zoneTheme)}>
          <div style={S.tabRow(zoneTheme)}>
            {[["manage", "经营"], ["hire", "招工"], ["menu", "菜单"], ["ledger", "账本"]].map(([k, label]) => (
              <span key={k} onClick={() => setTab(k)}
                style={S.tab(zoneTheme, tab === k)}>{label}</span>
            ))}
          </div>
          <div style={{ padding: 12, overflowY: "auto", flex: 1 }}>
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

// ── 像素大堂 ─────────────────────────────────────────────────────────
// 借 Star-Office-UI 的"状态→区域"渲染：实体位置只由 phase/岗位决定，
// 走动 = left/top 的 CSS transition，零 canvas 零逐帧 JS。
function Scene({ sim, night, zoneTheme }) {
  const staff = sim.staff;
  return (
    <div style={S.scene(night)}>
      {/* 后墙横梁线，分出墙上墙下两个空间 */}
      <div style={{ position: "absolute", left: 0, right: 0, top: "26%", height: 2, background: "#3a2e1e", opacity: 0.8 }} />

      {/* 后墙设施：大号 emoji + 文字标签，一眼认得出是什么 */}
      <div style={{ position: "absolute", left: `${ZONES.stove.x}%`, top: `${ZONES.stove.y}%`, textAlign: "center" }}>
        <div style={{ fontSize: 30 }}>🍳</div>
        <div className="ts-steam"><i /><i /><i /></div>
        <div style={S.zoneLabel}>灶台</div>
        {staff.cook && <div style={S.token()} title={`厨子 ${staff.cook.name}`}>👨‍🍳</div>}
      </div>
      <div style={{ position: "absolute", left: `${ZONES.cellar.x}%`, top: `${ZONES.cellar.y}%`, textAlign: "center" }}>
        <div style={{ fontSize: 26 }}>🍶🍶🍶</div>
        <div style={S.zoneLabel}>酒架</div>
      </div>
      <div style={{ position: "absolute", left: `${ZONES.ledger.x}%`, top: `${ZONES.ledger.y}%`, textAlign: "center" }}>
        <div style={{ fontSize: 26 }}>🧮</div>
        <div style={S.zoneLabel}>账台</div>
        {staff.accountant && <div style={S.token()} title={`账房 ${staff.accountant.name}`}>🤓</div>}
      </div>
      <div style={{ position: "absolute", left: `${ZONES.counter.x}%`, top: `${ZONES.counter.y}%`, textAlign: "center" }}>
        <div style={{ fontSize: 26 }}>🛎</div>
        <div style={S.zoneLabel}>柜台</div>
        {staff.manager && <div style={S.token()} title={`掌柜 ${staff.manager.name}`}>🎩</div>}
      </div>

      {/* 灯笼 ×2（CSS 明灭） */}
      <div className="ts-lantern" style={{ position: "absolute", left: "46%", top: "1%", fontSize: 22 }}>🏮</div>
      <div className="ts-lantern" style={{ position: "absolute", left: "66%", top: "1%", fontSize: 22 }}>🏮</div>

      {/* 堂中桌子：CSS 画木桌，比暗色 emoji 显眼 */}
      {SEAT_COORDS.slice(0, sim.seats.length).map((c, i) => (
        <div key={`t${i}`} style={{
          position: "absolute", left: `${c.x + 1}%`, top: `${c.y + 7}%`,
          width: 34, height: 22, borderRadius: 4,
          background: "linear-gradient(180deg, #4a3620 0%, #3a2a18 100%)",
          border: "1px solid #5a4630", boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
        }} />
      ))}

      {/* 跑堂在大堂游走（CSS 动画） */}
      {staff.runner && <div className="ts-runner" title={`跑堂 ${staff.runner.name}`}>🏃</div>}

      {/* 护院站门口 */}
      {sim.guards.map((g, i) => (
        <div key={g.name} title={`护院 ${g.name}（技 ${g.skill}）`}
          style={{ position: "absolute", left: `${ZONES.door.x + 6 + i * 6}%`, top: `${ZONES.door.y - 10}%`, fontSize: 24 }}>
          🗡
        </div>
      ))}

      {/* 客人：phase 决定坐标，transition 走出"来/走" */}
      {sim.seats.map((seat, i) => {
        if (!seat) return null;
        const atDoor = seat.phase === "arriving" ? { x: ZONES.door.x + 4, y: ZONES.door.y - 8 }
          : seat.phase === "leaving" ? { x: ZONES.door.x + 2, y: ZONES.door.y - 6 }
          : SEAT_COORDS[i];
        return (
          <div key={seat.id} style={{
            position: "absolute", left: `${atDoor.x}%`, top: `${atDoor.y}%`,
            transition: "left 1.4s ease, top 1.4s ease", textAlign: "center", zIndex: 2,
          }}>
            <div className="ts-breathe" style={{ fontSize: 26 }}>{seat.glyph}</div>
            {seat.phase === "eating" && <div className="ts-bubble">{seat.banter}</div>}
          </div>
        );
      })}

      {/* 门口与招牌 */}
      <div style={{ position: "absolute", left: `${ZONES.door.x - 1}%`, top: `${ZONES.door.y - 2}%`, fontSize: 26, opacity: 0.85 }}>🚪</div>
      <div style={{ position: "absolute", left: `${ZONES.door.x}%`, top: `${ZONES.door.y + 8}%`, fontSize: 12, color: "#b09a6a", letterSpacing: 2 }}>
        — 醉三江 —
      </div>
      {/* 昼夜罩 */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: night ? "rgba(10,10,40,0.35)" : "rgba(255,220,150,0.06)", transition: "background 2s" }} />
    </div>
  );
}

// ── 经营 tab ─────────────────────────────────────────────────────────
function ManageTab({ sim, doAct, zoneTheme, setSim }) {
  const up = LEVEL_UP[sim.level];
  return (
    <div>
      <SectionTitle zoneTheme={zoneTheme}>库存（卖菜扣份，打烊不保鲜）</SectionTitle>
      {Object.entries(STOCK_INFO).map(([k, info]) => (
        <div key={k} style={S.row}>
          <span style={{ color: "#c8bfa0", fontSize: 12 }}>{info.icon} {info.label} × {sim.pantry[k]}</span>
          <Btn label={`进 ${STOCK_BATCH} 份（${info.unitPrice * STOCK_BATCH}两）`} zoneTheme={zoneTheme}
            disabled={sim.funds < info.unitPrice * STOCK_BATCH}
            onClick={() => doAct(s => buyStock(s, k))} />
        </div>
      ))}

      <SectionTitle zoneTheme={zoneTheme}>店面</SectionTitle>
      {up ? (
        <div style={S.box(zoneTheme)}>
          <div style={{ color: "#c8bfa0", fontSize: 12, marginBottom: 4 }}>「{up.label}」 {up.desc}</div>
          <div style={{ color: "#8a8a7a", fontSize: 11, marginBottom: 6 }}>需声望 {up.needRep} · 花 {up.cost} 两</div>
          <Btn label="升级" zoneTheme={zoneTheme}
            disabled={sim.reputation < up.needRep || sim.funds < up.cost}
            onClick={() => doAct(upgradeLevel)} />
        </div>
      ) : (
        <div style={{ color: "#5a5a4a", fontSize: 12 }}>已是三江闻名的金字招牌。</div>
      )}

      <SectionTitle zoneTheme={zoneTheme}>其他</SectionTitle>
      <Btn label="重新开店（清空此档）" zoneTheme={zoneTheme} secondary
        onClick={() => {
          if (window.confirm("确定放弃这间店，重新开张？")) {
            const fresh = initSim();
            try { localStorage.setItem(SAVE_KEY, JSON.stringify(fresh)); } catch { /* ignore */ }
            setSim(fresh);
          }
        }} />
    </div>
  );
}

// ── 招工 tab ─────────────────────────────────────────────────────────
function HireTab({ sim, candidates, doAct, zoneTheme }) {
  return (
    <div>
      <SectionTitle zoneTheme={zoneTheme}>店内员工</SectionTitle>
      {Object.entries(STAFF_ROLES).map(([role, info]) => {
        const cur = sim.staff[role];
        return (
          <div key={role} style={S.row}>
            <span style={{ color: "#c8bfa0", fontSize: 12 }} title={info.desc}>
              {info.icon} {info.label}：{cur ? `${cur.name}（技${cur.skill}·日薪${cur.wage}）` : "—空缺—"}
            </span>
            {cur && <Btn label="辞退" zoneTheme={zoneTheme} secondary onClick={() => doAct(s => fireStaff(s, role))} />}
          </div>
        );
      })}
      {sim.guards.map((g, i) => (
        <div key={g.name} style={S.row}>
          <span style={{ color: "#c8bfa0", fontSize: 12 }}>🗡 护院：{g.name}（技{g.skill}·日薪{g.wage}）</span>
          <Btn label="送行" zoneTheme={zoneTheme} secondary onClick={() => doAct(s => fireGuard(s, i))} />
        </div>
      ))}

      <SectionTitle zoneTheme={zoneTheme}>今日候选（每日刷新）</SectionTitle>
      {candidates.staff.length === 0 && candidates.guards.length === 0 && (
        <div style={{ color: "#5a5a4a", fontSize: 12 }}>今日无人上门，明早再看看。</div>
      )}
      {candidates.staff.map((c, i) => {
        const info = STAFF_ROLES[c.role];
        return (
          <div key={`s${i}`} style={S.box(zoneTheme)}>
            <div style={{ color: "#c8bfa0", fontSize: 12 }}>{info.icon} 应${info.label} · {c.name} · 技{c.skill} · 日薪{c.wage}两</div>
            <div style={{ color: "#6a6a5a", fontSize: 10, margin: "3px 0 6px" }}>{info.desc}</div>
            <Btn label={sim.staff[c.role] ? "换人" : "录用"} zoneTheme={zoneTheme} onClick={() => doAct(s => hireStaff(s, c))} />
          </div>
        );
      })}
      {candidates.guards.map((g, i) => (
        <div key={`g${i}`} style={S.box(zoneTheme)}>
          <div style={{ color: "#c8bfa0", fontSize: 12 }}>🗡 {g.name} · 技{g.skill} · 佣金{g.fee}两 · 日薪{g.wage}两</div>
          <div style={{ color: "#6a6a5a", fontSize: 10, margin: "3px 0 6px" }}>看场子：闹事可稳妥处理；技≥7 还有名人效应（声望日增）。</div>
          <Btn label="聘请" zoneTheme={zoneTheme} disabled={sim.funds < g.fee} onClick={() => doAct(s => hireGuard(s, g))} />
        </div>
      ))}
    </div>
  );
}

// ── 菜单 tab ─────────────────────────────────────────────────────────
function MenuTab({ sim, doAct, zoneTheme }) {
  return (
    <div>
      <div style={{ color: "#8a8a7a", fontSize: 11, marginBottom: 10 }}>
        定价超过基准 1.2 倍后，客人会开始嫌贵扭头。好菜随声望解锁。
      </div>
      {MENU.map(d => {
        const locked = sim.reputation < d.minRep;
        const price = sim.prices[d.id];
        const stock = STOCK_INFO[d.stock];
        return (
          <div key={d.id} style={{ ...S.box(zoneTheme), opacity: locked ? 0.45 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#c8bfa0", fontSize: 12 }}>{d.name}</span>
              <span style={{ color: "#4a8a4a", fontSize: 12 }}>{price} 两</span>
            </div>
            <div style={{ color: "#6a6a5a", fontSize: 10, margin: "2px 0 6px" }}>
              {locked ? `声望 ${d.minRep} 解锁 · ` : ""}耗{stock.icon}{stock.label}×1 · 基准 {d.basePrice} 两 · {d.desc}
            </div>
            {!locked && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Btn label="−" zoneTheme={zoneTheme} secondary
                  onClick={() => doAct(s => setPrice(s, d.id, (price - 1) / d.basePrice))} />
                <span style={{ color: "#8a8a7a", fontSize: 11, minWidth: 52, textAlign: "center" }}>
                  {(price / d.basePrice).toFixed(2)}x
                </span>
                <Btn label="＋" zoneTheme={zoneTheme} secondary
                  onClick={() => doAct(s => setPrice(s, d.id, (price + 1) / d.basePrice))} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 账本 tab ─────────────────────────────────────────────────────────
function LedgerTab({ sim, zoneTheme }) {
  const rows = [...sim.ledger].reverse();
  return (
    <div>
      {!sim.staff.accountant && (
        <div style={{ color: "#8a6a4a", fontSize: 11, marginBottom: 8 }}>
          没请账房，每日流水有一成上下的糊涂损耗。请个账房（招工页）才能看明细。
        </div>
      )}
      {rows.length === 0 && <div style={{ color: "#5a5a4a", fontSize: 12 }}>还没打过一次烊。</div>}
      {rows.map(r => (
        <div key={r.day} style={S.box(zoneTheme)}>
          <div style={{ color: "#d4a853", fontSize: 12, marginBottom: 3 }}>第 {r.day} 日</div>
          <div style={{ color: "#8a8a7a", fontSize: 11 }}>
            客 {r.guests}（成 {r.served} / 失 {r.lost}）· 营收 {r.revenue} · 工钱 {r.wages}
            {r.bookLoss > 0 ? ` · 损耗 ${r.bookLoss}` : ""} · <span style={{ color: r.net >= 0 ? "#4a8a4a" : "#a45a5a" }}>净 {r.net}</span>
            {r.creditGain > 0 ? ` · 回款 ${r.creditGain}` : ""}
          </div>
          {sim.nightReports[r.day] && (
            <div style={{ color: "#c8bfa0", fontSize: 11, marginTop: 5, borderLeft: "2px solid #d4a853", paddingLeft: 8 }}>
              {sim.nightReports[r.day]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 日志 ─────────────────────────────────────────────────────────────
function LogPanel({ log, zoneTheme }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log.length]);
  return (
    <div ref={ref} style={S.logPanel(zoneTheme)}>
      {log.slice(-60).map((l, i) => (
        <div key={i} style={{
          fontSize: 12, lineHeight: 1.8,
          color: l.kind === "gold" ? "#d4a853" : l.kind === "event" ? "#b08ad4" : "#8a8a7a",
        }}>
          <span style={{ color: "#4a4a3a", fontSize: 10 }}>[{l.day}日·{TICK_LABELS[l.tick]}] </span>
          {l.text}
        </div>
      ))}
    </div>
  );
}

// ── 事件弹窗 ─────────────────────────────────────────────────────────
function EventModal({ sim, zoneTheme, onResolve }) {
  const ev = sim.pendingEvent;
  const def = EVENTS.find(e => e.id === ev.id);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.8)", zIndex: 60,
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: zoneTheme.panelBg || "#14161f", border: `1px solid ${zoneTheme.border}`,
        borderRadius: 8, width: 400, maxWidth: "92vw", padding: 18 }}>
        <div style={{ color: "#d4a853", fontSize: 14, marginBottom: 8 }}>⚠ {ev.title}</div>
        <div style={{ color: "#c8bfa0", fontSize: 12, lineHeight: 1.8, marginBottom: 14 }}>{ev.desc}</div>
        {(def?.options || ev.options).map(opt => {
          const needGuard = opt.needGuard && sim.guards.length === 0;
          const needFood = ev.id === "food_critic" && opt.id === "cook" && sim.pantry.food < 3;
          const needMoney = ev.id === "storyteller" && opt.id === "hire" && sim.funds < 10;
          const disabled = needGuard || needFood || needMoney;
          return (
            <div key={opt.id} style={{ marginBottom: 8 }}>
              <Btn label={opt.label} zoneTheme={zoneTheme} disabled={disabled} onClick={() => onResolve(opt.id)} />
              <span style={{ color: "#6a6a5a", fontSize: 10, marginLeft: 8 }}>
                {needGuard ? "（需雇有护院）" : needFood ? "（食材不足×3）" : needMoney ? "（银子不够）" : opt.hint}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 共用小组件 ─────────────────────────────────────────────────────────
function Btn({ label, onClick, disabled, zoneTheme, secondary }) {
  return (
    <span onClick={disabled ? undefined : onClick}
      style={{
        fontSize: 12, padding: "4px 12px", borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "#4a4a4a" : secondary ? zoneTheme.accentDim : zoneTheme.bg,
        background: disabled ? "#1a1a1a" : secondary ? "transparent" : zoneTheme.accent,
        border: `1px solid ${disabled ? "#2a2a2a" : secondary ? zoneTheme.border : zoneTheme.accent}`,
        opacity: disabled ? 0.5 : 1, userSelect: "none", whiteSpace: "nowrap",
      }}>{label}</span>
  );
}

function SectionTitle({ children, zoneTheme }) {
  return <div style={{ color: zoneTheme.accentDim, fontSize: 11, margin: "12px 0 6px", borderBottom: `1px solid ${zoneTheme.border}`, paddingBottom: 3 }}>{children}</div>;
}

// ── 样式 ─────────────────────────────────────────────────────────────
const S = {
  page: (t) => ({ height: "100vh", display: "flex", flexDirection: "column", background: t.bg || "#0a0c12", fontFamily: "inherit" }),
  topbar: (t) => ({ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${t.border}`, flexWrap: "wrap" }),
  chip: (t) => ({ color: "#c8bfa0", fontSize: 12, border: `1px solid ${t.border}`, borderRadius: 4, padding: "3px 8px", background: "rgba(255,255,255,0.02)" }),
  mainRow: { flex: 1, display: "flex", minHeight: 0, flexWrap: "wrap" },
  sceneWrap: (t) => ({ flex: "1 1 58%", minWidth: 320, padding: 12, borderRight: `1px solid ${t.border}` }),
  scene: (night) => ({
    position: "relative", width: "100%", height: "100%", minHeight: 300, borderRadius: 8, overflow: "hidden",
    background: night
      ? "repeating-linear-gradient(90deg, #241a12 0px, #241a12 46px, #20170f 46px, #20170f 48px), linear-gradient(180deg, #1a1410 0%, #241a12 55%, #17100c 100%)"
      : "repeating-linear-gradient(90deg, #33261a 0px, #33261a 46px, #2c2015 46px, #2c2015 48px), linear-gradient(180deg, #2a2018 0%, #33261a 55%, #241a12 100%)",
    border: "1px solid #3a2e1e",
  }),
  zoneLabel: { fontSize: 10, color: "#8a7a5a", letterSpacing: 2, marginTop: 1 },
  side: (t) => ({ flex: "1 1 38%", minWidth: 280, display: "flex", flexDirection: "column", minHeight: 0 }),
  tabRow: (t) => ({ display: "flex", borderBottom: `1px solid ${t.border}` }),
  tab: (t, active) => ({
    flex: 1, textAlign: "center", padding: "8px 0", fontSize: 12, cursor: "pointer", userSelect: "none",
    color: active ? t.accent : "#6a6a5a", borderBottom: active ? `2px solid ${t.accent}` : "2px solid transparent",
  }),
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  box: (t) => ({ border: `1px solid ${t.border}`, borderRadius: 6, padding: "8px 10px", marginBottom: 8, background: "rgba(255,255,255,0.02)" }),
  logPanel: (t) => ({ height: 130, overflowY: "auto", borderTop: `1px solid ${t.border}`, padding: "8px 14px", background: "rgba(0,0,0,0.25)" }),
  token: () => ({ fontSize: 20, marginTop: 2 }),
};

// CSS 动效：明灭灯笼 / 呼吸浮动 / 气泡 / 跑堂游走 / 灶台蒸汽
const CSS_KEYFRAMES = `
@keyframes tsFlicker { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
.ts-lantern { animation: tsFlicker 2.4s ease-in-out infinite; font-size: 18px; }
@keyframes tsBreathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
.ts-breathe { animation: tsBreathe 2.8s ease-in-out infinite; }
.ts-bubble {
  position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%);
  background: rgba(20,18,10,0.92); border: 1px solid #4a3a1a; border-radius: 6px;
  color: #c8bfa0; font-size: 10px; padding: 2px 8px; white-space: nowrap;
}
@keyframes tsRoam {
  0% { left: 20%; top: 40%; } 25% { left: 45%; top: 60%; }
  50% { left: 55%; top: 38%; } 75% { left: 30%; top: 66%; } 100% { left: 20%; top: 40%; }
}
.ts-runner { position: absolute; font-size: 20px; animation: tsRoam 18s linear infinite; }
@keyframes tsSteam { 0% { transform: translateY(0); opacity: 0.5; } 100% { transform: translateY(-14px); opacity: 0; } }
.ts-steam { position: absolute; left: 50%; top: -6px; }
.ts-steam i { display: inline-block; width: 3px; height: 3px; border-radius: 50%; background: #9a9a8a; margin: 0 2px; animation: tsSteam 1.8s ease-out infinite; }
.ts-steam i:nth-child(2) { animation-delay: 0.6s; }
.ts-steam i:nth-child(3) { animation-delay: 1.2s; }
`;
