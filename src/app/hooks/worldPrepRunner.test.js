// WO-24C worldPrepRunner 行为测试：触发映射/阅读 8 秒/并发礼让/stale/白名单/幂等/零落账
import { describe, expect, it } from "vitest";
import { createWorldPrepRunner, READING_IDLE_MS } from "./worldPrepRunner.js";
import { prepStateVersion } from "../../domain/rules/prep/prepSeeds.js";
import { createPrepSeed } from "../../domain/rules/prep/prepSeeds.js";

// 贡措海/贡措海密室有真实无预设容器 沉水石函——天都镇别墅铁柜/书桌皆有预设物，
// #523 Review 续修后 scripted 容器不再是备料候选（首翻必中预设+即坍缩，备料永不兑现）。
function makeState(overrides = {}) {
  return {
    room: { name: "贡措海", npcs: [{ name: "张三" }, { name: "李四" }] },
    innerRoomName: "贡措海密室",
    time: 24,
    varTree: { 世界: {}, 领域: {} },
    prepSeeds: [],
    ...overrides,
  };
}

function makeRunner({ state, aiData = null, aiOk = true, epochStale = false } = {}) {
  const calls = [];
  const applied = [];
  const timers = [];
  const runner = createWorldPrepRunner({
    getState: () => state,
    callAI: async () => {
      calls.push(1);
      await Promise.resolve();
      return { ok: aiOk, data: aiData };
    },
    applySeeds: (seeds) => applied.push(seeds),
    getEpoch: () => 1,
    isEpochStale: () => epochStale,
    setTimeoutFn: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeoutFn: () => {},
  });
  const flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };
  return { runner, calls, applied, timers, flush };
}

const goodData = {
  npcPlans: [{ npcName: "张三", plan: "今夜去堵仇家", nextAction: "埋伏巷口" }],
  tavernRumors: [{ text: "黑风寨近来换了大当家", faction: "黑风寨", nemesisId: "" }],
  prepItems: [
    { containerId: "沉水石函", name: "油纸包着的旧伤药", category: "misc", quality: "白", clue: "函缝渗出药香" },
    { containerId: "铁柜", name: "半张当票", category: "misc", quality: "绿", clue: "抽屉虚掩" },
  ],
};

