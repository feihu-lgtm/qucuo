import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRegistryForTest } from "../prompt/registry.js";
import { createMockAi } from "../../engine/ports/ai.js";
import { parseJudgeAnswer, registerSettleCalls, UNKNOWN_CHOICE } from "./judge.js";
import { SOFT_RULES } from "./softRules.js";
import { runSoftSettle, formatSettleNote } from "./settle.js";

beforeEach(() => {
  resetRegistryForTest();
  registerSettleCalls();
});

const angryTree = (npc = "才旦") => ({
  角色: { [npc]: { 好感度: 20, 生气状态: { active: true, reason: "被偷了东西", turnsLeft: 3 } } },
  世界: { 威望: 0 },
});

describe("parseJudgeAnswer", () => {
  const options = ["奏效", "未奏效", UNKNOWN_CHOICE];

  it("reads a well-formed reply", () => {
    const res = parseJudgeAnswer('{"choice":"奏效","probs":{"奏效":0.8,"未奏效":0.1,"无法判断":0.1}}', options);
    expect(res.choice).toBe("奏效");
    expect(res.probs.奏效).toBeCloseTo(0.8);
    expect(res.parseFailed).toBe(false);
  });

  it("argmaxes probs when choice is missing or not an option", () => {
    expect(parseJudgeAnswer('{"probs":{"奏效":0.1,"未奏效":0.9}}', options).choice).toBe("未奏效");
    expect(parseJudgeAnswer('{"choice":"胡扯","probs":{"奏效":1}}', options).choice).toBe("奏效");
  });

  it("strips 「」 quotes on prob keys and ignores unknown keys", () => {
    const res = parseJudgeAnswer('{"choice":"奏效","probs":{"「奏效」":2,"别的":9}}', options);
    expect(res.choice).toBe("奏效");
    expect(res.probs.奏效).toBe(1);
    expect(res.probs.别的).toBeUndefined();
  });

  it("never throws and falls back to 无法判断 on garbage", () => {
    for (const text of ["", "not json", "{}", '{"probs":{}}', null, "[]", '{"choice":"奏效"}']) {
      const res = parseJudgeAnswer(text, options);
      if (text === '{"choice":"奏效"}') {
        expect(res.choice).toBe("奏效"); // 有 choice 没 probs：把全部质量给它
      } else {
        expect(res.choice).toBe(UNKNOWN_CHOICE);
        expect(res.probs).toEqual({});
      }
    }
  });
});

describe("softRules mapping tables", () => {
  it("appease: 奏效 → 生气解除 + 好感回补；其余无 delta", () => {
    const ctx = { npc: "才旦", varTree: angryTree() };
    const on = SOFT_RULES.appease.deltas("奏效", ctx);
    expect(on).toContainEqual({ path: "角色.才旦.生气解除", op: "set", value: true });
    expect(on).toContainEqual({ path: "角色.才旦.好感度", op: "add", value: 3 });
    expect(SOFT_RULES.appease.deltas("未奏效", ctx)).toEqual([]);
    expect(SOFT_RULES.appease.deltas(UNKNOWN_CHOICE, ctx)).toEqual([]);
  });

  it("gift: 收下 → 按分量/品阶区间中值加好感；婉拒无 delta", () => {
    const ctx = { npc: "才旦", giftInfo: { itemName: "酥油", weight: { label: "厚礼", range: [3, 5] } } };
    expect(SOFT_RULES.gift.deltas("收下", ctx)).toEqual([
      { path: "角色.才旦.好感度", op: "add", value: 4 },
    ]);
    const plain = { npc: "才旦", giftInfo: { itemName: "铜风铃", quality: "绿" } };
    expect(SOFT_RULES.gift.deltas("收下", plain)).toEqual([
      { path: "角色.才旦.好感度", op: "add", value: 5 },
    ]);
    expect(SOFT_RULES.gift.deltas("婉拒", ctx)).toEqual([]);
  });

  it("companion_invite: 应允 → 直接 set 高初始好感", () => {
    const ctx = { npc: "雪豹" };
    expect(SOFT_RULES.companion_invite.deltas("欣然应允", ctx)).toEqual([
      { path: "角色.雪豹.好感度", op: "set", value: 45 },
    ]);
    expect(SOFT_RULES.companion_invite.deltas("婉拒", ctx)).toEqual([]);
  });

  it("learn_skill: 倾囊相授 → 绝学 +6 / 通行 +3；回绝无 delta", () => {
    expect(SOFT_RULES.learn_skill.deltas("倾囊相授", { npc: "师父", learnInfo: { isMaster: true } }))
      .toEqual([{ path: "角色.师父.好感度", op: "add", value: 6 }]);
    expect(SOFT_RULES.learn_skill.deltas("倾囊相授", { npc: "师父", learnInfo: { isMaster: false } }))
      .toEqual([{ path: "角色.师父.好感度", op: "add", value: 3 }]);
    expect(SOFT_RULES.learn_skill.deltas("回绝", { npc: "师父" })).toEqual([]);
  });

  it("narrator_affinity: 三档映射到 narrator.affection", () => {
    expect(SOFT_RULES.narrator_affinity.deltas("投机贴心", {})).toEqual([
      { path: "narrator.affection", op: "add", value: 5 },
    ]);
    expect(SOFT_RULES.narrator_affinity.deltas("寻常闲聊", {})).toEqual([
      { path: "narrator.affection", op: "add", value: 1 },
    ]);
    expect(SOFT_RULES.narrator_affinity.deltas("敷衍冒犯", {})).toEqual([
      { path: "narrator.affection", op: "add", value: -2 },
    ]);
    expect(SOFT_RULES.narrator_affinity.deltas(UNKNOWN_CHOICE, {})).toEqual([]);
  });
});

