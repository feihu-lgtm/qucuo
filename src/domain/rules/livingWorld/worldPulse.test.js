import { describe, expect, it } from "vitest";
import { createLivingWorldRegistry, registerWorldPack } from "./worldRegistry.js";
import { stepLivingWorld, stepHourlyBeat, stepDailyBeat, EVENT_CAP } from "./worldPulse.js";

// 测试扩展包：两支高张力敌对编队路线相交 + 一张局势卡
const mkRegistry = () => {
  const registry = createLivingWorldRegistry();
  registerWorldPack(registry, {
    id: "test_pack",
    worldStates: [],
    situations: [
      { id: "sit_herb_shortage", label: "伤药紧俏", durationDays: 3 },
    ],
    roamingSquads: [
      {
        id: "sq_heifeng", name: "黑风寨游骑", faction: "黑风寨",
        route: ["打箭炉", "鱼定村"], members: ["pool_da_hu", "pool_dao_scar"],
        combatPower: 40, onDefeated: { addTargetSituation: "sit_herb_shortage", tensionDelta: 12 },
      },
      {
        id: "sq_tusi", name: "土司府巡山队", faction: "鱼定土司府",
        route: ["打箭炉", "鱼定村"], members: ["pool_zhang_shang", "pool_young_xia"],
        combatPower: 40, onDefeated: { tensionDelta: 8 },
      },
    ],
  });
  return registry;
};

// 张力预置 80（>=70 阈值）确保同节点即战
const mkState = (time, worldExtra = {}) => ({
  time,
  varTree: {
    世界: {
      tension: { "鱼定土司府|黑风寨": 80 },
      ...worldExtra,
    },
  },
});

// 应用 result.changes.varTree 补丁得新 state（模拟 applyResult 写盘）
const applyResultToState = (state, result) => ({
  ...state,
  varTree: result.changes.varTree(state.varTree),
});

describe("WO-25E worldPulse 时辰节拍", () => {
  it("编队沿 route 步进并落 编队册", () => {
    const registry = mkRegistry();
    const result = stepLivingWorld(mkState(0), registry);
    expect(result).not.toBeNull();
    const next = applyResultToState(mkState(0), result);
    const book = next.varTree.世界.编队册;
    expect(book.sq_heifeng.active).toBe(true);
    expect(book.sq_heifeng.node).toBe("鱼定村"); // 起点打箭炉走一步
    expect(book.sq_heifeng.routeIndex).toBe(1);
  });

  it("幂等：同时辰桶重复推进零效果", () => {
    const registry = mkRegistry();
    const s0 = mkState(0);
    const once = applyResultToState(s0, stepLivingWorld(s0, registry));
    expect(stepLivingWorld(once, registry)).toBeNull();
  });

  it("同节点敌对编队张力>=70 触发冲突：hpRatio/势力战力/事件录/局势卡落账", () => {
    const registry = mkRegistry();
    const s0 = mkState(0);
    const next = applyResultToState(s0, stepLivingWorld(s0, registry));
    const w = next.varTree.世界;
    // 两队首步都落到鱼定村 → 同节点必战
    const events = w.事件录 || [];
    expect(events.some((e) => e.kind === "编队冲突")).toBe(true);
    const ev = events.find((e) => e.kind === "编队冲突");
    expect(ev.knownDistricts).toContain("鱼定村");
    // 败方触发局势卡
    if (ev.loserSquad === "sq_heifeng") {
      expect((w.据点局势?.鱼定村 || []).some((c) => c.id === "sit_herb_shortage")).toBe(true);
    }
    // 人物动态 hpRatio 有记账
    expect(Object.keys(w.人物动态 || {}).length).toBeGreaterThan(0);
  });
});

