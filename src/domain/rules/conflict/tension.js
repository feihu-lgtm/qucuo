// 势力张力：world.tension 只存偏离基线的对子，键为 tensionKey(A, B)（无向）。
import { BASE_TENSION, tensionKey } from "../../data/factions/npcFactions.js";

const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

export function getTension(tension, a, b) {
  if (!a || !b || a === b) return 0;
  const key = tensionKey(a, b);
  return tension?.[key] ?? BASE_TENSION[key] ?? 0;
}

export function adjustTension(tension, a, b, delta) {
  if (!a || !b || a === b || !Number.isFinite(delta) || !delta) return tension || {};
  const key = tensionKey(a, b);
  const next = clamp(getTension(tension, a, b) + delta);
  const out = { ...(tension || {}) };
  if (next === (BASE_TENSION[key] ?? 0)) delete out[key];
  else out[key] = next;
  return out;
}

// 每天向基线回落 rate 点（高于基线往下，低于基线往上），回到基线就不再存
export function decayTension(tension, days = 1, rate = 2) {
  const step = days * rate;
  if (!(days > 0 && rate > 0 && Number.isFinite(step))) return tension || {};
  const out = {};
  for (const [key, value] of Object.entries(tension || {})) {
    const base = BASE_TENSION[key] ?? 0;
    const moved = value > base ? Math.max(base, value - step) : Math.min(base, value + step);
    if (moved !== base) out[key] = moved;
  }
  return out;
}
