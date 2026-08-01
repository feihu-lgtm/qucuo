// 酒馆经营沙盒 · 纯函数引擎
// 设计原则跟主项目一致：AI 提议、系统裁决。这里更进一步——
// 引擎 100% 本地确定性运转（种子随机），不依赖任何网络与 AI，
// AI 只在 simNarrator.js 里做事后润色，失败与否都影响不了这里一个铜板。
//
// 所有函数都是纯函数：吃 state 返回新 state（state 是可 JSON 序列化的纯数据，
// UI 层直接整个塞进 localStorage 存档）。随机性全部从 (state.seed, day, tick, salt)
// 派生——同一存档同一天同一时段重进游戏，世界长得一模一样，F5 刷不了事件。

import { seededRand, weightedSample } from "../utils/seededRandom.js";
import {
  TICKS_PER_DAY, LAST_OPEN_TICK, MENU, STOCK_INFO, STOCK_BATCH,
  STAFF_ROLES, STAFF_SURNAMES, STAFF_GIVEN, GUARD_NAMES, GUARD_FEE_BASE,
  BASE_SEATS, LEVEL_SEAT_BONUS, LEVEL_UP, GUEST_GLYPHS,
  EVENTS, EVENT_CHANCE_PER_TICK, EVENT_MAX_PER_DAY, GUEST_BANTER,
  fallbackNightReport, EVENT_RESULT_TEXT, PRICE_MULT_MIN, PRICE_MULT_MAX,
} from "./simData.js";

// ── 随机 ─────────────────────────────────────────────────────────────
// salt 区分调用点（"guests" / "event" / "dish"…），保证同 tick 内不同用途不互吃序列
function rngFor(state, salt) {
  return seededRand(state.day * 100 + state.tick, `ts${state.seed}_${salt}`);
}

// 泊松采样（λ 较小，Knuth 足够）
function poisson(rng, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L && k < 12);
  return k - 1;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── 开局 ─────────────────────────────────────────────────────────────
export function initSim(seed = Math.floor(Math.random() * 1e9)) {
  const prices = {};
  for (const d of MENU) prices[d.id] = d.basePrice;
  return {
    version: 1,
    seed,
    day: 1, tick: 0,
    funds: 200, reputation: 10, level: 0,
    pantry: { wine: 12, food: 12, snack: 8 },
    prices,
    staff: { cook: null, runner: null, accountant: null, manager: null },
    guards: [],
    seats: Array(BASE_SEATS).fill(null),
    today: { guests: 0, served: 0, lost: 0, revenue: 0, events: 0, boost: 1 },
    ledger: [],
    log: [{ day: 1, tick: 0, kind: "sys", text: "你盘下了鱼定村口这间「醉三江」。开张了。" }],
    pendingEvent: null,
    heroDay: 0,
    creditDue: [],
    nightReports: {},
  };
}

// ── 查询 ─────────────────────────────────────────────────────────────
export function seatCount(state) {
  return BASE_SEATS + (LEVEL_SEAT_BONUS[state.level] || 0);
}

export function unlockedMenu(state) {
  return MENU.filter(d => state.reputation >= d.minRep);
}

// 每日招工候选（种子）：伙计四类各 0~1，护院 0~2
export function getDailyCandidates(state) {
  const rng = seededRand(state.day, `ts${state.seed}_candidates`);
  const staff = [];
  for (const [role, info] of Object.entries(STAFF_ROLES)) {
    if (rng() < 0.55) {
      const skill = clamp(1 + Math.floor(rng() * 8) + state.level, 1, 10);
      staff.push({
        role,
        name: STAFF_SURNAMES[Math.floor(rng() * STAFF_SURNAMES.length)] + STAFF_GIVEN[Math.floor(rng() * STAFF_GIVEN.length)],
        skill,
        wage: info.wageBase + skill,
      });
    }
  }
  const guards = [];
  const heroGuaranteed = state.heroDay === state.day;
  const guardCount = heroGuaranteed ? 1 + Math.floor(rng() * 2) : (rng() < 0.3 ? 1 : 0);
  const names = [...GUARD_NAMES];
  for (let i = 0; i < guardCount && names.length; i++) {
    const idx = Math.floor(rng() * names.length);
    const skill = 3 + Math.floor(rng() * 6); // 3~8
    guards.push({
      name: names.splice(idx, 1)[0],
      skill,
      fee: GUARD_FEE_BASE * skill,
      wage: 2 + skill,
    });
  }
  return { staff, guards };
}

