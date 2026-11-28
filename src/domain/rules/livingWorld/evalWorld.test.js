import { describe, expect, it } from "vitest";
import { evalPredicate, evalWhen, evalWorldStates, resolveDistrictOverride, currentSeason } from "./evalWorld.js";
import { createLivingWorldRegistry, registerWorldPack } from "./worldRegistry.js";

const mkState = (world = {}, time = 0) => ({ varTree: { 世界: world }, time });

describe("WO-25D evalPredicate", () => {
  it("npcStatus：无记录视为 alive，hpRatio<=0 视为 dead", () => {
    expect(evalPredicate({ type: "npcStatus", npcId: "resident_basang", in: ["alive"] }, mkState())).toBe(true);
    const dead = mkState({ 人物动态: { resident_basang: { hpRatio: 0 } } });
    expect(evalPredicate({ type: "npcStatus", npcId: "resident_basang", in: ["dead"] }, dead)).toBe(true);
    const injured = mkState({ 人物动态: { resident_basang: { status: "injured", hpRatio: 0.4 } } });
    expect(evalPredicate({ type: "npcStatus", npcId: "resident_basang", in: ["dead", "injured"] }, injured)).toBe(true);
    expect(evalPredicate({ type: "npcStatus", npcId: "resident_basang", in: ["dead"] }, injured)).toBe(false);
  });

  it("factionTensionGte / factionPowerLte / factionRepGte", () => {
    const state = mkState({ tension: {}, 势力战力: { 黑风寨: 30 }, 势力声誉: { 鱼定村: 55 } });
    expect(evalPredicate({ type: "factionPowerLte", faction: "黑风寨", value: 35 }, state)).toBe(true);
    expect(evalPredicate({ type: "factionPowerLte", faction: "黑风寨", value: 20 }, state)).toBe(false);
    expect(evalPredicate({ type: "factionRepGte", faction: "鱼定村", value: 50 }, state)).toBe(true);
    expect(evalPredicate({ type: "factionPowerLte", faction: "无记录势力X", value: 99 }, mkState())).toBe(false); // 默认满血 100
  });

  it("districtOwner / flag / questDone / situationActive", () => {
    const state = mkState({
      据点归属: { 玉泉寨: "玉泉寨" },
      旗号: { 商路开通: true },
      任务册: { 主线一: { done: true } },
      据点局势: { 打箭炉: [{ id: "sit_herb_shortage" }] },
    });
    expect(evalPredicate({ type: "districtOwner", district: "玉泉寨", faction: "玉泉寨" }, state)).toBe(true);
    expect(evalPredicate({ type: "districtOwner", district: "玉泉寨", faction: "黑风寨" }, state)).toBe(false);
    expect(evalPredicate({ type: "flag", flag: "商路开通" }, state)).toBe(true);
    expect(evalPredicate({ type: "flag", flag: "不存在" }, state)).toBe(false);
    expect(evalPredicate({ type: "questDone", quest: "主线一" }, state)).toBe(true);
    expect(evalPredicate({ type: "situationActive", id: "sit_herb_shortage" }, state)).toBe(true);
    expect(evalPredicate({ type: "situationActive", id: "sit_herb_shortage", district: "鱼定村" }, state)).toBe(false);
  });

  it("season：每 30 天一季", () => {
    expect(currentSeason(mkState({}, 0))).toBe("春");
    expect(currentSeason(mkState({}, 30 * 24))).toBe("夏");
    expect(evalPredicate({ type: "season", in: ["春"] }, mkState({}, 0))).toBe(true);
    expect(evalPredicate({ type: "season", in: ["冬"] }, mkState({}, 0))).toBe(false);
  });
});

describe("WO-25D evalWhen 嵌套布尔", () => {
  const state = mkState({ 旗号: { a: true }, 据点归属: { 玉泉寨: "黑风寨" } });
  it("all/any/not 任意嵌套 + 字符串简写", () => {
    const when = {
      all: [
        { type: "flag", flag: "a" },
        { any: [{ type: "flag", flag: "b" }, { type: "districtOwner", district: "玉泉寨", faction: "黑风寨" }] },
        { not: [{ type: "flag", flag: "c" }] },
      ],
    };
    expect(evalWhen(when, state)).toBe(true);
    expect(evalWhen({ not: [{ type: "flag", flag: "a" }] }, state)).toBe(false);
    expect(evalWhen(["ws_x"], state, { activeStates: new Set(["ws_x"]) })).toBe(true);
    expect(evalWhen(null, state)).toBe(true);
  });
});

