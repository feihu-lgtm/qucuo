import { describe, it, expect } from "vitest";
import { tradeWithNpc } from "./exchange.js";

const ORDER = { faction: "黑风寨", entryId: "heifeng_麻三", name: "麻三", turn: 5, note: "x" };

function tradeState({ orders = [ORDER], companionName = "麻三", stationed = false } = {}) {
  return {
    time: 20,
    room: { name: "黑风寨", npcs: [] },
    npcState: {},
    companionState: companionName ? {
      [`imported_${companionName}`]: {
        unlocked: true, active: true, label: companionName,
        data: { name: companionName },
        ...(stationed ? { stationed: { district: "天都镇" } } : {}),
      },
    } : {},
    varTree: { 世界: { 追杀令: orders }, 角色: {} },
  };
}

describe("WO-23C6 交易冷遇（deterministic 拒绝）", () => {
  it("随行叛徒被该势力追杀 → 拒绝交易不开店", () => {
    const res = tradeWithNpc(tradeState(), { name: "山寨货郎", faction: "黑风寨", carriedItems: [{ id: "c0", name: "碎银荷包", category: "accessory", quality: "绿", slot: "bag", price: 40 }] });
    expect(res.shop).toBeUndefined();
    expect(res.logs[0].text).toContain("叛门之徒");
  });
  it("叛徒留守/不在队/外势力 → 照常开店", () => {
    const npc = { name: "山寨货郎", faction: "黑风寨", carriedItems: [{ id: "c0", name: "碎银荷包", category: "accessory", quality: "绿", slot: "bag", price: 40 }] };
    expect(tradeWithNpc(tradeState({ stationed: true }), npc).shop).toBeTruthy();
    expect(tradeWithNpc(tradeState({ companionName: null }), npc).shop).toBeTruthy();
    expect(tradeWithNpc(tradeState(), { ...npc, faction: "雪山派" }).shop).toBeTruthy();
  });
});
