import { describe, expect, it } from "vitest";
import { applyThinkingGemini } from "./providers.js";

describe("applyThinkingGemini", () => {
  it("disableThinking=true 时禁用或压低各代 Gemini 思考预算", () => {
    const g25Flash = {};
    applyThinkingGemini(g25Flash, { model: "gemini-2.5-flash", thinkingMode: "high" }, { disableThinking: true });
    expect(g25Flash.thinkingConfig).toEqual({ thinkingBudget: 0 });

    const g25Pro = {};
    applyThinkingGemini(g25Pro, { model: "gemini-2.5-pro", thinkingMode: "high" }, { disableThinking: true, thinkingBudget: 0 });
    expect(g25Pro.thinkingConfig).toEqual({ thinkingBudget: 128 });

    const g3Flash = {};
    applyThinkingGemini(g3Flash, { model: "gemini-3-flash-preview", thinkingMode: "high" }, { disableThinking: true });
    expect(g3Flash.thinkingConfig).toEqual({ thinkingLevel: "minimal" });

    const g3Pro = {};
    applyThinkingGemini(g3Pro, { model: "gemini-3-pro-preview", thinkingMode: "high" }, { disableThinking: true });
    expect(g3Pro.thinkingConfig).toEqual({ thinkingLevel: "low" });
  });

  it("未传 disableThinking 时保持原有 Gemini 思考配置行为", () => {
    const g3Off = {};
    applyThinkingGemini(g3Off, { model: "gemini-3-flash-preview", thinkingMode: "off" });
    expect(g3Off.thinkingConfig).toBeUndefined();

    const g25Med = {};
    applyThinkingGemini(g25Med, { model: "gemini-2.5-flash", thinkingMode: "medium" });
    expect(g25Med.thinkingConfig?.thinkingBudget).toBeGreaterThan(0);
  });
});
