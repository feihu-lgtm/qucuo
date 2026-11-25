import { describe, expect, it } from "vitest";
import {
  PREP_SEED_KINDS, prepStateVersion, isPrepSeedValid,
  createPrepSeed, upsertPrepSeeds, validPrepSeeds,
} from "./prepSeeds.js";
import { decidePrep, PREP_TRIGGERS } from "../../../engine/turn/prepScheduler.js";

function mkState(overrides = {}) {
  return {
    room: { name: "曲措客栈", npcs: [{ id: "a", name: "掌柜" }, { id: "b", name: "伙计" }] },
    innerRoomName: null,
    time: 48, // day 2
    varTree: { 世界: { 宿敌谱: { 黑风寨: { entries: { e1: { status: "active" } } } }, 容器: { chest1: {} } } },
    ...overrides,
  };
}

function mkSeed(state, overrides = {}) {
  return createPrepSeed({
    kind: "npc_plan", turn: state.time, location: state.room.name,
    stateVersion: prepStateVersion(state), subject: "掌柜", seq: 1,
    payload: { note: "掌柜夜里盘账" }, ...overrides,
  });
}

describe("prepStateVersion", () => {
  it("同状态 hash 稳定", () => {
    expect(prepStateVersion(mkState())).toBe(prepStateVersion(mkState()));
    expect(prepStateVersion(mkState())).toMatch(/^[0-9a-f]{8}$/);
  });
  it("换地点即变", () => {
    const a = prepStateVersion(mkState());
    const b = prepStateVersion(mkState({ room: { name: "雪山派", npcs: [{ id: "a" }] } }));
    expect(a).not.toBe(b);
  });
  it("跨日即变", () => {
    expect(prepStateVersion(mkState())).not.toBe(prepStateVersion(mkState({ time: 72 })));
  });
  it("在场 NPC 换人即变、顺序无关", () => {
    const base = mkState();
    const swapped = mkState({ room: { name: "曲措客栈", npcs: [{ id: "b", name: "伙计" }, { id: "a", name: "掌柜" }] } });
    expect(prepStateVersion(base)).toBe(prepStateVersion(swapped));
    const changed = mkState({ room: { name: "曲措客栈", npcs: [{ id: "a" }] } });
    expect(prepStateVersion(base)).not.toBe(prepStateVersion(changed));
  });
  it("宿敌 active 计数变即变", () => {
    const s2 = mkState();
    s2.varTree = { 世界: { 宿敌谱: { 黑风寨: { entries: { e1: { status: "active" }, e2: { status: "active" } } } }, 容器: { chest1: {} } } };
    expect(prepStateVersion(mkState())).not.toBe(prepStateVersion(s2));
  });
  it("坏形状不炸", () => {
    expect(() => prepStateVersion({})).not.toThrow();
    expect(() => prepStateVersion(null)).not.toThrow();
    expect(() => prepStateVersion({ room: null, varTree: { 世界: null } })).not.toThrow();
  });
});

describe("容器计数两层契约（WO-24A-fix）", () => {
  const withContainers = (containers) => mkState({ varTree: { 世界: { 宿敌谱: {}, 容器: containers } } });
  it("同一 containerPlace 内任一容器 collapsed false→true 掀版本", () => {
    const before = withContainers({ 曲措客栈: { 木箱: { turn: 10 } } });
    const after = withContainers({ 曲措客栈: { 木箱: { collapsed: true, turn: 12 } } });
    expect(prepStateVersion(before)).not.toBe(prepStateVersion(after));
  });
  it("同地点第二个容器坍缩也掀版本（Review finding）", () => {
    const one = withContainers({ 曲措客栈: { 木箱: { collapsed: true, turn: 10 } } });
    const two = withContainers({ 曲措客栈: { 木箱: { collapsed: true, turn: 10 }, 暗格: { collapsed: true, turn: 11 } } });
    expect(prepStateVersion(one)).not.toBe(prepStateVersion(two));
  });
  it("同地点新增未坍缩容器键也掀版本", () => {
    const one = withContainers({ 曲措客栈: { 木箱: { collapsed: true, turn: 10 } } });
    const two = withContainers({ 曲措客栈: { 木箱: { collapsed: true, turn: 10 }, 暗格: { turn: 11 } } });
    expect(prepStateVersion(one)).not.toBe(prepStateVersion(two));
  });
  it("容器坏形状（非对象/空层）不炸", () => {
    expect(() => prepStateVersion(withContainers({ 曲措客栈: null }))).not.toThrow();
    expect(() => prepStateVersion(withContainers("bad"))).not.toThrow();
  });
});

