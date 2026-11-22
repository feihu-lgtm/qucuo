import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { makeNamedItem } from "../../domain/data/items/catalog.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { RESIDENT_NPCS } from "../../domain/data/npc/residentNpcs.js";
import { getBuildingIdForInnerRoom, isInnerExitUnlocked, getInnerRoom } from "../../domain/rules/map/innerMap.js";
import { isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { forceAdvanceQuest } from "../quest/logic.js";
import { checkFactionEntry, FACTION_ENTRIES } from "../../domain/rules/character/factionEntry.js";
import { giftNpc } from "../npc/exchange.js";
import { joinSect } from "../sect/logic.js";
import { buySkill } from "./logic.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";

const HX = "欢喜教";
const rep = (value, prestige = 0) => ({ 世界: { 势力声誉: { [HX]: value }, 威望: prestige } });
const state = (value = 0, overrides = {}) => ({
  char: { money: 500, special: { 智谋: 5 } }, inv: [], skills: [], flags: [], questProgress: {},
  varTree: rep(value), room: { name: "天都镇", npcs: RESIDENT_NPCS.天都镇 }, innerRoomName: "天都香行", time: 30,
  ...overrides,
});
const names = (offer) => offer.items.map((item) => item.name);
const apply = (update, prev) => (typeof update === "function" ? update(prev) : update);
const applyChanges = (s, changes) => ({ ...s, ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, apply(value, s[key])])) });
const quest = (id) => QUCUO_QUESTS.find((entry) => entry.id === id);
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { status: "completed" }]));

