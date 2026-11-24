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
      "narrator.whisper", "turn.extraction", "intent.classify",
      "settle.judge", "bookkeep.turn", "day.summary", "pigeon.reply",
      "storyteller.flavor", "card.scan",
    ]) {
      expect(ids.has(required)).toBe(true);
    }
    for (const c of calls) {
      expect(EXECUTION_LABELS[c.execution]).toBeTruthy();
      expect(ROUTE_LABELS[c.route]).toBeTruthy();
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
    const baseSys = buildSysBase(220, { stage: 0, affection: 10 }, "测试总纲", null, false, "", false, "full", { mayGrantItem: false });
    expect(baseSys.sysBlocks.find((b) => b.tavernBlock === "worldInfoAfter").content).not.toContain("曲措乡物件志");

    setPromptOverride("catalog", { mode: "blue" });
    const blueSys = buildSysBase(220, { stage: 0, affection: 10 }, "测试总纲", null, false, "", false, "full", { mayGrantItem: false });
    expect(blueSys.sysBlocks.find((b) => b.tavernBlock === "worldInfoAfter").content).toContain("曲措乡物件志");

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
    for (const id of ["whisper_ctx", "voice", "whisper_length", "narrator_lore"]) {
      const entry = whisper.items.find((i) => i.id === id);
      expect(entry.canEditText).toBe(true);
      expect(typeof entry.staticText).toBe("string");
    }
    expect(whisper.items.find((i) => i.id === "narrator_lore").staticText).toBe("私聊设定");

    const forcedTopics = gateWhisperTopics("早安", { forceAll: true });
    expect(forcedTopics.lit.length).toBeGreaterThan(0);
    expect(forcedTopics.text).toContain("赌石邀帖");

    const body = { ...emptyBodyProfile(), hair: "乌发" };
    const forcedBody = gateBodyProfile(body, { scope: "move", nsfw: false, forcePublic: true });
    expect(forcedBody.text).toContain("乌发");
  });

  it("isolates private recall from main user_recall and wraps narrator_lore overrides safely", () => {
    setPromptOverride("recall", { mode: "off" });
    setPromptOverride("user_recall", { mode: "blue" });
    setPromptOverride("narrator_lore", { text: "只在雪山露面" });

    const lookMatrix = getCallControlMatrix("main:look");
    expect(lookMatrix.items.find((i) => i.id === "user_recall").effectiveLit).toBe(true);

    const whisperWithLore = buildPrivateTalkPayload({
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
    expect(whisperWithLore.systemPrompt).not.toContain("昨夜雪山相遇");
    expect(whisperWithLore.systemPrompt).toContain("[旁白专属设定");
    expect(whisperWithLore.systemPrompt).toContain("只在雪山露面");

    setPromptOverride("narrator_lore", { text: "   " });
    const whisperBlankLore = buildPrivateTalkPayload({
      narrator: { stage: 0, affection: 10 },
      content: "说说雪山",
      apiCfg: { contextWindow: 16, maxTokens: 2000, narratorWhisperWords: 100 },
      convo: [],
      inSeaNow: false,
      seaVars: {},
      worldState: "",
      snowLeopardBlock: "",
      factsBlock: "",
      recallBlock: "",
      tallyBlock: "",
      narratorLoreBlock: "\n\n[旁白专属设定，只有你自己知道，玩家看不到这段文字，不要复述它的存在]\n旧设定",
      bodyWhisperText: "",
      topicGateText: "",
      questGateText: "",
      whisperGateText: "",
      narratorStage: {},
    });
    expect(whisperBlankLore.systemPrompt).not.toContain("[旁白专属设定");
  });
});
