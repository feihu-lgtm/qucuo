import { describe, it, expect } from "vitest";
import {
  buildPlacementPlan, sanitizePlacementPlan, PLANNABLE_DISTRICTS, PLAN_BATCH,
  PLAN_MAX_TOKENS,
} from "./placementPlan.js";
import { parseJsonLoose } from "./scanPrompts.js";

const NPCS = [
  { name: "孟铁匠", brief: "天都镇打铁的", levelCap: 1, entry: "在镇上开了二十年铁铺" },
  { name: "游方僧", aliases: ["苦竹和尚"], brief: "四处化缘的僧人", levelCap: 2 },
  { name: "某未来人", brief: "从别的世界来的", levelCap: 0 },
];

describe("buildPlacementPlan 请求构造", () => {
  it("据点清单里有正常据点、没有两个非常规节点", () => {
    const { system } = buildPlacementPlan(NPCS);
    expect(system).toContain("天都镇");
    expect(system).toContain("锦官城");
    expect(system).not.toContain("心灵之海");
    expect(system).not.toContain("第三新东京市");
  });

  it("三种落脚方式与硬规矩都写进了 system", () => {
    const { system } = buildPlacementPlan(NPCS);
    for (const m of ["mention", "resident", "wander"]) expect(system).toContain(m);
    expect(system).toContain("不能编造");
  });

  it("user 段带上每个人的名字与身份", () => {
    const { user } = buildPlacementPlan(NPCS);
    expect(user).toContain("孟铁匠");
    expect(user).toContain("天都镇打铁的");
    expect(user).toContain("3 人");
  });

  it("可规划据点是 16 个，批量上限为 6", () => {
    expect(PLANNABLE_DISTRICTS.length).toBe(16);
    expect(PLAN_BATCH).toBe(6);
  });
});

describe("sanitizePlacementPlan 净化", () => {
  it("清单内的驻场原样通过", () => {
    const r = sanitizePlacementPlan(
      [{ name: "孟铁匠", mode: "resident", district: "天都镇", timeSlot: [7, 19], why: "镇上开铁铺" }],
      NPCS);
    expect(r).toHaveLength(1);
    expect(r[0].index).toBe(0);
    expect(r[0].placement.mode).toBe("resident");
    expect(r[0].placement.district).toBe("天都镇");
    expect(r[0].placement.timeSlot).toEqual([7, 19]);
    expect(r[0].rejected).toBe(false);
  });

  it("编造的地名退回不落地并标记 rejected", () => {
    const r = sanitizePlacementPlan(
      [{ name: "孟铁匠", mode: "resident", district: "天都城", why: "瞎写的" }], NPCS);
    expect(r[0].placement.mode).toBe("mention");
    expect(r[0].placement.district).toBe(null);
    expect(r[0].rejected).toBe(true);
  });

  it("游走权重吸附到四档，清单外的据点被剔除", () => {
    const r = sanitizePlacementPlan(
      [{ name: "游方僧", mode: "wander", weights: { 喇嘛庙: 80, 天都镇: 30, 蓬莱仙岛: 100 } }], NPCS);
    expect(r[0].placement.mode).toBe("wander");
    expect(r[0].placement.weights).toEqual({ 喇嘛庙: 75, 天都镇: 25 });
  });

  it("权重全都非法时退回不落地", () => {
    const r = sanitizePlacementPlan(
      [{ name: "游方僧", mode: "wander", weights: { 蓬莱仙岛: 100 } }], NPCS);
    expect(r[0].placement.mode).toBe("mention");
    expect(r[0].rejected).toBe(true);
  });

  it("时辰越界被夹住，起止颠倒会调正", () => {
    const r = sanitizePlacementPlan(
      [{ name: "游方僧", mode: "wander", weights: { 喇嘛庙: 50 }, timeSlot: [22, 3] }], NPCS);
    expect(r[0].placement.timeSlot).toEqual([3, 22]);
    const r2 = sanitizePlacementPlan(
      [{ name: "游方僧", mode: "wander", weights: { 喇嘛庙: 50 }, timeSlot: [-5, 99] }], NPCS);
    expect(r2[0].placement.timeSlot).toEqual([0, 23]);
  });

  it("用别名回话也能对上人", () => {
    const r = sanitizePlacementPlan(
      [{ name: "苦竹和尚", mode: "resident", district: "喇嘛庙" }], NPCS);
    expect(r[0].index).toBe(1);
  });

  it("认不出的人名、重复条目都丢掉", () => {
    const r = sanitizePlacementPlan([
      { name: "路人甲", mode: "resident", district: "天都镇" },
      { name: "孟铁匠", mode: "resident", district: "天都镇" },
      { name: "孟铁匠", mode: "wander", weights: { 锦官城: 100 } },
    ], NPCS);
    expect(r).toHaveLength(1);
    expect(r[0].placement.mode).toBe("resident");
  });

  it("非数组输入返回空数组，不抛错", () => {
    expect(sanitizePlacementPlan(null, NPCS)).toEqual([]);
    expect(sanitizePlacementPlan({ name: "孟铁匠" }, NPCS)).toEqual([]);
    expect(sanitizePlacementPlan("坏数据", NPCS)).toEqual([]);
  });

  it("why 超长会截断", () => {
    const r = sanitizePlacementPlan(
      [{ name: "孟铁匠", mode: "resident", district: "天都镇", why: "很".repeat(200) }], NPCS);
    expect(r[0].why.length).toBeLessThanOrEqual(40);
  });

  it("mode 缺失或乱写当作不落地", () => {
    const r = sanitizePlacementPlan(
      [{ name: "某未来人", district: "天都镇", why: "跨世界" }], NPCS);
    expect(r[0].placement.mode).toBe("mention");
  });
});

