import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../../app/calls/registerAllPrompts.js";
import { getPromptOverrides, resetPromptOverrides, setPromptOverride } from "./registry.js";
import { buildSysBase } from "./sysBase.js";
import { buildPrivateTalkPayload } from "./privateTalkPayload.js";
import { gateWhisperTopics } from "../narrator/narrator.js";
import { gateBodyProfile, emptyBodyProfile } from "../character/bodyProfile.js";
import {
  CALL_GROUP_META,
  EXECUTION_LABELS,
  PROMPT_BLOCK_CATEGORIES,
  ROUTE_LABELS,
  getCallControlMatrix,
  listAllManagedCalls,
} from "./promptCatalog.js";

describe("promptCatalog unified control matrix", () => {
  beforeEach(() => {
    resetPromptOverrides();
  });

  afterEach(() => {
    resetPromptOverrides();
  });

  it("collects main actions, whisper, sync pipeline, and async background calls across all 4 groups", () => {
    const calls = listAllManagedCalls();
    const groups = new Set(calls.map((c) => c.group));
    for (const g of Object.keys(CALL_GROUP_META)) {
      expect(groups.has(g)).toBe(true);
    }
    const ids = new Set(calls.map((c) => c.id));
    for (const required of [
      "main:combat", "main:move", "main:gift",
      "narrator.whisper", "intent.classify",
      "narrator.affinity", "bookkeep.turn", "day.summary", "pigeon.reply",
      "storyteller.flavor", "card.scan",
    ]) {
      expect(ids.has(required)).toBe(true);
    }
    for (const c of calls) {
      expect(EXECUTION_LABELS[c.execution]).toBeTruthy();
      expect(ROUTE_LABELS[c.route]).toBeTruthy();
    }
  });

  it("WO-04 后目录 slot 元数据与真实承载位一致，控制台不说谎", () => {
    // 契约：冰山重排把 length/voice/npc_lore/catalog/body_gate 迁去 11 号位 inChat，
    // preset_scenario 拆成 sys 蓝灯基底 + inChat 绿灯专项段——目录必须标真实新位置。
    const matrix = getCallControlMatrix("main:combat", { mode: "single" });
    const slotOf = (id) => matrix.items.find((i) => i.id === id)?.slot;
    for (const id of ["length", "voice", "npc_lore", "catalog", "body_gate"]) {
      expect(slotOf(id), `${id} 应标 inChat`).toBe("inChat");
    }
    expect(slotOf("preset_scenario")).toBe("sys+inChat");
    // 留守冰山前缀的块仍标 sys。
    for (const id of ["engine_identity", "isolation", "map_law"]) {
      expect(slotOf(id), `${id} 应留守 sys`).toBe("sys");
    }
  });

  it("switches block lighting via setPromptOverride and prevents turning off engine blocks", () => {
    const base = getCallControlMatrix("main:explore", { mode: "single" });
    const catBase = base.items.find((i) => i.id === "catalog");
    expect(catBase.effectiveLit).toBe(false);

    setPromptOverride("catalog", { mode: "blue" });
    const forcedBlue = getCallControlMatrix("main:explore", { mode: "single" });
    expect(forcedBlue.items.find((i) => i.id === "catalog").effectiveLit).toBe(true);
    expect(forcedBlue.items.find((i) => i.id === "catalog").reason).toBe("总控台蓝灯");

    setPromptOverride("engine_identity", { mode: "off" });
    const engineCheck = getCallControlMatrix("main:explore", { mode: "single" });
    expect(engineCheck.items.find((i) => i.id === "engine_identity").effectiveLit).toBe(true);
    expect(engineCheck.items.find((i) => i.id === "engine_identity").canToggleOff).toBe(false);
  });

  it("supports static text overrides, protects sole sys blocks, and categorizes every item across 6 dimensions", () => {
    setPromptOverride("fact.summary.sys", { mode: "off", text: "自定义事实指令" });
    const matrix = getCallControlMatrix("fact.summary");
    const sysItem = matrix.items.find((i) => i.id === "fact.summary.sys");
    expect(sysItem.soleSys).toBe(true);
    expect(sysItem.canToggleOff).toBe(false);
    expect(sysItem.effectiveLit).toBe(true);
    expect(sysItem.reason).toBe("唯一系统块不可关闭");
    expect(sysItem.canEditText).toBe(true);
    expect(sysItem.effectiveText).toBe("自定义事实指令");
    expect(getPromptOverrides()["fact.summary.sys"]).toEqual({ mode: "off", text: "自定义事实指令" });

    setPromptOverride("voice", { mode: "off" });
    const mainCombat = getCallControlMatrix("main:combat");
    const voiceItem = mainCombat.items.find((i) => i.id === "voice");
    expect(voiceItem.canToggleOff).toBe(true);
    expect(voiceItem.effectiveLit).toBe(false);

    const catIds = new Set(PROMPT_BLOCK_CATEGORIES.map((c) => c.id));
    for (const item of mainCombat.items) {
      expect(catIds.has(item.category)).toBe(true);
    }
    expect(getCallControlMatrix("narrator.whisper").items.map((i) => i.id)).toContain("body_gate");
  });

  it("drives runtime sysBase and privateTalkPayload assembly when overrides are toggled", () => {
    // WO-04：物件志属动态块，总控台开关依然生效，只是承载位从 worldInfoAfter 挪到 dynBlocks.catalog。
    const baseSys = buildSysBase(220, { stage: 0, affection: 10 }, "测试总纲", null, false, "", false, "full", { mayGrantItem: false });
    expect(baseSys.dynBlocks.catalog).not.toContain("曲措乡物件志");

    setPromptOverride("catalog", { mode: "blue" });
    const blueSys = buildSysBase(220, { stage: 0, affection: 10 }, "测试总纲", null, false, "", false, "full", { mayGrantItem: false });
    expect(blueSys.dynBlocks.catalog).toContain("曲措乡物件志");

    setPromptOverride("recall", { mode: "off" });
    const whisper = buildPrivateTalkPayload({
      narrator: { stage: 0, affection: 10 },
      content: "近来如何",
      apiCfg: { contextWindow: 16, maxTokens: 2000, narratorWhisperWords: 100 },
      convo: [],
      inSeaNow: false,
      seaVars: {},
      worldState: "",
      snowLeopardBlock: "",
      factsBlock: "",
      recallBlock: "[往事] 昨夜雪山相遇",
      tallyBlock: "",
      narratorLoreBlock: "",
      bodyWhisperText: "",
      topicGateText: "",
      questGateText: "",
      whisperGateText: "",
      narratorStage: {},
    });
    expect(whisper.systemPrompt).not.toContain("昨夜雪山相遇");
  });

  it("hides fake blue toggle on runtime-triggered gates and exposes editable static blocks", () => {
    const combat = getCallControlMatrix("main:combat", { presetScenario: "" });
    const reunionItem = combat.items.find((i) => i.id === "reunion");
    const scenarioItem = combat.items.find((i) => i.id === "preset_scenario");
    const mainVoiceItem = combat.items.find((i) => i.id === "voice");
    expect(reunionItem.canForceBlue).toBe(false);
    expect(scenarioItem.canEditText).toBe(true);
    expect(scenarioItem.staticText).toBe("");
    expect(mainVoiceItem.canEditText).toBe(true);

    const whisper = getCallControlMatrix("narrator.whisper", { narratorLorebook: "私聊设定" });
    expect(whisper.items.find((i) => i.id === "quest_gate").canForceBlue).toBe(false);
    for (const id of ["whisper_ctx", "voice", "whisper_length"]) {
      const entry = whisper.items.find((i) => i.id === id);
      expect(entry.isSupplement).toBe(true);
      expect(entry.canEditText).toBe(true);
      expect(entry.staticText).toBe("");
    }
    const loreEntry = whisper.items.find((i) => i.id === "narrator_lore");
    expect(loreEntry.isSupplement).toBe(false);
    expect(loreEntry.editable).toBe("toggle");
    expect(loreEntry.canEditText).toBe(false);
    expect(loreEntry.canToggleOff).toBe(true);
    expect(loreEntry.staticText).toBe("私聊设定");
    expect(loreEntry.effectiveText).toBe("私聊设定");

    const forcedTopics = gateWhisperTopics("早安", { forceAll: true });
    expect(forcedTopics.lit.length).toBeGreaterThan(0);
    expect(forcedTopics.text).toContain("赌石邀帖");

    const body = { ...emptyBodyProfile(), hair: "乌发" };
    const forcedBody = gateBodyProfile(body, { scope: "move", nsfw: false, forcePublic: true });
    expect(forcedBody.text).toContain("乌发");
  });

  it("isolates private recall from main user_recall and keeps narrator_lore text out of the control center overrides", () => {
    setPromptOverride("recall", { mode: "off" });
    setPromptOverride("user_recall", { mode: "blue" });
    setPromptOverride("narrator_lore", { text: "遗留的旧覆盖" });

    const lookMatrix = getCallControlMatrix("main:look");
    expect(lookMatrix.items.find((i) => i.id === "user_recall").effectiveLit).toBe(true);

    const whisper = getCallControlMatrix("narrator.whisper", { narratorLorebook: "设置页正文" });
    const loreEntry = whisper.items.find((i) => i.id === "narrator_lore");
    expect(loreEntry.hasTextOverride).toBe(false);
    expect(loreEntry.effectiveText).toBe("设置页正文");

    const whisperPayload = buildPrivateTalkPayload({
      narrator: { stage: 0, affection: 10 },
      content: "说说雪山",
      apiCfg: { contextWindow: 16, maxTokens: 2000, narratorWhisperWords: 100 },
      convo: [],
      inSeaNow: false,
      seaVars: {},
      worldState: "",
      snowLeopardBlock: "",
      factsBlock: "",
      recallBlock: "[往事] 昨夜雪山相遇",
      tallyBlock: "",
      narratorLoreBlock: "",
      bodyWhisperText: "",
      topicGateText: "",
      questGateText: "",
      whisperGateText: "",
      narratorStage: {},
    });
    expect(whisperPayload.systemPrompt).not.toContain("昨夜雪山相遇");
  });

  it("treats voice, whisper_ctx, and whisper_length overrides as supplements without freezing affection tier or word count", () => {
    setPromptOverride("voice", { text: "额外补充：少用感叹句" });
    setPromptOverride("whisper_length", { text: "避免重复上一轮的话" });

    const sysLow = buildSysBase(220, { stage: "flirting", affection: 20 }, "总纲", null, false, "", false, "full");
    const sysHigh = buildSysBase(220, { stage: "flirting", affection: 90 }, "总纲", null, false, "", false, "full");
    // WO-04：旁白声线随好感档位跳变，属动态块——补充文本与档位措辞都改由 dynBlocks.voice 承载。
    const voiceLow = sysLow.dynBlocks.voice;
    const voiceHigh = sysHigh.dynBlocks.voice;
    expect(voiceLow).toContain("好感度 20/100");
    expect(voiceHigh).toContain("好感度 90/100");
    expect(voiceLow).toContain("额外补充：少用感叹句");
    expect(voiceHigh).toContain("额外补充：少用感叹句");
    // 好感档位不再污染 main 块（冰山前缀必须逐字节稳定）。
    expect(sysLow.sysBlocks.find((b) => b.tavernBlock === "main").content)
      .toBe(sysHigh.sysBlocks.find((b) => b.tavernBlock === "main").content);

    const whisperAwake = buildPrivateTalkPayload({
      narrator: { stage: "flirting", affection: 90 },
      content: "聊聊今天",
      apiCfg: { contextWindow: 16, maxTokens: 2000, narratorWhisperWords: { awake: 350 } },
      convo: [],
      inSeaNow: false,
      seaVars: {},
      worldState: "",
      snowLeopardBlock: "",
      factsBlock: "",
      recallBlock: "",
      tallyBlock: "",
      narratorLoreBlock: "",
      bodyWhisperText: "",
      topicGateText: "",
      questGateText: "",
      whisperGateText: "",
      narratorStage: {},
    });
    expect(whisperAwake.systemPrompt).toContain("约 350 字");
    expect(whisperAwake.systemPrompt).toContain("好感度 90/100");
    expect(whisperAwake.systemPrompt).toContain("避免重复上一轮的话");
    expect(whisperAwake.systemPrompt).toContain("额外补充：少用感叹句");

    const whisperLow = buildPrivateTalkPayload({
      narrator: { stage: "flirting", affection: 20 },
      content: "聊聊今天",
      apiCfg: { contextWindow: 16, maxTokens: 2000, narratorWhisperWords: { faint: 180, awake: 350 } },
      convo: [],
      inSeaNow: false,
      seaVars: {},
      worldState: "",
      snowLeopardBlock: "",
      factsBlock: "",
      recallBlock: "",
      tallyBlock: "",
      narratorLoreBlock: "",
      bodyWhisperText: "",
      topicGateText: "",
      questGateText: "",
      whisperGateText: "",
      narratorStage: {},
    });
    expect(whisperLow.systemPrompt).toContain("约 180 字");
    expect(whisperLow.systemPrompt).toContain("好感度 20/100");
  });
});
