import { describe, expect, it, vi } from "vitest";
import { runTurn } from "./runTurn.js";
import { createMockAi } from "./ports/ai.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { emptyBodyProfile } from "../domain/rules/character/bodyProfile.js";

// WO-16A 复审：SEAL respondedNpcs 兜底接线——系统推导优先，推导为空才用 SEAL
function makeDeps(overrides = {}) {
  const varTree = { 角色: {} };
  return {
    convo: [], addLog: vi.fn(), setConvo: vi.fn(),
    apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
    intent: { code: "TALK", label: "搭话" },
    room: { name: "鱼定村", npcs: [{ name: "才旦" }], items: [], exits: [] },
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
    visibleNpcsCount: 1, npcLoreBlockWithQuest: "",
    isTalk: true, talkTarget: "才旦",
    ...overrides,
  };
}

const sealLine = (arr) => `正文叙事\n---SEAL---\n${JSON.stringify({ fills: {}, respondedNpcs: arr, spontaneousPact: null })}`;

describe("SEAL respondedNpcs 兜底接线", () => {
  it("系统推导为空时：SEAL respondedNpcs 进 p 作低可信兜底", async () => {
    // intake 返回空 actions（推导为空），叙事 SEAL 自证才旦开口
    const ai = createMockAi([
      JSON.stringify({ read: "", refIds: [], actions: [], proposals: [] }),
      sealLine(["才旦"]),
    ]);
    const deps = makeDeps(); deps.ai = ai;
    const turn = await runTurn(deps, "才旦，最近可好？");
    expect(turn.derivedRespondedNpcs).toEqual([]);
    expect(turn.p?.respondedNpcs).toEqual(["才旦"]);
  });

  it("系统推导非空时：SEAL 不覆盖系统推导", async () => {
    const ai = createMockAi([
      JSON.stringify({ read: "", refIds: [], actions: [
        { kind: "talk", target: "才旦", item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.9, text: "才旦，最近可好？" },
      ], proposals: [] }),
      sealLine(["幻觉人"]),
    ]);
    const deps = makeDeps(); deps.ai = ai;
    const turn = await runTurn(deps, "才旦，最近可好？");
    expect(turn.derivedRespondedNpcs).toEqual(["才旦"]);
    // 推导非空 → SEAL 不进 p
    expect(turn.p?.respondedNpcs).toBeUndefined();
  });
});
