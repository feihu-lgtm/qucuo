import { describe, it, expect } from "vitest";
import { buildWorldPrepInput } from "./prepCalls.js";
import { getPromptDef } from "../registry.js";
import "./prepCalls.js";

function state(overrides = {}) {
  return {
    time: 30,
    char: { name: "小林" },
    room: { name: "天都镇", npcs: [
      // A0 口径：在场=内层房可见——fixture 显式落位一楼客厅（同 buildPresence）。
      { name: "王掌柜", brief: "杂货铺老板", innerRoom: "一楼客厅" },
      { name: "路人甲", innerRoom: "一楼客厅" },
    ] },
    innerRoomName: "一楼客厅",
    varTree: {
      世界: {
        宿敌谱: {
          黑风寨: { entries: { a: { id: "a", name: "麻三", faction: "黑风寨", tier: 2, status: "active", grudge: 2, scars: [], firstTurn: 1, lastTurn: 1 } } },
        },
        容器: {
          "天都镇/一楼客厅": { 铁柜: { collapsed: true } },
        },
      },
      领域: {
        事实: {
          f1: { id: "f1", 摘要: "昨夜村口来了生面孔", 诞生回合: 20 },
          f2: { id: "f2", 摘要: "雪山派换了个巡山的", 诞生回合: 28 },
          f3: { id: "f3", 摘要: "", 诞生回合: 29 }, // 空摘要不入
          f4: { id: "f4", 摘要: "山茶开了", 诞生回合: 30 },
        },
      },
    },
    ...overrides,
  };
}

describe("WO-24B world.prep schema 注册形状", () => {
  it("call 注册：async_background/primary/prep 键/schema 闭合", () => {
    const call = getPromptDef("call", "world.prep");
    expect(call.execution).toBe("async_background");
    expect(call.route).toBe("primary");
    expect(call.tokenLimitKey).toBe("prep");
    const schema = call.schema.schema;
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["npcPlans", "tavernRumors", "prepItems"]);
    // 字段级全 required+闭合（strict 门禁同口径）
    for (const key of ["npcPlans", "tavernRumors", "prepItems"]) {
      const item = schema.properties[key].items;
      expect(item.additionalProperties).toBe(false);
      expect(Object.keys(item.properties).sort()).toEqual([...item.required].sort());
    }
    expect(schema.properties.npcPlans.maxItems).toBe(1);
    expect(schema.properties.tavernRumors.maxItems).toBe(1);
    expect(schema.properties.prepItems.maxItems).toBe(2);
  });
  it("quality 枚举最高紫无橙金、category 对齐器物四类、无联合类型", () => {
    const item = getPromptDef("call", "world.prep").schema.schema.properties.prepItems.items;
    expect(item.properties.quality.enum).toEqual(["白", "绿", "蓝", "紫"]);
    expect(item.properties.quality.enum).not.toContain("橙");
    expect(item.properties.category.enum.sort()).toEqual(["accessory", "armor", "misc", "weapon"]);
    // 坏字段拒绝契约：additionalProperties false 即 schema 层拒额外字段
    expect(item.additionalProperties).toBe(false);
  });
  it("prompt 文案不含玩家行动预测指令——只有禁止条款", () => {
    const sys = getPromptDef("block", "world.prep.sys");
    const text = sys.text({ prep: { playerName: "小林", maxQualityHint: "紫" } });
    expect(text).toContain("不许预测");
    expect(text).not.toMatch(/玩家下一步应该|应当前往|建议玩家/);
    expect(text).toContain("备料人");
  });
});

describe("WO-24B buildWorldPrepInput 输入裁剪", () => {
  it("在场 NPC/未翻容器/宿敌/近期事实正确裁剪", () => {
    const out = buildWorldPrepInput(state());
    expect(out.place).toBe("天都镇");
    expect(out.innerRoom).toBe("一楼客厅");
    expect(out.day).toBe(2);
    expect(out.presentNpcsText).toContain("王掌柜");
    // 容器按内容表声明+collapsed+scripted：铁柜已坍缩不进；书桌虽有未翻
    // 但有预设物（scripted 首翻必中+即坍缩，备料永不兑现）——#524 起不作候选
    expect(out.unlootedContainersText).not.toContain("书桌");
    expect(out.unlootedContainersText).not.toContain("铁柜");
    // 非 scripted 未翻容器仍是候选（贡措海密室/沉水石函）
    const out2 = buildWorldPrepInput(state({ room: { name: "贡措海", npcs: [] }, innerRoomName: "贡措海密室" }));
    expect(out2.unlootedContainersText).toContain("沉水石函");
    expect(out.nemesisSummaryText).toContain("麻三");
    expect(out.recentFactsText).toContain("雪山派");
    expect(out.recentFactsText.startsWith("山茶开了")).toBe(true); // 最新在前
    expect(out.recentFactsText.split("；").length).toBeLessThanOrEqual(3); // cap 3
    expect(out.playerName).toBe("小林");
    expect(out.maxQualityHint).toBe("紫");
  });
  it("A0 串房修：玩家在商号时，村口/茶馆的人不进 world.prep 输入", () => {
    const st = state({
      room: { name: "鱼定村", npcs: [
        { name: "商号伙计", innerRoom: "鱼定商号" },
        { name: "村口闲人", innerRoom: "村口" },
        { name: "茶馆食客", innerRoom: "老孙茶馆" },
      ] },
      innerRoomName: "鱼定商号",
    });
    const out = buildWorldPrepInput(st);
    expect(out.presentNpcsText).toContain("商号伙计");
    expect(out.presentNpcsText).not.toContain("村口闲人");
    expect(out.presentNpcsText).not.toContain("茶馆食客");
  });

  it("裁剪脱敏：不传好感/账簿，npc 名字+brief 截断，容器 cap4、NPC cap5", () => {
    const st = state();
    st.room.npcs = Array.from({ length: 8 }, (_, i) => ({ name: `人${i}`, brief: "x".repeat(40), innerRoom: "一楼客厅" }));
    const out = buildWorldPrepInput(st);
    expect(out.presentNpcsText.split("、")).toHaveLength(5);
    expect(out.presentNpcsText).not.toContain("x".repeat(30)); // brief 截断 20 字
    expect(JSON.stringify(out)).not.toContain("好感");
  });
  it("坏形状不炸：无容器账/无宿敌谱/无事实/空 state", () => {
    expect(() => buildWorldPrepInput({})).not.toThrow();
    expect(() => buildWorldPrepInput(null)).not.toThrow();
    const bare = buildWorldPrepInput({ varTree: { 世界: { 容器: "oops" }, 领域: { 事实: [1, 2] } }, room: {}, innerRoomName: null });
    expect(bare.unlootedContainersText).toBe("");
    expect(bare.recentFactsText).toBe("");
  });
});
