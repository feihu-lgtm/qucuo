// 酒馆沙盒 · 内部工具（从 simEngine.js 拆出：随机/查询/日志，供引擎与动作共用）
import { seededRand } from "../../../utils/seededRandom.js";
import { BASE_SEATS, LEVEL_SEAT_BONUS, MENU } from "../../data/tavernSim/simData.js";

// ── 随机 ─────────────────────────────────────────────────────────────
// salt 区分调用点（"guests" / "event" / "dish"…），保证同 tick 内不同用途不互吃序列
export function rngFor(state, salt) {
  return seededRand(state.day * 100 + state.tick, `ts${state.seed}_${salt}`);
}

// 泊松采样（λ 较小，Knuth 足够）
export function poisson(rng, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L && k < 12);
  return k - 1;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── 查询 ─────────────────────────────────────────────────────────────
export function seatCount(state) {
  return BASE_SEATS + (LEVEL_SEAT_BONUS[state.level] || 0);
}

export function unlockedMenu(state) {
  return MENU.filter(d => state.reputation >= d.minRep);
}


// ── 日志 ─────────────────────────────────────────────────────────────
export function pushLog(state, kind, text) {
  const entry = { day: state.day, tick: state.tick, kind, text };
  return { ...state, log: [...state.log.slice(-199), entry] };
}

