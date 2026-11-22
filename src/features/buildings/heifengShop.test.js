import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { FACTION_ENTRIES, checkFactionEntry } from "../../domain/rules/character/factionEntry.js";
import { skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { joinSect } from "../sect/logic.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";

const SHOP = "黑风货栈";
const rep = (value, extra = {}) => ({ 世界: { 势力声誉: { 黑风寨: value }, ...extra } });
const names = (value, flags = []) => factionShopOffer(SHOP, rep(value), "vault", flags).items.map((item) => item.name);
const at = (innerRoomName, value, flags = []) => ({
  char: { money: 2000, special: { 智谋: 5 } },
  room: { name: "黑风寨" }, innerRoomName,
  inv: [], skills: [], flags, questProgress: {}, varTree: rep(value), time: 1,
});

describe("黑风货栈 · 山寨货栈", () => {
  it("opens east of 寨内公共区 on the 黑风货栈 pool", () => {
    const id = getBuildingIdForInnerRoom("黑风寨", "山寨货栈");
    expect(getBuildingsForLocation("黑风寨").find((building) => building.id === id))
      .toMatchObject({ name: "山寨货栈", type: "sectshop", shopKey: SHOP });
  });

  it("stocks goods by 黑风寨 rep tier with matching discounts", () => {
    expect(names(0)).toEqual(["苞谷酒", "风干牦牛肉", "黑风寨金疮药", "黑风寨草药包", "老阿雅婶的止咳散", "结绳护腕串", "黑风短矛"]);
    expect(names(15)).toHaveLength(13);
    expect(names(39)).not.toContain("黑风寨分发刀");
    expect(names(40)).toContain("黑风寨分发刀");
    expect(names(79)).not.toContain("犀牛皮重甲");
    expect(names(80)).toContain("犀牛皮重甲");
    expect(factionShopOffer(SHOP, rep(15), "vault").coef).toBe(0.92);
    expect(factionShopOffer(SHOP, rep(80), "vault").coef).toBe(0.75);
  });

  it("sells 牛皮重铠 and 黑风断刃 only to sworn 入伙 members at rep 40", () => {
    expect(names(40)).not.toContain("黑风寨牛皮重铠");
    expect(names(40)).not.toContain("黑风断刃");
    expect(names(40, ["黑风寨入伙"])).toEqual(expect.arrayContaining(["黑风寨牛皮重铠", "黑风断刃"]));
    const member = at("山寨货栈", 40, ["黑风寨入伙"]);
    expect(buyFactionShopItem(member, SHOP, "黑风寨牛皮重铠", 1).changes.inv([])[0])
      .toMatchObject({ name: "黑风寨牛皮重铠", quality: "紫" });
    expect(buyFactionShopItem(at("山寨货栈", 40), SHOP, "黑风寨牛皮重铠").logs[0].text).toContain("本门弟子");
  });

  it("sells the one 犀牛皮重甲 only once", () => {
    const state = at("山寨货栈", 80);
    const bought = buyFactionShopItem(state, SHOP, "犀牛皮重甲", 1);
    const flags = bought.changes.flags(state.flags);
    expect(bought.changes.inv([])[0]).toMatchObject({ name: "犀牛皮重甲", quality: "红" });
    expect(buyFactionShopItem({ ...state, flags }, SHOP, "犀牛皮重甲").changes).toBeUndefined();
  });

  it("marks up 白绿 goods at -20 and refuses at -60", () => {
    expect(names(-30)).toEqual(["苞谷酒", "风干牦牛肉", "黑风寨金疮药", "黑风寨草药包", "老阿雅婶的止咳散", "结绳护腕串", "黑风短矛"]);
    expect(factionShopOffer(SHOP, rep(-30), "vault").coef).toBe(1.2);
    expect(factionShopOffer(SHOP, rep(-60), "vault").closed).toBeTruthy();
  });

  it("charges silver and hands over the catalog item, only inside 山寨货栈", () => {
    const bought = buyFactionShopItem(at("山寨货栈", 15), SHOP, "黑风寨出征席", 1);
    const [item] = bought.changes.inv([]);
    expect(item).toMatchObject({ name: "黑风寨出征席", quality: "蓝" });
    expect(bought.changes.char({ money: 2000 }).money).toBe(2000 - item.buyPrice);
    expect(buyFactionShopItem(at("寨内公共区", 15), SHOP, "黑风寨出征席").changes).toBeUndefined();
  });
});

describe("入伙黑风寨", () => {
  const trial = ["heifeng_proven"];

  it("needs rep 40, prestige ≥ 0, the 劫药投名状 and no other sect", () => {
    expect(checkFactionEntry(FACTION_ENTRIES.黑风寨, { varTree: rep(40), flags: trial }).eligible).toBe(true);
    expect(checkFactionEntry(FACTION_ENTRIES.黑风寨, { varTree: rep(39), flags: trial }).missing).toEqual(["rep"]);
    expect(checkFactionEntry(FACTION_ENTRIES.黑风寨, { varTree: rep(40), flags: [] }).missing).toEqual(["trial"]);
    expect(checkFactionEntry(FACTION_ENTRIES.黑风寨, { varTree: rep(40, { 威望: -1 }), flags: trial }).missing).toEqual(["prestige"]);
    expect(checkFactionEntry(FACTION_ENTRIES.黑风寨, { varTree: rep(40), flags: [...trial, "青城派弟子"] }).missing).toEqual(["single"]);
  });

  it("joins at 聚义岩洞: +20 rep, token and gifts, member flag", () => {
    const result = joinSect(at("寨后岩洞", 45, trial));
    expect(result.changes.flags(trial)).toContain("黑风寨入伙");
    expect(result.changes.varTree(rep(45)).世界.势力声誉.黑风寨).toBe(65);
    expect(result.changes.inv([]).map((item) => item.name)).toEqual(["黑风令", "黑风寨分发刀", "结绳护腕串"]);
    expect(joinSect(at("寨后岩洞", 30, trial)).changes).toBeUndefined();
  });

  it("opens 黑风十三断 to sworn members at rep 80, outsiders at rep 100", () => {
    const move = SKILL_CATALOG.黑风.find((skill) => skill.name === "黑风十三断");
    const state = (value, flags) => ({ varTree: rep(value), flags });
    expect(skillUnlockStatus(state(80, []), move).ok).toBe(false);
    expect(skillUnlockStatus(state(79, ["黑风寨入伙"]), move).ok).toBe(false);
    expect(skillUnlockStatus(state(80, ["黑风寨入伙"]), move).ok).toBe(true);
    expect(skillUnlockStatus(state(100, []), move).ok).toBe(true);
  });
});
