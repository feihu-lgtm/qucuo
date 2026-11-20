import { describe, expect, it } from "vitest";
import {
  appeaseAngryNpc,
  giftNpc,
  inviteCompanion,
  learnNpcSkill,
  stealFromNpc,
  talkToNpc,
  tradeWithNpc,
} from "./logic.js";

const angryState = (overrides = {}) => ({
  char: { money: 0, special: { 身法: 10 } },
  companionState: {},
  inv: [],
  room: { name: "鱼定村", npcs: [] },
  skills: [],
  time: 0,
  varTree: {
    世界: {},
    角色: { 商人: { 好感度: 10, 生气状态: { active: true, reason: "偷窃未遂", turnsLeft: 3, attempts: [] } } },
  },
  ...overrides,
});

describe("angry NPC interactions", () => {
  it.each([
    ["trade", tradeWithNpc, { name: "杂货商人" }],
    ["learn", learnNpcSkill, { name: "商人", levelCap: 2, moveset: [] }],
    ["steal", stealFromNpc, { name: "商人", carriedItems: [{ name: "刀" }] }],
    ["invite", inviteCompanion, { name: "商人", imported: true }],
  ])("%s records an appeasement attempt without performing the normal action", (kind, interact, npc) => {
    const state = angryState({
      varTree: { 世界: {}, 角色: { [npc.name]: angryState().varTree.角色.商人 } },
    });
    const result = interact(state, npc, { now: 123 });

    expect(result.settleOptions).toEqual({ settleNpc: npc.name, settleKind: "appease" });
    expect(result.settle).toContain(npc.name);
    expect(result.logs).toContainEqual({ t: "cmd", text: expect.stringContaining(npc.name) });
    expect(result.changes.varTree(state.varTree).角色[npc.name].生气状态.attempts).toContainEqual({
      kind,
      detail: kind === "steal" ? "偷窃" : "",
      time: kind === "steal" ? 123 : expect.any(Number),
    });
    expect(result.shop).toBeUndefined();
    expect(result.changes.skills).toBeUndefined();
    expect(result.changes.char).toBeUndefined();
    expect(result.changes.companionState).toBeUndefined();
    expect(result.changes.room).toBeUndefined();
    expect(result.steal).toBeUndefined();
  });

  it("exports the appeasement helper through the NPC logic module", () => {
    const result = appeaseAngryNpc(angryState(), { name: "商人" }, { kind: "trade", now: 8 });

    expect(result.settle).toBe("趁商人气头上想与他交易，借机赔罪缓和");
    expect(result.changes.varTree(angryState().varTree).角色.商人.生气状态.attempts).toEqual([
      { kind: "trade", detail: "", time: 8 },
    ]);
  });

  it("transfers an angry gift and records it as an appeasement attempt", () => {
    const item = { id: "gift-1", name: "青稞饼" };
    const state = angryState({ inv: [item] });
    const result = giftNpc(state, { name: "商人" }, item, 19);

    expect(result.changes.inv).toEqual([]);
    expect(result.settleOptions).toMatchObject({ settleNpc: "商人", settleKind: "appease" });
    expect(result.changes.varTree(state.varTree).角色.商人.生气状态.attempts).toEqual([
      { kind: "gift", detail: "青稞饼", time: 19 },
    ]);
  });

  it("records angry talk without changing its normal conversation result", () => {
    const state = angryState();
    const result = talkToNpc(state, { name: "商人" }, { now: 21 });

    expect(result.logs).toEqual([{ t: "sys", text: "  你走向商人，看样子是想说些什么。" }]);
    expect(result.settle).toBeUndefined();
    expect(result.changes.varTree(state.varTree).角色.商人.生气状态.attempts).toEqual([
      { kind: "talk", detail: "", time: 21 },
    ]);
  });

  it("keeps non-angry gift and trade behavior", () => {
    const state = angryState({ varTree: { 角色: {}, 世界: {} } });
    const gift = giftNpc({ ...state, inv: [{ name: "青稞饼" }] }, { name: "商人" }, { name: "青稞饼" }, 1);

    expect(gift.settleOptions.settleKind).toBe("gift");
    expect(tradeWithNpc(state, { name: "杂货商人" }).shop.shopName).toBe("鱼定村杂货铺");
  });
});
