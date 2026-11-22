import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { getResidentNpcs } from "../../domain/data/npc/residentNpcs.js";
import { skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { getBuildingIdForInnerRoom, getResidentRoomForNpc } from "../../domain/rules/map/innerMap.js";
import { doClinicService } from "./factionClinic.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";

const SHOP = "鱼定商号";
const rep = (value) => ({ 世界: { 势力声誉: { 鱼定村: value } } });
const names = (value, flags) => factionShopOffer(SHOP, rep(value), "outer", flags).items.map((item) => item.name);
const at = (innerRoomName, value, flags = []) => ({
  char: { money: 5000, special: { 智谋: 5 } },
  room: { name: "鱼定村" }, innerRoomName,
  inv: [], skills: [], flags, questProgress: {}, varTree: rep(value), time: 1,
});
const building = (room) => getBuildingsForLocation("鱼定村").find((b) => b.id === getBuildingIdForInnerRoom("鱼定村", room));

describe("鱼定村 · 驻地", () => {
  it("opens 晒谷演武场, 西头药铺 and 鱼定商号", () => {
    expect(building("晒谷演武场")).toMatchObject({ type: "wuguan", skillSet: "鱼定" });
    expect(building("西头药铺")).toMatchObject({ type: "medicine", shopKey: "西头药铺" });
    expect(building("鱼定商号")).toMatchObject({ type: "shop", shopKey: SHOP });
  });

  it("homes the 合稿 residents in their rooms", () => {
    const names = getResidentNpcs("鱼定村").map((npc) => npc.name);
    expect(names).toEqual(expect.arrayContaining(["才旦", "泽仁", "老孙", "周铭章"]));
    expect(getResidentRoomForNpc("鱼定村", "老孙")).toBe("老孙饭馆");
    expect(getResidentRoomForNpc("鱼定村", "泽仁")).toBe("村长府");
    expect(getResidentRoomForNpc("鱼定村", "周铭章")).toBe("鱼定商号");
  });
});

describe("鱼定商号货池", () => {
  it("adds the 合稿 goods by 鱼定村 rep tier, top tier at 100", () => {
    expect(names(0)).toHaveLength(6);
    expect(names(15)).toEqual(expect.arrayContaining(["三曲炒面干粮袋", "雅江细盐包"]));
    expect(names(40)).toEqual(expect.arrayContaining(["熊山猎手短刃", "藏银避瘴符"]));
    expect(names(80)).toContain("熊山活血药膏");
    expect(names(99)).not.toContain("三曲通商路引");
    expect(names(100)).toHaveLength(12);
  });

  it("keeps only 白 goods at 120% when hostile, refuses at -60", () => {
    expect(names(-30)).toEqual(["制式长刀", "皮甲背心", "藏银手镯"]);
    expect(factionShopOffer(SHOP, rep(-30), "outer").coef).toBe(1.2);
    expect(factionShopOffer(SHOP, rep(-60), "outer").closed).toBeTruthy();
  });

  it("sells 三曲通商路引 once", () => {
    const bought = buyFactionShopItem(at("鱼定商号", 100), SHOP, "三曲通商路引");
    const flags = bought.changes.flags([]);
    expect(names(100, flags)).not.toContain("三曲通商路引");
    expect(buyFactionShopItem(at("鱼定商号", 100, flags), SHOP, "三曲通商路引").logs[0].text).toContain("只此一件");
  });
});

describe("歇马居托大娘捐粮药", () => {
  const INN = "inn_yiding";
  it("costs 20 两, grants 鱼定村 +5 and 威望 +1 once a day, refused at -20", () => {
    const state = { ...at("歇马居", 10), time: 30, char: { money: 50 } };
    const result = doClinicService(state, INN);
    const tree = result.changes.varTree(state.varTree);
    expect(tree.世界.势力声誉.鱼定村).toBe(15);
    expect(tree.世界.威望).toBe(1);
    expect(doClinicService({ ...state, flags: result.changes.flags([]) }, INN).changes).toBeUndefined();
    expect(doClinicService({ ...state, varTree: rep(-20) }, INN).changes).toBeUndefined();
  });
});

describe("晒谷演武场武学", () => {
  const skill = (name) => SKILL_CATALOG.鱼定.find((entry) => entry.name === name);
  const state = (value, done = [], flags = []) => ({
    varTree: rep(value), flags,
    questProgress: Object.fromEntries(done.map((id) => [id, { status: "completed" }])),
  });

  it("opens the seven arts by 鱼定村 rep and quests, gates ≤ 100", () => {
    expect(SKILL_CATALOG.鱼定).toHaveLength(7);
    for (const entry of SKILL_CATALOG.鱼定) expect(entry.unlock.rep).toBeLessThanOrEqual(100);
    expect(skillUnlockStatus(state(0), skill("茶马挑担棍")).ok).toBe(true);
    expect(skillUnlockStatus(state(14), skill("算盘拨珠手")).ok).toBe(false);
    expect(skillUnlockStatus(state(15), skill("界石扎根功")).ok).toBe(true);
    expect(skillUnlockStatus(state(40), skill("熊山剔骨刀")).ok).toBe(false);
    expect(skillUnlockStatus(state(40, ["yudingcun_side1_yushan_chuhuan"]), skill("踏雪寻踪步")).ok).toBe(true);
    expect(skillUnlockStatus(state(80, ["village5_laolieshu_chuanren"]), skill("熊山伏息术")).ok).toBe(false);
    expect(skillUnlockStatus(state(80, ["village5_laolieshu_chuanren"], ["flag_yuding_hunter_heir"]), skill("熊山伏息术")).ok).toBe(true);
  });
});
