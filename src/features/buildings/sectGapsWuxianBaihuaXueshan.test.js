import { describe, expect, it } from "vitest";
import { CATALOG_INDEX, makeNamedItem } from "../../domain/data/items/catalog.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { RESIDENT_NPCS } from "../../domain/data/npc/residentNpcs.js";
import { isQuestChoiceOpen, isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { resolveStageRewards } from "../../domain/rules/quests/questRewards.js";
import { herbDonationRepGain } from "../../domain/rules/economy/herbDonation.js";

const quest = (id) => QUCUO_QUESTS.find((q) => q.id === id);
const tree = (rep) => ({ 世界: { 势力声誉: rep, 威望: 0 } });
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { status: "completed" }]));
const npc = (district, name) => RESIDENT_NPCS[district].find((n) => n.name === name);

describe("雪2 两条药路分支", () => {
  const stage = quest("xueshan_2_hanji_tang").stages.at(-1);
  const [lama, hanyu] = stage.choices;
  it("达摩温补线要带达摩驱寒膏，结算喇嘛庙 +12 并写破冰 flag", () => {
    expect(isQuestChoiceOpen(lama, { inv: [] })).toBe(false);
    expect(isQuestChoiceOpen(lama, { inv: [makeNamedItem("达摩驱寒膏")] })).toBe(true);
    const r = resolveStageRewards(stage, [lama.flag]);
    expect(r.factionRep).toMatchObject({ 雪山派: 20, 喇嘛庙: 12 });
    expect(r.consumeItems).toEqual(["达摩驱寒膏"]);
    expect(r.flags).toContain("xueshan_lama_icebreak");
  });
  it("寒玉猛药线加玄女好感 +20", () => {
    expect(isQuestChoiceOpen(hanyu, { inv: [] })).toBe(true);
    const r = resolveStageRewards(stage, [hanyu.flag]);
    expect(r.favorability).toMatchObject({ 玄女: 20, 何雨谢: 15 });
    expect(r.flags).toContain("xueshan_heyuxie_cold_purged");
    expect(r.factionRep.喇嘛庙).toBeUndefined();
  });
});

describe("蛊支2 延伸·赤焰压寒方送雪山", () => {
  const q = quest("wuxianjiao_side_2_ext_yaofang");
  it("做完蛊支2 才能接，交方子换雪山派 +10", () => {
    expect(isQuestGateOpen(q, {}, [], tree({}))).toBe(false);
    expect(isQuestGateOpen(q, done("wuxianjiao_side_2_xueshanhanlu"), [], tree({}))).toBe(true);
    const [stage] = q.stages;
    expect(stage.requiresItems).toEqual(["赤焰压寒方"]);
    const r = resolveStageRewards(stage, [stage.completionFlag]);
    expect(r.factionRep).toEqual({ 雪山派: 10 });
    expect(r.consumeItems).toEqual(["赤焰压寒方"]);
  });
});

describe("百花门花谱晋升", () => {
  it("银梅令要百花门声誉 80 且完成花3", () => {
    const q = quest("baihuamen_rank_yinmeiling");
    const p = done("baihuamen_3_shixinyudu");
    expect(isQuestGateOpen(q, p, [], tree({ 百花门: 79 }))).toBe(false);
    expect(isQuestGateOpen(q, {}, [], tree({ 百花门: 80 }))).toBe(false);
    expect(isQuestGateOpen(q, p, [], tree({ 百花门: 80 }))).toBe(true);
    expect(CATALOG_INDEX["银梅令"]).toBeTruthy();
    expect(resolveStageRewards(q.stages[0], ["quest_bh_rank_yinmei"]).items.map((i) => i.name)).toEqual(["银梅令"]);
  });
  it("百花尊客要声誉 100、银梅令和花4", () => {
    const q = quest("baihuamen_rank_zunke");
    const p = done("baihuamen_rank_yinmeiling", "baihuamen_4_wuxianjiuan");
    expect(isQuestGateOpen(q, p, [], tree({ 百花门: 99 }))).toBe(false);
    expect(isQuestGateOpen(q, done("baihuamen_rank_yinmeiling"), [], tree({ 百花门: 100 }))).toBe(false);
    expect(isQuestGateOpen(q, p, [], tree({ 百花门: 100 }))).toBe(true);
    expect(resolveStageRewards(q.stages[0], ["quest_bh_rank_zunke"]).flags).toContain("baihua_zunke");
  });
});

describe("送药日常涨声誉", () => {
  const herb = makeNamedItem("雪山当归"); // 蓝品药材
  const cloth = makeNamedItem("广汉细棉布"); // 绿品布料
  it("雪山、百花、五仙各认自己的人，每派每天一次", () => {
    expect(herbDonationRepGain({ time: 0 }, npc("雪山派", "呼延雪"), herb)).toMatchObject({ faction: "雪山派", delta: 6 });
    expect(herbDonationRepGain({ time: 0 }, npc("雪山派", "何雨谢"), herb)).toMatchObject({ faction: "雪山派", delta: 6 });
    expect(herbDonationRepGain({ time: 0 }, npc("天都镇", "花婆"), herb)).toMatchObject({ faction: "百花门", delta: 6 });
    const wx = herbDonationRepGain({ time: 0 }, npc("雾隐寨", "乌婆婆"), herb);
    expect(wx).toMatchObject({ faction: "五仙教", delta: 5 });
    const flags = wx.flags([]);
    expect(herbDonationRepGain({ time: 5, flags }, npc("雾隐寨", "龙汐月"), herb)).toBeNull();
    expect(herbDonationRepGain({ time: 5, flags }, npc("雪山派", "呼延雪"), herb)).not.toBeNull();
    expect(herbDonationRepGain({ time: 30, flags }, npc("雾隐寨", "龙汐月"), herb)).not.toBeNull();
  });
  it("五仙教也收蜀锦布料，别家不收", () => {
    expect(herbDonationRepGain({ time: 0 }, npc("雾隐寨", "龙汐月"), cloth)).toMatchObject({ faction: "五仙教", delta: 3 });
    expect(herbDonationRepGain({ time: 0 }, npc("天都镇", "花婆"), cloth)).toBeNull();
    const brocade = makeNamedItem("烟雨青蜀锦");
    expect(herbDonationRepGain({ time: 0 }, npc("雾隐寨", "乌婆婆"), brocade)).toMatchObject({ faction: "五仙教", delta: 5 });
  });
});