describe("WO-25D evalWorldStates + resolveDistrictOverride", () => {
  const registry = createLivingWorldRegistry();
  registerWorldPack(registry, {
    id: "p",
    worldStates: [
      { id: "ws_base", label: "基础", when: { type: "flag", flag: "f" } },
      { id: "ws_chain", label: "链式", when: { type: "worldState", id: "ws_base" } },
      { id: "ws_off", label: "不激活", when: { type: "flag", flag: "zzz" } },
    ],
    districtOverrides: [
      { id: "ovr_low", district: "玉泉寨", when: ["ws_base"], priority: 99, patch: { ownerFaction: "甲", descAppend: "低条件" } },
      { id: "ovr_high", district: "玉泉寨", when: ["ws_base", "ws_chain"], priority: 1, patch: { ownerFaction: "乙", descAppend: "多条件" } },
      { id: "ovr_other", district: "打箭炉", when: ["ws_base"], patch: { ownerFaction: "丙" } },
    ],
  });

  it("worldState 链式引用不动点求值", () => {
    const active = evalWorldStates(registry, mkState({ 旗号: { f: true } }));
    expect(active.has("ws_base")).toBe(true);
    expect(active.has("ws_chain")).toBe(true);
    expect(active.has("ws_off")).toBe(false);
  });

  it("Kenshi 裁决：条件数多者压过少条件高优先级者", () => {
    const active = evalWorldStates(registry, mkState({ 旗号: { f: true } }));
    const winner = resolveDistrictOverride("玉泉寨", active, registry);
    expect(winner.overrideId).toBe("ovr_high"); // 2 条件 priority 1 压过 1 条件 priority 99
    expect(winner.ownerFaction).toBe("乙");
    expect(Object.isFrozen(winner)).toBe(true);
  });

  it("否定依赖不受注册顺序影响（依赖在后注册也正确）", () => {
    const r = createLivingWorldRegistry();
    registerWorldPack(r, {
      id: "neg",
      worldStates: [
        { id: "ws_neg", label: "否定在前", when: { not: [{ type: "worldState", id: "ws_dep" }] } }, // 先注册
        { id: "ws_dep", label: "依赖在后", when: { type: "flag", flag: "f" } }, // 后注册且激活
      ],
    });
    const active = evalWorldStates(r, mkState({ 旗号: { f: true } }));
    expect(active.has("ws_dep")).toBe(true);
    expect(active.has("ws_neg")).toBe(false); // dep 激活 → 否定必须退却，不得双活
    const activeOff = evalWorldStates(r, mkState());
    expect(activeOff.has("ws_neg")).toBe(true); // dep 不激活 → 否定成立
  });

  it("questDone 读 questProgress completed 真实记账", () => {
    const state = { ...mkState(), questProgress: { 主线一: { status: "completed" } } };
    expect(evalPredicate({ type: "questDone", quest: "主线一" }, state)).toBe(true);
    const active = { ...mkState(), questProgress: { 主线一: { status: "active" } } };
    expect(evalPredicate({ type: "questDone", quest: "主线一" }, active)).toBe(false);
  });

  it("hpRatio<=0 无显式 status 只算 dead 不算 alive", () => {
    const state = mkState({ 人物动态: { npc_x: { hpRatio: 0 } } });
    expect(evalPredicate({ type: "npcStatus", npcId: "npc_x", in: ["alive"] }, state)).toBe(false);
    expect(evalPredicate({ type: "npcStatus", npcId: "npc_x", in: ["dead"] }, state)).toBe(true);
  });

  it("同条件数比 priority，再同按注册序", () => {
    const r2 = createLivingWorldRegistry();
    registerWorldPack(r2, {
      id: "p2",
      worldStates: [{ id: "ws_a", label: "a", when: { type: "flag", flag: "f" } }],
      districtOverrides: [
        { id: "ovr_first", district: "玉泉寨", when: ["ws_a"], priority: 5, patch: { ownerFaction: "先" } },
        { id: "ovr_second", district: "玉泉寨", when: ["ws_a"], priority: 5, patch: { ownerFaction: "后" } },
      ],
    });
    const active = evalWorldStates(r2, mkState({ 旗号: { f: true } }));
    expect(resolveDistrictOverride("玉泉寨", active, r2).overrideId).toBe("ovr_first"); // 注册序先者胜
  });

  it("无命中安全回落 null", () => {
    const active = evalWorldStates(registry, mkState()); // 无旗号 f，全不激活
    expect(resolveDistrictOverride("玉泉寨", active, registry)).toBe(null);
    expect(resolveDistrictOverride("不存在的据点", active, registry)).toBe(null);
  });
});
