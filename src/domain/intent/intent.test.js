import { describe, expect, it } from "vitest";
import { ACTION_KINDS, SILVER, NONE, parseSilverAmount, slotOptions, visibleNpcs } from "./actionKinds.js";
import { parseChoice, probsFromLogprobs, renderPrompt, TEMPLATES } from "./prompts.js";
import { recognizeIntent } from "./recognizer.js";
import { gateRecognition, ROUTES, confirmLine } from "./gate.js";
import { validatePlan } from "./systemGate.js";
import { formatPlanNote, planExtractionNote, filterRejectedEffects, filterPlanDelta } from "./planNotes.js";
import { splitConditionClause } from "./conditions.js";
import { armIntentTriggers, fireIntentTriggers, expireIntentTriggers, intentTriggers } from "../../store/intentPendingStore.js";

const state = {
  room: { name: "测试镇", npcs: [{ name: "才旦" }, { name: "卓玛" }] },
  innerRoomName: null,
  inv: ["酥油茶", "青稞酒", "青稞酒"],
  char: { money: 150 },
};

function scripted(answers) {
  const calls = [];
  return {
    calls,
    async decide(question, vars, options) {
      calls.push({ question, text: vars.text, options });
      const [choice, p] = answers[question]?.(vars.text, options) || [options[0], 1];
      return { choice, probs: Object.fromEntries(options.map((o) => [o, o === choice ? p : (1 - p) / (options.length - 1 || 1)])) };
    },
    async split() { calls.push({ question: "split" }); return ["给才旦100两", "再跟才旦切磋"]; },
  };
}

describe("slots", () => {
  it("parses silver amounts from player text (system, not model)", () => {
    expect(parseSilverAmount("把100两给才旦")).toBe(100);
    expect(parseSilverAmount("送他一百二十两银子")).toBe(120);
    expect(parseSilverAmount("给卓玛五十两")).toBe(50);
    expect(parseSilverAmount("两两银子")).toBe(2);
    expect(parseSilverAmount("送两个馒头")).toBeNull();
    expect(parseSilverAmount("给才旦0.5两")).toBeNull();
  });

  it("builds target options from NPCs visible in the current inner room", () => {
    const inner = { ...state, room: { name: "测试镇", npcs: [{ name: "才旦" }, { name: "卓玛", pursuitInnerRoom: "后院" }] }, innerRoomName: "前厅" };
    expect(visibleNpcs(inner).map((n) => n.name)).toEqual(["才旦"]);
    expect(slotOptions(inner, ACTION_KINDS.DUEL, "target")).toEqual(["才旦", NONE]);
    expect(slotOptions(state, ACTION_KINDS.GIFT, "item")).toEqual([SILVER, "酥油茶", "青稞酒", NONE]);
    expect(slotOptions(state, ACTION_KINDS.USE_ITEM, "item")).toEqual(["酥油茶", "青稞酒", NONE]);
  });
});

describe("prompts", () => {
  it("renders frozen templates with options", () => {
    expect(Object.isFrozen(TEMPLATES)).toBe(true);
    expect(renderPrompt("kind", { text: "切磋", options: ["切磋", "其他"] })).toContain("「切磋」、「其他」");
  });

  it("parses stated probabilities and normalizes", () => {
    const out = parseChoice('好的 {"choice":"切磋","probs":{"切磋":0.8,"其他":0.4,"乱写":1}}', ["切磋", "其他"]);
    expect(out.choice).toBe("切磋");
    expect(out.probs.切磋).toBeCloseTo(2 / 3);
    expect(parseChoice("不是JSON", ["才旦", NONE])).toMatchObject({ choice: NONE, parseFailed: true });
  });

  it("prefers logprobs when the provider exposes them", () => {
    const tokens = ['{"', 'choice', '":"', "才", '旦"}'].map((token) => ({ token, logprob: 0 }));
    tokens[3].top_logprobs = [{ token: "才", logprob: Math.log(0.7) }, { token: "卓", logprob: Math.log(0.3) }];
    const probs = probsFromLogprobs({ content: tokens }, ["才旦", "卓玛", NONE]);
    expect(probs.才旦).toBeCloseTo(0.7);
    expect(probs.卓玛).toBeCloseTo(0.3);
  });
});

