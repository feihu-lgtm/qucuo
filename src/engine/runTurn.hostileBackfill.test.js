// S2 Review 补洞：选中对象 + 模型听意 target「无」→ 按 talkTarget 回填
import { describe, expect, it, vi } from "vitest";
import { runTurn } from "./runTurn.js";
import { createMockAi } from "./ports/ai.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { emptyBodyProfile } from "../domain/rules/character/bodyProfile.js";

function makeDeps(overrides = {}) {
  const varTree = { 角色: { 温掌柜: { 好感度: 30 } }, 世界: {} };
  return {
    convo: [], addLog: vi.fn(), setConvo: vi.fn(),
    apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
    intent: { code: "ACTION", label: "行动" },
    room: { name: "曲措乡", npcs: [{ name: "温掌柜", personality: "暴烈如火" }], items: [], exits: [] },
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

describe("S2 talkTarget 回填：敌意不点名不落空", () => {
  it("选中温掌柜骂「你这混蛋」：模型听意 target 无 → 回填后签 -3 怨+生气", async () => {
    const intakeJson = JSON.stringify({
      read: "玩家辱骂掌柜", refIds: [],
      actions: [{ kind: "talk", target: "无", item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "hostile", outcome: "无", risk: "无", confidence: 0.9, text: "你这混蛋" }],
      proposals: [],
    });
    const ai = createMockAi([intakeJson, "温掌柜拍案而起，怒目而视"]);
    const deps = makeDeps({ talkTarget: "温掌柜" });
    deps.ai = ai;
    const turn = await runTurn(deps, "你这混蛋", {});
    expect(turn.judgePipelineActive).toBe(true);
    const social = turn.judgeEffects?.verdict?.facts?.find((f) => f.op === "MUTATE_SOCIAL");
    expect(social).toBeTruthy();
    expect(social.npc).toBe("温掌柜");
    expect(social.affectionDelta).toBe(-3);
    expect(social.ledgerKind).toBe("怨");
    expect(social.anger?.active).toBe(true);
    expect(social.anger?.reason).toBe("你这混蛋");
  });

  it("模型点了名的不覆盖：骂王五时 target 保持王五不回填", async () => {
    const intakeJson = JSON.stringify({
      read: "玩家辱骂王五", refIds: [],
      actions: [{ kind: "talk", target: "王五", item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "hostile", outcome: "无", risk: "无", confidence: 0.9, text: "王五你这个畜生" }],
      proposals: [],
    });
    const ai = createMockAi([intakeJson, "……"]);
    const deps = makeDeps({ talkTarget: "温掌柜" });
    deps.ai = ai;
    const turn = await runTurn(deps, "王五你这个畜生", {});
    const social = turn.judgeEffects?.verdict?.facts?.find((f) => f.op === "MUTATE_SOCIAL");
    // 王五不在场——judgeTurn findNpc 查无此人，不签任何对象头上
    expect(social).toBeFalsy();
  });
});
