import { describe, expect, it } from "vitest";
import { emptyBodyProfile } from "../bodyProfile.js";
import { initialNarratorState } from "../narrator.js";
import { startTrace } from "../actionTrace.js";
import { applyKnowledgeTreeDiff } from "../knowledge.js";
import { createMockAi } from "./ports/ai.js";
import { createExtractionState, runTurn } from "./runTurn.js";

describe("runTurn", () => {
  it("forwards the locked destination and its exits to extraction", () => {
    const extractionState = createExtractionState({
      state: {
        room: { name: "山脚", exits: ["东"] },
        char: { hp: [10, 10] },
        inv: [],
        dao: {},
      },
      getMapNode: (name) => name === "山门" ? { exits: { west: "山脚" } } : null,
    }, { varTree: {}, lockedDestName: "山门" });

    expect(extractionState.lockedDestName).toBe("山门");
    expect(extractionState.lockedExits).toEqual({ west: "山脚" });
  });

  it("merges knowledge changes onto the latest varTree without losing intervening edits", () => {
    const base = {
      角色: { 阿青: { 好感度: 1 } },
      世界: { 知识领域: { 事实: { 山洪: { 摘要: "", 知晓者: {} } } } },
    };
    const evolved = {
      ...base,
      世界: { 知识领域: { 事实: { 山洪: { 摘要: "山洪曾毁坏旧桥", 知晓者: {} } } } },
    };
    const latest = {
      角色: { 阿青: { 好感度: 8 }, 小满: { 好感度: 3 } },
      世界: { 知识领域: { 事实: { 山洪: { 摘要: "", 知晓者: { 阿青: { 途径: "目击", 得知回合: 6 } } }, 旧约: { 摘要: "旧约", 知晓者: {} } } } },
    };

    expect(applyKnowledgeTreeDiff(base, evolved, latest)).toEqual({
      角色: { 阿青: { 好感度: 8 }, 小满: { 好感度: 3 } },
      世界: { 知识领域: { 事实: { 山洪: { 摘要: "山洪曾毁坏旧桥", 知晓者: { 阿青: { 途径: "目击", 得知回合: 6 } } }, 旧约: { 摘要: "旧约", 知晓者: {} } } } },
    });
  });

  it("retries a truncated unparseable response and returns the next parsed result", async () => {
    const requests = [];
    const ai = createMockAi([
      { text: "{not json", finishReason: "length" },
      `{"output":["石阶旁的草叶轻轻摇动。"],"delta":{"pot":3}}\n<mvu>_.set('世界.天气', '晴');</mvu>`,
    ], { onRequest: (messages) => requests.push(messages) });
    const apiCfg = {
      apiType: "openai",
      model: "test-model",
      targetWordCount: 220,
      contextWindow: 20,
      streamEnabled: false,
      extractionEnabled: false,
      callTokenLimits: {},
      intentBudgets: {},
    };
    const result = await runTurn({
      ai,
      apiCfg,
      convo: [],
      isTalk: false,
      prompt: {
        room: { name: "石阶", exits: [], npcs: [], items: [] },
        char: { name: "测试主角", gender: "男", hp: [10, 10], special: {}, neigong: 0, waigong: 0 },
        inv: [],
        skills: [],
        dao: { karma: 0, jie: 0 },
        flags: [],
        questProgress: {},
        varTree: { 角色: {}, 世界: {}, 主角: {} },
        time: 1,
        preset: { scenario: "测试剧本总纲" },
        companionState: {},
        nsfwOn: false,
        activeTarget: null,
        isTalk: false,
        gm: false,
        movingDir: null,
        lockedDestName: null,
        outerDepart: null,
        innerRoomName: null,
        apiCfg,
        getTimeStr: () => "卯时",
        hasInnerMap: () => false,
        describeEquipment: () => "",
        describeTodayForAI: () => "",
      },
      callDeps: () => ({
        varTree: { 角色: {}, 世界: {}, 主角: {} },
        gm: false,
        isSettle: false,
        isTalk: false,
        intent: { code: "UNKNOWN", label: "无法判定，交由本次调用自行裁量" },
        apiCfg,
        narrator: initialNarratorState(),
        scenario: "测试剧本总纲",
        budgetInstruction: null,
        npcLoreBlockWithQuest: "",
        visibleNpcsCount: 0,
        charName: "测试主角",
        charBodyProfile: emptyBodyProfile(),
        pickupJudgment: null,
        convo: [],
        nsfwOn: false,
        ctx: "[状态] 测试状态行",
        recallBlock: "",
        reunionBlock: "",
        infoDomainBlock: "",
        hist: "",
        mainConvo: [],
        gambleTalkCtx: null,
        recallInfo: null,
        _trace: startTrace("run-turn-test"),
        addLog: () => {},
        setLog: () => {},
      }),
    }, "探索石阶");

    expect(JSON.stringify(requests[0])).toContain("探索石阶");
    expect(JSON.stringify(requests[0])).toContain("房间:石阶");
    expect(requests).toHaveLength(2);
    expect(result.p.output).toEqual(["石阶旁的草叶轻轻摇动。"]);
    expect(result.p.delta.pot).toBe(3);
    expect(result.mvuCommands).toHaveLength(1);
  });
});