// ── 玩家动作 ─────────────────────────────────────────────────────────
export function buyStock(state, kind) {
  const info = STOCK_INFO[kind];
  if (!info) return state;
  const cost = info.unitPrice * STOCK_BATCH;
  if (state.funds < cost) return pushLog(state, "sys", `银子不够，进不起这批${info.label}（需 ${cost} 两）。`);
  return pushLog({
    ...state,
    funds: state.funds - cost,
    pantry: { ...state.pantry, [kind]: state.pantry[kind] + STOCK_BATCH },
  }, "sys", `进了 ${STOCK_BATCH} 份${info.label}，花 ${cost} 两。`);
}

export function setPrice(state, dishId, mult) {
  const dish = MENU.find(d => d.id === dishId);
  if (!dish) return state;
  const m = clamp(mult, PRICE_MULT_MIN, PRICE_MULT_MAX);
  const price = Math.max(1, Math.round(dish.basePrice * m));
  return { ...state, prices: { ...state.prices, [dishId]: price } };
}

export function hireStaff(state, cand) {
  if (!cand || !STAFF_ROLES[cand.role]) return state;
  return pushLog({
    ...state,
    staff: { ...state.staff, [cand.role]: { name: cand.name, skill: cand.skill, wage: cand.wage } },
  }, "sys", `${STAFF_ROLES[cand.role].label}「${cand.name}」上工了（技能 ${cand.skill}，日薪 ${cand.wage} 两）。`);
}

export function fireStaff(state, role) {
  const cur = state.staff[role];
  if (!cur) return state;
  return pushLog({
    ...state,
    staff: { ...state.staff, [role]: null },
  }, "sys", `你结清工钱，辞退了${STAFF_ROLES[role].label}「${cur.name}」。`);
}

export function hireGuard(state, cand) {
  if (!cand || state.funds < cand.fee) return state;
  return pushLog({
    ...state,
    funds: state.funds - cand.fee,
    guards: [...state.guards, { name: cand.name, skill: cand.skill, wage: cand.wage }],
  }, "sys", `侠客「${cand.name}」收下 ${cand.fee} 两佣金，在店里住下了（日薪 ${cand.wage} 两）。`);
}

export function fireGuard(state, idx) {
  const g = state.guards[idx];
  if (!g) return state;
  return pushLog({
    ...state,
    guards: state.guards.filter((_, i) => i !== idx),
  }, "sys", `侠客「${g.name}」抱拳一礼，飘然离去。`);
}

export function upgradeLevel(state) {
  const up = LEVEL_UP[state.level];
  if (!up || state.reputation < up.needRep || state.funds < up.cost) return state;
  const next = {
    ...state,
    level: state.level + 1,
    funds: state.funds - up.cost,
    seats: Array(seatCount(state) + (LEVEL_SEAT_BONUS[state.level + 1] || 0)).fill(null)
      .map((_, i) => state.seats[i] || null),
  };
  return pushLog(next, "gold", `「${up.label}」成了！${up.desc}`);
}

// ── 事件决策 ─────────────────────────────────────────────────────────
export function resolveEvent(state, optionId) {
  const ev = state.pendingEvent;
  if (!ev) return state;
  const rng = rngFor(state, `resolve_${ev.id}`);
  let s = { ...state, pendingEvent: null };
  const rep = d => ({ ...s, reputation: clamp(s.reputation + d, 0, 100) });
  const T = EVENT_RESULT_TEXT[ev.id] || {};

  if (ev.id === "drunk_brawl") {
    if (optionId === "self") {
      if (rng() < 0.6) { s = rep(2); s = pushLog(s, "event", T.self_win); }
      else { s = { ...s, funds: s.funds - 20 }; s = rep(-2); s = pushLog(s, "event", `${T.self_lose}（赔桌椅 20 两）`); }
    } else if (optionId === "guard") {
      s = rep(1); s = pushLog(s, "event", T.guard);
    } else {
      s = { ...s, funds: s.funds - 12 }; s = pushLog(s, "event", T.pay);
    }
  } else if (ev.id === "food_critic") {
    if (optionId === "cook") {
      s = { ...s, pantry: { ...s.pantry, food: s.pantry.food - 3 } };
      if (rng() < 0.65) { s = rep(6); s = pushLog(s, "event", T.cook_win); }
      else { s = rep(-1); s = pushLog(s, "event", T.cook_lose); }
    } else {
      s = pushLog(s, "event", T.normal);
    }
  } else if (ev.id === "credit_regular") {
    if (optionId === "allow") {
      if (rng() < 0.7) {
        s = { ...s, creditDue: [...s.creditDue, { day: s.day + 3, amount: 30 }] };
        s = pushLog(s, "event", T.allow_win);
      } else {
        s = { ...s, funds: Math.max(0, s.funds - 15) };
        s = pushLog(s, "event", T.allow_lose);
      }
    } else {
      s = rep(-1); s = pushLog(s, "event", T.refuse);
    }
  } else if (ev.id === "storyteller") {
    if (optionId === "hire") {
      s = { ...s, funds: s.funds - 10, today: { ...s.today, boost: 1.5 } };
      s = rep(3); s = pushLog(s, "event", T.hire);
    } else {
      s = pushLog(s, "event", T.pass);
    }
  }
  return s;
}

