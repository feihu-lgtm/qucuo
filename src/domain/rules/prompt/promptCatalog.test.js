import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../../app/calls/registerAllPrompts.js";
import { getPromptOverrides, resetPromptOverrides, setPromptOverride } from "./registry.js";
import { buildSysBase } from "./sysBase.js";
import { buildPrivateTalkPayload } from "./privateTalkPayload.js";
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

  it("supports static text overrides and categorizes every item across the 6 dimensions", () => {
    setPromptOverride("fact.summary.sys", { mode: "off", text: "自定义事实指令" });
    const matrix = getCallControlMatrix("fact.summary");
    const sysItem = matrix.items.find((i) => i.id === "fact.summary.sys");
    expect(sysItem.effectiveLit).toBe(false);
    expect(sysItem.canEditText).toBe(true);
    expect(sysItem.effectiveText).toBe("自定义事实指令");
    expect(getPromptOverrides()["fact.summary.sys"]).toEqual({ mode: "off", text: "自定义事实指令" });

    const catIds = new Set(PROMPT_BLOCK_CATEGORIES.map((c) => c.id));
    for (const item of getCallControlMatrix("main:combat").items) {
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
});
