import { describe, expect, it } from "vitest";
import { ACTION_KINDS, KIND_LIST, SILVER, NONE, HARD_ACTION_RE, parseSilverAmount, slotOptions, visibleNpcs } from "./actionKinds.js";
import { renderPrompt, TEMPLATES } from "./prompts.js";
import { recognizeIntent, clampConfidence } from "./recognizer.js";
import { gateRecognition, ROUTES, confirmLine } from "./gate.js";
import { validatePlan } from "./systemGate.js";
import { formatPlanNote, planExtractionNote, filterRejectedEffects, filterPlanDelta } from "./planNotes.js";
import { splitConditionClause } from "./conditions.js";
import { armIntentTriggers, fireIntentTriggers, expireIntentTriggers, intentTriggers } from "../../../store/intentPendingStore.js";
import { QUCUO_MAP } from "../../data/map/qucuoMap.js";

const INTENT_PLACE_NAMES = Object.keys(QUCUO_MAP);

const state = {
  room: { name: "测试镇", npcs: [{ name: "才旦" }, { name: "卓玛" }] },
  innerRoomName: null,
  inv: ["酥油茶", "青稞酒", "青稞酒"],
  char: { money: 150 },
};

// 一次调用的假分类器：按整句返回预设 JSON，并记录每次收到的候选清单。
function scripted(reply) {
  const calls = [];
  return {
    calls,
    async recognize(vars) {
      calls.push(vars);
      return typeof reply === "function" ? reply(vars) : reply;
    },
  };
}

const act = (fields) => ({ target: "无", item: "无", direction: "无", condition: "无", confidence: 0.99, ...fields });

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
  it("renders the frozen template with every candidate list at once", () => {
    expect(Object.isFrozen(TEMPLATES)).toBe(true);
    const prompt = renderPrompt("recognize", { text: "送他酒", hints: "", kinds: ["赠送", "其他"], targets: ["才旦"], giftItems: [SILVER, "青稞酒"], useItems: [], pickupItems: [], equipItems: [], directions: ["北"] });
    expect(prompt).toContain("玩家原话：「送他酒」");
    expect(prompt).toContain("行动类别：「赠送」、「其他」");
    expect(prompt).toContain("在场人物：「才旦」");
    expect(prompt).toContain("赠送可用物品：「银两」、「青稞酒」");
    expect(prompt).toContain("拾取可用物品：（无）");
  });

  it("clamps the model's stated confidence into [0,1]", () => {
    expect(clampConfidence(0.8)).toBe(0.8);
    expect(clampConfidence(1)).toBe(1);
    expect(clampConfidence(95)).toBeCloseTo(0.95);
    expect(clampConfidence(-1)).toBe(0);
    expect(clampConfidence("0.7")).toBeCloseTo(0.7);
    expect(clampConfidence(undefined)).toBe(0);
  });
});

describe("HARD_ACTION_RE", () => {
  const samples = {
    赠送: "送他一壶酒", 购买: "买两个馒头", 切磋: "跟他切磋", "拜师/学艺": "拜他为师", 邀同行: "邀他同行",
    偷窃: "偷他的钱袋", "平息/道歉": "向他赔罪", 移动: "往北走", 使用物品: "喝掉青稞酒", 拾取: "捡起枯枝", "装备/卸下": "穿上皮袍",
  };
  it("has a keyword sample for every closed kind (free kinds need none)", () => {
    const hard = KIND_LIST.filter((kind) => kind !== ACTION_KINDS.TALK && kind !== ACTION_KINDS.OTHER);
    expect(Object.keys(samples).sort()).toEqual([...hard].sort());
    for (const [kind, text] of Object.entries(samples)) expect(HARD_ACTION_RE.test(text), kind).toBe(true);
  });

  it("does not match pure intimate prose", () => {
    expect(HARD_ACTION_RE.test("（搂住亲嘴）（舌吻）我喜欢你（摸她的下面…）")).toBe(false);
  });
});

