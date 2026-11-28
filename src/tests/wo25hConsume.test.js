// WO-25H 验收：覆写驻场增删 / 商店物价倍率浮动回落 / 11 号位局势注入
import { describe, it, expect } from "vitest";
import { buildDefaultRegistry } from "../domain/data/livingWorld/index.js";
import { getDistrictSnapshot } from "../domain/rules/livingWorld/projectWorld.js";
import { quoteBuy } from "../domain/rules/npc/npcTradeFlow.js";
import { buildLivingSituationBlock } from "../engine/act/actCall.js";

const registry = buildDefaultRegistry();

function worldState(overrides = {}) {
  return {
    time: 24 * 10,
    varTree: { 世界: { 编队册: {}, 据点局势: {}, tension: {}, 势力战力: {}, 人物动态: {}, 事件录: [], ...overrides } },
  };
}

describe("WO-25H 商店物价倍率", () => {
  it("覆写 priceMod 叠入报价，解除后回落", () => {
    const entry = { name: "铁剑", buyPrice: 100 };
    // 无物价倍率：原价
    expect(quoteBuy(entry, 0, null).price).toBe(100);
    // 封锁卡 all 1.12：价格上浮
    expect(quoteBuy(entry, 0, { all: 1.12 }).price).toBe(112);
    // 回落：mod 撤掉回原价
    expect(quoteBuy(entry, 0, {}).price).toBe(100);
    // 伤药紧俏 medicine 1.3：回血消耗品涨价、武器不吃 medicine
    const med = { name: "金疮药", buyPrice: 50, consumable: { hpRestore: 30 } };
    expect(quoteBuy(med, 0, { medicine: 1.3 }).price).toBe(65);
    expect(quoteBuy(entry, 0, { medicine: 1.3 }).price).toBe(100);
    // 吃食归 food
    const food = { name: "干粮", buyPrice: 10, consumable: { energyRestore: 20 } };
    expect(quoteBuy(food, 0, { food: 0.85 }).price).toBe(9);
  });

  it("据点快照 priceMod 钳制区间生效", () => {
    const snap = getDistrictSnapshot(worldState(), "打箭炉", registry);
    expect(snap).toBeTruthy();
    for (const v of Object.values(snap.priceMod || {})) {
      expect(v).toBeGreaterThanOrEqual(0.8);
      expect(v).toBeLessThanOrEqual(1.4);
    }
  });
});

describe("WO-25H 11 号位局势注入", () => {
  it("无活跃局势零注入", () => {
    const out = buildLivingSituationBlock({ time: 10, varTree: { 世界: {} }, room: { name: "鱼定村" } });
    expect(out).toBe("");
  });

  it("活跃局势注入局势块且不超过 3 行", () => {
    const vt = {
      世界: {
        据点局势: { 打箭炉: [{ id: "sit_herb_shortage", untilDay: 999 }] },
        事件录: [], 编队册: {}, tension: {}, 势力战力: {}, 人物动态: {},
      },
    };
    const out = buildLivingSituationBlock({ time: 10, varTree: vt, room: { name: "打箭炉" } });
    expect(out).toContain("【此地局势与风声】");
    expect(out).toContain("紧俏");
    expect(out.split("\n").length - 1).toBeLessThanOrEqual(3);
  });
});

// ── 覆写驻场增删 + 编队代表上线（residentNpcRule 集成）────────────────────
import { residentNpcRule } from "../domain/rules/npc/rules.js";

const fakeImported = {
  getImportedResidentNames: () => [],
  getImportedRevision: () => 0,
  listImportedForDistrict: () => [],
  getImportedForDistrict: () => [],
};

function runResidents(district, worldLedger, registry) {
  const state = {
    room: { name: district, npcs: [] },
    time: 240,
    questProgress: {},
    flags: [],
    char: { special: { 气运: 5 } },
    varTree: { 世界: { 编队册: {}, 据点局势: {}, tension: {}, 势力战力: {}, 人物动态: {}, 事件录: [], 驻足锁: {}, 游走册: {}, 宿敌谱: {}, ...worldLedger } },
  };
  const result = residentNpcRule.run(state, {
    importedRegistry: fakeImported,
    roomMap: {},
    companionState: {},
    livingWorldRegistry: registry,
  });
  if (!result?.changes?.room) return [];
  const next = result.changes.room(state.room);
  return next.npcs || [];
}

describe("WO-25H 覆写驻场与编队上线", () => {
  it("黑风寨太平时日巴桑在驻场名单", () => {
    const npcs = runResidents("黑风寨", {}, registry);
    expect(npcs.some((n) => n.id === "resident_basang" || n.name === "巴桑")).toBe(true);
  });

  it("巴桑死后覆写生效——黑风寨驻场剔除巴桑", () => {
    const npcs = runResidents("黑风寨", { 人物动态: { resident_basang: { status: "dead" } } }, registry);
    expect(npcs.some((n) => n.id === "resident_basang")).toBe(false);
  });

  it("离线编队经过据点——首位成员实体化上线带 squadId 账", () => {
    const npcs = runResidents("打箭炉", { 编队册: { sq_chama_caravan: { active: true, node: "打箭炉" } } }, registry);
    const rep = npcs.find((n) => n.squadId === "sq_chama_caravan");
    expect(rep).toBeTruthy();
    expect(rep.squadName).toBeTruthy();
  });

  it("编队不在本据点零注入", () => {
    const npcs = runResidents("打箭炉", { 编队册: { sq_chama_caravan: { active: true, node: "雅江" } } }, registry);
    expect(npcs.some((n) => n.squadId === "sq_chama_caravan")).toBe(false);
  });
});
