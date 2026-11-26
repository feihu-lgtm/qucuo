import { describe, expect, it, vi } from "vitest";
import { stepEffect, findStepNpc } from "./logic.js";

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
    const off = stepEffect(state, { kind: "装备/卸下", item: "铁剑", text: "解下铁剑" });
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

describe("stepEffect 送礼回归（三态寻址形状修）", () => {
  it("普通按名送礼仍找到原物品并离背包", () => {
    const res = stepEffect({ ...state, inv: [sword, "青稞酒"] }, { kind: "赠送", target: "才旦", item: "青稞酒", text: "把青稞酒送给才旦" });
    // 关键回归点：findInvItem 三态形状下 giftNpc 拿到的须是物品本身而非包装对象——
    // 若误传 {item,mismatch}，itemNameOf 取不到名会走 err「背包中没有这件物品」。
    expect(res.logs?.[0]?.t).not.toBe("err");
    expect(res.changes?.inv).toBeTruthy();
  });
});

describe("findStepNpc 跟随同伴回退（D6 Review）", () => {
  const state = {
    room: { name: "鱼定村", npcs: [{ name: "才旦" }] },
    innerRoomName: null,
    companionState: {
      pearl: { unlocked: true, active: false, data: { name: "珍珠" } },
      asuka: { unlocked: true, active: false, data: { name: "明日香" }, stationed: { district: "鱼定村" } },
    },
  };
  it("非出战跟随同伴也找得到，留守的找不到", () => {
    const hit = findStepNpc(state, { target: "珍珠" });
    expect(hit).toMatchObject({ name: "珍珠", companion: true });
    expect(findStepNpc(state, { target: "明日香" })).toBeNull();
    // 本地 NPC 优先，不受影响
    expect(findStepNpc(state, { target: "才旦" })).toMatchObject({ name: "才旦" });
  });
});

describe("同伴携物非交互保管（D6 Review 二轮）", () => {
  it("名册条目不暴露携物池——切磋掉落/战斗摸取/货架天然无的放矢", async () => {
    const { companionNpcEntry } = await import("../../domain/rules/companion/companion.js");
    const cs = { pearl: { unlocked: true, active: true, data: { name: "珍珠", carriedItems: [{ name: "青钢剑", id: "it_x" }] } } };
    const entry = companionNpcEntry(cs, "pearl", { party: true });
    expect(entry.carriedItems).toEqual([]);
    // 正本不受影响
    expect(cs.pearl.data.carriedItems).toHaveLength(1);
  });

  it("偷窃/交易同伴被确定性拒止", async () => {
    const { stealFromNpc } = await import("../npc/learn.js");
    const { tradeWithNpc } = await import("../npc/exchange.js");
    const npc = { name: "珍珠", companion: true, carriedItems: [] };
    const state = { varTree: { 角色: {} }, inv: [], room: { npcs: [] } };
    expect(stealFromNpc(state, npc).logs[0].text).toContain("伙伴");
    expect(tradeWithNpc(state, npc).logs[0].text).toContain("不做买卖");
  });
});
