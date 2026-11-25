// WO-16F-F4b：learn settle 先裁后落——feature defer + 判官直签转写 + 自由文本裁量不回归
import { describe, expect, it } from "vitest";
import { learnNpcSkill } from "./learn.js";
import { judgeTurn } from "../../domain/rules/judge/judgeTurn.js";
import { materializeFacts } from "../../domain/rules/effects/materializeFacts.js";
import { MOVE_TYPE } from "../../domain/rules/combat/moveTypes.js";

const masterNpc = {
  name: "老拳师", levelCap: 3,
  moveset: [{ id: "mv_taizu", name: "太祖长拳", type: MOVE_TYPE.ATTACK, archetype: "拳", quality: "绿", desc: "入门拳法" }],
};
const makeState = (overrides = {}) => ({
  char: { money: 500, special: { 魅力: 5 }, hp: [80, 100] },
  companionState: {}, flags: [], inv: [], questProgress: {},
  room: { name: "曲措乡", npcs: [masterNpc] },
  skills: [], exp: 0, pot: 0, time: 1,
  varTree: { 角色: { 老拳师: { 好感度: 50 } }, 世界: {} },
  ...overrides,
});

describe("learnNpcSkill deferToJudge（F4b）", () => {
  it("defer：不扣银/不加技能/不写授业好感，learnRequest 带目录快照", () => {
    const state = makeState();
    const result = learnNpcSkill(state, masterNpc, { deferToJudge: true });
    expect(result.settleOptions.settleKind).toBe("learn_skill");
    const req = result.settleOptions.learnRequest;
    expect(req.npc).toBe("老拳师");
    expect(req.totalPrice).toBeGreaterThan(0);
    expect(Array.isArray(req.freshSkills)).toBe(true);
    expect(req.freshSkills.length).toBeGreaterThan(0);
    // 不扣银不加技能——changes 无 char/skills 键
    expect(result.changes.char).toBeUndefined();
    expect(result.changes.skills).toBeUndefined();
    // varTree 只记尝试——无好感日增账
    const tree = result.changes.varTree(state.varTree);
    expect(tree.世界?.好感日增?.gained?.老拳师).toBeUndefined();
  });

  it("legacy（默认）：前置硬结算不变——扣银+加技能+写好感、无 learnRequest", () => {
    const state = makeState();
    const result = learnNpcSkill(state, masterNpc);
    expect(result.settleOptions.learnRequest).toBeUndefined();
    expect(result.changes.skills).toBeDefined();
    expect(result.changes.char).toBeDefined();
  });

  it("束脩不足：只 logs 零账，defer 不产生 settle", () => {
    const state = makeState({ char: { money: 0, special: { 魅力: 5 }, hp: [80, 100] } });
    const result = learnNpcSkill(state, masterNpc, { deferToJudge: true });
    expect(result.settle).toBeUndefined();
    expect(result.changes).toBeUndefined();
    expect(result.logs?.[0]?.text).toContain("银两不够");
  });

  it("已学全（门规不过）：只 logs 零账", () => {
    const learned = { id: "mv_taizu", name: "太祖长拳", type: "外功" };
    const state = makeState({ skills: [learned] });
    const result = learnNpcSkill(state, masterNpc, { deferToJudge: true });
    expect(result.settle).toBeUndefined();
  });
});

