import { describe, expect, it } from "vitest";
import { deposit, pledge, redeem, withdraw, withdrawalSummary } from "./logic.js";

const item = { id: "jade", name: "玉佩", sellPrice: 100, equipped: false };
const makeState = (overrides = {}) => ({
  char: { money: 100 },
  deposit: 0,
  depositedAt: null,
  pledgedItems: [],
  inv: [item],
  time: 6,
  ...overrides,
});

describe("bank logic", () => {
  it("deposits money and records the current time", () => {
    expect(deposit(makeState(), 50)).toEqual({
      changes: { char: { money: 50 }, deposit: 50, depositedAt: 6 },
      logs: [],
      settle: "在钱庄存入50两",
    });
  });

  it("does not deposit more than the available money", () => {
    expect(deposit(makeState({ char: { money: 20 } }), 50)).toEqual({ logs: [] });
  });

  it("rejects non-finite and non-positive transaction amounts", () => {
    const invalidResult = { logs: [{ t: "err", text: "  数额无效" }] };
    const redeemable = makeState({
      char: { money: 100 },
      pledgedItems: [{ item, pledgeValue: 80 }],
    });
    expect(deposit(makeState(), -50)).toEqual(invalidResult);
    expect(deposit(makeState(), Number.NaN)).toEqual(invalidResult);
    expect(pledge(makeState(), "jade", 0)).toEqual(invalidResult);
    expect(pledge(makeState(), "jade", Number.POSITIVE_INFINITY)).toEqual(invalidResult);
    expect(redeem(redeemable, 0, -88)).toEqual(invalidResult);
    expect(redeem(redeemable, 0, "88")).toEqual(invalidResult);
  });

  it("computes the same whole-day interest shown in the bank UI", () => {
    const state = makeState({ char: { money: 50 }, deposit: 50, depositedAt: 6, time: 30 });
    expect(withdrawalSummary(state)).toEqual({ elapsed: 1, interest: 1, total: 51 });
    expect(withdraw(state)).toEqual({
      changes: { deposit: 0, depositedAt: null, char: { money: 101 } },
      logs: [],
      settle: "在钱庄取出银两51两（含利息）",
    });
  });

  it("pledges an inventory item for the requested amount", () => {
    expect(pledge(makeState(), "jade", 80)).toEqual({
      changes: {
        inv: [],
        pledgedItems: [{ item, pledgeValue: 80 }],
        char: { money: 180 },
      },
      logs: [],
      settle: "把「玉佩」质押给当铺，得80两",
    });
  });

  it("does not pledge an item that is not in inventory", () => {
    expect(pledge(makeState(), "missing", 80)).toEqual({ logs: [] });
  });

  it("redeems a pledged item and charges the requested amount", () => {
    const state = makeState({
      char: { money: 100 },
      pledgedItems: [{ item, pledgeValue: 80 }],
      inv: [],
    });
    expect(redeem(state, 0, 88)).toEqual({
      changes: {
        char: { money: 12 },
        pledgedItems: [],
        inv: [{ ...item, equipped: false }],
      },
      logs: [],
      settle: "从当铺赎回「玉佩」，花费88两",
    });
  });

  it("refuses redemption without funds or a pledged item", () => {
    expect(redeem(makeState({ char: { money: 10 }, pledgedItems: [{ item, pledgeValue: 80 }] }), 0, 88))
      .toEqual({ logs: [] });
    expect(redeem(makeState(), 0, 88)).toEqual({ logs: [] });
  });
});
