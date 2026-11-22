import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { checkQingchengEntry } from "../../domain/rules/character/qingchengEntry.js";
import { skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { joinSect } from "../sect/logic.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";

const SHOP = "青城商坊";
const rep = (value, extra = {}) => ({ 世界: { 势力声誉: { 青城派: value }, ...extra } });
const names = (value) => factionShopOffer(SHOP, rep(value), "vault").items.map((item) => item.name);
const at = (innerRoomName, value, flags = []) => ({
  char: { money: 2000, special: { 智谋: 5 } },
  room: { name: "雅江" }, innerRoomName,
  inv: [], skills: [], flags, questProgress: {}, varTree: rep(value), time: 1,
});

describe("青城商坊 · 三清玄阁", () => {
  it("opens east of 三清殿 on the 青城商坊 pool", () => {
    const id = getBuildingIdForInnerRoom("雅江", "三清玄阁");
    expect(getBuildingsForLocation("雅江").find((building) => building.id === id))
      .toMatchObject({ name: "三清玄阁", type: "sectshop", shopKey: SHOP });
  });

  it("stocks goods by 青城派 rep tier with matching discounts", () => {
    expect(names(0)).toEqual(["青城柏香符", "三清松风铁剑", "山阴清瘴丹"]);
    expect(names(15)).toHaveLength(6);
    expect(names(40)).toEqual(expect.arrayContaining(["紫阳清心散", "听松玄铁剑"]));
    expect(names(79)).not.toContain("三清鹤羽道衣");
    expect(names(80)).toHaveLength(9);
    expect(factionShopOffer(SHOP, rep(15), "vault").coef).toBe(0.92);
    expect(factionShopOffer(SHOP, rep(80), "vault").coef).toBe(0.75);
  });

  it("sells only 柏香符 and 清瘴丹 below 0, marks them up at -20 and refuses at -60", () => {
    expect(names(-5)).toEqual(["青城柏香符", "山阴清瘴丹"]);
    expect(factionShopOffer(SHOP, rep(-5), "vault").coef).toBe(1);
    expect(names(-30)).toEqual(["青城柏香符", "山阴清瘴丹"]);
    expect(factionShopOffer(SHOP, rep(-30), "vault").coef).toBe(1.2);
    expect(factionShopOffer(SHOP, rep(-60), "vault").closed).toBeTruthy();
  });

  it("charges silver and hands over the catalog item, only inside 三清玄阁", () => {
    const bought = buyFactionShopItem(at("三清玄阁", 40), SHOP, "紫阳清心散", 1);
    const char = bought.changes.char({ money: 2000 });
    const [item] = bought.changes.inv([]);
    expect(item).toMatchObject({ name: "紫阳清心散", consumable: { dispelAll: true } });
    expect(char.money).toBe(2000 - item.buyPrice);
    expect(buyFactionShopItem(at("三清玄阁", 0), SHOP, "听松玄铁剑").changes).toBeUndefined();
    expect(buyFactionShopItem(at("三清殿", 40), SHOP, "紫阳清心散").changes).toBeUndefined();
  });
});

describe("拜入青城派", () => {
  const trial = ["qingcheng_spar_first"];

  it("needs rep 40, prestige ≥ 0, the 剑坪 trial and no other sect", () => {
    expect(checkQingchengEntry({ varTree: rep(40), flags: trial }).eligible).toBe(true);
    expect(checkQingchengEntry({ varTree: rep(39), flags: trial }).missing).toEqual(["rep"]);
    expect(checkQingchengEntry({ varTree: rep(40), flags: [] }).missing).toEqual(["trial"]);
    expect(checkQingchengEntry({ varTree: rep(40, { 威望: -1 }), flags: trial }).missing).toEqual(["prestige"]);
    expect(checkQingchengEntry({ varTree: rep(40), flags: [...trial, "雪山派弟子"] }).missing).toEqual(["single"]);
  });

  it("joins at 青城山山门: +20 rep, token and gifts, member flag", () => {
    const result = joinSect(at("青城山山门", 45, trial));
    expect(result.changes.flags(trial)).toContain("青城派弟子");
    expect(result.changes.varTree(rep(45)).世界.势力声誉.青城派).toBe(65);
    expect(result.changes.inv([]).map((item) => item.name)).toEqual(["青城玄门竹牌", "三清松风铁剑", "青城道袍"]);
    expect(joinSect(at("青城山山门", 30, trial)).changes).toBeUndefined();
    expect(joinSect({ ...at("内堂", 0, ["青城派弟子"]), room: { name: "雪山派" } }).changes).toBeUndefined();
  });

  it("opens member-only 青城 skills to disciples at rep 80", () => {
    const sword = SKILL_CATALOG.青城.find((skill) => skill.name === "一字电剑");
    const state = (value, flags) => ({ varTree: rep(value), flags });
    expect(skillUnlockStatus(state(80, []), sword).ok).toBe(false);
    expect(skillUnlockStatus(state(79, ["青城派弟子"]), sword).ok).toBe(false);
    expect(skillUnlockStatus(state(80, ["青城派弟子"]), sword).ok).toBe(true);
  });
});
