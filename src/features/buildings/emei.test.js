import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { FACTION_ENTRIES, checkFactionEntry } from "../../domain/rules/character/factionEntry.js";
import { skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { joinSect } from "../sect/logic.js";
import { doClinicService } from "./factionClinic.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";
import { healAtHospital } from "./lodging.js";

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
    const reps = result.changes.varTree(rep(40)).世界.势力声誉;
    expect(reps).toMatchObject({ 峨眉派: 60, 天龙教: -10, 五仙教: -10 });
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

const FOTANG = "hospital_emei_fotang";

describe("慈济佛堂", () => {
  const fotang = (value, extra = {}) => ({ ...at("慈济佛堂", value), time: 50, char: { money: 100, hp: [10, 100] }, ...extra });

  it("alms: once a day, 20 两 for 峨眉 +5 and 威望 +2", () => {
    const state = fotang(10);
    const result = doClinicService(state, FOTANG);
    expect(result.changes.char.money).toBe(80);
    const tree = result.changes.varTree(state.varTree);
    expect(tree.世界.势力声誉).toMatchObject({ 峨眉派: 15, 天龙教: -3, 五仙教: -3 });
    expect(tree.世界.威望).toBe(2);
    const flags = result.changes.flags(["emei_alms_day_1"]);
    expect(flags).toEqual(["emei_alms_day_2"]);
    expect(doClinicService({ ...state, flags }, FOTANG).changes).toBeUndefined();
    expect(doClinicService({ ...state, flags, time: 72 }, FOTANG).changes).toBeTruthy();
  });

  it("treats free from rep 15 and refuses at -20", () => {
    const heal = (value) => healAtHospital(fotang(value), { cost: 30, healAmt: 90, buildingName: "慈济佛堂", buildingId: FOTANG });
    expect(heal(15).changes.char.money).toBe(100);
    expect(heal(14).changes.char.money).toBe(70);
    expect(heal(-20).changes).toBeUndefined();
  });
});

describe("青城药圃义诊", () => {
  const YAOPU = "hospital_qingcheng_yaopu";
  const yaopu = (value) => ({
    char: { money: 0, hp: [10, 100] }, room: { name: "雅江" }, innerRoomName: "药圃",
    flags: [], time: 30, varTree: { 世界: { 势力声誉: { 青城派: value }, 威望: 99 } },
  });

  it("药圃 is 玉真子's clinic; 义诊 costs two hours for 青城 +8, 威望 +3 (capped 100)", () => {
    expect(getBuildingIdForInnerRoom("雅江", "药圃")).toBe(YAOPU);
    const state = yaopu(95);
    const result = doClinicService(state, YAOPU);
    expect(result.changes.time).toBe(32);
    expect(result.changes.char).toBeUndefined();
    const tree = result.changes.varTree(state.varTree);
    expect(tree.世界.势力声誉).toMatchObject({ 青城派: 100, 天龙教: -3, 唐门: -3 });
    expect(tree.世界.威望).toBe(100);
  });

  it("refuses the hostile and charges normal fees otherwise", () => {
    expect(doClinicService(yaopu(-20), YAOPU).changes).toBeUndefined();
    const heal = healAtHospital({ ...yaopu(50), char: { money: 50, hp: [10, 100] } }, { cost: 30, healAmt: 90, buildingName: "青城药圃", buildingId: YAOPU });
    expect(heal.changes.char.money).toBe(20);
  });
});
