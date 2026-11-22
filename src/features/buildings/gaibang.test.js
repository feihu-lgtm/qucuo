import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { makeNamedItem } from "../../domain/data/items/catalog.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { RESIDENT_NPCS } from "../../domain/data/npc/residentNpcs.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { isQuestChoiceOpen } from "../../domain/rules/quests/questEngine.js";
import { giftSilver } from "../npc/exchange.js";
import { playLocalQuestStage } from "../quest/logic.js";
import { buySkill } from "./logic.js";
import { buildRoomNpcWithCombat } from "../../domain/rules/npc/rules.js";
import { isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";
import { FACTION_ENTRIES, checkFactionEntry, factionEntryForBuilding } from "../../domain/rules/character/factionEntry.js";
import { skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { joinSect } from "../sect/logic.js";

const GB = "丐帮三星分舵";
const rep = (value) => ({ 世界: { 势力声誉: { [GB]: value } } });
const state = (value = 0, overrides = {}) => ({
  char: { money: 500, special: { 智谋: 5 } }, inv: [], skills: [], flags: [], questProgress: {},
  varTree: rep(value), room: { name: "广汉", npcs: RESIDENT_NPCS.广汉 }, innerRoomName: "粥棚后耳房·分舵义坊", time: 30,
  ...overrides,
});
const names = (offer) => offer.items.map((item) => item.name);
const apply = (update, prev) => (typeof update === "function" ? update(prev) : update);

describe("丐帮三星分舵", () => {
  it("binds the branch buildings to the temple rooms and seats seven residents", () => {
    const buildings = getBuildingsForLocation("广汉");
    const at = (inner) => buildings.find((building) => building.id === getBuildingIdForInnerRoom("广汉", inner));
    expect(at("粥棚后耳房·分舵义坊")).toMatchObject({ type: "sectshop", shopKey: "三星分舵商坊" });
    expect(at("破庙前院·粥棚与竹坪")?.skillSet).toBe("丐帮");
    const residents = RESIDENT_NPCS.广汉.map((npc) => npc.name);
    expect(residents).toEqual(expect.arrayContaining(["严九斤", "周小满", "胡三爷", "白婶", "多吉", "哑巴七", "秦小鹊"]));
  });

  it("every shop, carry and quest item resolves in the catalog", () => {
    const shopItems = factionShopOffer("三星分舵商坊", rep(200), "vault").items.map((item) => item.name);
    const carry = RESIDENT_NPCS.广汉.flatMap((npc) => (npc.carry || []).map((entry) => entry.name));
    const quests = QUCUO_QUESTS.filter((quest) => quest.id.startsWith("gaibang_"));
    const rewardItems = JSON.stringify(quests).match(/"name":"[^"]+","fromCatalog":true/g) || [];
    const rewardNames = rewardItems.map((text) => text.slice(8, text.indexOf('","')));
    for (const name of [...shopItems, ...carry, ...rewardNames]) expect(makeNamedItem(name), name).toBeTruthy();
    expect(quests.length).toBe(9);
  });

  it("prices and gates the branch shop by 丐帮 reputation", () => {
    const neutral = factionShopOffer("三星分舵商坊", rep(0), "vault");
    expect(neutral.coef).toBe(1);
    expect(names(neutral)).not.toContain("铁头打狗棒");
    expect(factionShopOffer("三星分舵商坊", rep(15), "vault")).toMatchObject({ coef: 0.92 });
    expect(names(factionShopOffer("三星分舵商坊", rep(15), "vault"))).toContain("铁头打狗棒");
    expect(names(factionShopOffer("三星分舵商坊", rep(80), "vault"))).not.toContain("八袋青竹护心甲");
    expect(names(factionShopOffer("三星分舵商坊", rep(100), "vault"))).toContain("八袋青竹护心甲");
    const hostile = factionShopOffer("三星分舵商坊", rep(-20), "vault");
    expect(hostile.coef).toBe(1.2);
    expect(hostile.items.every((item) => ["白", "绿", "蓝"].includes(item.quality) && item.minRep == null)).toBe(true);
    expect(factionShopOffer("三星分舵商坊", rep(-60), "vault").closed).toBeTruthy();
    expect(factionShopOffer("三星分舵商坊", rep(0), null).closed).toContain("分舵义坊");
  });

  it("buys through the shared shop handler with the reputation discount", () => {
    const item = factionShopOffer("三星分舵商坊", rep(15), "vault").items.find((entry) => entry.name === "铁头打狗棒");
    const bought = buyFactionShopItem(state(15), "三星分舵商坊", "铁头打狗棒", 1);
    const price = Math.ceil(item.buyPrice * 0.92);
    expect(bought.logs[0].text).toContain(`${price}两`);
    expect(apply(bought.changes.char, { money: 500 }).money).toBe(500 - price);
    expect(buyFactionShopItem(state(0), "三星分舵商坊", "铁头打狗棒", 1).changes).toBeUndefined();
  });

  it("gates 丐帮 skills by reputation; outsiders need the higher bar for membership skills", () => {
    const skill = (name) => SKILL_CATALOG.丐帮.find((entry) => entry.name === name);
    const hall = { innerRoomName: "破庙前院·粥棚与竹坪" };
    expect(buySkill(state(0, hall), skill("莲花落棍")).changes?.skills).toBeTruthy();
    expect(buySkill(state(0, hall), skill("醉踏青石步")).changes).toBeUndefined();
    expect(buySkill(state(15, hall), skill("醉踏青石步")).changes?.skills).toBeTruthy();
    expect(buySkill(state(40, hall), skill("缠丝打犬棒")).changes).toBeUndefined();
    expect(buySkill(state(80, hall), skill("缠丝打犬棒")).changes?.skills).toBeTruthy();
  });

  it("raises 丐帮 rep once a day for alms given to 白婶, and the 天龙教 foe pays half", () => {
    const baishen = RESIDENT_NPCS.广汉.find((npc) => npc.name === "白婶");
    const s = state(0, { innerRoomName: "破庙前院·粥棚与竹坪" });
    const first = giftSilver(s, baishen, 40, 1);
    const tree = apply(first.changes.varTree, s.varTree);
    expect(tree.世界.势力声誉[GB]).toBe(4);
    expect(tree.世界.势力声誉.天龙教).toBe(-2);
    const flags = apply(first.changes.flags, s.flags);
    expect(giftSilver({ ...s, flags }, baishen, 40, 2).logs).toBeUndefined();
    expect(giftSilver({ ...s, flags, time: s.time + 24 }, baishen, 40, 3).logs?.[0].text).toContain("+4");
    expect(giftSilver(s, baishen, 10, 4).logs).toBeUndefined();
  });

  it("opens 丐1 at the soup kitchen and checks silver before paying for the grain", () => {
    const quest = QUCUO_QUESTS.find((entry) => entry.id === "gaibang_1_yiwanxizhou");
    const s = state(0, { innerRoomName: "破庙前院·粥棚与竹坪" });
    expect(getLocalQuestStage(quest, s)?.id).toBe("grain");
    expect(playLocalQuestStage({ ...s, char: { money: 10 } }, quest, "代付三十两", 1).changes).toBeUndefined();
    const paid = playLocalQuestStage(s, quest, "代付三十两", 1);
    expect(apply(paid.changes.char, { money: 500 }).money).toBe(470);
  });

  it("keeps the reputation-gated side quests closed until 丐帮 rep is high enough", () => {
    const gated = QUCUO_QUESTS.filter((quest) => quest.id.startsWith("gaibang_") && quest.requiresFactionRep);
    expect(gated.length).toBeGreaterThan(0);
    for (const quest of gated) {
      const where = quest.stages[0].requireLocation?.inner;
      const flags = [...(quest.requiresFlags || [])];
      const low = state(quest.requiresFactionRep["丐帮三星分舵"] - 1, { innerRoomName: where, flags });
      expect(getLocalQuestStage(quest, low), quest.id).toBeNull();
    }
  });

  it("keeps each branch resident in its own inner room once spawned", () => {
    const baishen = buildRoomNpcWithCombat(RESIDENT_NPCS.广汉.find((npc) => npc.name === "白婶"));
    expect(isNpcVisibleInInnerRoom("广汉", "破庙前院·粥棚与竹坪", baishen)).toBe(true);
    expect(isNpcVisibleInInnerRoom("广汉", "鸭子河畔", baishen)).toBe(false);
  });
});

describe("拜入丐帮三星分舵", () => {
  const entry = FACTION_ENTRIES[GB];
  const hall = { innerRoomName: "土地庙正殿·聚义堂" };
  const xiaokao = QUCUO_QUESTS.find((quest) => quest.id === "gaibang_join_xiaokao");

  it("binds the 聚义堂 entry hall and the 广汉镇 transport", () => {
    const buildings = getBuildingsForLocation("广汉");
    const byInner = (inner) => buildings.find((building) => building.id === getBuildingIdForInnerRoom("广汉", inner));
    expect(byInner("土地庙正殿·聚义堂")).toMatchObject({ type: "sect_entry", sect: GB });
    expect(byInner("广汉镇")).toMatchObject({ id: "transport_guanghan", type: "transport" });
    expect(factionEntryForBuilding("sect_gaibang_entry")).toBe(entry);
  });

  it("needs rep 40, prestige ≥ 0, the 入门小考 and no other sect", () => {
    const check = (value, flags, extra = {}) => checkFactionEntry(entry, {
      varTree: { 世界: { 势力声誉: { [GB]: value }, ...extra } }, flags, char: { gender: "男" },
    }).missing;
    expect(check(40, ["quest_gbj_spar"])).toEqual([]);
    expect(check(40, [])).toEqual(["trial"]);
    expect(check(39, ["quest_gbj_spar"])).toEqual(["rep"]);
    expect(check(40, ["quest_gbj_spar"], { 威望: -1 })).toEqual(["prestige"]);
    expect(check(40, ["quest_gbj_spar", "峨眉派弟子"])).toEqual(["single"]);
  });

  it("runs the 小考: toast 严九斤 in the hall, then take 胡三爷's five blows at 竹坪", () => {
    expect(getLocalQuestStage(xiaokao, state(39, hall))).toBeNull();
    const toast = playLocalQuestStage(state(40, hall), xiaokao, undefined, 1);
    const progress = apply(toast.changes.questProgress, {});
    const flags = apply(toast.changes.flags, []);
    expect(flags).toContain("quest_gbj_toast");
    const yard = state(40, { innerRoomName: "破庙前院·粥棚与竹坪", questProgress: progress, flags });
    expect(getLocalQuestStage(xiaokao, yard)?.id).toBe("spar");
    const spar = playLocalQuestStage(yard, xiaokao, "硬接胡三爷五招不退", 2);
    expect(apply(spar.changes.flags, flags)).toContain("quest_gbj_spar");
    expect(getLocalQuestStage(xiaokao, state(40, { ...hall, flags: ["丐帮弟子"] }))).toBeNull();
  });

  it("joins with +20 rep, the 三星青竹袋 and the member gate for 缠丝打犬棒", () => {
    const result = joinSect(state(40, { ...hall, flags: ["quest_gbj_spar"] }));
    const flags = result.changes.flags([]);
    expect(flags).toContain("丐帮弟子");
    expect(result.changes.varTree(rep(40)).世界.势力声誉[GB]).toBe(60);
    expect(result.changes.inv([]).map((item) => item.name)).toContain("三星青竹袋");
    const skill = SKILL_CATALOG.丐帮.find((entry) => entry.name === "缠丝打犬棒");
    expect(skillUnlockStatus({ varTree: rep(40), flags }, skill).ok).toBe(true);
    expect(skillUnlockStatus({ varTree: rep(40), flags: [] }, skill).ok).toBe(false);
  });
});

describe("丐5·百棒出广汉", () => {
  const quest = QUCUO_QUESTS.find((entry) => entry.id === "gaibang_5_shiliudagouzhen");
  const done = { gaibang_4_jiuenyuxinzhai: { status: "completed" } };

  it("opens only after 丐4 with 丐帮 rep ≥ 80", () => {
    const hall = (value, questProgress) => state(value, { innerRoomName: "土地庙正殿·聚义堂", questProgress });
    expect(getLocalQuestStage(quest, hall(80, {}))).toBeNull();
    expect(getLocalQuestStage(quest, hall(79, done))).toBeNull();
    expect(getLocalQuestStage(quest, hall(80, done))?.id).toBe("council");
  });

  const oathState = (value, flags = [], duoji = 10) => state(value, {
    innerRoomName: "土地庙正殿·聚义堂", flags,
    varTree: { ...rep(value), 角色: { 多吉: { 好感度: duoji } } },
    questProgress: { ...done, [quest.id]: { questId: quest.id, status: "active", progress: 0, currentStageIndex: 4 } },
  });
  const oathLabels = (s) => quest.stages[4].choices.filter((c) => isQuestChoiceOpen(c, s)).map((c) => c.label);

  it("pays the 合稿 oath reward in one go and sets the endgame ally flags", () => {
    const oath = quest.stages.find((stage) => stage.id === "oath").onReach;
    expect(oath).toMatchObject({ money: 200, factionRep: { [GB]: 35, 鱼定土司府: -11, 青城派: 7, 峨眉派: 7 } });
    expect(oath.flags).toEqual(["endgame_ally_gaibang", "endgame_buff_gaibang_scouts"]);
    expect(makeNamedItem("三星客卿青竹杖")?.name).toBe("三星客卿青竹杖");
    expect(makeNamedItem("七袋掌棒使铁令")?.name).toBe("七袋掌棒使铁令");
    expect(quest.stages.find((stage) => stage.id === "scouts").choices[0]).toMatchObject({ resolve: "combat" });
  });

  it("gives guests the 青竹杖 and promotes members to 七袋掌棒使", () => {
    expect(oathLabels(oathState(80))).toEqual(["受青竹杖·常规结盟"]);
    expect(oathLabels(oathState(80, ["丐帮弟子"]))).toEqual(["晋七袋掌棒使·常规结盟"]);
    const guest = playLocalQuestStage(oathState(80), quest, "受青竹杖·常规结盟", 5);
    expect(guest.changes.inv([]).map((item) => item.name)).toEqual(["三星客卿青竹杖"]);
    const member = playLocalQuestStage(oathState(80, ["丐帮弟子"]), quest, "晋七袋掌棒使·常规结盟", 5);
    expect(member.changes.inv([]).map((item) => item.name)).toEqual(["七袋掌棒使铁令"]);
    expect(apply(member.changes.flags, ["丐帮弟子"])).toEqual(expect.arrayContaining(["丐帮七袋掌棒使", "endgame_ally_gaibang"]));
  });

  it("opens 倾巢相助 only at 丐帮 rep 100 with 多吉 favor ≥ 60", () => {
    expect(oathLabels(oathState(99, [], 60))).not.toContain("倾巢相助·受青竹杖");
    expect(oathLabels(oathState(100, [], 59))).not.toContain("倾巢相助·受青竹杖");
    expect(oathLabels(oathState(100, [], 60))).toContain("倾巢相助·受青竹杖");
    expect(oathLabels(oathState(100, ["丐帮弟子"], 60))).toEqual(["晋七袋掌棒使·常规结盟", "倾巢相助·晋七袋掌棒使"]);
    expect(playLocalQuestStage(oathState(100, [], 59), quest, "倾巢相助·受青竹杖", 5).changes).toBeUndefined();
    const full = playLocalQuestStage(oathState(100, ["丐帮弟子"], 60), quest, "倾巢相助·晋七袋掌棒使", 5);
    expect(apply(full.changes.flags, ["丐帮弟子"])).toEqual(expect.arrayContaining([
      "丐帮七袋掌棒使", "endgame_ally_gaibang_full", "gaibang_epilogue_yiyue_zhoupeng",
    ]));
    expect(apply(full.changes.questProgress, {})[quest.id].status).toBe("completed");
  });
});
