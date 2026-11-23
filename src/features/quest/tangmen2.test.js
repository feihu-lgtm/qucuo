import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getResidentNpcs } from "../../domain/data/npc/residentNpcs.js";
import { CATALOG_INDEX } from "../../domain/data/items/catalog.js";
import { getBuildingIdForInnerRoom, getInnerRoom, isInnerExitUnlocked } from "../../domain/rules/map/innerMap.js";
import { isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { parseLocalCommand } from "../../engine/localCommands.js";
import { doClinicService } from "../buildings/factionClinic.js";
import { tangmenShopOffer } from "../buildings/tangmenShop.js";
import { joinSect, leaveSect } from "../sect/logic.js";
import { residentNpcRule } from "../../domain/rules/npc/rules.js";

const find = (id) => QUCUO_QUESTS.find((entry) => entry.id === id);
const apply = (state, result) => ({ ...state, ...Object.fromEntries(Object.entries(result.changes || {}).map(
  ([key, value]) => [key, typeof value === "function" ? value(state[key]) : value],
)) });
const base = (reps = {}, extra = {}) => ({
  char: { money: 0, special: { 悟性: 5, 根骨: 5 } },
  inv: [], skills: [], flags: [], time: 1, questProgress: {},
  varTree: { 世界: { 势力声誉: reps, 威望: 0 } },
  ...extra,
});
const at = (state, inner, district = "蜀南唐堡", npcs = []) => ({ ...state, room: { name: district, npcs }, innerRoomName: inner });
const advance = (state, id, choice = "") => apply(state, parseLocalCommand(`推进任务 ${id} ${choice}`.trim(), state, { surface: "cli" }).result);
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { status: "completed" }]));
const IDS = [
  "tangmen_2_tuimoqingjiang", "tangmen_3_zhulintingfeng", "tangmen_4_wuxianhuohuan", "tangmen_5_jiaguichujian",
  "tangmen_s1_yajiangtieyin", "tangmen_s2_duanertingji", "tangmen_s3_qingchengjiuzhen",
];

describe("唐门任务线（唐2～唐5、唐支1～3）", () => {
  it("registers every quest with PR237 rep gates no higher than 100", () => {
    for (const id of IDS) {
      const quest = find(id);
      expect(quest, id).toBeTruthy();
      expect(quest.requiresFactionRep?.唐门, id).toBeGreaterThan(0);
      expect(Math.max(...Object.values(quest.requiresFactionRep)), id).toBeLessThanOrEqual(100);
    }
  });

  it("chains the main line by completion and rep", () => {
    const q4 = find("tangmen_4_wuxianhuohuan");
    const tree = (rep) => ({ 世界: { 势力声誉: { 唐门: rep } } });
    expect(isQuestGateOpen(q4, done("tangmen_3_zhulintingfeng"), [], tree(54))).toBe(false);
    expect(isQuestGateOpen(q4, done("tangmen_3_zhulintingfeng"), [], tree(55))).toBe(true);
    expect(isQuestGateOpen(q4, {}, [], tree(80))).toBe(false);
  });

  it("taking 唐伯渊's hush money closes 唐4/唐5 for the dark ending", () => {
    const q3 = find("tangmen_3_zhulintingfeng");
    const verdict = q3.stages.find((stage) => stage.id === "s2_verdict");
    expect(verdict.onReach.byFlag.quest_tang3_b.flags).toEqual(["flag_tangmen_dark_line", "flag_tangmen_sells_tusi"]);
    const tree = { 世界: { 势力声誉: { 唐门: 100 } } };
    const progress = done("tangmen_3_zhulintingfeng", "tangmen_4_wuxianhuohuan");
    expect(isQuestGateOpen(find("tangmen_4_wuxianhuohuan"), progress, ["flag_tangmen_dark_line"], tree)).toBe(false);
    expect(isQuestGateOpen(find("tangmen_5_jiaguichujian"), progress, ["flag_tangmen_dark_line"], tree)).toBe(false);
    expect(isQuestGateOpen(find("tangmen_5_jiaguichujian"), progress, [], tree)).toBe(true);
  });

  it("唐5 both verdicts confirm the endgame alliance", () => {
    const law = find("tangmen_5_jiaguichujian").stages.find((stage) => stage.id === "s3_law");
    expect(law.onReach.flags).toEqual(["ally_tangmen_confirmed"]);
    expect(law.completionFlag).toEqual(["quest_tang5_a", "quest_tang5_b"]);
    expect(law.onReach.items[0].name).toBe("破甲连弩信物");
  });

  it("walks 唐2 through the ledger room and pays the chosen branch", () => {
    const id = "tangmen_2_tuimoqingjiang";
    const start = base({ 唐门: 15 }, { flags: ["tangmen_invited"], questProgress: done("tangmen_1_anxianglaike") });
    const laotai = getResidentNpcs("蜀南唐堡").find((npc) => npc.name === "唐老太");
    const hall = (state) => at(state, "竹影正堂", "蜀南唐堡", [{ ...laotai, id: `pool_${laotai.id}` }]);
    let s = advance(hall(start), id);
    expect(s.flags).toContain("quest_tang2_s1");
    expect(isInnerExitUnlocked(getInnerRoom("蜀南唐堡", "宗谱铁室").unlockCondition, s)).toBe(true);
    s = advance(at(s, "宗谱铁室"), id);
    expect(s.inv.map((item) => item.name)).toContain("三十年前褪墨旧账抄本");
    s = advance(hall(s), id, "誊一份副本交给才旦或柳青鸢作罪证");
    expect(s.questProgress[id].status).toBe("completed");
    expect(s.char.money).toBe(200);
    expect(s.varTree.世界.势力声誉).toMatchObject({ 唐门: 35, 鱼定村: 10, 锦官城: 8 });
    expect(s.flags).toContain("flag_tangmen_ink_proof");
  });

  it("唐支1 appeal settles at 唐仲衡's room without 陈默 beside you", () => {
    const id = "tangmen_s1_yajiangtieyin";
    const chenmo = getResidentNpcs("蜀南唐堡").find((npc) => npc.name === "陈默");
    const start = base({ 唐门: 15 }, { flags: ["tangmen_invited"], questProgress: done("tangmen_1_anxianglaike") });
    let s = advance(at(start, "外姓竹坞", "蜀南唐堡", [{ ...chenmo, id: `pool_${chenmo.id}` }]), id);
    expect(s.flags).toContain("quest_tangs1_proof");
    s = advance(at(s, "宗谱机密楼"), id, "找唐仲衡按宗规申诉");
    expect(s.questProgress[id].status).toBe("completed");
    expect(s.flags).toContain("quest_tangs1_a");
  });

  it("唐4 disposing of the gu box needs it in hand and takes it away", () => {
    const box = find("tangmen_4_wuxianhuohuan").stages.find((stage) => stage.id === "s3_box");
    expect(box.requiresItems).toEqual(["紫铜蛊盒"]);
    expect(box.onReach.consumeItems).toEqual(["紫铜蛊盒"]);
  });

  it("唐伯渊 is gone from 唐堡 once either verdict is passed", () => {
    const registry = { getImportedForDistrict: () => [], getImportedResidentNames: () => [] };
    const names = (flags, npcs = []) => {
      const state = { char: { special: { 气运: 5 } }, companionState: {}, flags, importedVer: 0, questProgress: {}, room: { name: "蜀南唐堡", npcs }, time: 6 };
      const result = residentNpcRule.run(state, { importedRegistry: registry });
      return result ? result.changes.room(state.room).npcs.map((npc) => npc.name) : npcs.map((npc) => npc.name);
    };
    expect(names([])).toContain("唐伯渊");
    for (const flag of ["quest_tang5_a", "quest_tang5_b"]) {
      expect(names([flag])).not.toContain("唐伯渊");
      expect(names([flag], [{ name: "唐伯渊", id: "pool_resident_tangboyuan" }])).not.toContain("唐伯渊");
    }
  });

  it("every reward item resolves in the catalog", () => {
    const names = [];
    const walk = (reward) => {
      if (!reward) return;
      for (const item of reward.items || []) names.push(item.name);
      Object.values(reward.byFlag || {}).forEach(walk);
    };
    for (const id of IDS) find(id).stages.forEach((stage) => walk(stage.onReach));
    for (const name of names) expect(CATALOG_INDEX[name], name).toBeTruthy();
  });
});