describe("recognizeIntent", () => {
  it("asks one question per thing and skips the compound gate for plain lines", async () => {
    const classifier = scripted({ kind: () => ["赠送", 0.98], target: () => ["才旦", 0.97], item: () => [SILVER, 0.99] });
    const result = await recognizeIntent(state, "把100两给才旦", { classifier });
    expect(classifier.calls.map((c) => c.question)).toEqual(["kind", "target", "item"]);
    expect(result.compound).toBe(0);
    expect(result.actions[0]).toMatchObject({ kind: "赠送", target: "才旦", item: SILVER, amount: 100 });
    expect(result.actions[0].confidence).toBeCloseTo(0.98 * 0.97 * 0.99);
    expect(gateRecognition(result).route).toBe(ROUTES.EXECUTE);
    expect(confirmLine(result.actions)).toBe("你是要把100两给才旦吗？");
  });

  it("splits compound lines into an ordered list only after the yes/no gate", async () => {
    const classifier = scripted({
      compound: () => ["是", 0.9],
      kind: (text) => (text.includes("切磋") ? ["切磋", 0.97] : ["赠送", 0.97]),
      target: () => ["才旦", 0.99], item: () => [SILVER, 0.99],
    });
    const result = await recognizeIntent(state, "给才旦100两，再跟才旦切磋", { classifier });
    expect(classifier.calls[0].question).toBe("compound");
    expect(result.actions.map((a) => a.kind)).toEqual(["赠送", "切磋"]);
    expect(gateRecognition(result).route).toBe(ROUTES.CONFIRM);
  });

  it("routes chit-chat, refusals and low confidence to the free-action path", () => {
    expect(gateRecognition({ actions: [{ kind: "交谈", confidence: 0.99 }] }).route).toBe(ROUTES.FALLBACK);
    expect(gateRecognition({ actions: [{ kind: "切磋", confidence: 0.4 }] }).route).toBe(ROUTES.FALLBACK);
    expect(gateRecognition({ actions: [{ kind: "切磋", confidence: 0.7 }] }).route).toBe(ROUTES.CONFIRM);
    expect(gateRecognition({ actions: [] }).route).toBe(ROUTES.FALLBACK);
  });
});

