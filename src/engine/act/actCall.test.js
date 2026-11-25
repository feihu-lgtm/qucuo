import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { bindTurnRuntime } from "../../features/turnRuntime.js";
import { getTurnContext, PHASE, turnMonitor, withTurnContext } from "../../infra/turnMonitor.js";
bindTurnRuntime({ getTurnContext, PHASE, turnMonitor, withTurnContext });

// callModel / callModelStream 打桩：捕获组装好的消息数组（黄金快照对象），返回固定假回复。
// 其余导出（cleanJsonString 等）保持真实实现。
vi.mock("../../infra/apiConfig.js", async (importOriginal) => {
  const orig = await importOriginal();
  return {
    ...orig,
    callModel: vi.fn(async () => ({ text: '{"output":["假回复"]}', finishReason: "stop" })),
    callModelStream: vi.fn(),
  };
});

import { callModel } from "../../infra/apiConfig.js";
import { gameActions } from "../../store/gameStore.js";
import { callMainOnce } from "./actCall.js";
import { startTrace } from "../../infra/actionTrace.js";
import { initialNarratorState } from "../../domain/rules/narrator/narrator.js";
import { emptyBodyProfile } from "../../domain/rules/character/bodyProfile.js";
import { deposit } from "../../features/bank/logic.js";
import { applyResult } from "../../features/run.js";
import { defaultPreset } from "../../domain/rules/prompt/presetSystem.js";
import { LEGACY_DEFAULT_CONTENT } from "../../domain/rules/prompt/presetLegacy.js";
import { resetPromptOverrides, setPromptOverride } from "../../domain/rules/prompt/registry.js";