// ── 主推进：走一个时段 ────────────────────────────────────────────────
export function advanceTick(state) {
  if (state.pendingEvent) return state; // 事件未决，时间冻结（UI 也应暂停）
  if (state.tick >= TICKS_PER_DAY - 1) return settleDay(state);

  let s = { ...state, tick: state.tick + 1 };
  const rng = rngFor(s, "guests");

  // ① 在店客人的生命周期推进：arriving → eating（此刻点单结算）→ leaving → 空
  let seats = s.seats.map(seat => {
    if (!seat) return null;
    if (seat.phase === "arriving") return { ...seat, phase: "eating", tickLeft: 2 + Math.floor(rng() * 2) };
    if (seat.phase === "eating") {
      if (seat.tickLeft > 1) return { ...seat, tickLeft: seat.tickLeft - 1 };
      return { ...seat, phase: "leaving", tickLeft: 1 };
    }
    return null; // leaving → 离店
  });
  s = { ...s, seats };

  // 点单结算发生在 arriving→eating 的那批人身上
  s.seats.forEach((seat, i) => {
    if (seat && seat.phase === "eating" && !seat.ordered) {
      const [ns, updated] = serveGuest(s, seat, i);
      s = ns;
      if (updated) {
        const seats = [...s.seats];
        seats[i] = updated;
        s = { ...s, seats };
      }
      // updated === null：客人一道都没点成，serveGuest 已在 ns.seats 里置为 leaving，无需再动
    }
  });

  // ② 新客到店（泊松，受空位限制）
  const runnerSkill = s.staff.runner?.skill || 0;
  const lambda = (3 + s.reputation / 15 + runnerSkill * 0.09 + s.level * 2) * s.today.boost * 0.5;
  const vacant = s.seats.map((x, i) => x ? -1 : i).filter(i => i >= 0);
  const arrivals = Math.min(poisson(rng, lambda), vacant.length);
  for (let i = 0; i < arrivals; i++) {
    const seatIdx = vacant[i];
    const glyph = GUEST_GLYPHS[Math.floor(rng() * GUEST_GLYPHS.length)];
    s.seats[seatIdx] = {
      id: `g${s.day}_${s.tick}_${seatIdx}`,
      glyph, phase: "arriving", tickLeft: 1,
      banter: GUEST_BANTER[Math.floor(rng() * GUEST_BANTER.length)],
      ordered: false,
    };
    s = { ...s, today: { ...s.today, guests: s.today.guests + 1 } };
  }

  // ③ 事件骰（营业时段、每日上限、无待决事件时）
  if (s.tick <= LAST_OPEN_TICK && s.today.events < EVENT_MAX_PER_DAY && !s.pendingEvent) {
    if (rngFor(s, "event")() < EVENT_CHANCE_PER_TICK) {
      s = triggerEvent(s);
    }
  }
  return s;
}

// 一位客人点单：选菜 → 嫌贵判定 → 厨子出菜判定 → 成交/流失
function serveGuest(state, seat, seatIdx) {
  const rng = rngFor(state, `dish_${seat.id}`);
  const menu = unlockedMenu(state);
  const available = menu.filter(d => state.pantry[d.stock] > 0);
  const s = { ...state };
  const seatNext = { ...seat, ordered: true };

  // 想点 1~2 道
  const want = 1 + (rng() < 0.4 ? 1 : 0);
  const picks = [];
  for (let i = 0; i < want; i++) {
    const pool = available.length ? available : menu;
    picks.push(pool[Math.floor(rng() * pool.length)]);
  }

  let earned = 0, stockUse = [];
  const cookSkill = state.staff.cook ? state.staff.cook.skill : 0;
  const serveRate = state.staff.cook ? 0.6 + cookSkill * 0.04 : 0.45;
  const mgrSkill = state.staff.manager?.skill || 0;

  for (const dish of picks) {
    const price = s.prices[dish.id];
    // 嫌贵：定价超过基准 1.2x 后开始有概率扭头不买
    const ratio = price / dish.basePrice;
    if (ratio > 1.2 && rng() < Math.min(0.7, (ratio - 1) * 1.2)) continue;
    // 没库存 / 厨子做不出
    if (s.pantry[dish.stock] <= 0) continue;
    if (rng() > serveRate) continue;
    stockUse.push(dish.stock);
    earned += Math.round(price * (1 + mgrSkill * 0.02));
  }

  if (earned > 0) {
    const pantry = { ...s.pantry };
    for (const k of stockUse) pantry[k] -= 1;
    return [{
      ...s, pantry,
      today: { ...s.today, revenue: s.today.revenue + earned, served: s.today.served + 1 },
    }, { ...seatNext, spent: earned }];
  }
  // 一道都没成：客人失望离开（今日流失+1）
  return [{
    ...s,
    seats: s.seats.map((x, i) => i === seatIdx ? { ...x, phase: "leaving", tickLeft: 1 } : x),
    today: { ...s.today, lost: s.today.lost + 1 },
  }, null];
}

