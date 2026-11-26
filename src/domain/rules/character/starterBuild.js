import { random } from "../../../utils/rng.js";
import { STARTER_SKILLS } from "../../data/kungfu/starterKungfu.js";
import { SPECIAL_KEYS } from "../../data/character/specialKeys.js";

const SPECIAL_BASE = 0;
const SPECIAL_POINTS = 20;
const SPECIAL_TOTAL = SPECIAL_KEYS.length * SPECIAL_BASE + SPECIAL_POINTS;

export function baseSpecial() {
  return Object.fromEntries(SPECIAL_KEYS.map((key) => [key, SPECIAL_BASE]));
}

export function remainingSpecialPoints(special) {
  const spent = SPECIAL_KEYS.reduce((sum, key) => sum + ((special?.[key] ?? SPECIAL_BASE) - SPECIAL_BASE), 0);
  return SPECIAL_POINTS - spent;
}

export function adjustSpecial(special, key, delta) {
  if (!SPECIAL_KEYS.includes(key) || !Number.isFinite(delta)) return special;
  const current = special?.[key] ?? SPECIAL_BASE;
  const nextValue = Math.max(SPECIAL_BASE, Math.min(10, current + Math.trunc(delta)));
  const cost = nextValue - current;
  if (cost > remainingSpecialPoints(special)) return special;
  return { ...special, [key]: nextValue };
}

export function isCompleteSpecial(special) {
  return SPECIAL_KEYS.every((key) => Number.isInteger(special?.[key]) && special[key] >= SPECIAL_BASE && special[key] <= 10)
    && SPECIAL_KEYS.reduce((sum, key) => sum + special[key], 0) === SPECIAL_TOTAL;
}

export function randomizeSpecial(rng = random) {
  const special = baseSpecial();
  let points = SPECIAL_POINTS;
  while (points > 0) {
    const available = SPECIAL_KEYS.filter((key) => special[key] < 10);
    const key = available[Math.floor(rng() * available.length)];
    special[key] += 1;
    points -= 1;
  }
  return special;
}

export function drawStarterSkills(rng = random, excludedIds = []) {
  const excluded = new Set(excludedIds);
  const pool = STARTER_SKILLS.filter((skill) => !excluded.has(skill.id)).slice();
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, 3);
}
