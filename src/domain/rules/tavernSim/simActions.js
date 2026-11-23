// 酒馆沙盒 · 玩家动作与事件决策（从 simEngine.js 拆出）
// ============================================================================
import { rngFor, clamp, seatCount, pushLog } from "./simHelpers.js";
import {
  STOCK_INFO, STOCK_BATCH, STAFF_ROLES, GUARD_FEE_BASE, MENU,
  LEVEL_SEAT_BONUS, LEVEL_UP, EVENT_RESULT_TEXT,
  PRICE_MULT_MIN, PRICE_MULT_MAX,
} from "../../data/tavernSim/simData.js";

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

