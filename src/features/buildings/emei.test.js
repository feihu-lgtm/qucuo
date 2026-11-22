import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { FACTION_ENTRIES, checkFactionEntry } from "../../domain/rules/character/factionEntry.js";
import { skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { joinSect } from "../sect/logic.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";

const SHOP = "峨眉坊";
const rep = (value, extra = {}) => ({ 世界: { 势力声誉: { 峨眉派: value }, ...extra } });
const names = (value, flags) => factionShopOffer(SHOP, rep(value), "vault", flags).items.map((item) => item.name);
const at = (innerRoomName, value, flags = []) => ({
  char: { money: 3000, special: { 智谋: 5 } },
  room: { name: "锦官城" }, innerRoomName,
  inv: [], skills: [], flags, questProgress: {}, varTree: rep(value), time: 1,
});
const building = (room) => getBuildingsForLocation("锦官城").find((b) => b.id === getBuildingIdForInnerRoom("锦官城", room));

describe("峨眉剑庐 · 内院", () => {
  it("opens 听竹轩、锻簪坊、慈济佛堂 behind the 剑庐", () => {
    expect(building("听竹轩")).toMatchObject({ type: "sect_entry", sect: "峨眉派" });
    expect(building("锻簪坊")).toMatchObject({ type: "sectshop", shopKey: SHOP });
    expect(building("慈济佛堂")).toMatchObject({ type: "hospital" });
  });

  it("stocks 峨眉坊 by rep tier and refuses the hostile", () => {
    expect(names(0)).toEqual(["素铁峨眉刺", "白蜡护法枪", "青布道袍", "清心避瘴散"]);
    expect(names(15)).toHaveLength(6);
    expect(names(40)).toEqual(expect.arrayContaining(["金顶净心露", "素影银簪刺"]));
    expect(names(80)).toContain("玄清太极佩");
    expect(names(-5)).toEqual(["青布道袍", "清心避瘴散"]);
    expect(names(-30)).toEqual(["清心避瘴散"]);
    expect(factionShopOffer(SHOP, rep(-30), "vault").coef).toBe(1.2);
    expect(factionShopOffer(SHOP, rep(-60), "vault").closed).toBeTruthy();
  });

  it("sells the one 冷月拂柳剑 to disciples at rep 100", () => {
    expect(names(100)).not.toContain("冷月拂柳剑");
    expect(names(100, ["峨眉派弟子"])).toContain("冷月拂柳剑");
    const bought = buyFactionShopItem(at("锻簪坊", 100, ["峨眉派弟子"]), SHOP, "冷月拂柳剑", 1);
    expect(bought.changes.flags(["峨眉派弟子"])).toContain("shop_bought:峨眉坊:冷月拂柳剑");
  });
});

describe("拜入峨眉派", () => {
  it("needs rep 40, prestige ≥ 0 and no other sect", () => {
    const entry = FACTION_ENTRIES.峨眉派;
    expect(checkFactionEntry(entry, { varTree: rep(40), flags: [] }).eligible).toBe(true);
    expect(checkFactionEntry(entry, { varTree: rep(40), flags: ["青城派弟子"] }).missing).toEqual(["single"]);
    expect(checkFactionEntry(entry, { varTree: rep(40, { 威望: -5 }), flags: [] }).missing).toEqual(["prestige"]);
  });

  it("joins at 听竹轩 with +20 rep and the 弟子令", () => {
    const result = joinSect(at("听竹轩", 40));
    expect(result.changes.flags([])).toContain("峨眉派弟子");
    expect(result.changes.varTree(rep(40)).世界.势力声誉.峨眉派).toBe(60);
    expect(result.changes.inv([]).map((item) => item.name)).toContain("峨眉青玉弟子令");
  });
});

describe("峨眉武学按声誉解锁", () => {
  const skill = (name) => SKILL_CATALOG.峨眉.find((entry) => entry.name === name);
  const state = (value, flags = [], extra = {}) => ({ varTree: rep(value, extra), flags });

  it("follows the 合稿 tiers, member gates and prestige", () => {
    expect(skillUnlockStatus(state(0), skill("峨眉通臂拳")).ok).toBe(true);
    expect(skillUnlockStatus(state(14), skill("峨眉剑法")).ok).toBe(false);
    expect(skillUnlockStatus(state(15, [], { 威望: -1 }), skill("截手九式")).ok).toBe(false);
    expect(skillUnlockStatus(state(15), skill("截手九式")).ok).toBe(true);
    expect(skillUnlockStatus(state(60), skill("兰花拂穴手")).ok).toBe(false);
    expect(skillUnlockStatus(state(60, ["峨眉派弟子"]), skill("兰花拂穴手")).ok).toBe(true);
    expect(skillUnlockStatus(state(80, [], { 威望: 19 }), skill("佛光普照")).ok).toBe(false);
    expect(skillUnlockStatus(state(80, [], { 威望: 20 }), skill("佛光普照")).ok).toBe(true);
  });
});
