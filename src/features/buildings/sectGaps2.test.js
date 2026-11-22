import { describe, expect, it } from "vitest";
import { effectiveMaxHp, SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { makeNamedItem } from "../../domain/data/items/catalog.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { checkFactionEntry, FACTION_ENTRIES } from "../../domain/rules/character/factionEntry.js";
import { isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { resolveStageRewards } from "../../domain/rules/quests/questRewards.js";
import { skillPrice, skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { buySkill } from "./skills.js";

const quest = (id) => QUCUO_QUESTS.find((q) => q.id === id);
const allSkills = Object.values(SKILL_CATALOG).flat();
const skill = (name) => allSkills.find((s) => s.name === name);
const tree = (rep) => ({ 世界: { 势力声誉: rep, 威望: 0 } });
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { status: "completed" }]));

describe("五仙拜师坛饮引蛊酒检定", () => {
  const entry = FACTION_ENTRIES.五仙教;
  const base = { varTree: tree({ 五仙教: 40 }), flags: [], questProgress: done(...entry.quests) };
  const weak = { hp: [30, 100], neigong: 2 };
  it("气血、内功都不够又没带解毒药，过不了", () => {
    const s = checkFactionEntry(entry, { ...base, char: weak, inv: [] });
    expect(s.eligible).toBe(false);
    expect(s.missing).toEqual(["trial"]);
  });
  it("气血六成或内功 8 就能稳住，不耗药", () => {
    expect(checkFactionEntry(entry, { ...base, char: { hp: [60, 100], neigong: 0 } })).toMatchObject({ eligible: true, trialItem: null });
    expect(checkFactionEntry(entry, { ...base, char: { hp: [10, 100], neigong: 8 } })).toMatchObject({ eligible: true, trialItem: null });
  });
  it("气血六成按含内功被动的有效上限算", () => {
    const hpSkill = allSkills.find((s) => effectiveMaxHp(100, [s]) > 100);
    const max = effectiveMaxHp(100, [hpSkill]);
    const char = { hp: [60, 100], neigong: 0 };
    expect(checkFactionEntry(entry, { ...base, char, skills: [hpSkill] }).eligible).toBe(60 >= max * 0.6);
    expect(checkFactionEntry(entry, { ...base, char: { hp: [Math.ceil(max * 0.6), 100], neigong: 0 }, skills: [hpSkill] }).eligible).toBe(true);
  });
  it("体魄不够时带解毒药能硬扛，并指出要喝掉的那份", () => {
    const pill = { ...makeNamedItem("百草解瘴散"), id: "p1" };
    const s = checkFactionEntry(entry, { ...base, char: weak, inv: [pill] });
    expect(s.eligible).toBe(true);
    expect(s.trialItem).toBe(pill);
  });
});

describe("雪2 拔毒线：温泉纳气半价与终局战力 flag", () => {
  const wq = skill("温泉纳气");
  it("拔毒线写入终局 flag", () => {
    const stage = quest("xueshan_2_hanji_tang").stages.at(-1);
    expect(resolveStageRewards(stage, ["quest_xs2_hanyu"]).flags).toEqual(
      expect.arrayContaining(["xueshan_heyuxie_cold_purged", "endgame_xueshan_heyuxie_full"]));
  });
  it("持 flag 半价，购买按折后价扣钱", () => {
    expect(skillPrice({ flags: [] }, wq)).toBe(wq.price);
    const flags = ["xueshan_heyuxie_cold_purged"];
    expect(skillPrice({ flags }, wq)).toBe(Math.round(wq.price / 2));
    const state = { flags, varTree: tree({ 雪山派: 40 }), questProgress: {}, skills: [], char: { money: 1000 }, room: { name: "雪山派" } };
    const r = buySkill(state, wq);
    expect(r.changes.char.money).toBe(1000 - Math.round(wq.price / 2));
  });
});

describe("花4 出卖兰姐：花谱除名", () => {
  const stage = quest("baihuamen_4_wuxianjiuan").stages.find((s) => s.onReach?.byFlag?.quest_bh4_betray);
  it("收回素梅牌、银梅令，记叛出百花门", () => {
    const r = resolveStageRewards(stage, ["quest_bh4_betray"]);
    expect(r.consumeItems).toEqual(["素梅牌", "银梅令"]);
    expect(r.flags).toEqual(expect.arrayContaining(["baihua_huapu_chuming", "叛出:百花门"]));
  });
  it("除名后花谱晋升关闭、百花高阶武学不可再学", () => {
    const flags = ["baihua_huapu_chuming", "叛出:百花门"];
    const q = quest("baihuamen_rank_yinmeiling");
    expect(isQuestGateOpen(q, done("baihuamen_3_shixinyudu"), flags, tree({ 百花门: 80 }))).toBe(false);
    const high = allSkills.find((s) => s.unlock?.faction === "百花门" && s.unlock.rep >= 40);
    const st = { flags, varTree: tree({ 百花门: 100 }), questProgress: {} };
    expect(skillUnlockStatus({ ...st, flags: [] }, high).ok).toBe(true);
    expect(skillUnlockStatus(st, high).ok).toBe(false);
  });
});