// ── 截断救援 ────────────────────────────────────────────────────────────────
// 这批用例来自一个实测 bug：落脚规划的 maxTokens 原本写死 700，在带思考的模型上
// 被思考 token 吃穿，正文只吐出「```json」加一个左方括号就撞 length 上限。当时
// 三层救援全落空，报出的却是「返回的不是合法 JSON」——补救方向完全指错。
describe("parseJsonLoose 截断救援", () => {
  it("正常 JSON 与带围栏的都照常解析", () => {
    expect(parseJsonLoose('[{"a":1}]')).toEqual([{ a: 1 }]);
    expect(parseJsonLoose('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
  });

  it("只有开围栏、没有闭围栏也能解析", () => {
    expect(parseJsonLoose('```json\n[{"a":1}]')).toEqual([{ a: 1 }]);
  });

  it("数组被截断时救回已完整的条目，残缺那半个丢掉", () => {
    const v = parseJsonLoose('[{"name":"甲","mode":"mention"},{"name":"乙","mo');
    expect(v).toEqual([{ name: "甲", mode: "mention" }]);
  });

  it("嵌套对象里被截断也能定位到顶层边界", () => {
    // lastIndexOf("}") 会截到 weights 那层，必须靠括号计数才对
    const v = parseJsonLoose(
      '[{"name":"甲","weights":{"天都镇":75}},{"name":"乙","weights":{"锦官');
    expect(v).toEqual([{ name: "甲", weights: { 天都镇: 75 } }]);
  });

  it("字符串里的括号不参与计数", () => {
    const v = parseJsonLoose('[{"why":"他在{天都镇}开铺子"},{"why":"残');
    expect(v).toEqual([{ why: "他在{天都镇}开铺子" }]);
  });

  it("一个完整条目都没有时抛 TRUNCATED，不是 NOT_JSON", () => {
    // 原来只查 indexOf("{")，这种只吐出左方括号的输入会被误判成 NOT_JSON 熔断
    expect(() => parseJsonLoose("```json\n[")).toThrowError(/截断/);
    try { parseJsonLoose("```json\n["); } catch (e) { expect(e.code).toBe("TRUNCATED"); }
  });

  it("模型压根没在输出 JSON 时仍判 NOT_JSON（该熔断的还要熔断）", () => {
    try { parseJsonLoose("抱歉，我无法完成这个请求。"); }
    catch (e) { expect(e.code).toBe("NOT_JSON"); }
  });

  it("空输入抛 EMPTY", () => {
    try { parseJsonLoose("   "); } catch (e) { expect(e.code).toBe("EMPTY"); }
  });

  it("token 上限对齐 cardScan 量级，不是按正文长度给的小值", () => {
    expect(PLAN_MAX_TOKENS.single).toBeGreaterThanOrEqual(1500);
    expect(PLAN_MAX_TOKENS.batch).toBeGreaterThanOrEqual(4000);
  });
});
