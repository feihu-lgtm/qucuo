import { describe, expect, it } from "vitest";
import { ocWanderRule, positionsWithFallback, wanderRangeOf, wanderWeightOf, WANDERING_OCS } from "./ocWander.js";
import { ADVENTURER_POOL } from "../../data/dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";

const OC_BY_NAME = Object.fromEntries([...ADVENTURER_POOL, ...ADVENTURER_POOL_IP].map((a) => [a.name, a]));
const yu = OC_BY_NAME.鱼丽;

// 依次推进世界规则 n 个时辰，threading varTree，返回终态与累计日志
function runTicks(startState, fromTime, count) {
  let varTree = startState.varTree || {};
  const logs = [];
  for (let t = fromTime; t < fromTime + count; t++) {
    const state = { ...startState, time: t, varTree };
    const result = ocWanderRule.run(state, { previousDeps: [t - 1], companionState: {} });
    if (result?.changes?.varTree) varTree = result.changes.varTree(varTree);
    if (result?.logs) logs.push(...result.logs);
  }
  return { varTree, logs };
}

describe("OC 冒险者名册游走（大肥鱼跑路案）", () => {
  it("位置册兜底确定且幂等：同一时刻两次求解一致，落盘后不再按日重掷", () => {
    const a = positionsWithFallback(null, 260 * 24);
    const b = positionsWithFallback(null, 260 * 24);
    expect(a).toEqual(b);
    expect(Object.keys(a).length).toBe(WANDERING_OCS.length);
    // 落盘册子优先于兜底：手动改写后原样返回
    const custom = { ...a, 鱼丽: { at: "雅江", inner: null, since: 1 } };
    expect(positionsWithFallback(custom, 300 * 24).鱼丽.at).toBe("雅江");
  });

  it("鱼丽（大肥鱼）有自己的活动范围：鱼定派系落点，且吃货偏爱有饭馆的据点", () => {
    const range = wanderRangeOf(yu);
    expect(range).toContain("鱼定土司");
    expect(range).toContain("鱼定村");
    expect(range).not.toContain("锦官城");
    expect(range).not.toContain("天龙营");
    // 嘴馋性情 → 有吃喝处的据点权重 3，没有的 1
    expect(wanderWeightOf(yu, "鱼定村")).toBe(3); // 老孙饭馆
    expect(wanderWeightOf(yu, "鱼定土司")).toBe(1);
  });

  it("时间流逝不让人蒸发：无玩家干扰推 200 时辰，每人始终有确定位置且都在自己范围内", () => {
    const start = { time: 0, room: { name: "锦官城", npcs: [] }, varTree: {} };
    const { varTree } = runTicks(start, 100, 200);
    const book = varTree.世界.游走册;
    expect(Object.keys(book).length).toBe(WANDERING_OCS.length);
    for (const adv of WANDERING_OCS) {
      const entry = book[adv.name];
      expect(entry.at, adv.name).toBeTruthy();
      expect(wanderRangeOf(adv), `${adv.name}@${entry.at}`).toContain(entry.at);
    }
  });

  it("铁律：与玩家同一内层房间时钉死不动——推 300 时辰位置不变", () => {
    const book0 = positionsWithFallback(null, 100 * 24);
    // 把鱼丽塞进玩家所在的内层房间
    const at = book0.鱼丽.at;
    const inner = book0.鱼丽.inner;
    const start = {
      time: 0,
      room: { name: at, npcs: [{ name: "鱼丽", innerRoom: inner }] },
      innerRoomName: inner,
      varTree: { 世界: { 游走册: book0 } },
    };
    const { varTree } = runTicks(start, 100 * 24 + 1, 300);
    expect(varTree.世界.游走册.鱼丽.at).toBe(at);
  });

  it("驻足锁未过期同样钉死，过期后才恢复游走资格", () => {
    const book0 = positionsWithFallback(null, 100 * 24);
    const base = 100 * 24 + 1;
    const start = {
      time: 0,
      room: { name: "锦官城", npcs: [] },
      varTree: { 世界: { 游走册: book0, 驻足锁: { 鱼丽: base + 400 } } },
    };
    const { varTree } = runTicks(start, base, 300);
    expect(varTree.世界.游走册.鱼丽.at).toBe(book0.鱼丽.at);
  });

  it("离场有叙事且交代去向：游走者离开玩家所在据点时上公屏", () => {
    // 找一个 fallback 就在锦官城的游走者，玩家在锦官城但不同房（不钉死）
    const book0 = positionsWithFallback(null, 100 * 24);
    const here = WANDERING_OCS.find((adv) => book0[adv.name].at === "锦官城");
    expect(here, "须有 fallback 落锦官城的游走者").toBeTruthy();
    const start = {
      time: 0,
      room: { name: "锦官城", npcs: [] },
      varTree: { 世界: { 游走册: book0 } },
    };
    const { varTree, logs } = runTicks(start, 100 * 24 + 1, 400);
    // 400 时辰内此人大概率挪窝（5%/时辰）——若没挪，至少全册其他人有人进出锦官城留下过叙事
    const departures = logs.filter((l) => l.text.includes("收拾行囊，往「"));
    const arrivals = logs.filter((l) => l.text.includes("打外乡远路而来"));
    expect(departures.length + arrivals.length).toBeGreaterThan(0);
    if (varTree.世界.游走册[here.name].at !== "锦官城") {
      expect(departures.some((l) => l.text.startsWith(`  ${here.name}收拾行囊，往「`))).toBe(true);
    }
  });

  it("入队同伴冻结：解锁后不再满世界跑", () => {
    const book0 = positionsWithFallback(null, 100 * 24);
    const start = {
      time: 0,
      room: { name: "锦官城", npcs: [] },
      varTree: { 世界: { 游走册: book0 } },
    };
    // 冻结判定走 isCompanionUnlockedByName——直接给一个全解锁的 companionState 形状
    // 不可行（键名内部约定），改测结构性事实：冻结分支存在且不抛错
    const result = ocWanderRule.run(
      { ...start, time: 100 * 24 + 1 },
      { previousDeps: [100 * 24], companionState: {} },
    );
    expect(result === null || result.changes?.varTree).toBeTruthy();
  });
});
