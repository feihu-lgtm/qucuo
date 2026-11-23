import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { makeNamedItem } from "../../domain/data/items/catalog.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { RESIDENT_NPCS } from "../../domain/data/npc/residentNpcs.js";
import { getNpcFaction } from "../../domain/data/factions/npcFactions.js";
import { INNER_MAP, getBuildingIdForInnerRoom, isInnerExitUnlocked, isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { resolveStageRewards, stageRewardPatches } from "../../domain/rules/quests/questRewards.js";
import { buildRoomNpcWithCombat } from "../../domain/rules/npc/rules.js";
import { giftSilver } from "../npc/exchange.js";
import { playLocalQuestStage } from "../quest/logic.js";
import { buySkill } from "./logic.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";

const TS = "鱼定土司府";
const rep = (value) => ({ 世界: { 势力声誉: { [TS]: value } } });
const npcs = RESIDENT_NPCS.鱼定土司.map(buildRoomNpcWithCombat);
const state = (value = 0, overrides = {}) => ({
  char: { money: 500, special: { 智谋: 5 } }, inv: [], skills: [], flags: [], questProgress: {},
  varTree: rep(value), room: { name: "鱼定土司", npcs }, innerRoomName: "护卫厅", time: 30,
  ...overrides,
});
const names = (offer) => offer.items.map((item) => item.name);
const apply = (update, prev) => (typeof update === "function" ? update(prev) : update);
const quest = (id) => QUCUO_QUESTS.find((entry) => entry.id === id);
const tusiQuests = () => QUCUO_QUESTS.filter((entry) => entry.id.startsWith("yudingtusi_"));

describe("鱼定土司府", () => {
  it("binds five buildings to the manor rooms and seats six residents", () => {
    const buildings = getBuildingsForLocation("鱼定土司");
    const at = (inner) => buildings.find((building) => building.id === getBuildingIdForInnerRoom("鱼定土司", inner));
    expect(at("军需司")).toMatchObject({ type: "sectshop", shopKey: "土司军需司" });
    expect(at("护卫厅")?.skillSet).toBe("土司");
    expect(at("档册文书房")?.type).toBe("library");
    expect(at("前厅")?.type).toBe("bounty");
    expect(at("府门")?.type).toBe("pigeon_coop");
    const residents = RESIDENT_NPCS.鱼定土司.map((npc) => npc.name);
    expect(residents).toEqual(expect.arrayContaining(["梅朵", "桑杰朵杰", "管家·陆福生", "格桑顿珠", "洛桑平措", "白玛次仁"]));
    for (const npc of RESIDENT_NPCS.鱼定土司) expect(getNpcFaction(npc), npc.name).toBe(TS);
  });

  it("every shop, carry and quest item resolves in the catalog", () => {
    const shopItems = names(factionShopOffer("土司军需司", rep(100), "vault"));
    const carry = RESIDENT_NPCS.鱼定土司.flatMap((npc) => (npc.carry || []).map((entry) => entry.name));
    const rewardItems = JSON.stringify(tusiQuests()).match(/"name":"[^"]+","fromCatalog":true/g) || [];
    const rewardNames = rewardItems.map((text) => text.slice(8, text.indexOf('","')));
    expect(shopItems).toHaveLength(10);
    for (const name of [...shopItems, ...carry, ...rewardNames]) expect(makeNamedItem(name), name).toBeTruthy();
    expect(tusiQuests()).toHaveLength(8);
  });

  it("prices and gates the 军需司 by 土司府 reputation, top tier at 100", () => {
    expect(factionShopOffer("土司军需司", rep(0), "vault").coef).toBe(1);
    expect(names(factionShopOffer("土司军需司", rep(0), "vault"))).not.toContain("土司府云雷铜牌");
    expect(names(factionShopOffer("土司军需司", rep(15), "vault"))).toContain("土司府云雷铜牌");
    expect(names(factionShopOffer("土司军需司", rep(80), "vault"))).toContain("黑铁札片重甲");
    expect(names(factionShopOffer("土司军需司", rep(99), "vault"))).not.toContain("镇边虎纹玉佩");
    expect(names(factionShopOffer("土司军需司", rep(100), "vault"))).toContain("镇边虎纹玉佩");
    const hostile = factionShopOffer("土司军需司", rep(-20), "vault");
    expect(hostile.coef).toBe(1.2);
    expect(hostile.items.every((item) => item.quality === "白")).toBe(true);
    expect(factionShopOffer("土司军需司", rep(-60), "vault").closed).toBeTruthy();
    const bought = buyFactionShopItem(state(15, { innerRoomName: "军需司" }), "土司军需司", "土司府云雷铜牌", 1);
    expect(apply(bought.changes.char, { money: 500 }).money).toBeLessThan(500);
    expect(buyFactionShopItem(state(0, { innerRoomName: "军需司" }), "土司军需司", "土司府云雷铜牌", 1).changes).toBeUndefined();
  });

  it("gates the six 土司 skills by reputation, all at or under 100", () => {
    const list = SKILL_CATALOG.土司;
    expect(list).toHaveLength(6);
    expect(list.every((entry) => entry.unlock.faction === TS && entry.unlock.rep <= 100)).toBe(true);
    const skill = (name) => list.find((entry) => entry.name === name);
    expect(buySkill(state(0), skill("巡山铁步")).changes?.skills).toBeTruthy();
    expect(buySkill(state(14), skill("镇边矛势")).changes).toBeUndefined();
    expect(buySkill(state(15), skill("镇边矛势")).changes?.skills).toBeTruthy();
    expect(buySkill(state(79), skill("印山镇岳掌")).changes).toBeUndefined();
    expect(buySkill(state(80, { varTree: { ...rep(80), 角色: { 桑杰朵杰: { 好感度: 45 } } } }), skill("印山镇岳掌")).changes?.skills).toBeTruthy();
  });

  it("raises 土司府 rep once a day for tribute silver handed to 陆福生, foes pay half", () => {
    const luo = npcs.find((npc) => npc.name === "管家·陆福生");
    const s = state(0, { innerRoomName: "管家值房" });
    const first = giftSilver(s, luo, 100, 1);
    const tree = apply(first.changes.varTree, s.varTree);
    expect(tree.世界.势力声誉[TS]).toBe(4);
    expect(tree.世界.势力声誉.黑风寨).toBe(-2);
    const flags = apply(first.changes.flags, s.flags);
    expect(giftSilver({ ...s, flags }, luo, 100, 2).logs).toBeUndefined();
    expect(giftSilver(s, luo, 40, 3).logs).toBeUndefined();
  });

  it("uses the PR237 top-level gate shape with thresholds no higher than 100", () => {
    for (const entry of tusiQuests()) {
      if (!entry.requiresFactionRep) continue;
      expect(entry.requiresFactionRep.faction, entry.id).toBeUndefined();
      expect(entry.requiresFactionRep[TS], entry.id).toBeLessThanOrEqual(100);
      const where = entry.stages[0].requireLocation?.inner;
      const low = state(entry.requiresFactionRep[TS] - 1, {
        innerRoomName: where,
        questProgress: Object.fromEntries([entry.requiresQuestCompleted].flat().filter(Boolean).map((id) => [id, { status: "completed" }])),
      });
      expect(getLocalQuestStage(entry, low), entry.id).toBeNull();
    }
  });

  it("府1 can raise or lower 土司府 rep depending on the branch", () => {
    const q = quest("yudingtusi_1_xunshan_cuiliang");
    const repAfter = (flag) => {
      const tree = stageRewardPatches(resolveStageRewards(q.stages[1], [flag]))
        .reduce((acc, patch) => (patch.path === "varTree" ? patch.value(acc) : acc), rep(0));
      return tree.世界.势力声誉[TS];
    };
    expect(repAfter("quest_ts1_iron")).toBe(18);
    expect(repAfter("quest_ts1_protect")).toBe(-20);
  });

  it("shows off-site stages without the giver standing there", () => {
    const q = quest("yudingtusi_1_xunshan_cuiliang");
    const progress = { [q.id]: { status: "active", currentStageIndex: 1 } };
    const s = state(0, { room: { name: "鱼定村", npcs: [] }, innerRoomName: "村口·广场", questProgress: progress });
    expect(getLocalQuestStage(q, s)?.id).toBe("collect");
    const s3 = quest("yudingtusi_3_jiuqi_canyin");
    const vault = state(40, { innerRoomName: "库房", questProgress: { yudingtusi_2_caodian_anliang: { status: "completed" }, [s3.id]: { status: "active", currentStageIndex: 1 } } });
    expect(getLocalQuestStage(s3, vault)?.id).toBe("vault");
  });

  it("opens the hidden study only after 府3 is settled, not by holding an item", () => {
    const cond = INNER_MAP.鱼定土司.rooms.书房密室.unlockCondition;
    expect(cond.type).toBe("flag");
    expect(isInnerExitUnlocked(cond, { flags: [], inv: [{ name: "旧地契残页" }] })).toBe(false);
    expect(quest("yudingtusi_3_jiuqi_canyin").stages[2].onReach.flags).toContain(cond.flag);
  });

  it("keeps the new residents in their own rooms", () => {
    const luosang = npcs.find((npc) => npc.name === "洛桑平措");
    expect(isNpcVisibleInInnerRoom("鱼定土司", "档册文书房", luosang)).toBe(true);
    expect(isNpcVisibleInInnerRoom("鱼定土司", "府门", luosang)).toBe(false);
    const baima = npcs.find((npc) => npc.name === "白玛次仁");
    expect(isNpcVisibleInInnerRoom("鱼定土司", "军需司", baima)).toBe(true);
  });

  it("府1 refuses to pay without fifty taels", () => {
    const q = quest("yudingtusi_1_xunshan_cuiliang");
    const progress = { [q.id]: { status: "active", currentStageIndex: 1 } };
    const s = state(0, { room: { name: "鱼定村", npcs: [] }, innerRoomName: "村口·广场", questProgress: progress });
    expect(playLocalQuestStage({ ...s, char: { money: 10 } }, q, "自掏五十两垫付", 1).changes).toBeUndefined();
  });
});
