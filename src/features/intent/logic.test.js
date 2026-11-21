import { describe, expect, it, vi } from "vitest";
import { stepEffect } from "./logic.js";

vi.mock("../npc/anger.js", () => ({
  appeaseAngryNpc: vi.fn(() => ({
    settle: "向才旦赔罪求和",
    settleOptions: { settleNpc: "才旦", settleKind: "appease" },
  })),
}));

const sword = { id: "w1", name: "铁剑", category: "武器", equipped: true };
const state = {
  room: { name: "测试镇", npcs: [{ name: "才旦" }], items: [{ name: "枯枝" }] },
  varTree: { 角色: { 才旦: { 生气状态: { active: true } } } },
  inv: [sword, "青稞酒"],
};

describe("stepEffect 装备/卸下", () => {
  it("按原话定方向：卸下已穿的脱下，装备已穿的原样保留", () => {
    const off = stepEffect(state, { kind: "装备/卸下", item: "铁剑", text: "把铁剑卸下来" });
    expect(off.changes.inv(state.inv).find((i) => i.id === "w1").equipped).toBe(false);
    const on = stepEffect(state, { kind: "装备/卸下", item: "铁剑", text: "穿戴铁剑" });
    expect(on.changes.inv(state.inv).find((i) => i.id === "w1").equipped).toBe(true);
  });
});

describe("stepEffect 平息/道歉", () => {
  it("把玩家原话带进 settleOptions.attempt 供裁决段看", () => {
    const result = stepEffect(state, { kind: "平息/道歉", target: "才旦", text: "跟才旦赔罪说是我错怪他了" });
    expect(result.settleOptions).toMatchObject({ settleKind: "appease", attempt: "跟才旦赔罪说是我错怪他了" });
  });
});