describe("judgeTurn learn 直签转写（learnRequest）", () => {
  const mkEnvelope = (npcExtra = {}) => ({
    turn: 1, day: 1, place: "曲措乡",
    npcs: [{ ...masterNpc, ...npcExtra }],
    varTree: { 角色: { 老拳师: { 好感度: 50 } }, 世界: {} },
    inv: [], entries: [], char: { money: 500, hp: [80, 100] }, containers: {},
  });
  const learnAction = (req) => ({
    kind: "learn", target: "老拳师", itemId: "", direction: "none",
    stance: "casual", text: "拜师", learnRequest: req,
  });
  const sampleReq = {
    npc: "老拳师", isMaster: true, moveBrief: "太祖长拳(拳)", totalPrice: 30,
    freshSkills: [{ name: "太祖长拳", type: "外功", quality: "绿", moveType: "拳" }],
    beast: false,
  };

  it("直签三账：BESTOW_SKILL 带目录/束脩银/绝学好感 6，不用天机券", () => {
    const verdict = judgeTurn(mkEnvelope(), { read: "", refIds: [], actions: [learnAction(sampleReq)], proposals: [] }, { rng: () => 0.99 });
    const bestow = verdict.facts.find((f) => f.op === "BESTOW_SKILL");
    expect(bestow.skills).toHaveLength(1);
    expect(bestow.skills[0].name).toBe("太祖长拳");
    // 天机券不该出现（直签不走填名券）
    expect(verdict.warrants.filter((w) => w.op === "BESTOW_SKILL")).toHaveLength(0);
    const silver = verdict.facts.find((f) => f.op === "CHANGE_VITALS_SILVER");
    expect(silver.moneyDelta).toBe(-30);
    const social = verdict.facts.find((f) => f.op === "MUTATE_SOCIAL");
    expect(social.affectionDelta).toBe(6); // 绝学 6
    expect(social.ledgerKind).toBe("恩");
  });

  it("普通（非绝学）好感签 3；兽类不签好感", () => {
    const v1 = judgeTurn(mkEnvelope(), { read: "", refIds: [], actions: [learnAction({ ...sampleReq, isMaster: false })], proposals: [] }, { rng: () => 0.99 });
    expect(v1.facts.find((f) => f.op === "MUTATE_SOCIAL")?.affectionDelta).toBe(3);
    const beastNpc = { ...masterNpc, beast: true };
    const env = mkEnvelope();
    env.npcs = [beastNpc];
    const v2 = judgeTurn(env, { read: "", refIds: [], actions: [learnAction({ ...sampleReq, beast: true })], proposals: [] }, { rng: () => 0.99 });
    expect(v2.facts.find((f) => f.op === "MUTATE_SOCIAL")).toBeUndefined();
    // 兽类招式/束脩仍签
    expect(v2.facts.find((f) => f.op === "BESTOW_SKILL")).toBeTruthy();
  });

  it("分文不取（totalPrice 0）不签银两账", () => {
    const v = judgeTurn(mkEnvelope(), { read: "", refIds: [], actions: [learnAction({ ...sampleReq, totalPrice: 0 })], proposals: [] }, { rng: () => 0.99 });
    expect(v.facts.find((f) => f.op === "CHANGE_VITALS_SILVER")).toBeUndefined();
  });

  it("materializeFacts fact.skills 直落+已习得幂等", () => {
    const state = makeState();
    const facts = [{
      id: "F1_1", op: "BESTOW_SKILL", npc: "老拳师",
      skills: [{ name: "太祖长拳", type: "外功", quality: "绿", moveType: "拳" }],
    }];
    const r1 = materializeFacts(state, facts, []);
    expect((r1.changes?.skills || []).some((s) => s.name === "太祖长拳")).toBe(true);
    const count = (r1.changes?.skills || []).length;
    // 幂等：同一事实再来一遍不重复入列——skillsDirty 不置位，无重复写
    const r2 = materializeFacts({ ...state, skills: r1.changes.skills }, facts, []);
    expect(r2.changes?.skills).toBeUndefined();
    void count;
  });

  it("自由文本 learn（无 learnRequest）裁量路径不回归：rng 必败不签直签形状", () => {
    const freeAction = { kind: "learn", target: "老拳师", itemId: "", direction: "none", stance: "casual", text: "求你教我" };
    const v = judgeTurn(mkEnvelope(), { read: "", refIds: [], actions: [freeAction], proposals: [] }, { rng: () => 0.999 });
    // 必败——无 BESTOW_SKILL 直签（无 skills 数组形状），也无束脩银
    expect(v.facts.find((f) => f.op === "BESTOW_SKILL" && Array.isArray(f.skills))).toBeUndefined();
    expect(v.facts.find((f) => f.op === "CHANGE_VITALS_SILVER" && f.moneyDelta < 0)).toBeUndefined();
  });
  it("束脩防御性原子 guard：信封银两不足整批零 facts（返修）", () => {
    const env = mkEnvelope();
    env.char = { money: 5, hp: [80, 100] }; // 不足 30 两束脩
    const v = judgeTurn(env, { read: "", refIds: [], actions: [learnAction(sampleReq)], proposals: [] }, { rng: () => 0.99 });
    expect(v.facts.find((f) => f.op === "BESTOW_SKILL")).toBeUndefined();
    expect(v.facts.find((f) => f.op === "CHANGE_VITALS_SILVER")).toBeUndefined();
    expect(v.facts.find((f) => f.op === "MUTATE_SOCIAL")).toBeUndefined();
    expect((v.notes || []).join("")).toContain("束脩不足");
  });

  it("同名异 id 照授不误跳过——定价按 id，跳过也只按 id（Review 修）", () => {
    const state = makeState({ skills: [{ id: "kf_other", name: "太祖长拳", type: "外功" }] });
    const facts = [{
      id: "F1_1", op: "BESTOW_SKILL", npc: "老拳师",
      skills: [{ id: "mv_taizu", name: "太祖长拳", type: "外功", quality: "绿" }],
    }];
    const r = materializeFacts(state, facts, []);
    // 同名异 id：照授（与 legacy/定价同语义）——两条共存
    expect((r.changes?.skills || []).filter((s) => s.name === "太祖长拳")).toHaveLength(2);
    // 同 id 才幂等跳过
    const r2 = materializeFacts({ ...state, skills: r.changes.skills }, facts, []);
    expect(r2.changes?.skills).toBeUndefined();
  });

});
