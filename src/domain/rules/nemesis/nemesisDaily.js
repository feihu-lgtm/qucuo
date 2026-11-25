// ── WO-23C3 宿敌谱每日争位与茶馆传闻（纯函数日结，无 AI）──────────────────
// roadmap「每日日结纯函数推演名册内部争位并写入茶馆传闻」最小闭环：
//   · 系统纯函数决定结果，AI 不参与裁决；本单不接 AI 润色，无玩家战斗数值影响。
//   · 争位只作小幅账本变化：同势力低阶挑战高阶，成功 tier 互换，失败不变；
//     绝不复活 fakeDead/settled，绝不改 origin/scars/epithet，tier 不出 1-4。
//   · 随机用 seededRand(day, key) 同日同结果可复现（与 npcRoam 同口径），
//     纯函数 rng 由调用方注入可测。
//   · 幂等：varTree.世界.宿敌争位日 记已日结的 day——同日重复日结零效果。
//   · 传闻写 varTree.世界.传闻（最小通用结构，见 PR 偏差声明）——馆内本无
//     持久传闻账（茶馆 RUMORS 是静态池、npcEmergence 传闻人物是涌现机制），
//     故按工单退路开最小结构，cap 30 条滚动淘汰。

import { seededRand } from "../../../utils/seededRandom.js";

// 每势力每日争位触发率与每日传闻条数上限（手册未定，最小起步）。
export const NEMESIS_DAILY_CHALLENGE_RATE = 0.35;
export const NEMESIS_DAILY_RUMOR_CAP = 2;
export const RUMOR_KEEP_CAP = 30;
export const NEMESIS_DAILY_MARK_KEY = "宿敌争位日";

function activeEntries(group) {
  const entries = group?.entries;
  if (!entries || typeof entries !== "object") return [];
  return Object.values(entries).filter(
    (e) => e && typeof e === "object" && e.id && e.name && e.status === "active" && Number.isFinite(e.tier),
  );
}

// 稳定排序键：tier 升序 → grudge 降序 → firstTurn 升序 → name——同输入恒同序，不依赖遍历序。
function stableSort(entries) {
  return [...entries].sort((a, b) =>
    (a.tier - b.tier) || ((b.grudge || 0) - (a.grudge || 0)) || ((a.firstTurn || 0) - (b.firstTurn || 0)) || String(a.name).localeCompare(String(b.name), "zh"),
  );
}

// 单势力日结推演（纯函数）：返回 { events, updates } ——
// updates 是 {entryId: newEntry} 补丁（tier 互换），events 供传闻模板。
// 规则：tier 最低的 active 为挑战者（同 tier 比 grudge/入谱序），目标为 tier 严格高一级
// 以内最近的更高阶者；成功率 0.5 + 0.1×(挑战者grudge − 目标grudge)，clamp [0.2, 0.8]；
// 成功 tier 互换，失败不变。grudge 是「与主角结仇强度」，内务争位不动它。
export function runFactionContest(entries, rng) {
  const eligible = stableSort(entries);
  if (eligible.length < 2) return { events: [], updates: {} };
  const challenger = eligible[0];
  const target = eligible.find((e) => e.id !== challenger.id && e.tier > challenger.tier);
  if (!target) return { events: [], updates: {} }; // 挑战者已是最高阶，无可争
  const p = Math.min(0.8, Math.max(0.2, 0.5 + 0.1 * ((challenger.grudge || 0) - (target.grudge || 0))));
  const success = rng() < p;
  const event = { challenger, target, success };
  if (!success) return { events: [event], updates: {} };
  return {
    events: [event],
    updates: {
      [challenger.id]: { ...challenger, tier: target.tier },
      [target.id]: { ...target, tier: challenger.tier },
    },
  };
}

// 传闻文本（deterministic 模板，不编造战绩细节）
export function nemesisContestRumorText(faction, event) {
  const c = event.challenger;
  const t = event.target;
  const cName = c.epithet ? `「${c.epithet}」${c.name}` : c.name;
  const tName = t.epithet ? `「${t.epithet}」${t.name}` : t.name;
  return event.success
    ? `听说${faction}里排位有变，${cName}硬生生压过了${tName}一头。`
    : `听说${faction}的${cName}向${tName}叫阵，到底没能撼动其位次。`;
}

