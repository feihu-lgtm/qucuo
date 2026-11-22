// 经营面板四个 tab（自 TavernSimScreen 拆出）：经营/招工/菜单/账本，纯展示+派发动作。
import {
  MENU, STOCK_INFO, STOCK_BATCH, STAFF_ROLES, LEVEL_UP,
} from "../../../domain/data/tavernSim/simData.js";
import {
  initSim, buyStock, setPrice, hireStaff, fireStaff, hireGuard, fireGuard, upgradeLevel,
} from "../../../domain/rules/tavernSim/simEngine.js";
import { Btn, SectionTitle, S, SAVE_KEY } from "./tavernWidgets.jsx";

import React from "react";

// ── 经营 tab ─────────────────────────────────────────────────────────
export function ManageTab({ sim, doAct, zoneTheme, setSim }) {
  const up = LEVEL_UP[sim.level];
  return (
    <div>
      <SectionTitle zoneTheme={zoneTheme}>库存（卖菜扣份，打烊不保鲜）</SectionTitle>
      {Object.entries(STOCK_INFO).map(([k, info]) => (
        <div key={k} style={S.row}>
          <span style={{ color: "var(--ink-text)", fontSize: 12 }}>{info.icon} {info.label} × {sim.pantry[k]}</span>
          <Btn label={`进 ${STOCK_BATCH} 份（${info.unitPrice * STOCK_BATCH}两）`} zoneTheme={zoneTheme}
            disabled={sim.funds < info.unitPrice * STOCK_BATCH}
            onClick={() => doAct(s => buyStock(s, k))} />
        </div>
      ))}

      <SectionTitle zoneTheme={zoneTheme}>店面</SectionTitle>
      {up ? (
        <div style={S.box(zoneTheme)}>
          <div style={{ color: "var(--ink-text)", fontSize: 12, marginBottom: 4 }}>「{up.label}」 {up.desc}</div>
          <div style={{ color: "var(--ink-text-dim)", fontSize: 11, marginBottom: 6 }}>需声望 {up.needRep} · 花 {up.cost} 两</div>
          <Btn label="升级" zoneTheme={zoneTheme}
            disabled={sim.reputation < up.needRep || sim.funds < up.cost}
            onClick={() => doAct(upgradeLevel)} />
        </div>
      ) : (
        <div style={{ color: "var(--ink-text-dim)", fontSize: 12 }}>已是三江闻名的金字招牌。</div>
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
export function HireTab({ sim, candidates, doAct, zoneTheme }) {
  return (
    <div>
      <SectionTitle zoneTheme={zoneTheme}>店内员工</SectionTitle>
      {Object.entries(STAFF_ROLES).map(([role, info]) => {
        const cur = sim.staff[role];
        return (
          <div key={role} style={S.row}>
            <span style={{ color: "var(--ink-text)", fontSize: 12 }} title={info.desc}>
              {info.icon} {info.label}：{cur ? `${cur.name}（技${cur.skill}·日薪${cur.wage}）` : "—空缺—"}
            </span>
            {cur && <Btn label="辞退" zoneTheme={zoneTheme} secondary onClick={() => doAct(s => fireStaff(s, role))} />}
          </div>
        );
      })}
      {sim.guards.map((g, i) => (
        <div key={g.name} style={S.row}>
          <span style={{ color: "var(--ink-text)", fontSize: 12 }}>🗡 护院：{g.name}（技{g.skill}·日薪{g.wage}）</span>
          <Btn label="送行" zoneTheme={zoneTheme} secondary onClick={() => doAct(s => fireGuard(s, i))} />
        </div>
      ))}

      <SectionTitle zoneTheme={zoneTheme}>今日候选（每日刷新）</SectionTitle>
      {candidates.staff.length === 0 && candidates.guards.length === 0 && (
        <div style={{ color: "var(--ink-text-dim)", fontSize: 12 }}>今日无人上门，明早再看看。</div>
      )}
      {candidates.staff.map((c, i) => {
        const info = STAFF_ROLES[c.role];
        return (
          <div key={`s${i}`} style={S.box(zoneTheme)}>
            <div style={{ color: "var(--ink-text)", fontSize: 12 }}>{info.icon} 应${info.label} · {c.name} · 技{c.skill} · 日薪{c.wage}两</div>
            <div style={{ color: "var(--ink-moss)", fontSize: 10, margin: "3px 0 6px" }}>{info.desc}</div>
            <Btn label={sim.staff[c.role] ? "换人" : "录用"} zoneTheme={zoneTheme} onClick={() => doAct(s => hireStaff(s, c))} />
          </div>
        );
      })}
      {candidates.guards.map((g, i) => (
        <div key={`g${i}`} style={S.box(zoneTheme)}>
          <div style={{ color: "var(--ink-text)", fontSize: 12 }}>🗡 {g.name} · 技{g.skill} · 佣金{g.fee}两 · 日薪{g.wage}两</div>
          <div style={{ color: "var(--ink-moss)", fontSize: 10, margin: "3px 0 6px" }}>看场子：闹事可稳妥处理；技≥7 还有名人效应（声望日增）。</div>
          <Btn label="聘请" zoneTheme={zoneTheme} disabled={sim.funds < g.fee} onClick={() => doAct(s => hireGuard(s, g))} />
        </div>
      ))}
    </div>
  );
}

// ── 菜单 tab ─────────────────────────────────────────────────────────
export function MenuTab({ sim, doAct, zoneTheme }) {
  return (
    <div>
      <div style={{ color: "var(--ink-text-dim)", fontSize: 11, marginBottom: 10 }}>
        定价超过基准 1.2 倍后，客人会开始嫌贵扭头。好菜随声望解锁。
      </div>
      {MENU.map(d => {
        const locked = sim.reputation < d.minRep;
        const price = sim.prices[d.id];
        const stock = STOCK_INFO[d.stock];
        return (
          <div key={d.id} style={{ ...S.box(zoneTheme), opacity: locked ? 0.45 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-text)", fontSize: 12 }}>{d.name}</span>
              <span style={{ color: "var(--ink-fern)", fontSize: 12 }}>{price} 两</span>
            </div>
            <div style={{ color: "var(--ink-moss)", fontSize: 10, margin: "2px 0 6px" }}>
              {locked ? `声望 ${d.minRep} 解锁 · ` : ""}耗{stock.icon}{stock.label}×1 · 基准 {d.basePrice} 两 · {d.desc}
            </div>
            {!locked && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Btn label="−" zoneTheme={zoneTheme} secondary
                  onClick={() => doAct(s => setPrice(s, d.id, (price - 1) / d.basePrice))} />
                <span style={{ color: "var(--ink-text-dim)", fontSize: 11, minWidth: 52, textAlign: "center" }}>
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
export function LedgerTab({ sim, zoneTheme }) {
  const rows = [...sim.ledger].reverse();
  return (
    <div>
      {!sim.staff.accountant && (
        <div style={{ color: "var(--ink-caution)", fontSize: 11, marginBottom: 8 }}>
          没请账房，每日流水有一成上下的糊涂损耗。请个账房（招工页）才能看明细。
        </div>
      )}
      {rows.length === 0 && <div style={{ color: "var(--ink-text-dim)", fontSize: 12 }}>还没打过一次烊。</div>}
      {rows.map(r => (
        <div key={r.day} style={S.box(zoneTheme)}>
          <div style={{ color: "var(--ink-warn)", fontSize: 12, marginBottom: 3 }}>第 {r.day} 日</div>
          <div style={{ color: "var(--ink-text-dim)", fontSize: 11 }}>
            客 {r.guests}（成 {r.served} / 失 {r.lost}）· 营收 {r.revenue} · 工钱 {r.wages}
            {r.bookLoss > 0 ? ` · 损耗 ${r.bookLoss}` : ""} · <span style={{ color: r.net >= 0 ? "var(--ink-fern)" : "var(--tavern-loss)" }}>净 {r.net}</span>
            {r.creditGain > 0 ? ` · 回款 ${r.creditGain}` : ""}
          </div>
          {sim.nightReports[r.day] && (
            <div style={{ color: "var(--ink-text)", fontSize: 11, marginTop: 5, borderLeft: "2px solid var(--ink-warn)", paddingLeft: 8 }}>
              {sim.nightReports[r.day]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

