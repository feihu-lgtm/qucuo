import { describe, it, expect, vi, beforeEach } from "vitest";

// callModel / callModelStream 打桩：捕获组装好的消息数组（黄金快照对象），返回固定假回复。
// 其余导出（cleanJsonString 等）保持真实实现。
vi.mock("../apiConfig.js", async (importOriginal) => {
  const orig = await importOriginal();
  return {
    ...orig,
    callModel: vi.fn(async () => ({ text: '{"output":["假回复"]}', finishReason: "stop" })),
    callModelStream: vi.fn(),
  };
});

import { callModel } from "../apiConfig.js";
import { callMainOnce } from "./actCall.js";
import { startTrace } from "../actionTrace.js";
import { initialNarratorState } from "../narrator.js";
import { emptyBodyProfile } from "../bodyProfile.js";

// 回合上下文 fixture：形状与 act 里 callDeps() 一致。
function makeDeps(over = {}) {
  return {
    varTree: { 角色: {} },
    gm: false,
    isSettle: false,
    isTalk: false,
    intent: { code: "UNKNOWN", label: "无法判定，交由本次调用自行裁量" },
    apiCfg: {
      targetWordCount: 220, model: "test-model", apiType: "openai",
      streamEnabled: false, extractionEnabled: false, contextWindow: 20,
      callTokenLimits: {},
    },
    narrator: initialNarratorState,
    scenario: "测试剧本总纲",
    budgetInstruction: null,
    npcLoreBlockWithQuest: "",
    visibleNpcsCount: 0,
    charName: "测试主角",
    charBodyProfile: emptyBodyProfile(),
    pickupJudgment: null,
    cmd: "四下打量",
    convo: [],
    nsfwOn: false,
    ctx: "[状态] 测试状态行",
    recallBlock: "",
    reunionBlock: "",
    infoDomainBlock: "",
    hist: "[玩家] 上一句\n[引擎] 上一回",
    mainConvo: [{ role: "user", content: "上一句" }, { role: "assistant", content: "上一回" }],
    gambleTalkCtx: null,
    recallInfo: null,
    settleNpc: null,
    settleKind: null,
    giftInfo: null,
    _trace: startTrace("test-act"),
    addLog: () => {},
    setLog: () => {},
    ...over,
  };
}

describe("callMainOnce 组装黄金快照", () => {
  beforeEach(() => { callModel.mockClear(); });

  it("full 档：system 13 位置块 + user 侧消息", async () => {
    const d = makeDeps();
    const r = await callMainOnce(null, false, d);
    expect(r.rawFull).toBe('{"output":["假回复"]}');
    const [cfg, sysBlocks, chatMessages] = callModel.mock.calls[0];
    expect(cfg.model).toBe("test-model");
    expect(sysBlocks.map(b => b.tavernBlock)).toMatchSnapshot();
    expect(JSON.stringify(sysBlocks)).toMatchSnapshot();
    expect(JSON.stringify(chatMessages)).toMatchSnapshot();
  });

  it("full·COMBAT 档：物件志 + MVU 全量挂载", async () => {
    const d = makeDeps({ intent: { code: "COMBAT", label: "战斗" }, visibleNpcsCount: 1 });
    await callMainOnce(null, false, d);
    const [, sysBlocks, chatMessages] = callModel.mock.calls[0];
    const worldAfter = sysBlocks.find(b => b.tavernBlock === "worldInfoAfter")?.content || "";
    expect(worldAfter).toContain("曲措乡物件志");
    expect(worldAfter).toContain("认知隔离");
    const phi = chatMessages.find(b => b.tavernBlock === "phi")?.content || "";
    expect(phi).toContain("items_add");
    expect(JSON.stringify(sysBlocks)).toMatchSnapshot();
  });

  it("settle·gift 档：砍物件志/隔离，挂送礼铁律 MVU", async () => {
    const d = makeDeps({
      isSettle: true, settleNpc: "八云", settleKind: "gift",
      giftInfo: { itemName: "雪莲", quality: "蓝", desc: "崖上采的", range: [3, 5], suggestedDelta: 4, categoryLabel: "杂项" },
    });
    await callMainOnce(null, false, d);
    const [, sysBlocks, chatMessages] = callModel.mock.calls[0];
    expect(JSON.stringify(sysBlocks)).toMatchSnapshot();
    expect(JSON.stringify(chatMessages)).toMatchSnapshot();
  });

  it("谈价·轻量档：整体换成单块 system + 近 8 条对话", async () => {
    const d = makeDeps({
      isTalk: true,
      gambleTalkCtx: {
        bidderName: "贾掌柜", stoneId: "s1",
        persona: { brief: "精明的玉商", personality: "锱铢必较", bio: "做了三十年玉石生意。" },
        carry: [{ name: "玉佩" }], scene: "料场赌桌", baseOffer: 120, cash: 200,
      },
    });
    await callMainOnce(null, false, d);
    const [, sysBlocks, chatMessages] = callModel.mock.calls[0];
    expect(sysBlocks.length).toBe(1);
    expect(sysBlocks[0].tavernBlock).toBe("main");
    expect(JSON.stringify(sysBlocks)).toMatchSnapshot();
    expect(JSON.stringify(chatMessages)).toMatchSnapshot();
  });

  it("trace 契约：Prompt注入/调用模式标签照常打出", async () => {
    const d = makeDeps();
    await callMainOnce(null, false, d);
    const layers = d._trace.steps.map(s => s.layer);
    expect(layers).toContain("Prompt注入");
    expect(layers).toContain("调用模式");
  });
});
