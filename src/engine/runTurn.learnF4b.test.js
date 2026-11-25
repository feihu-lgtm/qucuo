// WO-16F-F4b：learn settle 进判官——runTurn 集成与 sysBase 铁律钉测试
import { describe, expect, it, vi } from "vitest";
import { runTurn } from "./runTurn.js";
import { createMockAi } from "./ports/ai.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { emptyBodyProfile } from "../domain/rules/character/bodyProfile.js";
import { buildSysBase } from "../domain/rules/prompt/sysBase.js";

const sampleReq = {
  npc: "老拳师", isMaster: true, moveBrief: "太祖长拳(拳)", totalPrice: 30,
  freshSkills: [{ name: "太祖长拳", type: "外功", quality: "绿" }], beast: false,
};

function makeDeps(overrides = {}) {
  const varTree = { 角色: { 老拳师: { 好感度: 50 } }, 世界: {} };
  return {
    convo: [], addLog: vi.fn(), setConvo: vi.fn(),
    apiCfg: { extractionEnabled: true, judgePipelineEnabled: true, streamEnabled: false, maxTokens: 4000 },
    intent: { code: "ACTION", label: "行动" },
    room: { name: "曲措乡", npcs: [{ name: "老拳师" }], items: [], exits: [] },
    inv: [], char: { hp: [80, 100], money: 500, special: { 气运: 5 } }, skills: [],
    varTree, memory: { varTreeLatest: varTree, recall: { lastAiText: "" } },
    gm: false, flags: [],
    narrator: initialNarratorState(), narratorStage: initialNarratorState().stage,
    scenario: "测试剧本", preset: { scenario: "测试剧本" },
    charBodyProfile: emptyBodyProfile(), charName: "少侠",
    dao: { karma: 0, jie: 0 }, questProgress: {}, companionState: {},
    time: 1, getTimeStr: () => "卯时",
    hasInnerMap: () => false, describeEquipment: () => "", describeTodayForAI: () => "",
    npcLoreBlockWithQuest: "",
    ...overrides,
  };
}

describe("runTurn learn settle 进判官（F4b）", () => {
  it("带 learnRequest 的求教 settle：判官激活，合成 learn 听意单不调 intake AI", async () => {
    const ai = createMockAi(["老拳师拉开架式，一招一式拆给你看"]);
    const deps = makeDeps();
    deps.ai = ai;
    const turn = await runTurn(deps, "拜老拳师为师", {
      settle: true, settleKind: "learn_skill", settleNpc: "老拳师",
      learnRequest: sampleReq,
    });
    expect(turn.judgePipelineActive).toBe(true);
  });

  it("不带 learnRequest 的求教 settle（legacy/特殊通道）：判官仍不激活", async () => {
    const ai = createMockAi(["老拳师点了点头"]);
    const deps = makeDeps();
    deps.ai = ai;
    const turn = await runTurn(deps, "拜老拳师为师", {
      settle: true, settleKind: "learn_skill", settleNpc: "老拳师",
    });
    expect(turn.judgePipelineActive).toBe(false);
  });

  it("单调用老路：判官链关闭时 learn settle 行为不变", async () => {
    const ai = createMockAi([
      JSON.stringify({ output: ["老拳师传授了拳法"], memory: "拜师" }),
    ]);
    const deps = makeDeps({ apiCfg: { extractionEnabled: false, judgePipelineEnabled: false, streamEnabled: false, maxTokens: 4000 } });
    deps.ai = ai;
    const turn = await runTurn(deps, "拜老拳师为师", {
      settle: true, settleKind: "learn_skill", settleNpc: "老拳师",
      learnRequest: sampleReq,
    });
    expect(turn.judgePipelineActive).toBeFalsy();
  });
});

describe("sysBase 授业铁律判官路收口", () => {
  const mk = (opts = {}) => buildSysBase(
    220, { stage: "NORMAL", affection: 20 }, "x", null, false, "", true, "settle",
    {
      playerName: "少侠", settleNpc: "老拳师", settleKind: "learn_skill",
      learnInfo: { isMaster: true, moveBrief: "太祖长拳(拳)", totalPrice: 30 },
      ...opts,
    },
  );
  it("judgeActive 时不预设「系统已结算完毕」——方向归判官定案单", () => {
    const { phiRules } = mk({ judgeActive: true });
    expect(phiRules).not.toContain("授业传艺铁律");
    expect(phiRules).not.toContain("系统结算完毕");
  });
  it("非判官路（legacy）保留授业铁律", () => {
    const { phiRules } = mk({ judgeActive: false });
    expect(phiRules).toContain("授业传艺铁律");
  });
});
