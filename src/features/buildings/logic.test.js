import { describe, expect, it, vi } from "vitest";
import {
  buyBook,
  cookMeal,
  healAtHospital,
  pray,
  restAtInn,
  travelByCarriage,
} from "./logic.js";

const state = (overrides = {}) => ({
  char: {
    money: 100,
    hp: [20, 100],
    special: { 根骨: 5, 悟性: 5, 体魄: 5, 魅力: 5, 智谋: 5, 身法: 5, 气运: 5 },
  },
  dao: { karma: 20 },
  skills: [],
  flags: [],
  inv: [{ name: "熊山松茸" }],
  room: { name: "鱼定村" },
  mapData: { 鱼定村: { x: 0, y: 0 } },
  time: 8,
  ...overrides,
});

describe("building feature logic", () => {
  it("rests, heals, and advances 23 time units", () => {
    expect(restAtInn(state(), { cost: 10, roomType: "普通房", buildingName: "歇马居" }).changes.time).toBe(31);
    expect(healAtHospital(state(), { cost: 10, healAmt: 50, buildingName: "医馆" }).changes.char.hp).toEqual([70, 100]);
  });

  it("refuses invalid or unaffordable inn and hospital amounts", () => {
    expect(restAtInn(state({ char: { ...state().char, money: 1 } }), { cost: 10, roomType: "普通房" })).toEqual({ logs: [] });
    expect(healAtHospital(state(), { cost: -1, healAmt: 10 })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(healAtHospital(state(), { cost: 10, healAmt: Number.NaN })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
  });

  it("buys a book once and refuses duplicates or lack of funds", () => {
    const book = { name: "《铁指功》", price: 30, skillEntry: { id: "iron", name: "铁指功" } };
    expect(buyBook(state(), book).changes.char.money).toBe(70);
    expect(buyBook(state({ skills: [{ id: "iron" }] }), book)).toEqual({ logs: [] });
    expect(buyBook(state({ char: { ...state().char, money: 1 } }), book)).toEqual({ logs: [] });
  });

  it("prays for an available stat and refuses without karma or room to grow", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pray(state()).changes.dao.karma).toBe(10);
    vi.restoreAllMocks();
    expect(pray(state({ dao: { karma: 0 } }))).toEqual({ logs: [] });
    expect(pray(state({ char: { ...state().char, special: Object.fromEntries(Object.keys(state().char.special).map((key) => [key, 10])) } }))).toEqual({ logs: [] });
  });

  it("cooks only when all ingredients exist", () => {
    const dish = { name: "松茸汤", hpDelta: 12, buffs: [] };
    expect(cookMeal(state(), { materials: ["熊山松茸"], dish }).changes.inv).toEqual([]);
    expect(cookMeal(state({ inv: [] }), { materials: ["熊山松茸"], dish })).toEqual({ logs: [] });
  });

  it("travels only to a known node and charges the fare", () => {
    expect(travelByCarriage(state(), "喇嘛庙", 5).changes.char.money).toBe(95);
    expect(travelByCarriage(state(), "不存在", 5)).toEqual({ logs: [] });
    expect(travelByCarriage(state(), "喇嘛庙", -1)).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
  });
});