describe("欢喜教", () => {
  it("binds the 天都香行 rooms to their buildings and residents", () => {
    const buildings = getBuildingsForLocation("天都镇");
    const at = (inner) => buildings.find((building) => building.id === getBuildingIdForInnerRoom("天都镇", inner));
    expect(at("天都香行")).toMatchObject({ shopKey: "天都香行" });
    expect(at("品香雅座")?.type).toBe("teahouse");
    expect(at("晒香天井")?.skillSet).toBe("欢喜");
    expect(at("欢喜堂")).toMatchObject({ type: "sect_entry", sect: HX });
    const room = (name) => getInnerRoom("天都镇", name);
    expect(room("调香药房").residentNpcName).toBe("阿雅");
    expect(isInnerExitUnlocked(room("欢喜堂").unlockCondition, { questProgress: done("huanxijiao_1_xiangzhongyi") })).toBe(false);
    expect(isInnerExitUnlocked(room("欢喜堂").unlockCondition, { questProgress: done("huanxijiao_2_biwuzhaoxian") })).toBe(true);
    expect(isInnerExitUnlocked(room("莲花廊").unlockCondition, { flags: ["欢喜教弟子"] })).toBe(true);
  });

  it("every shop, quest and entry item resolves in the catalog", () => {
    const shopItems = factionShopOffer("天都香行", rep(100), "vault", ["欢喜教弟子"]).items.map((item) => item.name);
    expect(shopItems).toHaveLength(12);
    const quests = QUCUO_QUESTS.filter((entry) => entry.id.startsWith("huanxijiao_"));
    const rewardNames = (JSON.stringify(quests).match(/"name":"[^"]+","fromCatalog":true/g) || [])
      .map((text) => text.slice(8, text.indexOf('","')));
    for (const name of [...shopItems, ...rewardNames, FACTION_ENTRIES[HX].token]) expect(makeNamedItem(name), name).toBeTruthy();
  });

  it("prices and gates the 天都香行 counter by 欢喜教 reputation", () => {
    const offer = (value, flags) => factionShopOffer("天都香行", rep(value), "vault", flags);
    expect(names(offer(0))).toHaveLength(6);
    expect(offer(-1)).toMatchObject({ coef: 1 });
    expect(names(offer(-1))).toHaveLength(6);
    expect(names(offer(15))).toContain("三息醉香粉");
    expect(offer(15).coef).toBe(0.92);
    expect(names(offer(40))).toContain("紫檀秘香囊");
    expect(names(offer(80))).toContain("极品金创香膏");
    expect(names(offer(100))).not.toContain("天竺莲纹短刃");
    expect(names(offer(100, ["欢喜教弟子"]))).toContain("天竺莲纹短刃");
    const hostile = offer(-20);
    expect(hostile.coef).toBe(1.2);
    expect(hostile.items.every((item) => ["白", "绿"].includes(item.quality))).toBe(true);
    expect(offer(-60).closed).toBeTruthy();
    const bought = buyFactionShopItem(state(15), "天都香行", "三息醉香粉", 1);
    expect(bought.changes?.inv).toBeTruthy();
  });

  it("gates 欢喜 skills by reputation and membership", () => {
    const skill = (name) => SKILL_CATALOG.欢喜.find((entry) => entry.name === name);
    const yard = { innerRoomName: "晒香天井" };
    expect(SKILL_CATALOG.欢喜).toHaveLength(7);
    expect(SKILL_CATALOG.欢喜.every((entry) => entry.unlock.rep <= 100)).toBe(true);
    expect(buySkill(state(0, yard), skill("熏香换气")).changes?.skills).toBeTruthy();
    expect(buySkill(state(0, yard), skill("伽罗转手")).changes).toBeUndefined();
    expect(buySkill(state(15, yard), skill("伽罗转手")).changes?.skills).toBeTruthy();
    expect(buySkill(state(100, yard), skill("弥香醉骨掌")).changes).toBeUndefined();
    expect(buySkill(state(40, { ...yard, flags: ["欢喜教弟子"] }), skill("弥香醉骨掌")).changes?.skills).toBeTruthy();
  });

  it("joins at the 坛城香案 without a prestige check, once 香2 is through", () => {
    const entry = FACTION_ENTRIES[HX];
    const hall = { innerRoomName: "欢喜堂", varTree: rep(40, -50) };
    expect(checkFactionEntry(entry, { varTree: rep(40, -50), flags: [] }).missing).toEqual(["trial"]);
    const joined = joinSect(state(40, { ...hall, flags: ["huanxijiao_xiang2_passed"] }), 1);
    expect(apply(joined.changes.flags, ["huanxijiao_xiang2_passed"])).toContain("欢喜教弟子");
    expect(apply(joined.changes.varTree, hall.varTree).世界.势力声誉[HX]).toBe(60);
    expect(apply(joined.changes.inv, []).map((item) => item.name)).toEqual(["莲纹铜牌"]);
    expect(checkFactionEntry(entry, { varTree: rep(40), flags: ["huanxijiao_xiang2_passed", "峨眉派弟子"] }).missing).toEqual(["single"]);
  });

  it("raises 欢喜教 rep once a day for herbs given to 阿雅, without touching 锦官城", () => {
    const aya = RESIDENT_NPCS.天都镇.find((npc) => npc.name === "阿雅");
    const herb = { ...makeNamedItem("雪山当归"), id: "herb_1" };
    const s = state(0, { innerRoomName: "调香药房", inv: [herb] });
    const first = giftNpc(s, aya, herb, 1);
    const tree = apply(first.changes.varTree, s.varTree);
    expect(tree.世界.势力声誉).toEqual({ [HX]: 6 });
    const flags = apply(first.changes.flags, s.flags);
    expect(giftNpc({ ...s, flags }, aya, herb, 2).logs.some((log) => log.text.includes("声誉"))).toBe(false);
    const plain = { ...makeNamedItem("冰片"), id: "herb_2" };
    expect(giftNpc({ ...s, inv: [plain] }, aya, plain, 3).logs.some((log) => log.text.includes("声誉"))).toBe(false);
  });

  it("gates the 香 quest line by 欢喜教 rep and pays the 合稿 rewards", () => {
    const open = (id, value, progress = {}) => isQuestGateOpen(quest(id), progress, [], rep(value));
    expect(open("huanxijiao_1_xiangzhongyi", 0)).toBe(true);
    expect(open("huanxijiao_1_xiangzhongyi", -1)).toBe(false);
    expect(open("huanxijiao_2_biwuzhaoxian", 9, done("huanxijiao_1_xiangzhongyi"))).toBe(false);
    expect(open("huanxijiao_2_biwuzhaoxian", 10, done("huanxijiao_1_xiangzhongyi"))).toBe(true);
    expect(open("huanxijiao_3_guanjiadetanzi", 25, done("huanxijiao_2_biwuzhaoxian"))).toBe(false);
    expect(open("huanxijiao_3_guanjiadetanzi", 25, done("huanxijiao_2_biwuzhaoxian", "huanxijiao_dive_1_caimaixiangliao"))).toBe(true);
    expect(open("huanxijiao_6_juezhanqianye", 79, done("huanxijiao_5_guanjiadetuxi"))).toBe(false);
    const xiang2 = quest("huanxijiao_2_biwuzhaoxian");
    const low = state(9, { questProgress: done("huanxijiao_1_xiangzhongyi") });
    expect(forceAdvanceQuest(low, xiang2, xiang2.stages[0].completionFlag, 1).changes).toEqual({});
    const ok = state(10, { questProgress: done("huanxijiao_1_xiangzhongyi") });
    expect(forceAdvanceQuest(ok, xiang2, xiang2.stages[0].completionFlag, 1).changes.questProgress).toBeTruthy();
    for (const entry of QUCUO_QUESTS.filter((q) => q.id.startsWith("huanxijiao_") && q.requiresFactionRep)) {
      expect(entry.requiresFactionRep[HX]).toBeLessThanOrEqual(100);
    }
    const s1 = quest("huanxijiao_1_xiangzhongyi").stages[0];
    const s0 = state(0, { flags: [s1.completionFlag], questProgress: { huanxijiao_1_xiangzhongyi: { status: "active", currentStageIndex: 1 } } });
    const out = applyChanges(s0, forceAdvanceQuest(s0, quest("huanxijiao_1_xiangzhongyi"), "quest_huanxijiao1_quiet", 1).changes);
    expect(out.varTree.世界.势力声誉).toEqual({ [HX]: 12 });
    expect(out.char.money).toBe(580);
    expect(out.inv.map((item) => item.name)).toEqual(["安神檀香", "安神檀香"]);
  });

  it("settles 香 branches: rewards per choice, betrayal gated by flag and expels members", () => {
    const xiang5 = quest("huanxijiao_5_guanjiadetuxi");
    const run = (flags, flag, inv = []) => {
      const s0 = state(60, { flags, inv, questProgress: { ...done("huanxijiao_3_guanjiadetanzi", "huanxijiao_4_jinguanchengdeanxian") } });
      const result = forceAdvanceQuest(s0, xiang5, flag, 1);
      return Object.keys(result.changes).length ? applyChanges(s0, result.changes) : null;
    };
    expect(run([], "quest_huanxijiao5_betray")).toBeNull();
    expect(run(["flag_huanxi_betray_ready", "欢喜教弟子"], "quest_huanxijiao5_betray")).toBeNull();
    const token = { ...makeNamedItem("莲纹铜牌"), id: "t1" };
    const member = run(["flag_huanxi_betray_ready", "欢喜教弟子"], "quest_huanxijiao5_betray_member", [token]);
    expect(member.varTree.世界.势力声誉.欢喜教).toBe(-70);
    expect(member.flags).toContain("叛出:欢喜教");
    expect(member.flags).not.toContain("欢喜教弟子");
    expect(member.inv.map((item) => item.name)).not.toContain("莲纹铜牌");
    const guest = run(["flag_huanxi_betray_ready"], "quest_huanxijiao5_betray");
    expect(guest.varTree.世界.势力声誉.欢喜教).toBe(0);
    const defend = run([], "quest_huanxijiao5_defend");
    expect(defend.varTree.世界.势力声誉).toMatchObject({ 欢喜教: 85, 鱼定土司府: -15 });
    expect(defend.char.money).toBe(800);
    const after = { ...done("huanxijiao_5_guanjiadetuxi") };
    expect(isQuestGateOpen(quest("huanxijiao_6_juezhanqianye"), after, ["flag_huanxi_betray_done"], rep(90))).toBe(false);
    expect(isQuestGateOpen(quest("huanxijiao_6a_bangguanjia"), after, ["flag_huanxi_betray_done"], rep(-70))).toBe(true);
    const finals = QUCUO_QUESTS.filter((entry) => entry.exclusiveGroup === "欢喜教终局");
    expect(finals).toHaveLength(3);
    const owners = { ending_huanxi_guanjia: "huanxijiao_6a_bangguanjia", ending_huanxi_fanyanna: "huanxijiao_6b_bangfanyanna", ending_huanxi_luoqi_ally: "huanxijiao_6_juezhanqianye" };
    for (const [ending, owner] of Object.entries(owners)) {
      const open = finals.filter((entry) => entry.id !== owner && isQuestGateOpen(entry, after, [ending], rep(90)));
      expect(open).toHaveLength(0);
    }
  });
});
