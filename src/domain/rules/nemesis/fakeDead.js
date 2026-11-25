// ── WO-23C2b 宿敌假死池（纯函数，deterministic seeded，无 AI）──────────────
// 只在 lethal dying + fakeDeadCandidate=true 的宿敌上运行；普通切磋永不进池。
// 真假死/逃脱概率 seededRand(turn/day+npc identity) 可复现，不由 AI 决定。
// 玩家可见口径只有死亡表象（已故/气绝/尸身）——账本内 fakeDead 真相绝不外泄；
// 宿敌谱 status 置 fakeDead/dead 后谱注入/战斗弱点只认 active，自动退场。

import { seededRand } from "../../../utils/seededRandom.js";

// 假死概率与重逢窗口（deterministic 常量，写死进 docs）：
//   候选宿敌 dying 后 40% 进假死池；重逢窗口 seeded 取 2-5 日。
export const FAKE_DEAD_PROB = 0.4;
export const RETURN_MIN_DAYS = 2;
export const RETURN_MAX_DAYS = 5;

// 掷签（纯函数可复现）：输入 turn+npc identity，输出 {entersPool, returnAfterDay}
export function rollFakeDead({ turn = 0, npcName = "", faction = "" } = {}) {
  const day = Math.floor(turn / 24);
  const rng = seededRand(day, `fakeDead:${faction}:${npcName}`);
  const entersPool = rng() < FAKE_DEAD_PROB;
  const span = RETURN_MAX_DAYS - RETURN_MIN_DAYS + 1;
  const returnAfterDay = day + RETURN_MIN_DAYS + Math.floor(rng() * span);
  return { entersPool, returnAfterDay };
}

// 宿敌谱状态置位（纯函数不原地改）：fakeDead 或 dead，scars/grudge/origin 全保留。
// 无 entry/非 active 返回 null。
export function markNemesisStatus(roster, faction, name, status) {
  const entries = roster?.[faction]?.entries;
  if (!entries) return null;
  const hit = Object.values(entries).find((e) => e && e.name === name);
  if (!hit || hit.status !== "active") return null;
  return {
    ...(roster || {}),
    [faction]: {
      ...roster[faction],
      entries: { ...entries, [hit.id]: { ...hit, status } },
    },
  };
}

// 假死池查询（纯函数）：生死簿中 fakeDead 且到重逢日的条目。
// returnAfterDay 按「日」（turn/24 整数）比较，含当日。
export function dueReturns(book, currentDay = 0) {
  return Object.entries(book || {})
    .filter(([, v]) => v?.fakeDead && v?.returnedAt === undefined && Number.isFinite(v.returnAfterDay) && v.returnAfterDay <= currentDay)
    .map(([name, v]) => ({ name, ...v }));
}
