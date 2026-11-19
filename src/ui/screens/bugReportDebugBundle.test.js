import { describe, expect, it } from "vitest";
import { buildModalDebugBundle } from "./bugReportDebugBundle.js";

describe("modal debug bundle selection", () => {
  it("keeps only selected turns and non-narrative recent logs", () => {
    const selectedTurn = {
      label: "turn one",
      entries: [
        { role: "user", content: "selected player text" },
        { role: "assistant", content: "selected narrative" },
      ],
    };
    const deselectedTurn = {
      label: "turn two",
      entries: [
        { role: "user", content: "deselected player text" },
        { role: "assistant", content: "deselected narrative" },
      ],
    };
    const retainedLogs = [
      { t: "sys", text: "system status survives" },
      { t: "stat", text: "status survives" },
      { t: "err", text: "error survives" },
      { t: "quest", text: "quest update survives" },
      { t: "item", text: "item update survives" },
      { t: "loot", text: "loot update survives" },
      { t: "skill", text: "skill status survives" },
    ];
    const bundle = buildModalDebugBundle({
      save: { log: [], convo: [] },
      apiConfig: { model: "test", endpoint: "https://provider.example" },
      recentLog: [
        { t: "cmd", text: "selected player text" },
        { t: "desc", text: "selected narrative" },
        { t: "cmd", text: "deselected player text" },
        { t: "narrator", text: "deselected narrative" },
        { t: "crash", text: "deselected crash narrative" },
        { t: "affection", text: "deselected affinity narrative" },
        ...retainedLogs,
      ],
      traces: [],
      pipelineCalls: [],
      errors: [],
    }, [selectedTurn, deselectedTurn], new Set([0]), false);
    const serialized = JSON.stringify(bundle);

    expect(bundle.conversation).toEqual([selectedTurn]);
    expect(bundle.recentLog).toEqual(retainedLogs);
    expect(serialized).toContain("system status survives");
    expect(serialized).not.toContain("deselected player text");
    expect(serialized).not.toContain("deselected narrative");
    expect(serialized).not.toContain("deselected crash narrative");
    expect(serialized).not.toContain("deselected affinity narrative");
  });

  it("includes only selected turns and no AI records when pipeline logging is unchecked", () => {
    const turns = [
      { label: "turn one", entries: [{ text: "first" }] },
      { label: "turn two", entries: [{ text: "selected" }] },
      { label: "turn three", entries: [{ text: "third" }] },
    ];
    const bundle = buildModalDebugBundle({
      save: { log: [], convo: [{ content: "unselected save conversation" }] },
      apiConfig: { model: "test", endpoint: "https://provider.example" },
      recentLog: [],
      conversation: [{ content: "unselected source conversation" }],
      traces: [{ prompt: "private prompt" }],
      pipelineCalls: [{ prompt: "private pipeline prompt" }],
      errors: [],
    }, turns, new Set([1]), false);

    expect(bundle.conversation).toEqual([{ label: "turn two", entries: [{ text: "selected" }] }]);
    expect(bundle.traces).toEqual([]);
    expect(bundle.pipelineCalls).toEqual([]);
  });
});
