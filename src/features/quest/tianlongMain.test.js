import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { resolveStageRewards } from "../../domain/rules/quests/questRewards.js";
import { getResidentRoomForNpc } from "../../domain/rules/map/innerMap.js";
import { RESIDENT_NPCS } from "../../domain/data/npc/residentNpcs.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";

const quest = (id) => QUCUO_QUESTS.find((q) => q.id === id);
const rep = (n) => ({ 世界: { 势力声誉: { 天龙教: n } } });
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { status: "completed" }]));
const lastStage = (q) => q.stages[q.stages.length - 1];
const allRewardFlags = (q) => q.stages.flatMap((s) => [
  ...(s.onReach?.flags || []),
  ...Object.values(s.onReach?.byFlag || {}).flatMap((r) => r.flags || []),
]);

const MAIN = ["tianlong_2_xifengruying", "tianlong_3_shishixunzong", "tianlong_4_zhigeanhuo",
  "tianlong_4_xueqitunchuan", "tianlong_5_baiqizhige", "tianlong_5_tieqitatu"];

describe("天龙教主线天2～天5", () => {
  it("六条任务都在，战斗档位都在 0～5，发布人站在第一段的房间里", () => {
    for (const id of MAIN) {
      const q = quest(id);
      expect(q, id).toBeTruthy();
      for (const c of q.stages.flatMap((s) => s.choices || [])) {
        if (c.combatNpc) expect(c.combatNpc.levelCap, `${id} ${c.flag}`).toBeGreaterThanOrEqual(0);
        if (c.combatNpc) expect(c.combatNpc.levelCap, `${id} ${c.flag}`).toBeLessThanOrEqual(5);
      }
      const first = q.stages[0].requireLocation;
      if (first.district === "天龙营") expect(getResidentRoomForNpc("天龙营", q.giver), id).toBe(first.inner);
    }
  });

  it("门槛照合稿：天2 ≥ -19、天3 ≥ 15、天4 ≥ 40、天5 ≥ 80，且都不超过 100", () => {
    const t2 = quest("tianlong_2_xifengruying");
    expect(isQuestGateOpen(t2, {}, [], rep(0))).toBe(false);
    expect(isQuestGateOpen(t2, done("tianlong_1_caodianxueshui"), [], rep(-20))).toBe(false);
    expect(isQuestGateOpen(t2, done("tianlong_1_caodianxueshui"), [], rep(-19))).toBe(true);
    const t3 = quest("tianlong_3_shishixunzong");
    expect(isQuestGateOpen(t3, done("tianlong_2_xifengruying"), [], rep(14))).toBe(false);
    expect(isQuestGateOpen(t3, done("tianlong_2_xifengruying"), [], rep(15))).toBe(true);
    for (const id of MAIN) expect(Object.values(quest(id).requiresFactionRep).every((n) => n <= 100), id).toBe(true);
    expect(quest("tianlong_4_zhigeanhuo").requiresFactionRep.天龙教).toBe(40);
    expect(quest("tianlong_5_baiqizhige").requiresFactionRep.天龙教).toBe(80);
    expect(quest("tianlong_5_tieqitatu").requiresFactionRep.天龙教).toBe(80);
  });

  it("天3 分支发天王线资格或龙王死忠；告密后贺兰昭和十三离场", () => {
    const vow = quest("tianlong_3_shishixunzong").stages.find((s) => s.id === "vow");
    expect(resolveStageRewards(vow, ["quest_tian3_a"]).flags).toContain("tianlong_path_tianwang_open");
    expect(resolveStageRewards(vow, ["quest_tian3_b"]).flags).toContain("tianlong_path_longwang_locked");
    expect(RESIDENT_NPCS.天龙营.find((n) => n.name === "贺兰昭").goneFlags).toContain("quest_tian3_b");
    expect(RESIDENT_NPCS.大草甸.find((n) => n.name === "血刀门徒·十三").goneFlags).toContain("quest_tian3_b");
  });

  it("天4 天王/龙王严格互斥：走过一条线第一段，另一条就接不了也做不下去", () => {
    const zhige = quest("tianlong_4_zhigeanhuo");
    const badao = quest("tianlong_4_xueqitunchuan");
    const pre = done("tianlong_3_shishixunzong");
    expect(isQuestGateOpen(zhige, pre, [], rep(40))).toBe(false);
    expect(isQuestGateOpen(zhige, pre, ["tianlong_path_tianwang_open"], rep(40))).toBe(true);
    expect(isQuestGateOpen(zhige, pre, ["tianlong_path_tianwang_open", "tianlong_path_longwang_locked"], rep(40))).toBe(false);
    expect(isQuestGateOpen(badao, pre, ["tianlong_path_tianwang_open"], rep(40))).toBe(true);
    expect(zhige.stages[0].onReach.flags).toContain("tianlong_route_tianwang");
    expect(badao.stages[0].onReach.flags).toContain("tianlong_route_longwang");
    const both = { ...pre, [zhige.id]: { status: "active" }, [badao.id]: { status: "active" } };
    expect(isQuestGateOpen(badao, both, ["tianlong_route_tianwang"], rep(40))).toBe(false);
    expect(isQuestGateOpen(zhige, both, ["tianlong_route_longwang"], rep(40))).toBe(false);
  });

  it("龙王线写 faction_tianlong_dragon（青5 靠它锁死），天王线不写", () => {
    expect(allRewardFlags(quest("tianlong_4_xueqitunchuan"))).toContain("faction_tianlong_dragon");
    for (const id of ["tianlong_4_zhigeanhuo", "tianlong_5_baiqizhige"]) {
      expect(allRewardFlags(quest(id))).not.toContain("faction_tianlong_dragon");
    }
  });

  it("天5 两条线各发终局 flag，且各自只认本线天4", () => {
    const tw = quest("tianlong_5_baiqizhige");
    const lw = quest("tianlong_5_tieqitatu");
    expect(lastStage(tw).onReach.flags).toEqual(["ending_ally_tianlong_tianwang", "tianlong_tianwang_restored"]);
    expect(lastStage(lw).onReach.flags).toEqual(["ending_ally_tianlong_longwang"]);
    expect(allRewardFlags(tw)).not.toContain("ending_ally_tianlong_longwang");
    expect(allRewardFlags(lw)).not.toContain("ending_ally_tianlong_tianwang");
    expect(isQuestGateOpen(tw, done("tianlong_4_zhigeanhuo"), ["tianlong_faction_tianwang"], rep(80))).toBe(true);
    expect(isQuestGateOpen(tw, done("tianlong_4_zhigeanhuo"), ["tianlong_faction_tianwang"], rep(79))).toBe(false);
    expect(isQuestGateOpen(lw, done("tianlong_4_zhigeanhuo"), ["tianlong_faction_tianwang"], rep(100))).toBe(false);
  });

  it("《八部天龙经》要天王线天5 了结", () => {
    const babu = Object.values(SKILL_CATALOG).flat().find((s) => s?.id === "kf_tl_babujing");
    expect(babu.unlock.quest).toEqual(["tianlong_5_baiqizhige"]);
  });
});
