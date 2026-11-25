import { describe, expect, it, vi } from "vitest";
import { runTurn } from "./runTurn.js";
import { createMockAi } from "./ports/ai.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { emptyBodyProfile } from "../domain/rules/character/bodyProfile.js";

// WO-15 窄过渡：turn.appease 只在双调用模式裁赔罪消气，数值系统钉死
function makeDeps(overrides = {}) {
  const varTree = { 角色: { 八云: { 好感度: 20, 生气状态: { active: true, reason: "偷窃未遂" }, 性情: "刚烈" } } };
  return {
    convo: [], addLog: vi.fn(), setConvo: vi.fn(),
    apiCfg: { extractionEnabled: true, judgePipelineEnabled: false, streamEnabled: false, maxTokens: 4000 },
    intent: { code: "APPEASE", label: "赔罪" },
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
    visibleNpcsCount: 1, npcLoreBlockWithQuest: "",
    ...overrides,
  };
}

describe("turn.appease 窄过渡补洞", () => {
  it("奏效：注入生气解除+好感+3 mvu，只注入一次", async () => {
    const ai = createMockAi(["正文叙事", '{"choice":"奏效"}']);
    const deps = makeDeps();
    deps.ai = ai;
    const turn = await runTurn(deps, "八云，上次是我不对，给你赔不是了", { settle: true, settleKind: "appease", settleNpc: "八云" });
    expect(turn.mvuCommands).toEqual([
      { op: "set", path: "角色.八云.生气解除", value: true },
      { op: "add", path: "角色.八云.好感度", value: 3 },
    ]);
    expect(turn.mvuCommands.filter(c => c.path.endsWith("生气解除"))).toHaveLength(1);
  });

  it("未奏效/无法判断：零写入", async () => {
    for (const choice of ["未奏效", "无法判断"]) {
      const ai = createMockAi(["正文叙事", JSON.stringify({ choice })]);
      const d = makeDeps(); d.ai = ai;
      const turn = await runTurn(d, "随便啦", { settle: true, settleKind: "appease", settleNpc: "八云" });
      expect(turn.mvuCommands).toEqual([]);
    }
  });

  it("gift settle 不触发 appease 仲裁", async () => {
    const base = createMockAi(["正文叙事"]);
    const ai = { chat: vi.fn(base.chat) };
    const d = makeDeps(); d.ai = ai;
    const turn = await runTurn(d, "送你礼物", { settle: true, settleKind: "gift", settleNpc: "八云" });
    expect(turn.mvuCommands).toEqual([]);
    // 全部调用里没有赔罪仲裁（系统指令不含仲裁措辞）
    const sysTexts = ai.chat.mock.calls.map(c => JSON.stringify(c[0]) + JSON.stringify(c[1] || {}));
    expect(sysTexts.every(t => !t.includes("消了气"))).toBe(true);
  });
});
