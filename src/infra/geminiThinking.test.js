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

    // 官方：3.7 / 3.8 Flash 与 Gemini 4 不支持 minimal（传了报错），最低只能 low
    for (const model of ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-4-argon"]) {
      const g = {};
      applyThinkingGemini(g, { model, thinkingMode: "high" }, { disableThinking: true });
      expect(g.thinkingConfig, model).toEqual({ thinkingLevel: "low" });
    }
  });

  it("设置里选「关」时 3 系列以后真的压到最低档，不再留空让模型按默认 medium 思考", () => {
    const g3Off = {};
    applyThinkingGemini(g3Off, { model: "gemini-3-flash-preview", thinkingMode: "off" });
    expect(g3Off.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
    const g38Off = {};
    applyThinkingGemini(g38Off, { model: "gemini-3.8-flash", thinkingMode: "off" });
    expect(g38Off.thinkingConfig).toEqual({ thinkingLevel: "low" });

    const g25Med = {};
    applyThinkingGemini(g25Med, { model: "gemini-2.5-flash", thinkingMode: "medium" });
    expect(g25Med.thinkingConfig?.thinkingBudget).toBeGreaterThan(0);
  });
});
