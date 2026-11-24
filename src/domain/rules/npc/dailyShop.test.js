import { describe, it, expect } from "vitest";
import {
  dailyShopDayKey, promoForDay, genDailyStock, refreshDailyShop, isDailyShopNpc, PROMO_DISCOUNT,
} from "./dailyShop.js";

const NPC = { id: "adv_yuanduoduo", name: "元朵朵", carriedItems: [{ name: "核桃糕", slot: "bag" }] };
const STATE = (npcState = {}, npcs = [NPC]) => ({ room: { npcs }, npcState, varTree: {} });

describe("dailyShopDayKey", () => {
  it("按 UTC+8 自然日切分", () => {
    expect(dailyShopDayKey(new Date("2026-01-01T15:59:59Z"))).toBe("2026-01-01"); // 23:59 +8
    expect(dailyShopDayKey(new Date("2026-01-01T16:00:00Z"))).toBe("2026-01-02"); // 00:00 +8
    expect(dailyShopDayKey(new Date("2026-04-05T03:00:00Z"))).toBe("2026-04-05");
  });
});

describe("promoForDay", () => {
  it("节气日命中，平日为空", () => {
    expect(promoForDay("2026-04-05")?.term).toBe("清明");
    expect(promoForDay("2026-12-22")?.term).toBe("冬至");
    expect(promoForDay("2026-04-06")).toBeNull();
  });
});

describe("genDailyStock", () => {
  it("同一 dayKey 产出完全一致（seeded 可重放）", () => {
    expect(genDailyStock("2026-05-01", "k")).toEqual(genDailyStock("2026-05-01", "k"));
  });

  it("不同日货不同；垃圾为主、条目可买", () => {
    const a = genDailyStock("2026-05-01").items;
    const b = genDailyStock("2026-05-02").items;
    expect(a.map(i => i.name)).not.toEqual(b.map(i => i.name));
    for (const i of a) {
      expect(i.slot).toBe("bag");
      expect(i.sellable).toBe(true);
      expect(i.dailyShop).toBe("2026-05-01");
      expect(i.price).toBeGreaterThan(0);
      expect(i.id).toContain("2026-05-01");
    }
    expect(a.length).toBeGreaterThanOrEqual(5);
  });

  it("节气日：特供上架 + 价格折扣", () => {
    const { items, promo } = genDailyStock("2026-04-05");
    expect(promo.term).toBe("清明");
    const special = items.find((i) => i.name === "艾草青团");
    expect(special).toBeTruthy();
    expect(special.price).toBe(Math.round(15 * PROMO_DISCOUNT));
    expect(items.every((i) => i.dailyShop === "2026-04-05")).toBe(true);
  });
});

describe("refreshDailyShop", () => {
  const NOW = new Date("2026-05-10T02:00:00Z"); // +8 → 2026-05-10

  it("首刷：挂今日货、npcState 记刷新日、room 同步、有吆喝", () => {
    const r = refreshDailyShop(STATE(), NPC, NOW);
    expect(r).toBeTruthy();
    expect(r.npcState.adv_yuanduoduo.dailyShopDay).toBe("2026-05-10");
    const live = r.room.npcs[0];
    expect(live.carriedItems.some((i) => i.name === "核桃糕")).toBe(true); // 常驻货不动
    expect(live.carriedItems.filter((i) => i.dailyShop === "2026-05-10").length).toBeGreaterThanOrEqual(5);
    expect(r.logs[0].text).toContain("新货");
  });

  it("同日再开不重复刷新", () => {
    const first = refreshDailyShop(STATE(), NPC, NOW);
    const state2 = STATE(first.npcState, [first.npc]);
    expect(refreshDailyShop(state2, first.npc, NOW)).toBeNull();
  });

  it("换日剔除昨日货补今日新货；非日更 NPC 不动", () => {
    const day1 = refreshDailyShop(STATE(), NPC, NOW);
    const later = new Date("2026-05-11T02:00:00Z");
    const day2 = refreshDailyShop(STATE(day1.npcState, [day1.npc]), day1.npc, later);
    expect(day2.npc.carriedItems.every((i) => i.dailyShop !== "2026-05-10")).toBe(true);
    expect(day2.npc.carriedItems.some((i) => i.dailyShop === "2026-05-11")).toBe(true);
    expect(refreshDailyShop(STATE(), { name: "铁伯" }, NOW)).toBeNull();
  });

  it("卖掉的日更货不会因同日复刷回来", () => {
    const first = refreshDailyShop(STATE(), NPC, NOW);
    // 模拟买走一件：从 carriedItems 划掉
    const sold = first.npc.carriedItems.find((i) => i.dailyShop);
    const afterBuy = { ...first.npc, carriedItems: first.npc.carriedItems.filter((i) => i.id !== sold.id) };
    const state2 = STATE(first.npcState, [afterBuy]);
    const r = refreshDailyShop(state2, afterBuy, NOW);
    expect(r).toBeNull(); // 同日已刷过（npcState 记了 dayKey 且今日货还在摊）
    // npcState 丢了但今日货还在摊：只补记刷新日，不重复上同 id 的货
    const r2 = refreshDailyShop(STATE({}, [afterBuy]), afterBuy, NOW);
    expect(r2).toBeTruthy();
    expect(r2.npcState.adv_yuanduoduo.dailyShopDay).toBe("2026-05-10");
    expect(r2.npc.carriedItems.filter((i) => i.dailyShop).length)
      .toBe(afterBuy.carriedItems.filter((i) => i.dailyShop).length);
  });

  it("当日货被买空也不回补", () => {
    const first = refreshDailyShop(STATE(), NPC, NOW);
    const soldOut = { ...first.npc, carriedItems: first.npc.carriedItems.filter((i) => !i.dailyShop) };
    expect(refreshDailyShop(STATE(first.npcState, [soldOut]), soldOut, NOW)).toBeNull();
  });
});
