import { describe, expect, it } from "vitest";
import { buildModalDebugBundle } from "./bugReportDebugBundle.js";

describe("modal debug bundle selection", () => {
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
