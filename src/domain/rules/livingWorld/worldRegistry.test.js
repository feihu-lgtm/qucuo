import { describe, expect, it } from "vitest";
import { createLivingWorldRegistry, registerWorldPack, validateWorldPacks } from "./worldRegistry.js";

const validPack = () => ({
  id: "test_pack",
  worldStates: [
    { id: "ws_a", label: "状态甲", when: { type: "flag", flag: "f1" } },
    { id: "ws_b", label: "状态乙", when: { any: [{ type: "worldState", id: "ws_a" }, { type: "factionPowerLte", faction: "黑风寨", value: 35 }] } },
  ],
  districtOverrides: [
    { id: "ovr_x", district: "玉泉寨", when: ["ws_a", "ws_b"], priority: 10, patch: { ownerFaction: "黑风寨" } },
  ],
  situations: [
    { id: "sit_x", label: "伤药紧俏", durationDays: 3 },
  ],
  roamingSquads: [
    { id: "sq_x", name: "茶马帮", faction: "黑风寨", route: ["打箭炉", "鱼定村"], when: { not: [{ type: "worldState", id: "ws_a" }] }, onArrive: { clearSituation: "sit_x" } },
  ],
  aiPackages: [
    { id: "ai_merchant", prototype: "merchant" },
  ],
});

describe("WO-25C worldRegistry", () => {
  it("合法扩展包加载：注册后静态校验零错误", () => {
    const registry = createLivingWorldRegistry();
    registerWorldPack(registry, validPack());
    expect(registry.packs).toEqual(["test_pack"]);
    expect(registry.worldStates).toHaveLength(2);
    expect(validateWorldPacks(registry)).toEqual([]);
  });

  it("幂等注册：同一 pack id 重复注册是 no-op", () => {
    const registry = createLivingWorldRegistry();
    registerWorldPack(registry, validPack());
    registerWorldPack(registry, validPack());
    expect(registry.worldStates).toHaveLength(2);
    expect(registry.packs).toEqual(["test_pack"]);
  });

  it("重名 id 不同内容报错；同名同内容容忍", () => {
    const registry = createLivingWorldRegistry();
    registerWorldPack(registry, validPack());
    const conflict = { id: "pack2", worldStates: [{ id: "ws_a", label: "不一样的甲", when: { type: "flag", flag: "f2" } }] };
    expect(() => registerWorldPack(registry, conflict)).toThrow(/重名 id/);
    const same = { id: "pack3", worldStates: [validPack().worldStates[0]] };
    expect(() => registerWorldPack(registry, same)).not.toThrow();
  });

  it("无效据点报错", () => {
    const registry = createLivingWorldRegistry();
    const pack = validPack();
    pack.districtOverrides[0].district = "不存在的城";
    registerWorldPack(registry, pack);
    expect(validateWorldPacks(registry).some((e) => e.includes("不在 QUCUO_MAP"))).toBe(true);
  });

  it("未知势力报错", () => {
    const registry = createLivingWorldRegistry();
    const pack = validPack();
    pack.roamingSquads[0].faction = "天外飞仙门";
    registerWorldPack(registry, pack);
    expect(validateWorldPacks(registry).some((e) => e.includes("未知势力"))).toBe(true);
  });

  it("引用未声明 worldState 报错", () => {
    const registry = createLivingWorldRegistry();
    const pack = validPack();
    pack.districtOverrides[0].when = ["ws_ghost"];
    registerWorldPack(registry, pack);
    expect(validateWorldPacks(registry).some((e) => e.includes("ws_ghost"))).toBe(true);
  });

  it("worldState 循环依赖报错", () => {
    const registry = createLivingWorldRegistry();
    registerWorldPack(registry, {
      id: "cyclic",
      worldStates: [
        { id: "ws_x", label: "x", when: { type: "worldState", id: "ws_y" } },
        { id: "ws_y", label: "y", when: { type: "worldState", id: "ws_x" } },
      ],
    });
    expect(validateWorldPacks(registry).some((e) => e.includes("循环依赖"))).toBe(true);
  });

  it("situations durationDays 非正报错", () => {
    const registry = createLivingWorldRegistry();
    const pack = validPack();
    pack.situations[0].durationDays = 0;
    registerWorldPack(registry, pack);
    expect(validateWorldPacks(registry).some((e) => e.includes("durationDays"))).toBe(true);
  });

  it("roamingSquads route 断裂边报错、连通边通过", () => {
    const registry = createLivingWorldRegistry();
    const pack = validPack();
    pack.roamingSquads[0].route = ["鱼定村", "锦官城"]; // 不相邻
    registerWorldPack(registry, pack);
    expect(validateWorldPacks(registry).some((e) => e.includes("不连通"))).toBe(true);
  });

  it("未知谓词类型报错", () => {
    const registry = createLivingWorldRegistry();
    registerWorldPack(registry, {
      id: "badpred",
      worldStates: [{ id: "ws_z", label: "z", when: { type: "moonPhase", value: 1 } }],
    });
    expect(validateWorldPacks(registry).some((e) => e.includes("未知谓词"))).toBe(true);
  });
});
