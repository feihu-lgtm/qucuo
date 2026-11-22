import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { CATALOG_INDEX } from "../../domain/data/items/catalog.js";
import { getInnerRoom, isInnerExitUnlocked, resolveInnerExit } from "../../domain/rules/map/innerMap.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { isQuestChoiceOpen, isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { resolveStageRewards } from "../../domain/rules/quests/questRewards.js";
import { RESIDENT_NPCS } from "../../domain/data/npc/residentNpcs.js";

const quest = (id) => QUCUO_QUESTS.find((entry) => entry.id === id);
const stage = (q, id) => quest(q).stages.find((entry) => entry.id === id);
const rep = (reps) => ({ 世界: { 势力声誉: reps } });
const IDS = [
  "qingcheng_4_shanmen_jueze", "qingcheng_5_songfeng_xidu",
  "qingcheng_side1_sishibabai", "qingcheng_side2_yijianweizhen", "qingcheng_side3_taijiechen",
];

describe("青城青4/青5 终局拉拢与三条支线", () => {
  it("五个任务都已注册，奖励物品都在 catalog 里", () => {
    for (const id of IDS) {
      const q = quest(id);
      expect(q, id).toBeTruthy();
      for (const s of q.stages) {
        const all = [s.onReach, ...Object.values(s.onReach?.byFlag || {})].flatMap((r) => r?.items || []);
        for (const it of all) expect(CATALOG_INDEX[it.name], it.name).toBeTruthy();
      }
    }
  });

  it("发布人都在任务第一步的房间里", () => {
    const yajiang = RESIDENT_NPCS.雅江.map((npc) => npc.name);
    for (const id of IDS) {
      const q = quest(id);
      expect(yajiang).toContain(q.giver);
      expect(getInnerRoom("雅江", q.stages[0].requireLocation.inner).residentNpcName, id).toBe(q.giver);
    }
  });

  it("门槛照合稿：青4 要青3 和声誉 60，青5 要青4、声誉 80，走龙王线锁死", () => {
    const q4 = quest("qingcheng_4_shanmen_jueze");
    const done = { qingcheng_3_jianyue: { status: "completed" } };
    expect(isQuestGateOpen(q4, done, [], rep({ 青城派: 59 }))).toBe(false);
    expect(isQuestGateOpen(q4, {}, [], rep({ 青城派: 60 }))).toBe(false);
    expect(isQuestGateOpen(q4, done, [], rep({ 青城派: 60 }))).toBe(true);
    const q5 = quest("qingcheng_5_songfeng_xidu");
    const done4 = { qingcheng_4_shanmen_jueze: { status: "completed" } };
    expect(isQuestGateOpen(q5, done4, [], rep({ 青城派: 80 }))).toBe(true);
    expect(isQuestGateOpen(q5, done4, ["faction_tianlong_dragon"], rep({ 青城派: 80 }))).toBe(false);
    for (const id of IDS) {
      for (const min of Object.values(quest(id).requiresFactionRep)) expect(min).toBeLessThanOrEqual(100);
    }
  });

  it("青5 守住索桥后写入青城终局援军，青霞子亲征要声誉 100 和青3 剑约", () => {
    const pledge = stage("qingcheng_5_songfeng_xidu", "pledge");
    expect(resolveStageRewards(pledge, ["quest_qc5_songhe"]).flags).toContain("ally_qingcheng");
    const full = pledge.choices.find((c) => c.flag === "quest_qc5_qingxiazi");
    expect(isQuestChoiceOpen(full, { flags: ["qingcheng_jianyue_done"], varTree: rep({ 青城派: 99 }) })).toBe(false);
    expect(isQuestChoiceOpen(full, { flags: [], varTree: rep({ 青城派: 100 }) })).toBe(false);
    expect(isQuestChoiceOpen(full, { flags: ["qingcheng_jianyue_done"], varTree: rep({ 青城派: 100 }) })).toBe(true);
    const r = resolveStageRewards(pledge, ["quest_qc5_qingxiazi"]);
    expect(r.items.map((it) => it.name)).toContain("紫阳松纹剑");
    expect(r.factionRep).toEqual({ 青城派: 30, 峨眉派: 6, 丐帮三星分舵: 6, 天龙教: -15, 鱼定土司府: -15 });
    expect(r.flags).toContain("ally_qingcheng_full");
  });

  it("青4 联峨眉西出要峨眉声誉 40，分支奖励挂在出分支的那一步", () => {
    const decide = stage("qingcheng_4_shanmen_jueze", "decide");
    const emei = decide.choices.find((c) => c.flag === "qingcheng_strategy_west_emei");
    expect(isQuestChoiceOpen(emei, { varTree: rep({ 峨眉派: 39 }) })).toBe(false);
    expect(isQuestChoiceOpen(emei, { varTree: rep({ 峨眉派: 40 }) })).toBe(true);
    for (const q of IDS) {
      for (const s of quest(q).stages) {
        if (s.onReach?.byFlag) expect(Object.keys(s.onReach.byFlag).sort(), `${q}/${s.id}`).toEqual([...s.completionFlag].sort());
      }
    }
    expect(resolveStageRewards(decide, ["qingcheng_strategy_west_emei"]).factionRep).toEqual({ 青城派: 25, 峨眉派: 15, 丐帮三星分舵: 5, 天龙教: -15 });
  });

  it("青支2 没凑齐三味药不能解毒，解完毒打开雾隐寨", () => {
    const q = quest("qingcheng_side2_yijianweizhen");
    const progress = { [q.id]: { status: "active", currentStageIndex: 3 } };
    const state = (inv) => ({
      questProgress: progress, flags: [], varTree: rep({ 青城派: 15 }), inv,
      room: { name: "雅江", npcs: [] }, innerRoomName: "西城门",
    });
    const herbs = ["山阴七叶莲", "离堆冷水苔", "熊山花椒"].map((name) => ({ name }));
    expect(getLocalQuestStage(q, state(herbs.slice(0, 2)))).toBeNull();
    expect(getLocalQuestStage(q, state(herbs))?.id).toBe("treat");
    expect(resolveStageRewards(stage(q.id, "treat"), ["quest_qcs2_xuewei"]).flags).toContain("wuxian_invited");
  });

  it("青支3 酒菜、不够就不能选对应分支；交回水则尺打开离堆听水亭", () => {
    const bridge = stage("qingcheng_side3_taijiechen", "bridgehead");
    const feast = bridge.choices.find((c) => c.flag === "quest_qcs3_feast");
    const buy = bridge.choices.find((c) => c.flag === "quest_qcs3_buy");
    expect(isQuestChoiceOpen(feast, { inv: [{ name: "冷锅鱼" }] })).toBe(false);
    expect(isQuestChoiceOpen(feast, { inv: [{ name: "冷锅鱼" }, { name: "青城老酒" }] })).toBe(false);
    expect(isQuestChoiceOpen(feast, { inv: [{ name: "冷锅鱼" }, { name: "青城老酒" }, { name: "青城老酒" }] })).toBe(true);
    expect(buy.requiresMoney).toBe(80);
    expect(resolveStageRewards(bridge, ["quest_qcs3_buy"]).money).toBe(-80);

    expect(resolveInnerExit("雅江", "伏龙观", "n")).toBe("离堆听水亭");
    const lock = getInnerRoom("雅江", "离堆听水亭").unlockCondition;
    expect(isInnerExitUnlocked(lock, { flags: [] })).toBe(false);
    const flags = resolveStageRewards(stage("qingcheng_side3_taijiechen", "return"), ["quest_qcs3_done"]).flags;
    expect(isInnerExitUnlocked(lock, { flags })).toBe(true);
  });
});