describe("runSoftSettle", () => {
  it("runs the judge call and applies validated deltas", async () => {
    const onRequest = vi.fn();
    const ai = createMockAi(['{"choice":"奏效","probs":{"奏效":0.9,"未奏效":0.05,"无法判断":0.05}}'], { onRequest });
    const result = await runSoftSettle({
      ai, apiCfg: {}, kind: "appease",
      ctx: { npc: "才旦", varTree: angryTree(), attempt: "赔罪道歉" },
    });
    expect(result.target).toBe("才旦");
    expect(result.choice).toBe("奏效");
    expect(result.deltas).toContainEqual({
      path: "角色.才旦.生气解除", op: "set", value: true, finalValue: true,
    });
    const gain = result.deltas.find((d) => d.path.endsWith("好感度"));
    expect(gain.op).toBe("add");
    expect(gain.finalValue).toBe(23);
    expect(result.note).toContain("才旦");
    expect(result.note).toContain("消了气");
    const [messages, opts] = onRequest.mock.calls[0];
    expect(opts.systemPrompt).toContain("选择题");
    expect(messages.at(-1).content).toContain("「无法判断」");
  });

  it("无法判断 produces no deltas", async () => {
    const ai = createMockAi(['{"choice":"无法判断","probs":{"无法判断":1}}']);
    const result = await runSoftSettle({
      ai, apiCfg: {}, kind: "gift",
      ctx: { npc: "才旦", varTree: angryTree(), giftInfo: { itemName: "酥油", quality: "白" } },
    });
    expect(result.choice).toBe(UNKNOWN_CHOICE);
    expect(result.deltas).toEqual([]);
    expect(result.note).toContain("判不了");
  });

  it("unparseable reply falls back to 无法判断 with no deltas", async () => {
    const ai = createMockAi(["我随便聊聊……"]);
    const result = await runSoftSettle({
      ai, apiCfg: {}, kind: "learn_skill",
      ctx: { npc: "师父", varTree: angryTree("师父"), learnInfo: { isMaster: true } },
    });
    expect(result.choice).toBe(UNKNOWN_CHOICE);
    expect(result.deltas).toEqual([]);
  });

  it("AI off / offline → 无法判断, no deltas", async () => {
    for (const ai of [null, createMockAi([])]) {
      const result = await runSoftSettle({
        ai, apiCfg: ai ? { offline: true } : {}, kind: "companion_invite",
        ctx: { npc: "雪豹", varTree: angryTree("雪豹") },
      });
      expect(result.choice).toBe(UNKNOWN_CHOICE);
      expect(result.deltas).toEqual([]);
    }
  });

  it("unknown kind returns empty result without calling AI", async () => {
    const onRequest = vi.fn();
    const result = await runSoftSettle({
      ai: createMockAi([], { onRequest }), apiCfg: {}, kind: "not_a_kind", ctx: {},
    });
    expect(result.choice).toBe(UNKNOWN_CHOICE);
    expect(result.deltas).toEqual([]);
    expect(onRequest).not.toHaveBeenCalled();
  });

  it("clamps narrator.affection through field bounds", async () => {
    const ai = createMockAi(['{"choice":"敷衍冒犯","probs":{"敷衍冒犯":1}}']);
    const result = await runSoftSettle({
      ai, apiCfg: {}, kind: "narrator_affinity",
      ctx: { narrator: { affection: 1 }, playerSay: "你算什么东西" },
    });
    const delta = result.deltas.find((d) => d.path === "narrator.affection");
    expect(delta.finalValue).toBe(0);
    expect(result.note).toContain("不快");
  });

  it("formatSettleNote wraps the note for the narrative prompt", () => {
    expect(formatSettleNote(null)).toBe("");
    expect(formatSettleNote({ note: "才旦收下了酥油，好感+3" })).toContain("才旦收下了酥油");
    expect(formatSettleNote({ note: "" })).toBe("");
  });
});