describe("system gate", () => {
  const gift = (amount, target = "才旦") => ({ kind: "赠送", target, item: SILVER, amount, text: `给${target}${amount}两` });

  it("validates in order on simulated state and stops at the first failing step", () => {
    const plan = validatePlan(state, [gift(100), gift(100, "卓玛"), { kind: "切磋", target: "才旦" }]);
    expect(plan.valid.map((s) => s.index)).toEqual([0]);
    expect(plan.rejected).toMatchObject({ index: 1, reason: "银两不够（身上只有50两）" });
    expect(plan.skipped.map((s) => s.kind)).toEqual(["切磋"]);
  });

  it("tracks item counts and NPC presence across steps", () => {
    const wine = { kind: "赠送", target: "卓玛", item: "青稞酒" };
    expect(validatePlan(state, [wine, wine]).rejected).toBeNull();
    expect(validatePlan(state, [wine, wine, wine]).rejected.reason).toBe("背包里没有青稞酒");
    expect(validatePlan(state, [{ kind: "切磋", target: "王掌柜" }]).rejected.reason).toBe("王掌柜不在此处");
    expect(validatePlan(state, [{ kind: "移动", direction: "东" }, { kind: "切磋", target: "才旦" }]).rejected.reason).toContain("走动之后");
  });

  it("feeds stage 2 a structured note and keeps stage 3 from writing rejected effects", () => {
    const plan = validatePlan(state, [gift(100), gift(100, "卓玛")]);
    const note = formatPlanNote(plan, state);
    expect(note).toContain("1. 把100两给才旦（系统已核准）");
    expect(note).toContain("系统拒绝：银两不够");
    expect(planExtractionNote(plan)).toContain("不得为其输出任何状态变化");
    const kept = filterRejectedEffects([{ path: "人物.才旦.好感", value: 5 }, { path: "人物.卓玛.好感", value: 5 }], plan);
    expect(kept).toEqual([{ path: "人物.才旦.好感", value: 5 }]);
    expect(planExtractionNote(validatePlan(state, [gift(10)]))).toBe("");
  });

  it("keeps stage 3 from deleting inventory the system already settled or rejected", () => {
    const plan = validatePlan(state, [{ kind: "赠送", target: "卓玛", item: "青稞酒" }, { kind: "切磋", target: "王掌柜" }, { kind: "使用物品", item: "酥油茶" }]);
    const p = { delta: { items_rm: ["青稞酒", { name: "酥油茶" }, "馒头"] } };
    expect(filterPlanDelta(p, plan).delta.items_rm).toEqual(["馒头"]);
    expect(filterPlanDelta(p, null)).toBe(p);
  });

  it("applies the same learning thresholds as the button and charges tuition in the simulation", () => {
    const angry = { ...state, varTree: { 角色: { 才旦: { 生气状态: { active: true } } } } };
    const learn = { kind: "拜师/学艺", target: "才旦" };
    const plan = validatePlan(state, [learn, gift(100)]);
    expect(plan.valid).toHaveLength(0);
    expect(plan.rejected.reason).toBeTruthy();
    expect(plan.skipped).toHaveLength(1);
    expect(validatePlan(angry, [learn]).rejected.reason).toBe("才旦正在气头上，不肯传授");
  });
});

