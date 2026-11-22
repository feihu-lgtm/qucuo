import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { FACTION_ENTRIES, checkFactionEntry } from "../../domain/rules/character/factionEntry.js";
import { skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { joinSect } from "../sect/logic.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";

const SHOP = "锦官兵备";
const rep = (value, extra = {}) => ({ 世界: { 势力声誉: { 锦官城: value }, ...extra } });
const names = (value, flags = []) => factionShopOffer(SHOP, rep(value), "vault", flags).items.map((item) => item.name);
const at = (innerRoomName, value, flags = [], questProgress = {}) => ({
  char: { money: 2000, special: { 智谋: 5 } },
  room: { name: "锦官城" }, innerRoomName,
  inv: [], skills: [], flags, questProgress, varTree: rep(value), time: 1,
});

describe("锦官兵备 · 都事府兵备库", () => {
  it("opens at 城东营房 on the 锦官兵备 pool, 都事府 hosts the 值房 entry", () => {
    expect(getBuildingIdForInnerRoom("锦官城", "城东营房")).toBe("sectshop_guan");
    expect(getBuildingIdForInnerRoom("锦官城", "都事府")).toBe("sect_entry_guan");
    expect(getBuildingsForLocation("锦官城").map((b) => b.id)).toEqual(
      expect.arrayContaining(["sect_entry_guan", "sectshop_guan"]),
    );
  });

  it("stocks goods by 锦官城 rep tier with matching discounts", () => {
    expect(names(0)).toEqual(["锦官城官袍", "乡勇木棓", "乡勇布甲", "锦官巡街棍", "镖师护腕", "锦官文思膏", "锦官城红烧牦牛肉"]);
    expect(names(14)).toHaveLength(7);
    expect(names(15)).toContain("巡捕营制式腰刀");
    expect(names(39)).not.toContain("锦官制式软甲");
    expect(names(40)).toContain("锦官制式软甲");
    expect(names(40)).toContain("锦官续命丹");
    expect(names(79)).not.toContain("御赐銮铃");
    expect(names(80, ["锦官城当差"])).toContain("御赐銮铃");
    expect(factionShopOffer(SHOP, rep(15), "vault").coef).toBe(0.92);
    expect(factionShopOffer(SHOP, rep(80), "vault").coef).toBe(0.75);
  });

  it("sells 标兵甲 and 御赐銮铃 only to 特派巡查 members", () => {
    expect(names(100)).not.toContain("锦官坊标兵甲");
    expect(names(100)).not.toContain("御赐銮铃");
    expect(names(100, ["锦官城当差"])).toEqual(
      expect.arrayContaining(["锦官坊标兵甲", "御赐銮铃"]),
    );
  });

  it("sells the one 御赐銮铃 only once", () => {
    expect(names(100, ["锦官城当差"])).toContain("御赐銮铃");
    expect(names(100, ["锦官城当差", "shop_bought:锦官兵备:御赐銮铃"])).not.toContain("御赐銮铃");
  });

  it("marks up 白绿 goods at -20 and refuses at -60", () => {
    const offer = factionShopOffer(SHOP, rep(-30), "vault");
    expect(offer.items.every((item) => ["白", "绿"].includes(item.quality))).toBe(true);
    expect(offer.coef).toBe(1.2);
    expect(factionShopOffer(SHOP, rep(-60), "vault").closed).toBeTruthy();
  });

  it("charges silver and hands over the catalog item, only inside 城东营房", () => {
    const result = buyFactionShopItem(at("城东营房", 15), SHOP, "巡捕营制式腰刀");
    const char = result.changes.char({ money: 2000 });
    const [item] = result.changes.inv([]);
    expect(item.name).toBe("巡捕营制式腰刀");
    expect(char.money).toBe(2000 - item.buyPrice);
    expect(buyFactionShopItem(at("都事府", 15), SHOP, "巡捕营制式腰刀").changes).toBeUndefined();
  });
});

describe("投效都事府", () => {
  const trial = ["guan_cases_cleared"];
  const done = { jinguancheng_guan1_xinren: { status: "completed" } };

  it("needs rep 40, prestige ≥ 0, the five cleared cases and no other sect", () => {
    expect(checkFactionEntry(FACTION_ENTRIES.锦官城, { varTree: rep(40), flags: trial }).eligible).toBe(true);
    expect(checkFactionEntry(FACTION_ENTRIES.锦官城, { varTree: rep(39), flags: trial }).missing).toEqual(["rep"]);
    expect(checkFactionEntry(FACTION_ENTRIES.锦官城, { varTree: rep(40), flags: [] }).missing).toEqual(["trial"]);
    expect(checkFactionEntry(FACTION_ENTRIES.锦官城, { varTree: rep(40, { 威望: -1 }), flags: trial }).missing).toEqual(["prestige"]);
    expect(checkFactionEntry(FACTION_ENTRIES.锦官城, { varTree: rep(40), flags: [...trial, "青城派弟子"] }).missing).toEqual(["single"]);
    expect(checkFactionEntry(FACTION_ENTRIES.锦官城, { varTree: rep(40), flags: ["锦官城当差"] }).already).toBe(true);
  });

  it("counts the trial as passed for old saves that finished 官1 before the flag existed", () => {
    // 老存档官1已结但没有 guan_cases_cleared——按任务完成记录放行。
    expect(checkFactionEntry(FACTION_ENTRIES.锦官城, { varTree: rep(40), flags: [], questProgress: done }).eligible).toBe(true);
    expect(checkFactionEntry(FACTION_ENTRIES.锦官城, { varTree: rep(40), flags: [], questProgress: { jinguancheng_guan1_xinren: { status: "active" } } }).missing).toEqual(["trial"]);
  });

  it("joins at 都事府值房: +20 rep, 腰牌与官袍, 当差 flag", () => {
    const result = joinSect(at("都事府", 45, trial));
    expect(result.changes.flags(trial)).toContain("锦官城当差");
    expect(result.changes.varTree(rep(45)).世界.势力声誉.锦官城).toBe(65);
    expect(result.changes.inv([]).map((item) => item.name)).toEqual(["巡捕营腰牌", "锦官制式软甲", "锦官烧刀子"]);
    expect(joinSect(at("都事府", 30, trial)).changes).toBeUndefined();
  });

  it("opens 青鸢回风 to 当差 members at rep 80, outsiders at rep 100", () => {
    const sword = SKILL_CATALOG.锦官.find((m) => m.id === "kf_guan_qingyuan");
    const state = (value, flags) => ({ varTree: rep(value), flags });
    expect(skillUnlockStatus(state(80, []), sword).ok).toBe(false);
    expect(skillUnlockStatus(state(79, ["锦官城当差"]), sword).ok).toBe(false);
    expect(skillUnlockStatus(state(80, ["锦官城当差"]), sword).ok).toBe(true);
    expect(skillUnlockStatus(state(100, []), sword).ok).toBe(true);
  });

  it("treats the 特派巡查 title alone as a title, not membership", () => {
    // 官2-A 的头衔旗不经过投效门槛：只持证不当差——member 限售/顶招/入伙判定都不认它。
    const title = ["title_jinguancheng_tequai_xuncha", "guan_cases_cleared"];
    expect(names(100, title)).not.toContain("锦官坊标兵甲");
    const sword = SKILL_CATALOG.锦官.find((m) => m.id === "kf_guan_qingyuan");
    expect(skillUnlockStatus({ varTree: rep(80), flags: title }, sword).ok).toBe(false);
    const status = checkFactionEntry(FACTION_ENTRIES.锦官城, { varTree: rep(40), flags: title });
    expect(status.already).toBe(false);
    expect(status.eligible).toBe(true);
  });
});
