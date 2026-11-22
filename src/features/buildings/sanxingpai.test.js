import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { makeNamedItem } from "../../domain/data/items/catalog.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { RESIDENT_NPCS } from "../../domain/data/npc/residentNpcs.js";
import { getBuildingIdForInnerRoom, getInnerRoom, isInnerExitUnlocked, isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { resolveStageRewards } from "../../domain/rules/quests/questRewards.js";
import { applyFactionRep } from "../../domain/rules/economy/factionRep.js";
import { sectSparRepGain } from "../../domain/rules/economy/sectSpar.js";
import { buildRoomNpcWithCombat } from "../../domain/rules/npc/rules.js";
import { buySkill } from "./logic.js";
import { factionShopOffer } from "./factionShop.js";
import { FACTION_ENTRIES, checkFactionEntry, factionEntryForBuilding } from "../../domain/rules/character/factionEntry.js";
import { joinSect } from "../sect/logic.js";

const SX = "三星派";
const rep = (value) => ({ 世界: { 势力声誉: { [SX]: value } } });
const state = (value = 0, overrides = {}) => ({
  char: { money: 2000, special: { 智谋: 5 } }, inv: [], skills: [], flags: [], questProgress: {},
  varTree: rep(value), room: { name: "广汉", npcs: RESIDENT_NPCS.广汉 }, innerRoomName: "祭祀坑·碎铜坪", time: 30,
  ...overrides,
});
const names = (offer) => offer.items.map((item) => item.name);
const quests = QUCUO_QUESTS.filter((quest) => quest.id.startsWith("sanxingpai_"));

describe("三星派", () => {
  it("binds the ruin buildings to their rooms and seats 樊枯 and 姜泠", () => {
    const buildings = getBuildingsForLocation("广汉");
    const at = (inner) => buildings.find((building) => building.id === getBuildingIdForInnerRoom("广汉", inner));
    expect(at("祭祀坑·碎铜坪")?.skillSet).toBe("三星");
    expect(at("祭祀坑西石室·古墟秘藏阁")).toMatchObject({ type: "sectshop", shopKey: "三星秘藏" });
    expect(at("铸铜地窖·赤炉窟")?.type).toBe("forge");
    expect(at("古蜀石刻廊")?.type).toBe("library");
    expect(at("青铜神树下")?.type).toBe("temple");
    const fanku = buildRoomNpcWithCombat(RESIDENT_NPCS.广汉.find((npc) => npc.name === "樊枯"));
    expect(isNpcVisibleInInnerRoom("广汉", "铸铜地窖·赤炉窟", fanku)).toBe(true);
    expect(isNpcVisibleInInnerRoom("广汉", "鸭子河畔", fanku)).toBe(false);
  });

  it("opens the pit after 星1 and the depths after 星2 by flag, so selling the tokens locks nothing", () => {
    const lock = (room) => getInnerRoom("广汉", room).unlockCondition;
    expect(isInnerExitUnlocked(lock("祭祀坑·碎铜坪"), { flags: [], inv: [{ name: "青铜引路牌" }] })).toBe(false);
    expect(isInnerExitUnlocked(lock("祭祀坑·碎铜坪"), { flags: ["sanxing_pit_pass"], inv: [] })).toBe(true);
    const opener = quests.find((quest) => quest.id === "sanxingpai_1_xujiejiuyue").stages.at(-1);
    expect(opener.onReach.flags).toContain("sanxing_pit_pass");
    for (const room of ["铸铜地窖·赤炉窟", "古蜀石刻廊", "青铜神树下"]) {
      expect(isInnerExitUnlocked(lock(room), { flags: [] }), room).toBe(false);
      expect(isInnerExitUnlocked(lock(room), { flags: ["sanxing_trial_passed"] }), room).toBe(true);
    }
    expect(isInnerExitUnlocked(lock("金乌暗室·归墟秘井"), { flags: [], inv: [{ name: "太阳神鸟残片" }] })).toBe(false);
    expect(isInnerExitUnlocked(lock("金乌暗室·归墟秘井"), { flags: ["quest_sxs3_return"], inv: [] })).toBe(true);
    const finale = quests.find((quest) => quest.id === "sanxingpai_2_sanmianjianzhen").stages.at(-1);
    expect(finale.completionFlag).toBe("sanxing_trial_passed");
  });

  it("lets the pit trial and the sun-bird weld play out where 姜泠 is not standing", () => {
    const trial = quests.find((quest) => quest.id === "sanxingpai_2_sanmianjianzhen");
    const opened = { flags: ["sanxing_pit_pass"], questProgress: { sanxingpai_1_xujiejiuyue: { status: "completed" } } };
    expect(getLocalQuestStage(trial, state(15, { ...opened, innerRoomName: "祭祀坑·碎铜坪" }))?.id).toBe("first");
    const sunbird = quests.find((quest) => quest.id === "sanxingpai_side_3_shenniaocanye");
    const atWeld = { questProgress: { [sunbird.id]: { status: "active", currentStageIndex: 2 } }, innerRoomName: "铸铜地窖·赤炉窟" };
    expect(getLocalQuestStage(sunbird, state(30, atWeld))?.id).toBe("weld");
  });

  it("every shop, carry and quest item resolves in the catalog", () => {
    const shopItems = names(factionShopOffer("三星秘藏", rep(100), "vault"));
    const carry = ["樊枯", "姜泠"].flatMap((who) => RESIDENT_NPCS.广汉.find((npc) => npc.name === who).carry.map((entry) => entry.name));
    const rewardNames = (JSON.stringify(quests).match(/"name":"[^"]+","fromCatalog":true/g) || [])
      .map((text) => text.slice(8, text.indexOf('","')));
    for (const name of [...shopItems, ...carry, ...rewardNames]) expect(makeNamedItem(name), name).toBeTruthy();
    expect(shopItems).toHaveLength(10);
    expect(quests).toHaveLength(6);
  });

  it("prices and gates 古墟秘藏阁 by 三星派 reputation", () => {
    expect(names(factionShopOffer("三星秘藏", rep(14), "vault"))).toEqual([]);
    const ally = factionShopOffer("三星秘藏", rep(15), "vault");
    expect(ally.coef).toBe(0.92);
    expect(names(ally)).toContain("听风柳叶铜剑");
    expect(names(ally)).not.toContain("古铜重剑");
    expect(names(factionShopOffer("三星秘藏", rep(80), "vault"))).toContain("玄麻祭天袍");
    expect(names(factionShopOffer("三星秘藏", rep(100), "vault"))).toContain("神鸟金纹剑");
    expect(factionShopOffer("三星秘藏", rep(-60), "vault").closed).toBeTruthy();
    expect(factionShopOffer("三星秘藏", rep(0), null).closed).toContain("古墟秘藏阁");
  });

  it("gates the seven 三星 techniques by reputation, quest and membership", () => {
    expect(SKILL_CATALOG.三星).toHaveLength(7);
    const skill = (name) => SKILL_CATALOG.三星.find((entry) => entry.name === name);
    const learned = (value, name, overrides) => !!buySkill(state(value, overrides), skill(name)).changes?.skills;
    expect(learned(14, "听风铜剑")).toBe(false);
    expect(learned(15, "听风铜剑")).toBe(true);
    expect(learned(15, "归墟坐忘")).toBe(false);
    expect(learned(15, "归墟坐忘", { questProgress: { sanxingpai_2_sanmianjianzhen: { status: "completed" } } })).toBe(true);
    expect(learned(40, "玄铜镇岳势")).toBe(true);
    expect(learned(40, "纵目剑法")).toBe(false);
    expect(learned(80, "纵目剑法")).toBe(true);
    expect(learned(100, "金乌破妄剑")).toBe(false);
    expect(learned(100, "金乌破妄剑", { questProgress: { sanxingpai_3_tongyinxuanji: { status: "completed" } } })).toBe(true);
  });

  it("raises 三星派 rep for the first win on the sword pit, then a little each day", () => {
    const jia = RESIDENT_NPCS.广汉.find((npc) => npc.name === "青铜面人·甲");
    const first = sectSparRepGain(state(0), jia, { outcome: "win" });
    expect(first).toMatchObject({ faction: SX, delta: 5 });
    expect(sectSparRepGain(state(0, { flags: first.flags }), jia, { outcome: "win" })).toBeNull();
    expect(sectSparRepGain(state(0, { flags: first.flags, time: 60 }), jia, { outcome: "win" })?.delta).toBe(2);
  });

  it("pays quest rewards at the full 合稿 value, including the -45 for selling the sun-bird", () => {
    const weld = quests.find((quest) => quest.id === "sanxingpai_side_3_shenniaocanye").stages.at(-1);
    const repAfter = (flag) => {
      const { factionRep } = resolveStageRewards(weld, [flag]);
      return applyFactionRep(rep(50), factionRep, { step: Infinity }).世界.势力声誉[SX];
    };
    expect(repAfter("quest_sxs3_return")).toBe(68);
    expect(repAfter("quest_sxs3_sell")).toBe(5);
    const trial = quests.find((quest) => quest.id === "sanxingpai_2_sanmianjianzhen").stages.at(-1);
    expect(resolveStageRewards(trial).factionRep).toEqual({ [SX]: 20 });
  });

  it("keeps the reputation-gated quests closed until 三星派 rep is high enough", () => {
    const gated = quests.filter((quest) => quest.requiresFactionRep);
    expect(gated.length).toBeGreaterThan(0);
    for (const quest of gated) {
      const where = quest.stages[0].requireLocation;
      const low = state(quest.requiresFactionRep["三星派"] - 1, { innerRoomName: where?.inner, room: { name: where?.district, npcs: [] } });
      expect(getLocalQuestStage(quest, low), quest.id).toBeNull();
    }
    const opener = quests.find((quest) => quest.id === "sanxingpai_1_xujiejiuyue");
    expect(getLocalQuestStage(opener, state(0, { innerRoomName: "鸭子河畔" }))?.id).toBe("stele");
  });
});

describe("三星派授面坛拜入", () => {
  const entry = FACTION_ENTRIES.三星派;
  const star2 = { sanxingpai_2_sanmianjianzhen: { status: "completed" } };
  const hall = { innerRoomName: "神树台西侧·授面坛", flags: ["sanxing_trial_passed"], questProgress: star2 };
  const withPrestige = (value, prestige) => ({ 世界: { 势力声誉: { [SX]: value }, 威望: prestige } });

  it("seats 授面坛 west of the tree, opened by the 星2 flag", () => {
    expect(factionEntryForBuilding(getBuildingIdForInnerRoom("广汉", "神树台西侧·授面坛"))).toBe(entry);
    expect(getInnerRoom("广汉", "神树台西侧·授面坛")?.unlockCondition).toEqual({ type: "flag", flag: "sanxing_trial_passed" });
    expect(getInnerRoom("广汉", "青铜神树下")?.exits.w).toBe("神树台西侧·授面坛");
  });

  it("needs rep 40, 星2 done, 威望 ≥ -60 and no other sect", () => {
    const check = (value, opts = {}) => checkFactionEntry(entry, { varTree: rep(value), questProgress: star2, flags: [], ...opts });
    expect(check(40).eligible).toBe(true);
    expect(check(39).missing).toEqual(["rep"]);
    expect(check(40, { questProgress: {} }).missing).toEqual(["quests"]);
    expect(check(40, { varTree: withPrestige(40, -60) }).eligible).toBe(true);
    expect(check(40, { varTree: withPrestige(40, -61) }).missing).toEqual(["prestige"]);
    expect(check(40, { flags: ["丐帮弟子"] }).missing).toEqual(["single"]);
  });

  it("joins with +20 rep and the 青铜纵目令, opening the member path for 纵目剑法", () => {
    expect(makeNamedItem("青铜纵目令")?.name).toBe("青铜纵目令");
    const result = joinSect(state(40, hall));
    const flags = result.changes.flags(hall.flags);
    expect(flags).toContain("三星派弟子");
    expect(result.changes.varTree(rep(40)).世界.势力声誉[SX]).toBe(60);
    expect(result.changes.inv([]).map((item) => item.name)).toContain("青铜纵目令");
    const skill = SKILL_CATALOG.三星.find((item) => item.name === "纵目剑法");
    expect(!!buySkill(state(40, { flags }), skill).changes?.skills).toBe(true);
    expect(!!buySkill(state(40), skill).changes?.skills).toBe(false);
  });
});