function triggerEvent(state) {
  const rng = rngFor(state, "event_pick");
  const ev = weightedSample(EVENTS, "weight", 1, rng)[0];
  if (!ev) return state;
  let s = { ...state, today: { ...state.today, events: state.today.events + 1 } };

  if (ev.id === "tax_check") {
    const hasAcc = !!s.staff.accountant;
    const fineRate = hasAcc ? Math.floor(rngFor(s, "tax")() * 3) / 100 : 0.05;
    const fine = Math.max(1, Math.round(s.funds * fineRate));
    s = { ...s, funds: s.funds - fine };
    return pushLog(s, "event", `${ev.desc} ${hasAcc ? EVENT_RESULT_TEXT.tax_check.withAccountant : EVENT_RESULT_TEXT.tax_check.withoutAccountant}（罚 ${fine} 两）`);
  }
  if (ev.id === "wandering_hero") {
    s = { ...s, heroDay: s.day };
    return pushLog(s, "event", `${ev.desc}`);
  }
  // 需要玩家决策的：挂起
  return { ...s, pendingEvent: { id: ev.id, title: ev.title, desc: ev.desc, options: ev.options } };
}

// ── 打烊日结 ─────────────────────────────────────────────────────────
function settleDay(state) {
  const rng = rngFor(state, "settle");
  const t = state.today;
  let s = { ...state };

  // 赊账回款
  let creditGain = 0;
  const stillDue = [];
  for (const c of s.creditDue) {
    if (c.day <= s.day) creditGain += c.amount;
    else stillDue.push(c);
  }
  s = { ...s, creditDue: stillDue };

  // 工资
  const wages =
    Object.values(s.staff).reduce((sum, x) => sum + (x ? x.wage : 0), 0) +
    s.guards.reduce((sum, g) => sum + g.wage, 0);

  // 账目损耗（无账房对不上账）
  const lossRate = s.staff.accountant ? (10 - s.staff.accountant.skill) / 100 : 0.10 + rng() * 0.15;
  const bookLoss = Math.round(t.revenue * Math.max(0, lossRate));

  // 声望：成交率 + 流失 + 护院名人效应
  const serveRatio = t.guests > 0 ? t.served / t.guests : 1;
  let repDelta = serveRatio >= 0.85 ? 2 : serveRatio >= 0.6 ? 1 : -2;
  if (t.lost >= 5) repDelta -= 1;
  if (s.guards.some(g => g.skill >= 7)) repDelta += 1;

  const revenue = t.revenue + creditGain;
  const net = revenue - wages - bookLoss;
  const report = {
    day: s.day, guests: t.guests, served: t.served, lost: t.lost,
    revenue, wages, bookLoss, net, repDelta, creditGain,
    events: t.events, level: s.level,
  };

  s = {
    ...s,
    funds: s.funds + net,
    reputation: clamp(s.reputation + repDelta, 0, 100),
    ledger: [...s.ledger.slice(-29), report],
    nightReports: {
      ...s.nightReports,
      [s.day]: fallbackNightReport(report),
    },
    day: s.day + 1,
    tick: 0,
    seats: s.seats.map(() => null), // 清场
    today: { guests: 0, served: 0, lost: 0, revenue: 0, events: 0, boost: 1 },
  };
  return pushLog(s, "gold", fallbackNightReport(report));
}

// ── 日志 ─────────────────────────────────────────────────────────────
function pushLog(state, kind, text) {
  const entry = { day: state.day, tick: state.tick, kind, text };
  return { ...state, log: [...state.log.slice(-199), entry] };
}

// 供 UI 写外部文本（AI 夜报覆盖、自定义提示）
export function appendLog(state, kind, text) {
  return pushLog(state, kind, text);
}

export function setNightReport(state, day, text) {
  return { ...state, nightReports: { ...state.nightReports, [day]: text } };
}
