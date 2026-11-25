import { describe, expect, it, vi } from "vitest";
import { runTurn } from "./runTurn.js";
import { createMockAi } from "./ports/ai.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { emptyBodyProfile } from "../domain/rules/character/bodyProfile.js";

// WO-16C：移动拾取判官链集成——掷中 pickupJudgment → 判官签条件券 →
// 正文埋锚+SEAL fill 双证据 → materializeFacts 按锁定品质/类别入包
function makeDeps(overrides = {}) {
  const varTree = { 角色: {} };
  return {
    convo: [], addLog: vi.fn(), setConvo: vi.fn(),
    apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
    intent: { code: "MOVE", label: "移动" },
    room: { name: "野径", npcs: [], items: [], exits: [] },
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
    visibleNpcsCount: 0, npcLoreBlockWithQuest: "",
    pickupJudgment: { quality: "蓝", category: "accessory" },
    ...overrides,
  };
}

describe("WO-16C 移动拾取判官链集成", () => {
  it("掷中→判官签条件券→锚+fill→正确品质类别入包", async () => {
    // intake 空 actions；正文埋 F 锚点，SEAL fill 填名。锚点 id 依赖判官 factId
    // 序列——首条即 F<turn>_1（本回合无其他 facts）。
    const ai = createMockAi([
      JSON.stringify({ read: "", refIds: [], actions: [], proposals: [] }),
      `行至半坡，少侠瞥见草丛里一点铜光，俯身拾起⟦F1_1⟧。\n---SEAL---\n${JSON.stringify({ fills: {}, respondedNpcs: [], spontaneousPact: null })}`,
    ]);
    // fills 键是 warrantId W1_1——先跑一次拿真实 warrantId 太绕，直接蒙对序列：
    // 条件券是本回合第一张 warrant（无其他 action），id 即 W1_1/F1_1。
    const ai2 = createMockAi([
      JSON.stringify({ read: "", refIds: [], actions: [], proposals: [] }),
      `行至半坡，少侠拾起⟦F1_1⟧。\n---SEAL---\n${JSON.stringify({ fills: { W1_1: { name: "青铜铃", desc: "锈铃" } }, respondedNpcs: [], spontaneousPact: null })}`,
    ]);
    void ai;
    const deps = makeDeps(); deps.ai = ai2;
    const turn = await runTurn(deps, "北");
    expect(turn.judgeEffects?.materialized).toBeTruthy();
    const inv = turn.judgeEffects.materialized.changes?.inv || [];
    const item = inv.find((it) => it?.name === "青铜铃");
    expect(item).toBeTruthy();
    expect(item.quality).toBe("蓝");
    expect(item.category).toBe("accessory");
    // 条件券不发前置 fact：verdict.facts 里无 GRANT_ITEM
    expect(turn.judgeEffects.verdict.facts.filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0);
  });

  it("正文不埋锚（叙事拒捡）：券作废不入包", async () => {
    const ai = createMockAi([
      JSON.stringify({ read: "", refIds: [], actions: [], proposals: [] }),
      `后有追兵，少侠无暇细看，匆匆赶路。\n---SEAL---\n${JSON.stringify({ fills: {}, respondedNpcs: [], spontaneousPact: null })}`,
    ]);
    const deps = makeDeps(); deps.ai = ai;
    const turn = await runTurn(deps, "北");
    const inv = turn.judgeEffects?.materialized?.changes?.inv || [];
    expect(inv.length).toBe(0);
  });
});