describe("createPrepSeed/isPrepSeedValid", () => {
  it("id 复用场记板 prep_<stateVersion>_<seq> 口径", () => {
    const state = mkState();
    const seed = mkSeed(state);
    expect(seed.id).toBe(`prep_${prepStateVersion(state)}_1`);
    expect(seed.kind).toBe("npc_plan");
    expect(seed.createdAtTurn).toBe(48);
  });
  it("非法 kind 返回 null", () => {
    expect(createPrepSeed({ kind: "evil_plan", turn: 1 })).toBeNull();
  });
  it("版本一致+地点一致才有效", () => {
    const state = mkState();
    expect(isPrepSeedValid(mkSeed(state), state)).toBe(true);
  });
  it("行动换地即 invalid", () => {
    const state = mkState();
    const seed = mkSeed(state);
    const moved = mkState({ room: { name: "雪山派", npcs: [] } });
    expect(isPrepSeedValid(seed, moved)).toBe(false);
  });
  it("关键状态变即 invalid", () => {
    const state = mkState();
    const seed = mkSeed(state);
    expect(isPrepSeedValid(seed, mkState({ time: 72 }))).toBe(false);
    expect(isPrepSeedValid(seed, mkState({ innerRoomName: "后院" }))).toBe(false);
  });
  it("坏形状/错 kind 一律 invalid 不炸", () => {
    const state = mkState();
    expect(isPrepSeedValid(null, state)).toBe(false);
    expect(isPrepSeedValid({}, state)).toBe(false);
    expect(isPrepSeedValid({ kind: "evil", location: "曲措客栈", stateVersion: "x" }, state)).toBe(false);
  });
});

describe("upsertPrepSeeds", () => {
  it("同 stateVersion+kind+subject 幂等替换", () => {
    const state = mkState();
    const s1 = mkSeed(state, { payload: { note: "旧" } });
    const s2 = mkSeed(state, { payload: { note: "新" } });
    const after = upsertPrepSeeds(upsertPrepSeeds([], s1, state), s2, state);
    expect(after).toHaveLength(1);
    expect(after[0].payload.note).toBe("新");
  });
  it("不同 subject 并存", () => {
    const state = mkState();
    const a = mkSeed(state, { subject: "掌柜" });
    const b = mkSeed(state, { subject: "伙计" });
    expect(upsertPrepSeeds(upsertPrepSeeds([], a, state), b, state)).toHaveLength(2);
  });
  it("版本不符的旧种入库即作废剔除", () => {
    const state = mkState();
    const old = mkSeed(state);
    // 世界变了：旧种版本不符，入新种时旧种应被清理
    const s2state = mkState({ time: 72 });
    const fresh = mkSeed(s2state, { subject: "掌柜" });
    const after = upsertPrepSeeds([old], fresh, s2state);
    expect(after).toHaveLength(1);
    expect(after[0]).toBe(fresh);
  });
  it("不匹配当前状态的新种子拒收", () => {
    const state = mkState();
    const elsewhere = mkSeed(mkState({ room: { name: "雪山派", npcs: [] } }));
    expect(upsertPrepSeeds([], elsewhere, state)).toHaveLength(0);
  });
  it("坏输入不炸且不原地改", () => {
    const state = mkState();
    const input = [null, { bad: true }];
    const snap = JSON.parse(JSON.stringify(input));
    const out = upsertPrepSeeds(input, null, state);
    expect(Array.isArray(out)).toBe(true);
    expect(input).toEqual(snap);
  });
});

describe("validPrepSeeds", () => {
  it("只读过滤+kind 过滤", () => {
    const state = mkState();
    const a = mkSeed(state, { kind: "npc_plan", subject: "掌柜" });
    const b = mkSeed(state, { kind: "tavern_rumor", subject: "" });
    const all = validPrepSeeds([a, b], state);
    expect(all).toHaveLength(2);
    expect(validPrepSeeds([a, b], state, "tavern_rumor")).toHaveLength(1);
    expect(validPrepSeeds([a, b], mkState({ time: 96 }))).toHaveLength(0);
  });
});

describe("decidePrep 调度", () => {
  it("四种允许触发+无有效备料 → shouldPrep", () => {
    for (const trigger of PREP_TRIGGERS) {
      const d = decidePrep({ trigger, state: mkState(), seeds: [] });
      expect(d.shouldPrep).toBe(true);
      expect(d.kind).toBeTruthy();
    }
  });
  it("非允许触发不备", () => {
    for (const trigger of ["combat", "talk", "move", "", null, undefined]) {
      expect(decidePrep({ trigger, state: mkState(), seeds: [] }).shouldPrep).toBe(false);
    }
  });
  it("当前地点有有效备料不重复备", () => {
    const state = mkState();
    const seed = mkSeed(state);
    const d = decidePrep({ trigger: "lodging", state, seeds: [seed] });
    expect(d.shouldPrep).toBe(false);
    expect(d.reason).toBe("cache_valid");
  });
  it("备料失效（换地/跨日）后恢复可备", () => {
    const state = mkState();
    const staleSeed = mkSeed(state);
    const moved = mkState({ time: 96 });
    const d = decidePrep({ trigger: "meditate", state: moved, seeds: [staleSeed] });
    expect(d.shouldPrep).toBe(true);
  });
  it("无地点不备", () => {
    expect(decidePrep({ trigger: "lodging", state: {}, seeds: [] }).shouldPrep).toBe(false);
  });
  it("触发类型→备料类型映射确定", () => {
    expect(decidePrep({ trigger: "lodging", state: mkState(), seeds: [] }).kind).toBe("tavern_rumor");
    expect(decidePrep({ trigger: "meditate", state: mkState(), seeds: [] }).kind).toBe("npc_plan");
    expect(decidePrep({ trigger: "travel", state: mkState(), seeds: [] }).kind).toBe("prep_item");
  });
});
