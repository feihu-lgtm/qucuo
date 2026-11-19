import { describe, expect, it } from "vitest";
import { getRngState, setRngState, setSeed } from "../../core/rng.js";
import {
  buySkill,
  buyBook,
  cookMeal,
  gamble,
  healAtHospital,
  listenToRumor,
  orderService,
  pray,
  readBook,
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
  mapData: {
    鱼定村: { x: 0, y: 0 },
    喇嘛庙: { x: 0, y: -1 },
  },
  time: 8,
  ...overrides,
});

function withSeed(seed, run) {
  const previous = getRngState();
  setSeed(seed);
  try {
    return run();
  } finally {
    setRngState(previous);
  }
}

describe("building feature logic", () => {
  it("rests, heals, and advances 23 time units", () => {
    expect(restAtInn(state(), { cost: 10, roomType: "普通客房", buildingName: "歇马居" }).changes.time).toBe(31);
    expect(healAtHospital(state(), { cost: 10, healAmt: 50, buildingName: "医馆" }).changes.char.hp).toEqual([70, 100]);
  });

  it("refuses invalid or unaffordable inn and hospital amounts", () => {
    expect(restAtInn(state({ char: { ...state().char, money: 1 } }), { cost: 10, roomType: "普通客房" })).toEqual({ logs: [] });
    expect(restAtInn(state(), { cost: Number.POSITIVE_INFINITY, roomType: "普通客房" })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(healAtHospital(state(), { cost: -1, healAmt: 10 })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(healAtHospital(state(), { cost: 10, healAmt: Number.NaN })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(healAtHospital(state({ char: { ...state().char, money: 1 } }), { cost: 10, healAmt: 10 })).toEqual({ logs: [] });
  });

  it("learns a purchased or insight skill and refuses invalid, unaffordable, duplicate, or gated skills", () => {
    const skill = { id: "iron", name: "铁指功", type: "招式", moveType: "攻击", price: 30 };
    expect(buySkill(state(), skill).changes.char.money).toBe(70);
    expect(buySkill(state({ char: { ...state().char, 悟性: 5 } }), { ...skill, id: "insight", insight: { stat: "悟性", threshold: 5 } }).changes.skills[0].id).toBe("insight");
    expect(buySkill(state(), {})).toEqual({ logs: [] });
    expect(buySkill(state(), { ...skill, price: 0 })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(buySkill(state({ char: { ...state().char, money: 1 } }), skill)).toEqual({ logs: [] });
    expect(buySkill(state({ skills: [{ id: "iron" }] }), skill)).toEqual({ logs: [] });
    expect(buySkill(state({ char: { ...state().char, 悟性: 4 } }), { ...skill, id: "insight", insight: { stat: "悟性", threshold: 5 } })).toEqual({ logs: [] });
  });

  it("gambles with seeded randomness and refuses invalid, capped, repeated, or unaffordable bets", () => {
    const wonOrLost = withSeed(42, () => gamble(state(), { mode: "money", bet: 10, luck: 5, dayIdx: 0 }));
    expect(wonOrLost.settle).toContain("在赌坊押注10两");
    const itemResult = withSeed(42, () => gamble(state(), { mode: "item", bet: 10, luck: 5, dayIdx: 0 }, 123));
    expect(itemResult.changes.inv).toHaveLength(2);
    expect(itemResult.changes.char.money).toBe(90);
    expect(gamble(state(), { mode: "money", bet: 0 })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(gamble(state(), { mode: "money", bet: 201, maxBet: 200 })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(gamble(state({ flags: ["gambled_day_0"] }), { mode: "money", bet: 10, dayIdx: 0 })).toEqual({ logs: [] });
    expect(gamble(state({ char: { ...state().char, money: 1 } }), { mode: "money", bet: 10 })).toEqual({ logs: [] });
    expect(gamble(state(), { mode: "unknown", bet: 10 })).toEqual({ logs: [] });
  });

  it("buys a book once and refuses duplicates or lack of funds", () => {
    const book = { name: "《铁指功》", price: 30, skillEntry: { id: "iron", name: "铁指功" } };
    expect(buyBook(state(), book).changes.char.money).toBe(70);
    expect(buyBook(state({ skills: [{ id: "iron" }] }), book)).toEqual({ logs: [] });
    expect(buyBook(state({ char: { ...state().char, money: 1 } }), book)).toEqual({ logs: [] });
    expect(buyBook(state(), { ...book, price: -1 })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(buyBook(state(), { name: "免费书", topic: "闲谈" })).toEqual({ logs: [] });
  });

  it("prays for an available stat using the seeded core RNG and refuses without karma, room, or valid cost", () => {
    const result = withSeed(42, () => pray(state()));
    expect(result.changes.dao.karma).toBe(10);
    expect(Object.values(result.changes.char.special).reduce((sum, value) => sum + value, 0)).toBe(36);
    expect(pray(state(), 0)).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(pray(state({ dao: { karma: 0 } }))).toEqual({ logs: [] });
    expect(pray(state({ char: { ...state().char, special: Object.fromEntries(Object.keys(state().char.special).map((key) => [key, 10])) } }))).toEqual({ logs: [] });
  });

  it("reads a valid book and refuses incomplete book data", () => {
    expect(readBook(state(), { name: "《武学浅论》", topic: "武学基础" }).settle).toContain("武学基础");
    expect(readBook(state(), { name: "无题" })).toEqual({ logs: [] });
  });

  it("consumes available ingredients and refuses empty cooking selections", () => {
    const dish = { name: "松茸汤", hpDelta: 12, buffs: [] };
    expect(cookMeal(state(), { materials: ["熊山松茸"], dish }).changes.inv).toEqual([]);
    expect(cookMeal(state({ inv: [] }), { materials: ["熊山松茸"], dish }).changes.char.hp).toEqual([32, 100]);
    expect(cookMeal(state(), { materials: [], dish })).toEqual({ logs: [] });
    expect(cookMeal(state(), { materials: ["熊山松茸"], dish: null })).toEqual({ logs: [] });
    expect(cookMeal(state(), { materials: ["熊山松茸", "熊山松茸"], dish }).changes.char.hp).toEqual([32, 100]);
  });

  it("orders a service with buffs and karma and refuses invalid or unaffordable orders", () => {
    const item = { name: "青稞糌粑", price: 3, buff: "体魄", val: 1, duration: 30 };
    const result = orderService(state(), item, 2);
    expect(result.changes.char.money).toBe(97);
    expect(result.changes.dao.karma).toBe(22);
    expect(orderService(state({ char: { ...state().char, money: 1 } }), item)).toEqual({ logs: [] });
    expect(orderService(state(), { ...item, price: Number.NaN })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(orderService(state(), null)).toEqual({ logs: [] });
  });

  it("spends money on rumors and refuses missing rumors, invalid prices, or insufficient funds", () => {
    const result = listenToRumor(state(), "雪山有客", 10);
    expect(result.changes.char(state().char).money).toBe(90);
    expect(result.settle).toContain("雪山有客");
    expect(listenToRumor(state(), "", 10)).toEqual({ logs: [] });
    expect(listenToRumor(state(), "雪山有客", -1)).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(listenToRumor(state({ char: { ...state().char, money: 1 } }), "雪山有客", 10)).toEqual({ logs: [] });
  });

  it("travels only to a known node and charges the fare", () => {
    expect(travelByCarriage(state(), "喇嘛庙", 5).changes.char.money).toBe(95);
    expect(travelByCarriage(state(), "不存在", 5)).toEqual({ logs: [] });
    expect(travelByCarriage(state({ mapData: { 鱼定村: { x: 0, y: 0 } } }), "喇嘛庙", 5)).toEqual({ logs: [] });
    expect(travelByCarriage(state(), "喇嘛庙", -1)).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(travelByCarriage(state({ char: { ...state().char, money: 1 } }), "喇嘛庙", 5)).toEqual({ logs: [] });
  });
});
