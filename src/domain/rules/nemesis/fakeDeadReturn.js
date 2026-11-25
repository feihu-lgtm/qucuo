// ── WO-23C2c 假死数日重逢 deterministic 日结（纯函数，无 AI）──────────────
// 世界规则按日检查 dueReturns(生死簿, floor(time/24))：到期假死者
//   · 宿敌谱对应 faction+entryId 从 fakeDead 置回 active，grudge deterministic +2
//     （GRUDGE_ON_RETURN 常量），origin/scars/epithet 全保留；
//   · 生死簿条目标记 returnedAt（幂等闸），不再 due；
//   · 写一条 deterministic 传闻（「尸身不见/活着回来」口径）——到期重逢揭示
//     允许玩家知道；到期前任何文案不泄 fakeDead。
// 不升 tier（没赢玩家）、不调 AI、复活后借现有驻场/游走池过滤自然回归世界。

import { dueReturns } from "./fakeDead.js";
import { RUMOR_KEEP_CAP } from "./nemesisDaily.js";

// 重逢深仇增量（deterministic 常量，写死进 docs）：假死归来者对主角的恨只会更深。
export const GRUDGE_ON_RETURN = 2;

// 重逢传闻模板（deterministic，两种口径 seeded 交替由 id/day 决定其一——
// 不重掷，幂等由 id 含 entryId 保证）
export function fakeDeadReturnRumorText(name, faction) {
  return `听说${faction}的${name}没死——那尸身原是不见了，如今人好端端活着回来了。`;
}

// 日结 tick（纯函数，输入不原地改）：输出 {changes, logs} 或 null（无到期）。
// 幂等：returnedAt 已标记的条目 dueReturns 还会命中，但本函数跳过——
// 重逢账以生死簿 returnedAt 为唯一闸，同条目绝不二触发。
export function runFakeDeadReturnTick(state) {
  const day = Math.floor((state.time || 0) / 24);
  const world = state.varTree?.世界 || {};
  const book = world.生死 || {};
  const due = dueReturns(book, day).filter((r) => !book[r.name]?.returnedAt);
  if (!due.length) return null;
  // 按 name+faction+entryId 精确置回（防止跨势力同名串人）
  const targets = due.filter((r) => {
    const entry = world.宿敌谱?.[r.faction]?.entries?.[r.entryId];
    return entry && entry.status === "fakeDead" && entry.name === r.name;
  });
  if (!targets.length) {
    // 谱中已无对应 fakeDead（被了结/被擒等）——生死簿仍标记 returnedAt 关闭循环，
    // 不复活但不再 due。
    return {
      changes: {
        varTree: (prev) => {
          const pw = prev?.世界 || {};
          const pb = { ...(pw.生死 || {}) };
          for (const r of due) if (pb[r.name] && !pb[r.name].returnedAt) pb[r.name] = { ...pb[r.name], returnedAt: day };
          return { ...(prev || {}), 世界: { ...pw, 生死: pb } };
        },
      },
      logs: [],
    };
  }
  return {
    changes: {
      varTree: (prev) => {
        const pw = prev?.世界 || {};
        const roster = { ...(pw.宿敌谱 || {}) };
        const bookNext = { ...(pw.生死 || {}) };
        const rumorAppend = [];
        for (const r of targets) {
          const group = roster[r.faction];
          const entry = group?.entries?.[r.entryId];
          if (!entry || entry.status !== "fakeDead") continue; // 并发幂等
          roster[r.faction] = {
            ...group,
            entries: {
              ...group.entries,
              [r.entryId]: { ...entry, status: "active", grudge: (entry.grudge || 0) + GRUDGE_ON_RETURN },
            },
          };
          if (bookNext[r.name]) bookNext[r.name] = { ...bookNext[r.name], returnedAt: day };
          const id = `rumor_fakedead_return_${r.entryId}_${day}`;
          rumorAppend.push({ id, day, turn: state.time || 0, kind: "宿敌重逢", text: fakeDeadReturnRumorText(r.name, r.faction) });
        }
        // 孤儿条目（谱中无 fakeDead 对应）也关闸
        for (const r of due) {
          if (!targets.includes(r) && bookNext[r.name] && !bookNext[r.name].returnedAt) {
            bookNext[r.name] = { ...bookNext[r.name], returnedAt: day };
          }
        }
        const prevRumors = Array.isArray(pw.传闻) ? pw.传闻 : [];
        const prevIds = new Set(prevRumors.map((x) => x?.id));
        const rumors = [...prevRumors, ...rumorAppend.filter((x) => !prevIds.has(x.id))].slice(-RUMOR_KEEP_CAP);
        return { ...(prev || {}), 世界: { ...pw, 宿敌谱: roster, 生死: bookNext, 传闻: rumors } };
      },
    },
    logs: [],
  };
}

// 世界规则壳：deps 按日分桶，同据点玩家当日即见回归（驻场过滤认 active）。
export const fakeDeadReturnRule = {
  id: "nemesis.fakeDeadReturn",
  deps: (state) => [Math.floor((state.time || 0) / 24)],
  run(state) {
    return runFakeDeadReturnTick(state);
  },
};