// 全谱日结推演（纯函数，输入不原地改）：返回 { roster, events }。
// roster 无变化时原样返回（引用不变）；events 每项 {faction, challenger, target, success}。
// rngFor(faction) 注入——默认 seededRand(day, `nemesis|faction`) 同日可复现。
export function runNemesisDaily(roster, { day = 0, rngFor = null } = {}) {
  if (!roster || typeof roster !== "object") return { roster, events: [] };
  const getRng = typeof rngFor === "function" ? rngFor : (faction) => seededRand(day, `nemesis|${faction}`);
  const events = [];
  let next = roster;
  let dirty = false;
  for (const [faction, group] of Object.entries(roster)) {
    const entries = activeEntries(group);
    if (entries.length < 2) continue;
    const rng = getRng(faction);
    if (rng() >= NEMESIS_DAILY_CHALLENGE_RATE) continue; // 本日无争议
    const { events: fEvents, updates } = runFactionContest(entries, rng);
    if (!fEvents.length) continue;
    for (const e of fEvents) events.push({ faction, ...e });
    if (Object.keys(updates).length) {
      dirty = true;
      const mergedEntries = { ...(group.entries || {}) };
      for (const [id, up] of Object.entries(updates)) mergedEntries[id] = up;
      next = { ...next, [faction]: { ...group, entries: mergedEntries } };
    }
  }
  return { roster: dirty ? next : roster, events };
}

// 日结 tick（纯函数）：输入 state 形状 {time, varTree}，输出 {changes, logs} 或 null。
// 幂等标记优先一切：同日已结直接 null——重复日结不重掷不双写。
export function runNemesisDailyTick(state) {
  const day = Math.floor((state.time || 0) / 24);
  const world = state.varTree?.世界 || {};
  if (Number.isFinite(world[NEMESIS_DAILY_MARK_KEY]) && world[NEMESIS_DAILY_MARK_KEY] >= day) return null;
  const roster = world.宿敌谱;
  const { roster: nextRoster, events } = runNemesisDaily(roster, { day });
  // 传闻：每日最多 CAP 条，id 含 day+faction 天然幂等（重写同 id 不重复）
  const existing = Array.isArray(world.传闻) ? world.传闻 : [];
  const existingIds = new Set(existing.map((r) => r?.id));
  const fresh = [];
  for (const e of events.slice(0, NEMESIS_DAILY_RUMOR_CAP)) {
    const id = `rumor_nemesis_${day}_${e.faction}`;
    if (existingIds.has(id)) continue;
    fresh.push({ id, day, turn: state.time || 0, kind: "宿敌争位", text: nemesisContestRumorText(e.faction, e) });
  }
  return {
    changes: {
      varTree: (prev) => {
        const pw = prev?.世界 || {};
        const prevRumors = Array.isArray(pw.传闻) ? pw.传闻 : [];
        const prevIds = new Set(prevRumors.map((r) => r?.id));
        const append = fresh.filter((r) => !prevIds.has(r.id));
        const rumors = [...prevRumors, ...append].slice(-RUMOR_KEEP_CAP);
        return {
          ...(prev || {}),
          世界: {
            ...pw,
            [NEMESIS_DAILY_MARK_KEY]: day,
            传闻: rumors,
            ...(nextRoster !== roster ? { 宿敌谱: nextRoster } : {}),
          },
        };
      },
    },
    logs: [], // 传闻只在茶馆场景可读，不落日志刷屏
  };
}

// 世界规则壳：跨日推进才结（deps 按日分桶）。幂等由 tick 内标记兜底——
// 不靠 firstRun skip（读档当日未结也应补上，争位不是惩罚性结算）。
export const nemesisDailyRule = {
  id: "nemesis.daily",
  deps: (state) => [Math.floor((state.time || 0) / 24)],
  run(state) {
    return runNemesisDailyTick(state);
  },
};