describe("recognizeIntent", () => {
  it("makes exactly one classifier call and builds every candidate list from live state", async () => {
    const classifier = scripted({ actions: [act({ text: "把100两给才旦", kind: "赠送", target: "才旦", item: SILVER, confidence: 0.98 })] });
    const result = await recognizeIntent(state, "把100两给才旦", { classifier });
    expect(classifier.calls).toHaveLength(1);
    expect(classifier.calls[0]).toMatchObject({
      text: "把100两给才旦", kinds: KIND_LIST, targets: ["才旦", "卓玛"], directions: ["北", "南", "东", "西"],
      giftItems: [SILVER, "酥油茶", "青稞酒"], useItems: ["酥油茶", "青稞酒"], pickupItems: [], equipItems: ["酥油茶", "青稞酒"],
    });
    expect(result.actions[0]).toMatchObject({ kind: "赠送", target: "才旦", item: SILVER, amount: 100, confidence: 0.98 });
    expect(gateRecognition(result).route).toBe(ROUTES.EXECUTE);
    expect(confirmLine(result.actions)).toBe("你是要把100两给才旦吗？");
  });

  it("reports one stage for the whole sentence", async () => {
    const stages = [];
    const classifier = scripted({ actions: [act({ text: "跟才旦切磋", kind: "切磋", target: "才旦" })] });
    await recognizeIntent(state, "跟才旦切磋", { classifier, onStage: (label) => stages.push(label) });
    expect(stages).toEqual(["识别·整句"]);
  });

  it("returns an ordered compound plan from the single reply", async () => {
    const classifier = scripted({ actions: [
      act({ text: "给才旦100两", kind: "赠送", target: "才旦", item: SILVER, confidence: 0.97 }),
      act({ text: "再跟才旦切磋", kind: "切磋", target: "才旦", confidence: 0.97 }),
    ] });
    const result = await recognizeIntent(state, "给才旦100两，再跟才旦切磋", { classifier });
    expect(classifier.calls).toHaveLength(1);
    expect(result.actions.map((a) => a.kind)).toEqual(["赠送", "切磋"]);
    expect(gateRecognition(result).route).toBe(ROUTES.EXECUTE);
  });

  it("sends moderately confident plans to CONFIRM rather than EXECUTE", async () => {
    const classifier = scripted({ actions: [act({ text: "跟才旦切磋", kind: "切磋", target: "才旦", confidence: 0.9 })] });
    expect(gateRecognition(await recognizeIntent(state, "跟才旦切磋", { classifier })).route).toBe(ROUTES.CONFIRM);
  });

  it("demotes an action whose target, item or direction is not in the candidate list", async () => {
    const classifier = scripted({ actions: [act({ text: "给王掌柜青稞酒", kind: "赠送", target: "王掌柜", item: "青稞酒" })] });
    const result = await recognizeIntent(state, "给王掌柜青稞酒", { classifier });
    expect(result.actions[0]).toMatchObject({ kind: "其他", text: "给王掌柜青稞酒", target: null, item: null });
    expect(gateRecognition(result).route).toBe(ROUTES.FALLBACK);

    const noItem = scripted({ actions: [act({ text: "送才旦一壶好酒", kind: "赠送", target: "才旦", item: "一壶好酒" })] });
    expect((await recognizeIntent(state, "送才旦一壶好酒", { classifier: noItem })).actions[0].kind).toBe("其他");

    const badDir = scripted({ actions: [act({ text: "往上走", kind: "移动", direction: "上" })] });
    expect((await recognizeIntent(state, "往上走", { classifier: badDir })).actions[0].kind).toBe("其他");
  });

  it("keeps an explicit 「无」 slot so the system gate can explain the refusal", async () => {
    const classifier = scripted({ actions: [act({ text: "送才旦一壶酒", kind: "赠送", target: "才旦", item: "无" })] });
    const result = await recognizeIntent(state, "送才旦一壶酒", { classifier });
    expect(result.actions[0]).toMatchObject({ kind: "赠送", target: "才旦", item: NONE });
  });

  it("treats unknown kinds as 其他 and rejects the whole reply when a text is not a substring of the input", async () => {
    const unknownKind = scripted({ actions: [act({ text: "跳个舞", kind: "跳舞" })] });
    expect((await recognizeIntent(state, "跳个舞", { classifier: unknownKind })).actions[0].kind).toBe("其他");
    const invented = scripted({ actions: [act({ text: "给才旦100两", kind: "赠送", target: "才旦", item: SILVER }), act({ text: "编出来的话", kind: "切磋", target: "才旦" })] });
    expect((await recognizeIntent(state, "给才旦100两", { classifier: invented })).actions).toEqual([]);
  });

  it("falls back on an empty or unparsable reply", async () => {
    for (const reply of [{ actions: [] }, { actions: [], parseFailed: true }, null]) {
      const result = await recognizeIntent(state, "跟才旦切磋", { classifier: scripted(reply) });
      expect(gateRecognition(result).route).toBe(ROUTES.FALLBACK);
    }
  });

  it("routes chit-chat, refusals and low confidence to the free-action path", () => {
    expect(gateRecognition({ actions: [{ kind: "交谈", confidence: 0.99 }] }).route).toBe(ROUTES.FALLBACK);
    expect(gateRecognition({ actions: [{ kind: "切磋", confidence: 0.4 }] }).route).toBe(ROUTES.FALLBACK);
    expect(gateRecognition({ actions: [{ kind: "切磋", confidence: 0.7 }] }).route).toBe(ROUTES.CONFIRM);
    expect(gateRecognition({ actions: [{ kind: "切磋", confidence: 0.94 }] }).route).toBe(ROUTES.CONFIRM);
    expect(gateRecognition({ actions: [{ kind: "切磋", confidence: 0.95 }] }).route).toBe(ROUTES.EXECUTE);
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

  it("gates steal/invite/appease/pickup/equip to the same presence and item checks", () => {
    const angry = { ...state, varTree: { 角色: { 才旦: { 生气状态: { active: true } } } } };
    const ground = { ...state, room: { ...state.room, items: [{ name: "枯枝" }] } };
    // 拾取的物品槽列的是地上物，装备槽列的是背包。
    expect(slotOptions(ground, ACTION_KINDS.PICKUP, "item")).toEqual(["枯枝", NONE]);
    expect(slotOptions(state, ACTION_KINDS.PICKUP, "item")).toEqual([NONE]);
    expect(slotOptions(state, ACTION_KINDS.EQUIP, "item")).toEqual(["酥油茶", "青稞酒", NONE]);
    // 目标类：偷窃/邀同行/平息都要求对象在场。
    expect(validatePlan(state, [{ kind: "偷窃", target: "王掌柜" }]).rejected.reason).toBe("王掌柜不在此处");
    expect(validatePlan(state, [{ kind: "偷窃", target: "才旦" }]).rejected).toBeNull();
    expect(validatePlan(state, [{ kind: "邀同行", target: "卓玛" }]).rejected).toBeNull();
    expect(validatePlan(state, [{ kind: "平息/道歉", target: "才旦" }]).rejected.reason).toBe("才旦并没有在生气");
    expect(validatePlan(angry, [{ kind: "平息/道歉", target: "才旦" }]).rejected).toBeNull();
    // 物品类：拾取查地上物，装备查背包；装备候选额外含地上物（先捡后穿的复合指令）。
    expect(slotOptions(ground, ACTION_KINDS.EQUIP, "item")).toEqual(["酥油茶", "青稞酒", "枯枝", NONE]);
    expect(validatePlan(ground, [{ kind: "拾取", item: "枯枝" }]).rejected).toBeNull();
    expect(validatePlan(state, [{ kind: "拾取", item: "枯枝" }]).rejected.reason).toBe("地上没有枯枝");
    expect(validatePlan(state, [{ kind: "装备/卸下", item: "酥油茶" }]).rejected).toBeNull();
    expect(validatePlan(state, [{ kind: "装备/卸下", item: "长剑" }]).rejected.reason).toBe("背包里没有长剑");
  });

  it("lets a pickup-then-equip compound pass: picked items enter the simulated bag", () => {
    const ground = { ...state, room: { ...state.room, items: [{ name: "枯枝" }] } };
    const plan = validatePlan(ground, [{ kind: "拾取", item: "枯枝" }, { kind: "装备/卸下", item: "枯枝" }]);
    expect(plan.rejected).toBeNull();
    expect(plan.valid).toHaveLength(2);
    // 同一件地上物不能连捡两次；地上有两件同名物则可以。
    expect(validatePlan(ground, [{ kind: "拾取", item: "枯枝" }, { kind: "拾取", item: "枯枝" }]).rejected.reason).toBe("地上没有枯枝");
    const twoTwigs = { ...state, room: { ...state.room, items: [{ name: "枯枝" }, { name: "枯枝" }] } };
    expect(validatePlan(twoTwigs, [{ kind: "拾取", item: "枯枝" }, { kind: "拾取", item: "枯枝" }]).rejected).toBeNull();
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

  it("attaches the trigger from the same single reply and hints the local clause split", async () => {
    const classifier = scripted({ actions: [act({ text: "跟他切磋", kind: "切磋", target: "才旦", condition: "遇敌", condition_text: "碰到山贼", confidence: 0.92 })] });
    const result = await recognizeIntent(state, "要是碰到山贼就跟他切磋", { classifier });
    expect(classifier.calls).toHaveLength(1);
    expect(classifier.calls[0].hints).toContain("前提「碰到山贼」");
    expect(result.actions[0]).toMatchObject({ kind: "切磋", target: "才旦", condition: { on: "encounter", detail: "碰到山贼" } });
    expect(gateRecognition(result).route).toBe(ROUTES.CONFIRM);
    expect(validatePlan(state, result.actions).triggers).toHaveLength(1);
  });

  it("falls back to the clause's own detail when the model omits or invents the premise text", async () => {
    const classifier = scripted({ actions: [act({ text: "打他", kind: "其他", condition: "遇敌", condition_text: "编造的前提" })] });
    const result = await recognizeIntent(state, "路上要是碰到山贼就打他", { classifier });
    expect(result.actions[0].condition).toEqual({ on: "encounter", detail: "路上碰到山贼" });
  });

  it("falls back to free text for the clause alone when the premise is outside the fixed list", async () => {
    const classifier = scripted({ actions: [
      act({ text: "给才旦100两", kind: "赠送", target: "才旦", item: SILVER }),
      act({ text: "要是下雨就躲", kind: "其他", condition: "其他", condition_text: "下雨" }),
    ] });
    const result = await recognizeIntent(state, "给才旦100两，要是下雨就躲", { classifier });
    expect(classifier.calls).toHaveLength(1);
    expect(result.actions[1]).toMatchObject({ kind: "其他", free: true, text: "要是下雨就躲" });
    // 条件段只回落它自己；其余步骤照常过闸。
    expect(gateRecognition(result).route).not.toBe(ROUTES.FALLBACK);
    const plan = validatePlan(state, result.actions);
    expect(plan.valid).toHaveLength(1);
    expect(plan.freeSteps).toHaveLength(1);
  });

  it("arms a demoted conditional step as a free-text trigger instead of dropping it", async () => {
    const classifier = scripted({ actions: [act({ text: "把信给她", kind: "赠送", target: "才旦", item: "信", condition: "到达", condition_text: "到了雅江" })] });
    const result = await recognizeIntent(state, "到了雅江就把信给她", { classifier });
    expect(result.actions[0]).toMatchObject({ kind: "其他", condition: { on: "arrive", detail: "到了雅江" } });
    expect(validatePlan(state, result.actions).triggers).toHaveLength(1);
  });

  it("reads the gift amount from the action half when the model keeps the premise in text", async () => {
    const input = "要是他先还我100两，就送才旦20两";
    const classifier = scripted({ actions: [act({ text: input, kind: "赠送", target: "才旦", item: SILVER, condition: "到达" })] });
    const result = await recognizeIntent(state, input, { classifier });
    expect(result.actions[0]).toMatchObject({ kind: "赠送", item: SILVER, amount: 20 });
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

  it("treats a place named as the departure point as origin, not destination", () => {
    expireIntentTriggers();
    armIntentTriggers([{ kind: "其他", text: "歇一歇", condition: { on: "arrive", detail: "从白塔出发到了" } }]);
    expect(fireIntentTriggers("arrive", { placeNames: INTENT_PLACE_NAMES, dest: "喇嘛庙", travelDone: false })).toEqual([]);
    expect(fireIntentTriggers("arrive", { placeNames: INTENT_PLACE_NAMES, dest: "喇嘛庙", travelDone: true })).toHaveLength(1);
    armIntentTriggers([{ kind: "其他", text: "歇一歇", condition: { on: "arrive", detail: "从白塔到了喇嘛庙" } }]);
    expect(fireIntentTriggers("arrive", { placeNames: INTENT_PLACE_NAMES, dest: "白塔", travelDone: true })).toEqual([]);
    expect(fireIntentTriggers("arrive", { placeNames: INTENT_PLACE_NAMES, dest: "喇嘛庙", travelDone: false })).toHaveLength(1);
    armIntentTriggers([{ kind: "其他", text: "歇一歇", condition: { on: "arrive", detail: "从白塔抵达喇嘛庙" } }]);
    expect(fireIntentTriggers("arrive", { placeNames: INTENT_PLACE_NAMES, dest: "顶峰", travelDone: true })).toEqual([]);
    expect(fireIntentTriggers("arrive", { placeNames: INTENT_PLACE_NAMES, dest: "喇嘛庙", travelDone: false })).toHaveLength(1);
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
    expect(fireIntentTriggers("arrive", { placeNames: INTENT_PLACE_NAMES, dest: "喇嘛庙", travelDone: false })).toEqual([]);
    expect(fireIntentTriggers("arrive", { placeNames: INTENT_PLACE_NAMES, dest: "白塔", travelDone: false })).toHaveLength(1);
    // 前提点名了别处：行程在别处走完也不算应验；没点地名：行程走完才应验。
    armIntentTriggers([{ kind: "其他", text: "拜佛", condition: { on: "arrive", detail: "到了喇嘛庙" } }, { kind: "其他", text: "歇脚", condition: { on: "arrive", detail: "到了以后" } }]);
    expect(fireIntentTriggers("arrive", { placeNames: INTENT_PLACE_NAMES, dest: "白塔", travelDone: true }).map((entry) => entry.step.text)).toEqual(["歇脚"]);
    expect(fireIntentTriggers("arrive", { placeNames: INTENT_PLACE_NAMES, dest: "喇嘛庙", travelDone: true }).map((entry) => entry.step.text)).toEqual(["拜佛"]);
    armIntentTriggers([{ kind: "其他", text: "走", condition: { on: "refused", detail: "他不肯" } }]);
    expect(expireIntentTriggers()).toHaveLength(1);
    expect(intentTriggers()).toHaveLength(0);
  });
});
