import { describe, expect, it, vi } from "vitest";
import { runTurn } from "./runTurn.js";
import { createMockAi } from "./ports/ai.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { emptyBodyProfile } from "../domain/rules/character/bodyProfile.js";
import { inferAppeaseStance } from "../domain/rules/npc/appeaseStance.js";
import { judgeTurn } from "../domain/rules/judge/judgeTurn.js";

function makeDeps(overrides = {}) {
  const varTree = { 角色: { 八云: { 好感度: 30, 生气状态: { active: true, reason: "偷窃未遂", turnsLeft: 2, attempts: [] }, 心账: [{ id: "g1", tag: "怨", summary: "偷窃败露", turn: 2 }] } } };
  return {
    convo: [], addLog: vi.fn(), setConvo: vi.fn(),
    apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
    intent: { code: "TALK", label: "搭话" },
    room: { name: "鱼定村", npcs: [{ name: "八云" }], items: [], exits: [] },
    inv: [], char: { hp: [80, 100], special: { 气运: 5 } }, skills: [],
    varTree, memory: { varTreeLatest: varTree, recall: { lastAiText: "" } },
    gm: false, flags: [],
    narrator: initialNarratorState(),
    narratorStage: initialNarratorState().stage,
    scenario: "测试剧本", preset: { scenario: "测试剧本" },
    charBodyProfile: emptyBodyProfile(), charName: "少侠",
    dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
    time: 1, getTimeStr: () => "卯时",
    hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
    npcLoreBlockWithQuest: "",
    ...overrides,
  };
}

describe("inferAppeaseStance 关键词保守判定", () => {
  it("歉意词 sincere / 敷衍语与短文 perfunctory / 其余 casual", () => {
    expect(inferAppeaseStance("对不起，是我错了，请你海涵")).toBe("sincere");
    expect(inferAppeaseStance("行行好别计较了")).toBe("perfunctory");
    expect(inferAppeaseStance("哦")).toBe("perfunctory");
    expect(inferAppeaseStance("")).toBe("perfunctory");
  });
  it("长句无关键词 casual", () => {
    expect(inferAppeaseStance("今日特来向你说明原委，望你大人大量")).toBe("casual");
  });
});

describe("judgeTurn appease F3 扩展", () => {
  const env = {
    turn: 5, day: 1, place: "鱼定村",
    npcs: [{ name: "八云", personality: "" }],
    varTree: { 角色: { 八云: { 好感度: 30 } } }, inv: [], entries: [],
  };
  const mk = (stance) => ({ read: "", refIds: [], actions: [{ kind: "appease", target: "八云", stance, text: "x" }], proposals: [] });
  it("perfunctory 一票否决零 facts", () => {
    const v = judgeTurn(env, mk("perfunctory"), { rng: () => 0 });
    expect(v.facts.length).toBe(0);
    expect(v.notes.join()).toContain("敷衍");
  });
  it("成功签见账+angerRelease+grudgeResolve；失败零写", () => {
    const ok = judgeTurn(env, mk("sincere"), { rng: () => 0 });
    const f = ok.facts.find((x) => x.op === "MUTATE_SOCIAL");
    expect(f.ledgerKind).toBe("见");
    expect(f.angerRelease).toBe(true);
    expect(f.grudgeResolve).toBe(true);
    const bad = judgeTurn(env, mk("casual"), { rng: () => 0.999 });
    expect(bad.facts.length).toBe(0);
  });
});

describe("runTurn appease settle 进判官", () => {
  it("双调用 appease settle：判官激活且不再调 turn.appease", async () => {
    // mock 只供主叙事一次调用——若 turn.appease 被调会错位消费叙事响应
    const ai = createMockAi(["八云脸色稍缓，算是收下了赔罪"]);
    const deps = makeDeps();
    deps.ai = ai;
    const turn = await runTurn(deps, "对不起，是我错了", { settle: true, settleKind: "appease", settleNpc: "八云", attempt: "对不起，是我错了，请你海涵" });
    expect(turn.judgePipelineActive).toBe(true);
  });

  it("送礼 settle 仍不进判官（回归）", async () => {
    const ai = createMockAi(["八云收下青布"]);
    const deps = makeDeps();
    deps.ai = ai;
    const turn = await runTurn(deps, "把青布送给八云", { settle: true, settleKind: "gift", settleNpc: "八云" });
    expect(turn.judgePipelineActive).toBe(false);
  });

  it("单调用老路：判官不激活，turn.appease 行为不变", async () => {
    const ai = createMockAi([
      JSON.stringify({ choice: "奏效" }),
      JSON.stringify({ output: ["八云消了气"], memory: "赔罪奏效" }),
    ]);
    const deps = makeDeps({ apiCfg: { extractionEnabled: false, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 } });
    deps.ai = ai;
    const turn = await runTurn(deps, "赔罪", { settle: true, settleKind: "appease", settleNpc: "八云" });
    expect(turn.judgePipelineActive).toBe(false);
    expect(turn.appeaseVerdict?.choice || deps.appeaseVerdict?.choice || "奏效").toBe("奏效");
  });
});
