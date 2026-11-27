import { describe, expect, it } from "vitest";
import {
  adaptOpenAIBodyForGemini, buildGeminiRequest, dropTrailingModelTurns, geminiMinOutputTokens,
  geminiOffThinkingLevel, isGeminiLevelModel, PROVIDERS,
} from "./providers.js";

// 口径来源：Gemini API 官方文档（2026-10）——What's new in Gemini 3.6 / 3.8 Flash / Gemini 4 Argon、Thinking、Caching。
describe("Gemini 3+ / 4 调用口径", () => {
  it("3 系列、4 系列都按思考档型号处理，2.5 不算", () => {
    for (const m of ["gemini-3.8-flash", "gemini-4-argon", "google/gemini-3.6-flash", "gemini-3.5-flash-lite", "models/gemini-4-hydrogen"]) {
      expect(isGeminiLevelModel(m), m).toBe(true);
    }
    for (const m of ["gemini-2.5-flash", "gemini-2.5-pro", "gpt-5.6", ""]) expect(isGeminiLevelModel(m), m).toBe(false);
  });

  it("「思考关」只在支持 minimal 的型号上给 minimal，其余给 low", () => {
    expect(geminiOffThinkingLevel("gemini-3.6-flash")).toBe("minimal");
    expect(geminiOffThinkingLevel("gemini-3.5-flash-lite")).toBe("minimal");
    expect(geminiOffThinkingLevel("gemini-3.8-flash")).toBe("low");
    expect(geminiOffThinkingLevel("gemini-3.7-flash")).toBe("low");
    expect(geminiOffThinkingLevel("gemini-4-argon")).toBe("low");
  });

  it("输出上限下限：Gemini 4 为 32768，3 系列为 8192，2.5 不设", () => {
    expect(geminiMinOutputTokens("gemini-4-argon")).toBe(32768);
    expect(geminiMinOutputTokens("gemini-3.8-flash")).toBe(8192);
    expect(geminiMinOutputTokens("gemini-2.5-flash")).toBe(0);
  });

  it("末尾预填的 model 轮并成一条 user 轮，避免 400", () => {
    const out = dropTrailingModelTurns([{ role: "user", content: "写" }, { role: "assistant", content: "雪落" }]);
    expect(out.at(-1).role).toBe("user");
    expect(out.at(-1).content).toContain("雪落");
    const plain = [{ role: "user", content: "写" }];
    expect(dropTrailingModelTurns(plain)).toBe(plain);
  });

  it("原生请求：系统提示进 systemInstruction、密钥进请求头、不传采样参数、输出上限抬到下限、思考只用 thinkingLevel", () => {
    const { headers, body } = buildGeminiRequest({
      cfg: { model: "gemini-3.8-flash", apiKey: "k-123", thinkingMode: "off" },
      provider: PROVIDERS.gemini,
      systemText: "你是说书人",
      messages: [{ role: "user", content: "往东走" }, { role: "assistant", content: "预填" }],
      maxOutputTokens: 2000,
      sampling: { temperature: 0.9, topP: 0.8, topK: 40 },
    });
    expect(headers["x-goog-api-key"]).toBe("k-123");
    expect(body.systemInstruction).toEqual({ parts: [{ text: "你是说书人" }] });
    expect(body.contents.at(-1).role).toBe("user");
    expect(body.generationConfig).toEqual({ maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "low" } });
  });

  it("2.5 照旧传采样参数与 thinkingBudget", () => {
    const { body } = buildGeminiRequest({
      cfg: { model: "gemini-2.5-flash", apiKey: "k", thinkingMode: "medium" },
      provider: PROVIDERS.gemini, systemText: "s", messages: [{ role: "user", content: "u" }],
      maxOutputTokens: 4000, sampling: { temperature: 0.7 },
    });
    expect(body.generationConfig.temperature).toBe(0.7);
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBeGreaterThan(0);
  });

  it("OpenAI 兼容通道上的 Gemini 3+：去掉采样参数、抬输出下限；非 Gemini 不动", () => {
    const g = adaptOpenAIBodyForGemini({ model: "google/gemini-4-argon", temperature: 1, top_p: 0.9, max_tokens: 1000 });
    expect(g).toEqual({ model: "google/gemini-4-argon", max_tokens: 32768 });
    const other = { model: "gpt-5.6", temperature: 1, max_tokens: 1000 };
    expect(adaptOpenAIBodyForGemini({ ...other })).toEqual(other);
  });
});