describe("conditional steps", () => {
  it("splits 「要是/如果/若/万一…就/便」 clauses into premise and action", () => {
    expect(splitConditionClause("路上要是碰到山贼就打他")).toMatchObject({ detail: "路上碰到山贼", actionText: "打他" });
    expect(splitConditionClause("若他不肯教，就走")).toMatchObject({ detail: "他不肯教", actionText: "走" });
    expect(splitConditionClause("如果下雨就找地方避一避")).toMatchObject({ detail: "下雨", actionText: "找地方避一避" });
    expect(splitConditionClause("给才旦100两")).toBeNull();
    expect(splitConditionClause("我想切磋")).toBeNull();
  });

  it("asks the cond question once and attaches the trigger to the action", async () => {
    const classifier = scripted({
      cond: () => ["遇敌", 0.92],
      kind: () => ["切磋", 0.97],
      target: () => ["才旦", 0.99],
    });
    const result = await recognizeIntent(state, "要是碰到山贼就跟他切磋", { classifier });
    expect(classifier.calls.map((c) => c.question)).toEqual(["cond", "kind", "target"]);
    expect(result.actions[0]).toMatchObject({ kind: "切磋", target: "才旦", condition: { on: "encounter", detail: "碰到山贼" } });
    expect(gateRecognition(result).route).toBe(ROUTES.CONFIRM);
    expect(validatePlan(state, result.actions).triggers).toHaveLength(1);
  });

  it("falls back to free text for the clause alone when the premise is outside the fixed list", async () => {
    const classifier = scripted({
      compound: () => ["是", 0.9],
      kind: (text) => (text.includes("切磋") ? ["切磋", 0.97] : ["赠送", 0.97]),
      cond: () => ["其他", 0.9],
      target: () => ["才旦", 0.99], item: () => [SILVER, 0.99],
      split: undefined,
    });
    classifier.split = async () => ["给才旦100两", "要是下雨就躲"];
    const result = await recognizeIntent(state, "给才旦100两，要是下雨就躲", { classifier });
    expect(result.actions[1]).toMatchObject({ kind: "其他", free: true, text: "要是下雨就躲" });
    // 条件段只回落它自己；其余步骤照常过闸。
    expect(gateRecognition(result).route).not.toBe(ROUTES.FALLBACK);
    const plan = validatePlan(state, result.actions);
    expect(plan.valid).toHaveLength(1);
    expect(plan.freeSteps).toHaveLength(1);
  });

  it("keeps conditioned steps out of immediate validation and arms them as triggers", () => {
    const gift = { kind: "赠送", target: "才旦", item: SILVER, amount: 100 };
    const cond = { kind: "切磋", target: "不在场的人", condition: { on: "encounter", detail: "碰到山贼" } };
    const plan = validatePlan(state, [gift, cond]);
    expect(plan.valid).toHaveLength(1);
    expect(plan.rejected).toBeNull();
    expect(plan.triggers).toMatchObject([{ kind: "切磋", condition: { on: "encounter" } }]);
  });

  it("lets a refused-conditioned step fire while later steps are skipped", () => {
    const learn = { kind: "拜师/学艺", target: "才旦" }; // 好感不够，系统必拒
    const refused = { kind: "交谈", target: "才旦", condition: { on: "refused", detail: "他不肯教" } };
    const other = { kind: "其他", text: "回家", condition: { on: "arrive", detail: "到家" } };
    const plan = validatePlan(state, [learn, refused, other]);
    expect(plan.rejected.kind).toBe("拜师/学艺");
    expect(plan.refused).toMatchObject({ condition: { on: "refused" } });
    expect(plan.skipped.map((s) => s.condition?.on)).toEqual(["arrive"]);
  });

  it("arms, fires and expires triggers in the shared intent store", () => {
    expireIntentTriggers();
    const steps = [
      { kind: "切磋", target: "才旦", condition: { on: "encounter", detail: "碰到山贼" } },
      { kind: "其他", text: "看看四周", condition: { on: "arrive", detail: "到了白塔" } },
    ];
    armIntentTriggers(steps);
    expect(intentTriggers()).toHaveLength(2);
    // 和气的势力过路人不算「遇敌」，触发器原样留着。
    expect(fireIntentTriggers("encounter", { hostile: false })).toEqual([]);
    expect(intentTriggers()).toHaveLength(2);
    const fired = fireIntentTriggers("encounter", { hostile: true });
    expect(fired.map((entry) => entry.step.kind)).toEqual(["切磋"]);
    expect(intentTriggers()).toHaveLength(1);
    // 行程未完、前提也没点名目的地时，「到达」不算应验。
    expect(fireIntentTriggers("arrive", { dest: "喇嘛庙", travelDone: false })).toEqual([]);
    expect(fireIntentTriggers("arrive", { dest: "白塔", travelDone: false })).toHaveLength(1);
    // 前提点名了别处：行程在别处走完也不算应验；没点地名：行程走完才应验。
    armIntentTriggers([{ kind: "其他", text: "拜佛", condition: { on: "arrive", detail: "到了喇嘛庙" } }, { kind: "其他", text: "歇脚", condition: { on: "arrive", detail: "到了以后" } }]);
    expect(fireIntentTriggers("arrive", { dest: "白塔", travelDone: true }).map((entry) => entry.step.text)).toEqual(["歇脚"]);
    expect(fireIntentTriggers("arrive", { dest: "喇嘛庙", travelDone: true }).map((entry) => entry.step.text)).toEqual(["拜佛"]);
    armIntentTriggers([{ kind: "其他", text: "走", condition: { on: "refused", detail: "他不肯" } }]);
    expect(expireIntentTriggers()).toHaveLength(1);
    expect(intentTriggers()).toHaveLength(0);
  });
});
