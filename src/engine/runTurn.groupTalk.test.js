import { describe, expect, it, vi } from "vitest";
import { runTurn } from "./runTurn.js";
import { createMockAi } from "./ports/ai.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { emptyBodyProfile } from "../domain/rules/character/bodyProfile.js";

// WO-16H-H1 群聊门槛：1 名 NPC 无 talkTarget 仍进判官 talkOnly；
// 2 名及以上在场无 talkTarget 才跳判官走群聊尾章。
function makeDeps(overrides = {}) {
  const varTree = { 角色: {} };
  return {
    convo: [], addLog: vi.fn(), setConvo: vi.fn(),
    apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
    intent: { code: "TALK", label: "搭话" },
    room: { name: "鱼定村", npcs: [{ name: "才旦" }, { name: "八云" }], items: [], exits: [] },
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
    isTalk: true, talkTarget: "",
    ...overrides,
  };
}

const groupSeal = (arr) => `众人你一言我一语\n---SEAL---\n${JSON.stringify({ respondedNpcs: arr })}`;

describe("WO-16H-H1 群聊门槛与尾章消费", () => {
  it("单人在场无 talkTarget：仍进判官 talkOnly（intake 被调用）", async () => {
    const ai = createMockAi([
      JSON.stringify({ read: "", refIds: [], actions: [
        { kind: "talk", target: "才旦", itemId: "", direction: "none", stance: "casual" },
      ], proposals: [] }),
      "才旦点了点头",
    ]);
    const deps = makeDeps({
      room: { name: "鱼定村", npcs: [{ name: "才旦" }], items: [], exits: [] },
      visibleNpcsForAI: undefined,
    });
    deps.ai = ai;
    const turn = await runTurn(deps, "近来可好？");
    expect(turn.judgePipelineActive).toBe(true);
    expect(turn.groupTalk).toBe(false);
  });

  it("两人在场无 talkTarget：跳过判官走群聊尾章，越界名字过滤", async () => {
    const ai = createMockAi([groupSeal(["才旦", "路人甲"])]);
    const deps = makeDeps();
    deps.ai = ai;
    const turn = await runTurn(deps, "大伙儿都在忙啥？");
    expect(turn.judgePipelineActive).toBe(false);
    expect(turn.groupTalk).toBe(true);
    // 在场白名单过滤：路人甲不在场被丢弃，才旦进 p
    expect(turn.p?.respondedNpcs).toEqual(["才旦"]);
  });

  it("两人在场但有 talkTarget：仍进判官（点选对话不算群聊）", async () => {
    const ai = createMockAi([
      JSON.stringify({ read: "", refIds: [], actions: [
        { kind: "talk", target: "才旦", itemId: "", direction: "none", stance: "casual" },
      ], proposals: [] }),
      "才旦应了声",
    ]);
    const deps = makeDeps({ talkTarget: "才旦" });
    deps.ai = ai;
    const turn = await runTurn(deps, "才旦，说说看");
    expect(turn.judgePipelineActive).toBe(true);
    expect(turn.groupTalk).toBe(false);
  });
});