describe("唐门拜入与门内玩法", () => {
  const swear = (rep, flags = ["tangmen_invited"]) => at(base({ 唐门: rep }, { char: { money: 0 }, flags }), "宗祠入堂石");

  it("swears in at 宗祠入堂石: rep ≥ 40, +20, 玄竹弟子令, member flag", () => {
    expect(getBuildingIdForInnerRoom("蜀南唐堡", "宗祠入堂石")).toBe("sect_entry_tangmen");
    expect(joinSect(swear(39)).changes).toBeUndefined();
    const s = apply(swear(40), joinSect(swear(40)));
    expect(s.flags).toContain("唐门弟子");
    expect(s.varTree.世界.势力声誉.唐门).toBe(60);
    expect(s.inv.map((item) => item.name)).toEqual(["玄竹弟子令"]);
    expect(joinSect(swear(80, ["tangmen_invited", "青城派弟子"])).changes).toBeUndefined();
  });

  it("leaving resets rep to -40 and takes back the token", () => {
    const s = apply(swear(40), joinSect(swear(40)));
    const left = apply(s, leaveSect(s, "唐门"));
    expect(left.flags).not.toContain("唐门弟子");
    expect(left.inv.map((item) => item.name)).not.toContain("玄竹弟子令");
    expect(left.varTree.世界.势力声誉.唐门).toBe(-40);
  });

  it("the poison clinic takes one daily errand for +5 rep", () => {
    const s = at(base({ 唐门: 0 }), "外姓竹坞");
    const result = doClinicService(s, "hospital_tangmen");
    expect(apply(s, result).varTree.世界.势力声誉.唐门).toBe(5);
    expect(doClinicService(apply(s, result), "hospital_tangmen").changes).toBeUndefined();
    expect(doClinicService(at(base({ 唐门: -20 }), "外姓竹坞"), "hospital_tangmen").changes).toBeUndefined();
  });

  it("opens the seven-star needle case at rep 100, once", () => {
    const rep = (value) => ({ 世界: { 势力声誉: { 唐门: value } } });
    const names = (value) => tangmenShopOffer(rep(value), "vault").items.map((item) => item.name);
    expect(names(99)).not.toContain("七星绣针匣");
    expect(names(100)).toContain("七星绣针匣");
    expect(CATALOG_INDEX.七星绣针匣.quality).toBe("橙");
  });

  it("seats the four house residents with catalog gear", () => {
    const npcs = getResidentNpcs("蜀南唐堡");
    for (const name of ["唐伯渊", "唐听竹", "唐仲衡", "陈默"]) {
      const npc = npcs.find((entry) => entry.name === name);
      expect(npc?.innerRoom, name).toBeTruthy();
      expect(getInnerRoom("蜀南唐堡", npc.innerRoom), name).toBeTruthy();
      for (const item of npc.carry) expect(CATALOG_INDEX[item.name], item.name).toBeTruthy();
    }
  });
});
