import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { isQuestChoiceOpen } from "../../domain/rules/quests/questEngine.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { resolveStageRewards } from "../../domain/rules/quests/questRewards.js";
import { TUSI_FINALE_FLAGS } from "../../content/quest/yudingtusi-1.js";

const finale = QUCUO_QUESTS.find((q) => q.id === "yudingtusi_5_dou_dizhu");
const stage = (id) => finale.stages.find((s) => s.id === id);
const open = (stageId, flags) => stage(stageId).choices.filter((c) => isQuestChoiceOpen(c, { flags, varTree: {} })).map((c) => c.flag);
const choiceFlags = (c) => [...(c.requiresFlag || []), ...(c.requiresFlagAny || []), ...(c.blockedByFlags || [])];
const F = Object.fromEntries(Object.entries(TUSI_FINALE_FLAGS).map(([k, v]) => [k, v.flag]));

const setFlags = (value, out = new Set()) => {
  if (Array.isArray(value)) value.forEach((v) => setFlags(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "flags" && Array.isArray(v)) v.forEach((f) => out.add(f));
      if (k === "flag" && typeof v === "string") out.add(v);
      setFlags(v, out);
    }
  }
  return out;
};

describe("府5·斗地主", () => {
  it("府4 完成且格桑按兵不动后才开，全程在议事厅", () => {
    expect(finale.requiresQuestCompleted).toBe("yudingtusi_4_gushu_wenxin");
    expect(finale.requiresFlags).toEqual(["flag_gesang_neutralized"]);
    expect(finale.localOnly).toBe(true);
    for (const s of finale.stages) expect(s.requireLocation, s.id).toEqual({ district: "鱼定土司", inner: "议事厅" });
  });

  it("议事厅里没有发布人也能接，府4 没完成或格桑没按兵不动就接不到", () => {
    const state = (questProgress, flags) => ({ room: { name: "鱼定土司", npcs: [] }, innerRoomName: "议事厅", questProgress, flags, varTree: {} });
    const done = { yudingtusi_4_gushu_wenxin: { status: "completed" } };
    expect(getLocalQuestStage(finale, state(done, ["flag_gesang_neutralized"]))?.id).toBe("open");
    expect(getLocalQuestStage(finale, state(done, []))).toBeNull();
    expect(getLocalQuestStage(finale, state({}, ["flag_gesang_neutralized"]))).toBeNull();
  });

  it("最后一战是桑杰朵杰，档位 5", () => {
    expect(stage("boss").choices.map((c) => c.combatNpc)).toEqual([{ name: "桑杰朵杰", levelCap: 5 }]);
  });

  it("读到的 flag 都在映射表里，且都由别的任务实际发出；映射表不读的 flag 不接效果", () => {
    const mapped = new Set(Object.values(TUSI_FINALE_FLAGS).map((v) => v.flag));
    const read = new Set([...finale.requiresFlags, ...finale.stages.flatMap((s) => (s.choices || []).flatMap(choiceFlags))]);
    for (const f of read) expect(mapped.has(f), f).toBe(true);
    const emitted = setFlags(QUCUO_QUESTS.filter((q) => q.id !== finale.id));
    for (const f of mapped) expect(emitted.has(f), f).toBe(true);
    for (const v of Object.values(TUSI_FINALE_FLAGS).filter((x) => x.effect === null)) expect(read.has(v.flag), v.flag).toBe(false);
  });

  it("没有任何盟友时，紫瘴、毒弩、亲兵都要正面打", () => {
    expect(open("miasma", [])).toEqual(["quest_ts5_miasma"]);
    expect(open("ambush", [])).toEqual(["quest_ts5_ambush"]);
    expect(open("guard", [])).toEqual(["quest_ts5_guard"]);
    expect(open("smoke", [])).toEqual(["quest_ts5_smoke_none"]);
    expect(open("xuedao", [])).toEqual(["quest_ts5_xuedao"]);
  });

  it("五仙银冠散紫瘴，唐门取消毒弩伏击，赤蜈线照样有紫瘴", () => {
    expect(open("miasma", [F.wuxianAlly])).toEqual(["quest_ts5_miasma_clear"]);
    expect(open("miasma", [F.wuxianPoisonTusi])).toEqual(["quest_ts5_miasma"]);
    expect(open("miasma", [F.baihuaAlly])).toContain("quest_ts5_miasma_cured");
    expect(open("miasma", [F.emeiFull])).toContain("quest_ts5_miasma_cured");
    expect(open("miasma", [F.emeiAlly])).toEqual(["quest_ts5_miasma"]);
    expect(open("ambush", [F.emeiFull])).toContain("quest_ts5_ambush_spotted");
    expect(open("ambush", [F.tangmenAlly])).toEqual(["quest_ts5_ambush_none"]);
    expect(open("ambush", [F.gaibangScouts])).toContain("quest_ts5_ambush_spotted");
    expect(open("ambush", [F.tusiCrossbowExposed])).toContain("quest_ts5_ambush_spotted");
  });

  it("各家援军按合稿削弱亲兵，鱼定村走暗渡奇袭", () => {
    const all = [F.gaibangAlly, F.heifengRaid, F.tangmenAlly, F.xueshanAlly, F.xueshanHeyuxieFull, F.emeiAlly, F.baihuaAlly, F.yudingAlly, F.huanxiLuoqi, F.tianlongLongwang];
    expect(open("guard", all)).toEqual(stage("guard").completionFlag);
    const caps = Object.fromEntries(stage("guard").choices.map((c) => [c.flag, c.combatNpc?.levelCap ?? null]));
    expect(caps).toMatchObject({ quest_ts5_guard: 4, quest_ts5_guard_emei: 3, quest_ts5_guard_baihua: 2, quest_ts5_guard_yuding: null, quest_ts5_guard_huanxi: null });
  });

  it("欢喜教管家线毒烟阵助敌，梵衍那线合稿没写对战局的效果，不接", () => {
    expect(open("smoke", [F.huanxiGuanjia])).toEqual(["quest_ts5_smoke"]);
    expect(open("smoke", [F.huanxiFanyanna])).toEqual(["quest_ts5_smoke_none"]);
    expect(open("smoke", [F.huanxiLuoqi])).toEqual(["quest_ts5_smoke_none"]);
    expect(open("guard", [F.huanxiLuoqi])).toContain("quest_ts5_guard_huanxi");
  });

  it("血刀部敌援：青城剑约钉住不来，峨眉倾巢压到档位 2，峨眉/五仙/丐帮斥候降到 3", () => {
    expect(open("xuedao", [F.qingchengPledge])).toContain("quest_ts5_xuedao_held");
    for (const f of [F.qingchengAlly, F.qingchengFull]) expect(open("xuedao", [f]), f).toContain("quest_ts5_xuedao_held");
    expect(open("xuedao", [F.emeiFull])).toContain("quest_ts5_xuedao_suppressed");
    for (const f of [F.emeiAlly, F.wuxianAlly, F.gaibangScouts]) expect(open("xuedao", [f]), f).toContain("quest_ts5_xuedao_weak");
    for (const f of [F.wuxianPoisonTusi, F.tangmenAlly, F.baihuaAlly]) expect(open("xuedao", [f]), f).toEqual(["quest_ts5_xuedao"]);
    const caps = Object.fromEntries(stage("xuedao").choices.map((c) => [c.flag, c.combatNpc?.levelCap ?? null]));
    expect(caps).toEqual({ quest_ts5_xuedao: 4, quest_ts5_xuedao_weak: 3, quest_ts5_xuedao_suppressed: 2, quest_ts5_xuedao_held: null,
      quest_ts5_xuedao_disbanded: null, quest_ts5_xuedao_turned: null });
  });

  it("天龙教：天王线解散血刀部不用打，龙王线血刀部随黑旗攻府、铁骑冲散亲兵、战后黑旗入曲措", () => {
    expect(open("xuedao", [F.tianlongTianwang])).toContain("quest_ts5_xuedao_disbanded");
    expect(open("xuedao", [F.tianlongLongwang])).toContain("quest_ts5_xuedao_turned");
    expect(open("guard", [F.tianlongLongwang])).toContain("quest_ts5_guard_longwang");
    expect(open("guard", [F.tianlongTianwang])).toEqual(["quest_ts5_guard"]);
    expect(open("aftermath", [F.tianlongLongwang, F.meiduoRegent])).toEqual(["quest_ts5_blackflag"]);
    expect(open("aftermath", [F.tianlongTianwang, F.meiduoRegent])).toEqual(["quest_ts5_regent", "quest_ts5_settle"]);
    expect(resolveStageRewards(stage("aftermath"), ["quest_ts5_blackflag"]).flags).toEqual(expect.arrayContaining(["tusi_finale_won", "tusi_black_flag_rule"]));
  });

  it("玉泉寨断南线补给，血刀部降到档位 3；向导耳目与全寨备马合稿没写对战局的效果，不接", () => {
    expect(open("xuedao", [F.yuquanAlly])).toContain("quest_ts5_xuedao_weak");
    for (const f of [F.yuquanEyes, F.yuquanFull]) expect(open("xuedao", [f]), f).toEqual(["quest_ts5_xuedao"]);
  });

  it("梅朵代管要府4推举或锦官城支持继位，结局都记终局胜利", () => {
    expect(open("aftermath", [])).toEqual(["quest_ts5_settle"]);
    expect(open("aftermath", [F.meiduoRegent])).toContain("quest_ts5_regent");
    expect(open("aftermath", [F.meiduoBacked])).toContain("quest_ts5_regent");
    expect(resolveStageRewards(stage("aftermath"), ["quest_ts5_regent"]).flags).toEqual(expect.arrayContaining(["tusi_finale_won", "tusi_meiduo_regency"]));
    expect(resolveStageRewards(stage("aftermath"), ["quest_ts5_settle"]).flags).toEqual(["tusi_finale_won"]);
  });
});
