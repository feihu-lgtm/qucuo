import { describe, expect, it } from "vitest";
import { createLivingWorldRegistry, registerWorldPack } from "./worldRegistry.js";
import { getDistrictSnapshot, getWorldOverview, getKnownEventsForDistrict, getNpcRecentEvents } from "./projectWorld.js";

const mkRegistry = () => {
  const registry = createLivingWorldRegistry();
  registerWorldPack(registry, {
    id: "p",
    worldStates: [
      { id: "ws_on", label: "黑风寨元气大伤", when: { type: "flag", flag: "f" } },
      { id: "ws_off", label: "未激活态", when: { type: "flag", flag: "zzz" } },
    ],
    districtOverrides: [
      { id: "ovr_yq", district: "玉泉寨", when: ["ws_on"], priority: 10, patch: { ownerFaction: "玉泉寨", priceMod: { all: 0.92 } } },
    ],
    situations: [
      { id: "sit_herb", label: "伤药紧俏", durationDays: 3, priceMod: { medicine: 1.3 }, promptHint: "伤药紧俏中" },
    ],
    roamingSquads: [
      { id: "sq_a", name: "康巴茶马帮", faction: "鱼定村", role: "caravan", route: ["打箭炉", "鱼定村"], members: ["pool_zhang_shang"] },
    ],
  });
  return registry;
};

const mkState = (world = {}) => ({ time: 0, varTree: { 世界: { 旗号: { f: true }, ...world } } });

describe("WO-25F projectWorld", () => {
  it("getDistrictSnapshot：覆写/局势卡/物价钳制/在场编队/已传事件", () => {
    const registry = mkRegistry();
    const state = mkState({
      据点局势: { 玉泉寨: [{ id: "sit_herb", sinceDay: 0, expireDay: 3 }] },
      编队册: { sq_a: { node: "玉泉寨", routeIndex: 0, dir: 1, active: true }, sq_off: { node: "玉泉寨", active: false } },
      事件录: [
        { id: "ev1", turn: 5, kind: "编队冲突", text: "康巴茶马帮遇袭", district: "玉泉寨", knownDistricts: ["玉泉寨"] },
        { id: "ev2", turn: 4, kind: "编队冲突", text: "远方的事", district: "锦官城", knownDistricts: ["锦官城"] },
      ],
    });
    const snap = getDistrictSnapshot(state, "玉泉寨", registry);
    expect(snap.override?.overrideId).toBe("ovr_yq");
    expect(snap.situations[0].label).toBe("伤药紧俏");
    expect(snap.priceMod.medicine).toBeCloseTo(1.3 * 0.92, 2); // 叠乘后仍在钳制区间内
    expect(snap.priceMod.all).toBeCloseTo(0.92, 2);
    expect(snap.squads).toHaveLength(1);
    expect(snap.squads[0].name).toBe("康巴茶马帮");
    expect(snap.events.map((e) => e.id)).toEqual(["ev1"]); // ev2 未传到玉泉寨
  });

  it("物价钳制 [0.80, 1.40]：极端叠乘不越界", () => {
    const registry = createLivingWorldRegistry();
    registerWorldPack(registry, {
      id: "p2",
      worldStates: [{ id: "ws", label: "x", when: { type: "flag", flag: "f" } }],
      districtOverrides: [{ id: "ovr", district: "玉泉寨", when: ["ws"], patch: { priceMod: { medicine: 1.9 } } }],
      situations: [{ id: "sit", label: "x", durationDays: 2, priceMod: { medicine: 1.9 } }],
    });
    const state = mkState({ 据点局势: { 玉泉寨: [{ id: "sit", sinceDay: 0, expireDay: 2 }] } });
    const snap = getDistrictSnapshot(state, "玉泉寨", registry);
    expect(snap.priceMod.medicine).toBe(1.40); // 1.9×1.9=3.61 钳到 1.40
  });

  it("getWorldOverview：激活态/局势/编队坐标/偏离基线张力对子", () => {
    const registry = mkRegistry();
    const state = mkState({
      tension: { "鱼定土司府|黑风寨": 80 }, // 基线 60 → 偏离 +20
      据点局势: { 打箭炉: [{ id: "sit_herb", sinceDay: 0, expireDay: 3 }] },
      编队册: { sq_a: { node: "打箭炉", active: true } },
      事件录: [{ id: "ev1", turn: 1 }],
    });
    const ov = getWorldOverview(state, registry);
    expect(ov.states.map((s) => s.id)).toEqual(["ws_on"]); // 未激活的不报
    expect(ov.situations[0]).toMatchObject({ district: "打箭炉", label: "伤药紧俏" });
    expect(ov.squads[0]).toMatchObject({ node: "打箭炉", name: "康巴茶马帮" });
    expect(ov.tensionPairs).toHaveLength(1);
    expect(ov.tensionPairs[0]).toMatchObject({ pair: "鱼定土司府|黑风寨", base: 60, current: 80, delta: 20 });
    expect(ov.eventCount).toBe(1);
  });

  it("getNpcRecentEvents：按人名文本匹配降级", () => {
    const state = mkState({
      事件录: [
        { id: "ev1", turn: 5, text: "康巴茶马帮在鱼定村遇袭", knownDistricts: [] },
        { id: "ev2", turn: 3, text: "不相干的事", knownDistricts: [], npcs: ["巴桑"] },
      ],
    });
    expect(getNpcRecentEvents(state, "康巴茶马帮").map((e) => e.id)).toEqual(["ev1"]);
    expect(getNpcRecentEvents(state, "巴桑").map((e) => e.id)).toEqual(["ev2"]);
    expect(getNpcRecentEvents(state, "不存在的人")).toHaveLength(0);
  });

  it("旧存档安全降级：无 事件录/据点局势/编队册 字段零报错", () => {
    const registry = mkRegistry();
    const legacy = { time: 0, varTree: { 世界: {} } };
    expect(() => getWorldOverview(legacy, registry)).not.toThrow();
    expect(() => getDistrictSnapshot(legacy, "玉泉寨", registry)).not.toThrow();
    expect(getKnownEventsForDistrict(legacy, "玉泉寨")).toEqual([]);
    expect(getNpcRecentEvents(legacy, "任何人")).toEqual([]);
    const ov = getWorldOverview(legacy, registry);
    expect(ov.squads).toEqual([]);
    expect(ov.situations).toEqual([]);
    // varTree 整个缺失也不炸
    expect(() => getWorldOverview({}, registry)).not.toThrow();
  });
});