describe("WO-25E 跳时追赶", () => {
  it("客栈住宿跳 23 格：逐桶追赶不吞中间节拍", () => {
    const registry = mkRegistry();
    // 先在 time 0 结一拍（落标记）
    const s0 = mkState(0);
    const settled = applyResultToState(s0, stepLivingWorld(s0, registry));
    // 住宿跳到 time 46（23 个时辰桶之后）
    const jumped = { ...settled, time: 46 };
    const result = stepLivingWorld(jumped, registry);
    expect(result).not.toBeNull();
    const next = applyResultToState(jumped, result);
    const w = next.varTree.世界;
    // 中间多拍冲突事件不只在最后一桶——事件 id 含 turn 可证
    const turns = (w.事件录 || []).map((e) => e.turn);
    expect(turns.length).toBeGreaterThanOrEqual(2); // 多拍结过（休整护栏下不必每场都打）
    expect(Math.min(...turns)).toBeLessThan(46); // 有中间时刻的事件，证明逐桶结过
    // 日结也被追：day0→day1 跨日，事件已扩散
    expect((w.事件录 || []).some((e) => (e.knownDistricts || []).length > 1)).toBe(true);
  });

  it("首跑无标记只结当前拍（firstRun 不补罚）", () => {
    const registry = mkRegistry();
    // 无标记直接从 time 46 起跑：只结当前桶，不回放历史
    const s = mkState(46);
    const result = stepLivingWorld(s, registry);
    const next = applyResultToState(s, result);
    const turns = (next.varTree.世界.事件录 || []).map((e) => e.turn);
    for (const t of turns) expect(t).toBeGreaterThanOrEqual(46);
  });
});

describe("WO-25E worldPulse 跨日节拍", () => {
  it("过期局势移除 + 事件扩散 1 跳 + 战力稳态恢复", () => {
    const registry = mkRegistry();
    const s0 = mkState(0, {
      据点局势: { 鱼定村: [{ id: "sit_herb_shortage", sinceDay: 0, expireDay: 0 }] }, // day1 即过期
      势力战力: { 黑风寨: 90 },
      事件录: [{ id: "ev1", day: 0, kind: "编队冲突", text: "x", district: "鱼定村", knownDistricts: ["鱼定村"] }],
    });
    // 推进到次日（time 48 = day 2）
    const stepped = applyResultToState({ ...s0, time: 48 }, stepLivingWorld({ ...s0, time: 48 }, registry));
    const w = stepped.varTree.世界;
    expect((w.据点局势?.鱼定村 || [])).toHaveLength(0); // 过期清除
    expect(w.势力战力?.黑风寨 ?? 100).toBeGreaterThan(90); // 稳态恢复
    const ev = (w.事件录 || []).find((e) => e.id === "ev1");
    expect(ev.knownDistricts.length).toBeGreaterThan(1); // 扩散 1 跳
  });

  it("stepDailyBeat 纯函数单元：decayTension 向基线回落", () => {
    const registry = mkRegistry();
    const out = stepDailyBeat(mkState(48), registry);
    expect(out.tension["鱼定土司府|黑风寨"]).toBeLessThan(80);
  });
});

describe("WO-25E 100 天模拟压测", () => {
  const simulate = (days) => {
    const registry = mkRegistry();
    let state = mkState(0);
    for (let t = 0; t < days * 24; t += 2) {
      const result = stepLivingWorld({ ...state, time: t }, registry);
      if (result) state = applyResultToState({ ...state, time: t }, result);
    }
    return state;
  };

  it("同 seed 两遍字节一致 + 张力不崩溃清零 + 事件录 cap 80 + 冲突产局势卡与传播", () => {
    const a = simulate(100);
    const b = simulate(100);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // 确定性可复现

    const w = a.varTree.世界;
    // 张力有起有落不崩溃清零（decay 回落但冲突 tensionDelta 会顶起）
    const tensions = Object.values(w.tension || {});
    expect(tensions.length).toBeGreaterThan(0);
    for (const v of tensions) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    // 事件录 cap 80
    expect((w.事件录 || []).length).toBeLessThanOrEqual(EVENT_CAP);
    expect((w.事件录 || []).length).toBeGreaterThan(0);
    // 扩散路径：有事件 knownDistricts 多于 1
    expect((w.事件录 || []).some((e) => (e.knownDistricts || []).length > 1)).toBe(true);
    // 势力战力不崩溃清零（稳态护栏）
    for (const v of Object.values(w.势力战力 || {})) {
      expect(v).toBeGreaterThan(0);
    }
    // 编队册持续活跃
    expect(w.编队册.sq_heifeng.active).toBe(true);
  }, 60000);
});
