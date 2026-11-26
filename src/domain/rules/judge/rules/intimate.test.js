import { describe, expect, it } from "vitest";
import { judgeTurn } from "../judgeTurn.js";

const NPC = { name: "元朵朵", personality: "活泼", archetype: "eccentric" };
const base = {
  turn: 1, day: 1, place: "天都镇", npcs: [NPC],
  varTree: { 角色: { 元朵朵: { 好感度: 60 } } },
  inv: [], entries: [], char: { money: 100 },
};
const intakeWith = (actions) => ({ read: "x", refIds: [], actions, proposals: [] });
const intimateAction = { kind: "free_act", target: "元朵朵", text: "抱住她", intimate: true, condition: "无" };

function run(ictx, actions = [intimateAction]) {
  return judgeTurn({ ...base, intimateCtx: ictx }, intakeWith(actions), { rng: () => 0.5 });
}

describe("V8 亲密回合社交结算", () => {
  it("三档结算：余量≥25→+3 / 10-24→+2 / 0-9→+1，均恩·闺房温存", () => {
    // eccentic 门槛 45，好感 60 → 余量 15 → +2
    const v = run({ npc: "元朵朵", ticket: false, threshold: 45, affection: 60 });
    const f = v.facts.find((x) => x.op === "MUTATE_SOCIAL");
    expect(f.affectionDelta).toBe(2);
    expect(f.ledgerKind).toBe("恩");
    expect(f.reason).toBe("闺房温存");
    const v3 = run({ npc: "元朵朵", ticket: false, threshold: 45, affection: 70 });
    expect(v3.facts.find((x) => x.op === "MUTATE_SOCIAL").affectionDelta).toBe(3);
    const v1 = run({ npc: "元朵朵", ticket: false, threshold: 45, affection: 48 });
    expect(v1.facts.find((x) => x.op === "MUTATE_SOCIAL").affectionDelta).toBe(1);
  });
  it("凭卡强开=被迫 -3 怨·闺房被迫；余量<0 非凭卡兜底勉强 -2", () => {
    const vt = run({ npc: "元朵朵", ticket: true, threshold: 45, affection: 10 });
    const ft = vt.facts.find((x) => x.op === "MUTATE_SOCIAL");
    expect(ft.affectionDelta).toBe(-3);
    expect(ft.ledgerKind).toBe("怨");
    expect(ft.reason).toBe("闺房被迫");
    const ve = run({ npc: "元朵朵", ticket: false, threshold: 45, affection: 40 });
    const fe = ve.facts.find((x) => x.op === "MUTATE_SOCIAL");
    expect(fe.affectionDelta).toBe(-2);
    expect(fe.reason).toBe("闺房勉强");
  });
  it("兽类/intimacy.forbidden 不产事实（含凭卡撬开 forbidden）", () => {
    const beast = { ...NPC, name: "雪豹", beast: true };
    const v = judgeTurn({ ...base, npcs: [beast], intimateCtx: { npc: "雪豹", ticket: false, threshold: 45, affection: 90 } },
      intakeWith([{ ...intimateAction, target: "雪豹" }]), { rng: () => 0.5 });
    expect(v.facts.filter((x) => x.op === "MUTATE_SOCIAL")).toHaveLength(0);
    const forb = { ...NPC, intimacy: { forbidden: true } };
    const v2 = judgeTurn({ ...base, npcs: [forb], intimateCtx: { npc: "元朵朵", ticket: true, threshold: 45, affection: 0 } },
      intakeWith([intimateAction]), { rng: () => 0.5 });
    expect(v2.facts.filter((x) => x.op === "MUTATE_SOCIAL")).toHaveLength(0);
  });
  it("witnesses 收窄只主角+对象，闺房密事不全村目击", () => {
    const v = run({ npc: "元朵朵", ticket: false, threshold: 45, affection: 60 });
    const f = v.facts.find((x) => x.op === "MUTATE_SOCIAL");
    expect(f.witnesses).toEqual(["主角", "元朵朵"]);
  });
  it("无 intimateCtx（门禁未放行/非亲密回合）不产事实——判官不补闸", () => {
    const v = run(null);
    expect(v.facts.filter((x) => x.op === "MUTATE_SOCIAL")).toHaveLength(0);
  });
  it("intimate=true 动作不进 free_act 破费链重复结算", () => {
    // 原话写「花五两」的亲密动作——若不拦截 freeAct 会签破费，现在只应有亲密事实
    const v = run({ npc: "元朵朵", ticket: false, threshold: 45, affection: 60 },
      [{ ...intimateAction, outcome: "破费", text: "花五两银子买春宵" }]);
    const social = v.facts.filter((x) => x.op === "MUTATE_SOCIAL");
    expect(social).toHaveLength(1);
    expect(v.facts.filter((x) => x.op !== "MUTATE_SOCIAL")).toHaveLength(0);
  });
  it("回合至多一条——多个 intimate 动作不重复签发", () => {
    const v = run({ npc: "元朵朵", ticket: false, threshold: 45, affection: 60 },
      [intimateAction, { ...intimateAction, text: "再亲一口" }]);
    expect(v.facts.filter((x) => x.op === "MUTATE_SOCIAL")).toHaveLength(1);
  });
});

describe("V8 Review 修：条件未成不颁奖/nsfw 关不吞调情", () => {
  it("亲密动作前提未成（condition 不成立）不签发好感——行为未发生", () => {
    const condAction = { ...intimateAction, condition: "到了地方", condition_text: "到了地方" };
    // 无移动无到达——evaluateActionCondition 判未成的语境
    const v = run({ npc: "元朵朵", ticket: false, threshold: 45, affection: 60 }, [condAction]);
    expect(v.facts.filter((x) => x.op === "MUTATE_SOCIAL")).toHaveLength(0);
  });
  it("前提成立则照签不误", () => {
    const v = run({ npc: "元朵朵", ticket: false, threshold: 45, affection: 60 });
    expect(v.facts.filter((x) => x.op === "MUTATE_SOCIAL")).toHaveLength(1);
  });
  it("无 intimateCtx（nsfw 关/门禁未跑）时 intimate 动作落回 free_act 正路不吞", () => {
    // nsfw 关：门禁不介入，flirt 动作按普通 free_act 处理——破费链可正常解读
    const v = run(null, [{ ...intimateAction, outcome: "破费", text: "花五两银子买酒助兴" }]);
    // 无亲密事实（无 ctx），但 free_act 破费链不被拦截——
    // 验证点：动作未被「intimate 跳过」吞掉，freeAct 链有机会签发或留痕
    expect(v.facts.filter((x) => x.op === "MUTATE_SOCIAL")).toHaveLength(0);
    // 破费在册即证明没落黑洞（freeAct 签发 MUTATE_VITALS/CHANGE_MONEY 类或至少进 notes）
    const signed = v.facts.length + v.notes.filter((n) => n.includes("破费") || n.includes("开销")).length;
    expect(signed).toBeGreaterThan(0);
  });
});
