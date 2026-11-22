import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { parseLocalCommand } from "../../engine/localCommands.js";
import { doClinicService } from "./factionClinic.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";
import { healAtHospital } from "./lodging.js";

const SHOP = "达磨药堂";
const rep = (value, extra = {}) => ({ 世界: { 势力声誉: { 喇嘛庙: value }, ...extra } });
const names = (value, flags) => factionShopOffer(SHOP, rep(value), "outer", flags).items.map((item) => item.name);
const at = (innerRoomName, value, flags = []) => ({
  char: { money: 5000, special: { 智谋: 5 } },
  room: { name: "喇嘛庙" }, innerRoomName,
  inv: [], skills: [], flags, questProgress: {}, varTree: rep(value), time: 1,
});
const building = (room) => getBuildingsForLocation("喇嘛庙").find((b) => b.id === getBuildingIdForInnerRoom("喇嘛庙", room));

describe("喇嘛庙 · 驻地建筑", () => {
  it("opens 护法禅院 and 山门施药棚 beside 山门", () => {
    expect(building("护法禅院")).toMatchObject({ type: "wuguan", skillSet: "喇嘛庙" });
    expect(building("山门施药棚")).toMatchObject({ type: "hospital" });
    expect(building("达摩药堂")).toMatchObject({ type: "medicine", shopKey: SHOP });
  });
});

describe("达摩药堂货池", () => {
  it("stocks the 合稿 ten goods by 喇嘛庙 rep tier", () => {
    expect(names(0)).toEqual(["高原酥油膏", "藏青稞健脾散", "藏红花活血丸", "达摩驱寒膏"]);
    expect(names(15)).toEqual(expect.arrayContaining(["药渍麻布僧袍", "青竹护法短杖"]));
    expect(names(40)).toEqual(expect.arrayContaining(["雪莲清毒丸", "老山檀香护心珠"]));
    expect(names(80)).toContain("白塔铜鎏金降魔杵");
    expect(names(99)).not.toContain("千年雪莲回天丹");
    expect(names(100)).toHaveLength(10);
    expect(factionShopOffer(SHOP, rep(40), "outer").coef).toBe(0.85);
  });

  it("keeps only the first three remedies at 120% when hostile, refuses at -60", () => {
    expect(names(-5)).toEqual(["高原酥油膏", "藏青稞健脾散", "藏红花活血丸", "达摩驱寒膏"]);
    expect(names(-30)).toEqual(["高原酥油膏", "藏青稞健脾散", "藏红花活血丸"]);
    expect(factionShopOffer(SHOP, rep(-30), "outer").coef).toBe(1.2);
    expect(factionShopOffer(SHOP, rep(-60), "outer").closed).toBeTruthy();
    expect(factionShopOffer(SHOP, rep(100), null).closed).toBeTruthy();
  });

  it("sells at most three 千年雪莲回天丹 per game", () => {
    let flags = [];
    for (let i = 0; i < 3; i++) {
      const bought = buyFactionShopItem(at("达摩药堂", 100, flags), SHOP, "千年雪莲回天丹", i);
      expect(bought.changes).toBeTruthy();
      flags = bought.changes.flags(flags);
    }
    expect(names(100, flags)).not.toContain("千年雪莲回天丹");
    expect(buyFactionShopItem(at("达摩药堂", 100, flags), SHOP, "千年雪莲回天丹").logs[0].text).toContain("限量3件");
  });

  it("buys through 买藏药 only inside 达摩药堂", () => {
    const here = parseLocalCommand("买藏药 高原酥油膏", at("达摩药堂", 0), { surface: "cli" });
    expect(here.result.changes.inv([]).map((item) => item.name)).toEqual(["高原酥油膏"]);
    const away = parseLocalCommand("买藏药 高原酥油膏", at("大殿", 0), { surface: "cli" });
    expect(away.result.changes).toBeUndefined();
  });
});

describe("山门施药棚", () => {
  const SHED = "hospital_lamamiao_yizhen";
  const shed = (value) => ({ ...at("山门施药棚", value), time: 30, char: { money: 50, hp: [10, 100] } });

  it("helping 根敦 takes two hours for 喇嘛庙 +5 and 威望 +2, once a day", () => {
    const state = shed(10);
    const result = doClinicService(state, SHED);
    expect(result.changes.time).toBe(31);
    const tree = result.changes.varTree(state.varTree);
    expect(tree.世界.势力声誉.喇嘛庙).toBe(15);
    expect(tree.世界.威望).toBe(2);
    const flags = result.changes.flags([]);
    expect(doClinicService({ ...state, flags }, SHED).changes).toBeUndefined();
  });

  it("heals free from rep 15, refuses at -20", () => {
    const heal = (value) => healAtHospital(shed(value), { cost: 30, healAmt: 90, buildingName: "山门施药棚", buildingId: SHED });
    expect(heal(15).changes.char.money).toBe(50);
    expect(heal(14).changes.char.money).toBe(20);
    expect(heal(-20).changes).toBeUndefined();
    expect(doClinicService(shed(-20), SHED).changes).toBeUndefined();
  });
});

describe("护法禅院武学", () => {
  const skill = (name) => SKILL_CATALOG.喇嘛庙.find((entry) => entry.name === name);
  const state = (value, done = []) => ({
    varTree: rep(value), flags: [],
    questProgress: Object.fromEntries(done.map((id) => [id, { status: "completed" }])),
  });

  it("opens the seven arts by 喇嘛庙 rep and main-line progress", () => {
    expect(SKILL_CATALOG.喇嘛庙).toHaveLength(7);
    expect(skillUnlockStatus(state(0), skill("转经调息")).ok).toBe(true);
    expect(skillUnlockStatus(state(14), skill("大雪金刚掌")).ok).toBe(false);
    expect(skillUnlockStatus(state(15), skill("大雪金刚掌")).ok).toBe(true);
    expect(skillUnlockStatus(state(15), skill("听钟·无畏")).ok).toBe(false);
    expect(skillUnlockStatus(state(15, ["lamamiao_2_canjuanjiuhui"]), skill("听钟·无畏")).ok).toBe(true);
    expect(skillUnlockStatus(state(40), skill("雪岭苦行步")).ok).toBe(true);
    expect(skillUnlockStatus(state(40), skill("酥油长明诀")).ok).toBe(true);
    expect(skillUnlockStatus(state(80), skill("降魔杵法")).ok).toBe(false);
    expect(skillUnlockStatus(state(80, ["lamamiao_3_xuenihongzhua"]), skill("降魔杵法")).ok).toBe(true);
    expect(skillUnlockStatus(state(99), skill("不动明王禅")).ok).toBe(false);
    expect(skillUnlockStatus(state(100), skill("不动明王禅")).ok).toBe(true);
  });
});