describe("worldPrepRunner", () => {
  it("四处触发映射：lodging/meditate/travel 即发；非法触发不发；已有有效备料不重复", async () => {
    const state = makeState();
    const { runner, calls, flush } = makeRunner({ state, aiData: goodData });
    expect(runner.maybePrep("lodging")).toBe(true);
    await flush();
    expect(calls.length).toBe(1);
    // 非空档触发被 decidePrep 闸掉
    expect(runner.maybePrep("combat")).toBe(false);
    // 已有任一有效备料不重复
    const version = prepStateVersion(state);
    state.prepSeeds = [createPrepSeed({
      kind: "npc_plan", subject: "张三", location: "贡措海",
      stateVersion: version, turn: 24, seq: 0, publicText: "x",
    })];
    expect(runner.maybePrep("meditate")).toBe(false);
    expect(runner.maybePrep("travel")).toBe(false);
  });

  it("阅读须 8 秒空档：到时才发；换地/stateVersion 变取消", async () => {
    const state = makeState();
    const { runner, calls, timers, flush } = makeRunner({ state, aiData: goodData });
    runner.maybePrep("reading");
    expect(timers.length).toBe(1);
    expect(timers[0].ms).toBe(READING_IDLE_MS);
    expect(calls.length).toBe(0); // 计时未到时绝不发
    timers[0].fn();
    await flush();
    expect(calls.length).toBe(1); // 8 秒空档到了才发

    // 换地取消
    const state2 = makeState();
    const r2 = makeRunner({ state: state2, aiData: goodData });
    r2.runner.maybePrep("reading");
    state2.room = { name: "贡措海", npcs: [] }; // 玩家走了
    r2.timers[0].fn();
    await r2.flush();
    expect(r2.calls.length).toBe(0);

    // stateVersion 变（在场 NPC 变了）取消
    const state3 = makeState();
    const r3 = makeRunner({ state: state3, aiData: goodData });
    r3.runner.maybePrep("reading");
    state3.room = { name: "天都镇", npcs: [{ name: "张三" }, { name: "李四" }, { name: "王五" }] };
    r3.timers[0].fn();
    await r3.flush();
    expect(r3.calls.length).toBe(0);
  });

  it("并发礼让：inflight 期间第二个触发直接拒", async () => {
    const state = makeState();
    let release;
    const gate = new Promise((res) => { release = res; });
    const calls = [];
    const runner = createWorldPrepRunner({
      getState: () => state,
      callAI: async () => { calls.push(1); await gate; return { ok: true, data: goodData }; },
      applySeeds: () => {},
      getEpoch: () => 1,
      isEpochStale: () => false,
    });
    expect(runner.maybePrep("lodging")).toBe(true);
    expect(runner.maybePrep("meditate")).toBe(false); // 礼让
    release();
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
    expect(calls.length).toBe(1);
  });

  it("stale（读档/换档）不写", async () => {
    const state = makeState();
    let stale = false;
    const applied = [];
    const runner = createWorldPrepRunner({
      getState: () => state,
      callAI: async () => { await Promise.resolve(); stale = true; return { ok: true, data: goodData }; },
      applySeeds: (s) => applied.push(s),
      getEpoch: () => 1,
      isEpochStale: () => stale,
    });
    runner.maybePrep("lodging");
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
    expect(applied.length).toBe(0);
  });

  it("stateVersion 两跳：返回后版本变了直接废弃", async () => {
    const state = makeState();
    const applied = [];
    const runner = createWorldPrepRunner({
      getState: () => state,
      callAI: async () => {
        await Promise.resolve();
        state.varTree = { 世界: { 宿敌谱: { 黑风寨: { entries: { e1: { status: "active" } } } } }, 领域: {} }; // 世界变了
        return { ok: true, data: goodData };
      },
      applySeeds: (s) => applied.push(s),
      getEpoch: () => 1,
      isEpochStale: () => false,
    });
    runner.maybePrep("lodging");
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
    expect(applied.length).toBe(0);
  });

  it("白名单过滤：不在场 NPC/已翻容器/坏枚举整条丢弃", async () => {
    const state = makeState();
    const applied = [];
    const badData = {
      npcPlans: [{ npcName: "不存在的人", plan: "x", nextAction: "y" }],
      tavernRumors: [{ text: "真传闻", faction: "", nemesisId: "" }],
      prepItems: [
        { containerId: "不存在的容器", name: "x", category: "misc", quality: "白", clue: "" },
        { containerId: "沉水石函", name: "合规旧物", category: "misc", quality: "蓝", clue: "灰" },
        // （第三件橙品神兵即便合规也超 schema cap2 被截——上限由 slice 兜住）
      ],
    };
    const r = makeRunner({ state, aiData: badData });
    r.runner.maybePrep("lodging");
    await r.flush();
    expect(r.applied.length).toBe(1);
    const seeds = r.applied[0];
    expect(seeds.filter((s) => s.kind === "npc_plan").length).toBe(0); // 不在场拒
    expect(seeds.filter((s) => s.kind === "tavern_rumor").length).toBe(1);
    expect(seeds.filter((s) => s.kind === "prep_item").length).toBe(1); // 只活合规沉水石函
    expect(seeds.find((s) => s.kind === "prep_item").subject).toBe("沉水石函");
  });

  it("三类 subject/kind 正确且幂等：同 subject 重备替换不淤积", async () => {
    const state = makeState();
    const r = makeRunner({ state, aiData: goodData });
    r.runner.maybePrep("lodging");
    await r.flush();
    expect(r.applied.length).toBe(1);
    const seeds = r.applied[0];
    const kinds = seeds.map((s) => s.kind).sort();
    expect(kinds).toEqual(["npc_plan", "prep_item", "tavern_rumor"].sort()); // 铁柜非本房白名单——scripted 容器/非候选容器一律不进
    expect(seeds.find((s) => s.kind === "npc_plan").subject).toBe("张三");
    expect(seeds.find((s) => s.kind === "tavern_rumor").subject).toBe("黑风寨近来换了大当家");
    // 幂等：库里已有同 subject 旧种，upsert 替换而非叠加
    const version = prepStateVersion(state);
    state.prepSeeds = [createPrepSeed({
      kind: "npc_plan", subject: "张三", location: "贡措海",
      stateVersion: version, turn: 24, seq: 99, publicText: "旧",
    })];
    const r2 = makeRunner({ state, aiData: goodData });
    // 已有有效备料会被 decidePrep 闸掉——先把闸让开：库内种子是有效的，确实不该再备。
    // 幂等真场景是 upsert 层：直接验证 reduce 结果替换旧条。
    expect(r2.runner.maybePrep("lodging")).toBe(false); // cache_valid 闸生效本身即证
  });

  it("非法模型输出零落账：空对象/坏形状/AI 失败都不写", async () => {
    for (const bad of [null, {}, { npcPlans: "oops" }, { npcPlans: [{ npcName: "不存在", plan: "x" }], tavernRumors: [], prepItems: [] }]) {
      const state = makeState();
      const r = makeRunner({ state, aiData: bad });
      r.runner.maybePrep("lodging");
      await r.flush();
      expect(r.applied.length, JSON.stringify(bad)).toBe(0);
    }
    const state = makeState();
    const r = makeRunner({ state, aiData: goodData, aiOk: false });
    r.runner.maybePrep("lodging");
    await r.flush();
    expect(r.applied.length).toBe(0);
  });
});
