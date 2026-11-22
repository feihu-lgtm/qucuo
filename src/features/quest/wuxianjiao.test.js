import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { CATALOG_INDEX } from "../../domain/data/items/catalog.js";
import { isQuestChoiceOpen } from "../../domain/rules/quests/questEngine.js";
import { resolveStageRewards } from "../../domain/rules/quests/questRewards.js";
import { getResidentNpcs } from "../../domain/data/npc/residentNpcs.js";

const find = (id) => QUCUO_QUESTS.find((entry) => entry.id === id);
const stage = (questId, stageId) => find(questId).stages.find((entry) => entry.id === stageId);
const choice = (st, flag) => st.choices.find((entry) => entry.flag === flag);
const ctx = (flags = [], rep = 0) => ({ flags, questProgress: {}, varTree: { 世界: { 势力声誉: { 五仙教: rep } } } });

describe("五仙教银冠/赤蜈双线（蛊2～蛊5）", () => {
  it("蛊2 回禀分两支：如实禀报或把断针交给麻九娘", () => {
    const report = stage("wuxianjiao_2_dudianyiying", "report");
    expect(resolveStageRewards(report, ["quest_wx2_report"]).favorability).toEqual({ 龙汐月: 15 });
    expect(resolveStageRewards(report, ["quest_wx2_mjn"]).favorability).toEqual({ 麻九娘: 15, 龙汐月: -10 });
    expect(resolveStageRewards(report, ["quest_wx2_mjn"]).factionRep).toEqual({ 五仙教: 15 });
  });

  it("蛊3 暗算兰姐只对蛊2 倒向麻九娘的开放，两支声誉照合稿", () => {
    const ambush = stage("wuxianjiao_3_shijiejiuhen", "ambush");
    const betray = choice(ambush, "quest_wx3_betray");
    expect(isQuestChoiceOpen(betray, ctx(["quest_wx2_report"]))).toBe(false);
    expect(isQuestChoiceOpen(betray, ctx(["quest_wx2_mjn"]))).toBe(true);
    const keep = resolveStageRewards(ambush, ["quest_wx3_fight"]);
    expect(keep.flags).toContain("wuxian_baihua_reconcile");
    expect(keep.factionRep).toEqual({ 五仙教: 20, 百花门: 20, 峨眉派: -3 });
    const bad = resolveStageRewards(ambush, ["quest_wx3_betray"]);
    expect(bad.factionRep).toEqual({ 五仙教: 25, 百花门: -50 });
    expect(bad.reputation).toBe(-15);
  });

  it("蛊4 纵毒只对赤蜈线开放，且两支都 +20 五仙声誉", () => {
    const deal = stage("wuxianjiao_4_chiwujiaoyi", "deal");
    expect(isQuestChoiceOpen(choice(deal, "quest_wx4_poison"), ctx(["quest_wx2_report"]))).toBe(false);
    expect(isQuestChoiceOpen(choice(deal, "quest_wx4_poison"), ctx(["quest_wx2_mjn"]))).toBe(true);
    expect(resolveStageRewards(deal, ["quest_wx4_keep"]).factionRep.五仙教).toBe(20);
    expect(resolveStageRewards(deal, ["quest_wx4_poison"]).factionRep.五仙教).toBe(20);
    expect(stage("wuxianjiao_4_chiwujiaoyi", "report").onReach.money).toBe(240);
  });

  it("蛊5 银冠线确认终局盟友，倾巢援军要声誉 100，赤蜈线给土司府送毒蛊", () => {
    const rite = stage("wuxianjiao_5_yingguandingtan", "rite");
    const crown = choice(rite, "quest_wx5_crown");
    const full = choice(rite, "quest_wx5_crown_full");
    const centipede = choice(rite, "quest_wx5_centipede");
    expect(isQuestChoiceOpen(crown, ctx(["quest_wx4_keep"], 80))).toBe(true);
    expect(isQuestChoiceOpen(crown, ctx(["quest_wx4_poison"], 80))).toBe(false);
    expect(isQuestChoiceOpen(full, ctx(["quest_wx4_keep"], 99))).toBe(false);
    expect(isQuestChoiceOpen(full, ctx(["quest_wx4_keep"], 100))).toBe(true);
    expect(isQuestChoiceOpen(centipede, ctx(["quest_wx4_keep"], 80))).toBe(false);
    expect(isQuestChoiceOpen(centipede, ctx(["quest_wx4_poison"], 80))).toBe(true);
    expect(resolveStageRewards(rite, ["quest_wx5_crown"]).flags).toContain("endgame_ally_wuxian");
    expect(resolveStageRewards(rite, ["quest_wx5_crown_full"]).flags).toEqual(expect.arrayContaining(["endgame_ally_wuxian", "endgame_ally_wuxian_full"]));
    const dark = resolveStageRewards(rite, ["quest_wx5_centipede"]);
    expect(dark.flags).toContain("endgame_wuxian_poison_tusi");
    expect(dark.flags).not.toContain("endgame_ally_wuxian");
    expect(dark.factionRep.五仙教).toBe(35);
    expect(stage("wuxianjiao_5_yingguandingtan", "report").onReach.money).toBe(500);
    for (const name of ["五仙圣盟银符", "金蚕护心蛊", "赤蜈毒王冠", "旧金蚕壳", "百花净毒露"]) {
      expect(CATALOG_INDEX[name], name).toBeTruthy();
    }
    for (const entry of rite.choices) expect(entry.combatNpc.levelCap).toBeLessThanOrEqual(5);
  });

  it("银冠线定坛后麻九娘不再常驻雾隐寨", () => {
    const majiu = getResidentNpcs("雾隐寨").find((npc) => npc.name === "麻九娘");
    expect(majiu.goneFlags).toEqual(["quest_wx5_crown", "quest_wx5_crown_full"]);
  });
});
