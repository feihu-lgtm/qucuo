import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { makeNamedItem } from "../../domain/data/items/catalog.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { RESIDENT_NPCS } from "../../domain/data/npc/residentNpcs.js";
import { INNER_MAP, getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { resolveStageRewards } from "../../domain/rules/quests/questRewards.js";
import { sectSparRepGain } from "../../domain/rules/economy/sectSpar.js";
import { playLocalQuestStage } from "../quest/logic.js";
import { buySkill } from "./logic.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";
import { clinicCare, doClinicService } from "./factionClinic.js";

const F = "玉泉寨";
const rep = (value) => ({ 世界: { 势力声誉: { [F]: value } } });
const state = (value = 0, overrides = {}) => ({
  char: { money: 500, special: { 智谋: 5 } }, inv: [], skills: [], flags: [], questProgress: {},
  varTree: rep(value), room: { name: "玉泉寨", npcs: RESIDENT_NPCS.玉泉寨 }, innerRoomName: "玉泉练武场", time: 30,
  ...overrides,
});
const names = (offer) => offer.items.map((item) => item.name);
const apply = (update, prev) => (typeof update === "function" ? update(prev) : update);

describe("玉泉寨", () => {
  it("binds the寨 buildings to inner rooms and seats seven residents", () => {
    const buildings = getBuildingsForLocation("玉泉寨");
    const at = (inner) => buildings.find((building) => building.id === getBuildingIdForInnerRoom("玉泉寨", inner));
    expect(at("玉泉小栈")).toMatchObject({ type: "inn" });
    expect(at("玉泉练武场")).toMatchObject({ type: "wuguan", skillSet: "玉泉" });
    expect(at("寨门铁作棚")).toMatchObject({ type: "forge" });
    expect(at("巴登草药棚")).toMatchObject({ type: "hospital" });
    expect(at("寨场酥油茶棚")).toMatchObject({ type: "teahouse" });
    expect(at("狼曲篝火灶台")).toMatchObject({ type: "kitchen" });
    expect(at("玉泉茶马货栈")).toMatchObject({ type: "shop", shopKey: "玉泉货栈" });
    const residents = RESIDENT_NPCS.玉泉寨.map((npc) => npc.name);
    expect(residents).toEqual(expect.arrayContaining(["丹增", "李若由", "扎西", "卓玛", "小牧童阿索", "巴登阿妈", "索朗"]));
    // 枯柳暗窖：黑风寨藏赃的暗室，要 yuquan_kuliu_unlocked 旗标（泉3/山3 发给）。
    expect(INNER_MAP.玉泉寨?.rooms?.枯柳暗窖?.unlockCondition).toMatchObject({ type: "flag", flag: "yuquan_kuliu_unlocked" });
  });

  it("every shop, carry and quest reward item resolves in the catalog", () => {
    const shopItems = factionShopOffer("玉泉货栈", rep(200), "outer").items.map((item) => item.name);
    const carry = RESIDENT_NPCS.玉泉寨.flatMap((npc) => (npc.carry || []).map((entry) => entry.name));
    const questNames = ["风干牦牛肉", "小牧童的口哨"];
    for (const name of [...shopItems, ...carry, ...questNames]) expect(makeNamedItem(name), name).toBeTruthy();
    expect(QUCUO_QUESTS.filter((quest) => quest.id.startsWith("yuquanzhai_")).length).toBe(5);
  });

  it("prices and gates 玉泉货栈 by 玉泉寨 reputation; hostile only sells 白品", () => {
    const neutral = factionShopOffer("玉泉货栈", rep(0), "outer");
    expect(neutral.coef).toBe(1);
    expect(names(neutral)).toContain("牧羊短刀");
    expect(names(neutral)).not.toContain("草原驯马长鞭");
    expect(names(factionShopOffer("玉泉货栈", rep(15), "outer"))).toContain("雪羊皮软甲");
    expect(names(factionShopOffer("玉泉货栈", rep(40), "outer"))).toContain("索朗精锻牧刀");
    expect(names(factionShopOffer("玉泉货栈", rep(80), "outer"))).toContain("狼牙护心铜镜");
    expect(factionShopOffer("玉泉货栈", rep(80), "outer").coef).toBe(0.75);
    expect(names(factionShopOffer("玉泉货栈", rep(99), "outer"))).not.toContain("百年雪水青稞陈酿");
    expect(names(factionShopOffer("玉泉货栈", rep(100), "outer"))).toContain("百年雪水青稞陈酿");
    // 冷淡（-19~-1）只剩炒面粪饼；敌对（-59~-20）只摆白品、加价两成；死敌拒售。
    expect(names(factionShopOffer("玉泉货栈", rep(-1), "outer"))).toEqual(["狼曲酥油炒面", "牦牛粪饼"]);
    const hostile = factionShopOffer("玉泉货栈", rep(-20), "outer");
    expect(hostile.coef).toBe(1.2);
    expect(hostile.items.every((item) => item.quality === "白")).toBe(true);
    expect(factionShopOffer("玉泉货栈", rep(-60), "outer").closed).toContain("玉泉寨");
    expect(factionShopOffer("玉泉货栈", rep(0), null).closed).toContain("茶马货栈");
  });

  it("buys the百年陈酿 once, then it撤柜", () => {
    const bought = buyFactionShopItem(state(100, { innerRoomName: "玉泉茶马货栈" }), "玉泉货栈", "百年雪水青稞陈酿", 1);
    expect(bought.logs?.[0]?.text).toBeTruthy();
    const flags = apply(bought.changes.flags, []);
    expect(flags).toContain("shop_bought:玉泉货栈:百年雪水青稞陈酿");
    const again = factionShopOffer("玉泉货栈", rep(100), "outer", flags);
    expect(names(again)).not.toContain("百年雪水青稞陈酿");
  });

  it("gates 玉泉 skills by reputation across the 0/15/40/80 ladder", () => {
    const skill = (name) => SKILL_CATALOG.玉泉.find((entry) => entry.name === name);
    const hall = { innerRoomName: "玉泉练武场" };
    expect(buySkill(state(0, hall), skill("牧歌调息")).changes?.skills).toBeTruthy();
    expect(buySkill(state(0, hall), skill("摔跌术")).changes).toBeUndefined();
    expect(buySkill(state(15, hall), skill("摔跌术")).changes?.skills).toBeTruthy();
    expect(buySkill(state(40, hall), skill("套马索魂手")).changes?.skills).toBeTruthy();
    expect(buySkill(state(40, hall), skill("长生天吐纳诀")).changes).toBeUndefined();
    expect(buySkill(state(80, hall), skill("长生天吐纳诀")).changes?.skills).toBeTruthy();
    expect(buySkill(state(80, hall), skill("搏狼鞭法")).changes?.skills).toBeTruthy();
  });

  it("raises 玉泉寨 rep once a day helping 巴登阿妈; rep ≥15 heals free, ≤-20 refused", () => {
    expect(clinicCare(rep(15), "hospital_yuquan")).toBe("free");
    expect(clinicCare(rep(-20), "hospital_yuquan")).toBe("refuse");
    const s = state(0, { innerRoomName: "巴登草药棚" });
    const first = doClinicService(s, "hospital_yuquan");
    expect(first.logs?.[0]?.text).toContain("玉泉寨声誉");
    const tree = apply(first.changes.varTree, s.varTree);
    expect(tree.世界.势力声誉[F]).toBe(6);
    expect(tree.世界.威望).toBe(2);
    const flags = apply(first.changes.flags, s.flags);
    expect(doClinicService({ ...s, flags }, "hospital_yuquan").logs[0].text).toContain("今日已出过力");
  });

  it("counts a straight win over 丹增/索朗/卓玛 toward 玉泉寨 rep, capped daily", () => {
    const danzeng = RESIDENT_NPCS.玉泉寨.find((npc) => npc.name === "丹增");
    const gain = sectSparRepGain(state(0), danzeng, { outcome: "win" });
    expect(gain).toMatchObject({ faction: "玉泉寨", delta: 5 });
    const day2 = sectSparRepGain({ ...state(0), flags: gain.flags, time: 60 }, danzeng, { outcome: "win" });
    expect(day2.delta).toBe(2);
    // 同一天只计一次；日常切磋刷到声誉 39 就封顶。
    expect(sectSparRepGain({ ...state(0), flags: gain.flags }, danzeng, { outcome: "win" })).toBeNull();
    expect(sectSparRepGain({ ...state(40), flags: ["yuquan_spar_first", "yuquan_spar_day_0"], time: 30 }, danzeng, { outcome: "win" })).toBeNull();
  });

  it("opens 泉1 only at rep ≥0, resolves both branches, and enforces the 30两 ransom", () => {
    const quest = QUCUO_QUESTS.find((entry) => entry.id === "yuquanzhai_1_mumutongdemaoniu");
    expect(quest.giver).toBe("小牧童阿索");
    expect(quest.requiresFactionRep).toEqual({ 玉泉寨: 0 });
    expect(isQuestGateOpen(quest, {}, [], rep(0))).toBe(true);
    expect(isQuestGateOpen(quest, {}, [], rep(-1))).toBe(false);
    const stage = quest.stages[0];
    const fight = resolveStageRewards(stage, ["quest_yuquanzhai1_fight"]);
    expect(fight.factionRep).toMatchObject({ 玉泉寨: 15, 黑风寨: 3, 鱼定村: 3, 土司府: -5 });
    expect(fight.items.map((item) => item.name)).toContain("小牧童的口哨");
    const pay = resolveStageRewards(stage, ["quest_yuquanzhai1_pay"]);
    expect(pay.money).toBe(-10);
    expect(pay.factionRep).toMatchObject({ 玉泉寨: 10, 黑风寨: 2 });
    // 钱不够不让走赎回分支。
    const broke = playLocalQuestStage(state(0, { char: { money: 0 }, room: { name: "大草甸", npcs: [{ name: "小牧童阿索" }] }, innerRoomName: null }), quest, "花三十两把牛赎回");
    expect(broke.logs[0].text).toContain("30两");
  });
});