const legacySnapshotPreset = {
  ...defaultPreset(),
  name: "旧版快照预设",
  prompts: defaultPreset().prompts.map((entry) => {
    const legacy = LEGACY_DEFAULT_CONTENT[entry.id]?.[0];
    return legacy ? { ...entry, content: legacy } : entry;
  }),
};

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
  beforeEach(() => {
    callModel.mockClear();
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ presets: [legacySnapshotPreset], activeIndex: 0 }),
    });
  });
  afterEach(() => {
    resetPromptOverrides();
    vi.unstubAllGlobals();
  });

  it.each([true, false])("permits only meat credit in an active leopard gift settlement (%s)", async (active) => {
    await callMainOnce(null, false, makeDeps({ isSettle: true, settleKind: "gift", settleNpc: "雪豹", snowLeopardContext: active ? "[收复雪豹] 在场" : "" }));
    const messages = callModel.mock.calls[0][2];
    const schema = messages.find((message) => message.tavernBlock === "phi").content;
    expect(schema.includes('"flags_add":["snow_spirit_meat"]')).toBe(active);
    expect(schema).toContain(active ? "只允许snow_spirit_meat" : "禁输出 room/char/dao/delta");
    expect(schema).not.toContain("snow_spirit_scratch");
  });

  it("passes completed bank deposit facts to the settlement model without relying on state context", async () => {
    const act = vi.fn();
    applyResult({ act, gameActions }, deposit({ char: { money: 100 }, deposit: 20, time: 6 }, 50));
    const [cmd, , options] = act.mock.calls[0];
    await callMainOnce(null, false, makeDeps({ cmd, isSettle: options.settle, ctx: "" }));
    const messages = JSON.stringify(callModel.mock.calls[0].slice(1));
    expect(messages).toContain("钱庄存款已完成：本次存入50两");
    expect(messages).toContain("存款余额70两，随身银两剩余50两");
    expect(messages).toContain("每24时间单位2%");
    expect(messages).toContain("不得再询问存期、利率或要求确认存款");
    expect(messages).toContain("不得重复扣款或入账");
  });

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
    // WO-04：物件志随轮跳变，已搬去 11 号位 inChat；worldInfoAfter 只留认知隔离+地图铁律。
    const worldAfter = sysBlocks.find(b => b.tavernBlock === "worldInfoAfter")?.content || "";
    expect(worldAfter).not.toContain("曲措乡物件志");
    expect(worldAfter).toContain("认知隔离");
    const inChat = chatMessages.find(b => b.tavernBlock === "inChat")?.content || "";
    expect(inChat).toContain("曲措乡物件志");
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

  it("settle prompt includes the anger note only while the target remains angry", async () => {
    const angryVarTree = {
      角色: {
        八云: {
          生气状态: {
            active: true,
            reason: "偷窃未遂",
            turnsLeft: 2,
            attempts: [{ kind: "trade", detail: "", time: 1 }],
          },
        },
      },
    };
    await callMainOnce(null, false, makeDeps({
      isSettle: true,
      settleNpc: "八云",
      settleKind: "appease",
      varTree: angryVarTree,
    }));
    let chatMessages = callModel.mock.calls[0][2];
    expect(chatMessages.find((message) => message.tavernBlock === "inChat").content)
      .toContain("此前已尝试：交易");

    callModel.mockClear();
    await callMainOnce(null, false, makeDeps({
      isSettle: true,
      settleNpc: "八云",
      settleKind: "appease",
      varTree: { 角色: { 八云: { 生气状态: { active: false } } } },
    }));
    chatMessages = callModel.mock.calls[0][2];
    expect(chatMessages.find((message) => message.tavernBlock === "inChat").content)
      .not.toContain("[社交状态]");
  });



  it.each([
    ["normal", { activeTarget: "阿旺", recallBlock: "【回忆】旧事", reunionBlock: "【重逢】相见" }],
    ["settle", { isSettle: true, settleNpc: "阿旺", reunionBlock: "【重逢】相见" }],
  ])("adds the target ledger after the recall/reunion block in the %s prompt", async (kind, overrides) => {
    const varTree = { 角色: { 阿旺: { 旧账: { lines: ["欠少侠一壶酒"] } } } };
    await callMainOnce(null, false, makeDeps({
      room: { name: "鱼定村", npcs: [{ name: "阿旺" }] },
      varTree,
      ...overrides,
    }));
    const content = callModel.mock.calls[0][2].find((message) => message.tavernBlock === "inChat").content;
    expect(content).toContain("【和对方的旧账】");
    expect(content).toContain("· 欠少侠一壶酒");
    const previousBlock = kind === "normal" ? "【回忆】旧事" : "【重逢】相见";
    expect(content.indexOf(previousBlock)).toBeLessThan(content.indexOf("【和对方的旧账】"));
    if (kind === "normal") expect(content.indexOf("【和对方的旧账】")).toBeLessThan(content.indexOf("【重逢】相见"));
  });

  it("leaves the in-chat payload unchanged when the target has no ledger", async () => {
    const common = {
      activeTarget: "阿旺",
      room: { name: "鱼定村", npcs: [{ name: "阿旺" }] },
    };
    await callMainOnce(null, false, makeDeps({ ...common, varTree: { 角色: { 阿旺: {} } } }));
    const withoutLedger = callModel.mock.calls[0][2].find((message) => message.tavernBlock === "inChat").content;

    callModel.mockClear();
    await callMainOnce(null, false, makeDeps({
      ...common,
      varTree: { 角色: { 阿旺: { 旧账: { lines: [] } } } },
    }));
    const emptyLedger = callModel.mock.calls[0][2].find((message) => message.tavernBlock === "inChat").content;
    expect(emptyLedger).toBe(withoutLedger);
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
    const layers = d._trace.nodes.map(s => s.label);
    expect(layers).toContain("Prompt注入");
    expect(layers).toContain("调用模式");
  });

  it("私聊 recall 关灯不影响主回合远景/召回，user_recall 关灯才关闭", async () => {
    setPromptOverride("recall", { mode: "off" });
    const dKeep = makeDeps({
      varTree: { 角色: {}, 世界: { 日总结: [{ label: "第1天", text: "初入鱼定村" }] } },
      recallBlock: "\n\n[往事] 昨夜雪山相遇",
      reunionBlock: "\n\n【重逢】久别的阿旺",
      infoDomainBlock: "\n\n【信息域】只知道茶价",
    });
    await callMainOnce(null, false, dKeep);
    const msgKeep = JSON.stringify(callModel.mock.calls[0][2]);
    expect(msgKeep).toContain("昨夜雪山相遇");
    expect(msgKeep).toContain("初入鱼定村");

    callModel.mockClear();
    setPromptOverride("user_recall", { mode: "off" });
    await callMainOnce(null, false, dKeep);
    const msgOff = JSON.stringify(callModel.mock.calls[0][2]);
    expect(msgOff).not.toContain("昨夜雪山相遇");
    expect(msgOff).not.toContain("初入鱼定村");
    // 「记忆」一整块（远景+召回+重逢+信息域）跟着同一个开关走
    expect(msgOff).not.toContain("久别的阿旺");
    expect(msgOff).not.toContain("只知道茶价");
  });

  it("body_gate 蓝灯可在移动回合强制点亮体貌公开层", async () => {
    setPromptOverride("body_gate", { mode: "blue" });
    const d = makeDeps({
      intent: { code: "MOVE", label: "移动" },
      charBodyProfile: { ...emptyBodyProfile(), hair: "乌发及腰" },
    });
    await callMainOnce(null, false, d);
    // WO-04：体貌属逐轮导向内容，从 sysBlocks 撤入 11 号位 inChat。
    const inChatMove = JSON.stringify(callModel.mock.calls[0][2]);
    expect(inChatMove).toContain("乌发及腰");
    expect(JSON.stringify(callModel.mock.calls[0][1])).not.toContain("乌发及腰");
  });
});
