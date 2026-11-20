import { describe, expect, it, vi } from "vitest";
import { auctionWin } from "./logic.js";
import { AUCTION_LOT } from "../../domain/economy/auction.js";
import { applyResult } from "../run.js";
import { gameStore, initGameStore } from "../../core/gameStore.js";

describe("auction logic", () => {
  it("charges the final price, grants the lot and records the purchase before settling", () => {
    const s = { char: { money: 300 }, inv: [] };
    const result = auctionWin(s, 200);
    const calls = [];
    const act = vi.fn(() => calls.push("settle"));
    initGameStore(s);
    applyResult({ act, addLog: () => calls.push("logs"), jotNote: () => calls.push("note") }, result);
    expect(gameStore.getState().char.money).toBe(100);
    expect(gameStore.getState().inv).toEqual([result.logs[1].item]);
    expect(result.logs[1].item).toMatchObject({ name: AUCTION_LOT.name, category: AUCTION_LOT.category, quality: AUCTION_LOT.quality });
    expect(result.logs.map(l => l.t)).toEqual(["sys", "loot"]);
    expect(calls).toEqual(["logs", "note", "settle"]);
    expect(act).toHaveBeenCalledWith(result.settle, [], { settle: true, keepUndo: true });
    expect(s).toEqual({ char: { money: 300 }, inv: [] });
  });

  it("refuses insufficient funds, even if already owned", () => {
    for (const inv of [[], [AUCTION_LOT.name]]) {
      expect(auctionWin({ char: { money: 10 }, inv }, 20)).toEqual({ logs: [{ t: "sys", text: "  你付不出这笔钱，掌槌的脸色很难看。" }] });
    }
    expect(auctionWin({ char: {}, inv: [] }, 20).changes).toBeUndefined();
  });

  it.each([AUCTION_LOT.name, { name: AUCTION_LOT.name }])("silently refuses an already-owned lot", item => {
    expect(auctionWin({ char: { money: 300 }, inv: [item] }, 200)).toEqual({ logs: [] });
  });
});
