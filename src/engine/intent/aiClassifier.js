// 把现有 AI 端口包装成行动识别的 classifier 端口（形状仿 Jev：一问一答、选项+概率），
// 以后换成 Jev 或专用分类模型，只需另写一个同形状的实现。
// 识别调用：关思考、要 JSON、输出预算 ≥1024；回复被长度截断时抛 IntentTruncatedError，不静默回落。
import { SYSTEM_PROMPT, renderPrompt, parseChoice, probsFromLogprobs, argmax, extractJson } from "../../domain/intent/prompts.js";

const LABELS = { compound: "行动识别·复合", split: "行动识别·拆分", kind: "行动识别·类别", target: "行动识别·对象", item: "行动识别·物品", direction: "行动识别·方向" };
const LENGTH_REASONS = new Set(["length", "max_tokens", "MAX_TOKENS"]);
export const INTENT_TRUNCATED = "INTENT_TRUNCATED";

export class IntentTruncatedError extends Error {
  constructor(question, text, finishReason) {
    super(`行动识别回复被截断（${question}，finish_reason=${finishReason}）：输出预算被思考或长回复用尽`);
    Object.assign(this, { name: "IntentTruncatedError", code: INTENT_TRUNCATED, question, text, finishReason });
  }
}

export function finishReasonOf(response) {
  return response?.finishReason ?? response?.raw?.choices?.[0]?.finish_reason ?? response?.raw?.candidates?.[0]?.finishReason ?? null;
}

export function createAiClassifier(ai, { model, cfg, temperature = 0, maxTokens = 1024, onResponse } = {}) {
  async function ask(question, vars, options) {
    const prompt = renderPrompt(question, { ...vars, options });
    const startedAt = Date.now();
    const modelOptions = { temperature, maxTokens, jsonOnly: true, disableThinking: true, thinkingBudget: 0, logprobs: true, topLogprobs: 5 };
    const reply = await ai.chat([{ role: "user", content: prompt }], {
      systemPrompt: SYSTEM_PROMPT, callLabel: LABELS[question] || "行动识别", stream: false,
      temperature, maxTokens, modelOptions,
      ...(model ? { model } : {}), ...(cfg ? { cfg: { ...cfg, thinkingMode: "off" } } : {}),
    });
    const response = typeof reply === "string" ? { text: reply } : reply || {};
    const finishReason = finishReasonOf(response);
    onResponse?.({ question, text: response.text ?? "", finishReason, usage: response.usage ?? response.raw?.usage ?? null, ms: Date.now() - startedAt });
    if (LENGTH_REASONS.has(String(finishReason))) throw new IntentTruncatedError(question, response.text ?? "", finishReason);
    return response;
  }
  return {
    async decide(question, vars, options) {
      const response = await ask(question, vars, options);
      const fromLogprobs = probsFromLogprobs(response.logprobs || response.raw?.choices?.[0]?.logprobs, options);
      if (fromLogprobs) return { choice: argmax(fromLogprobs), probs: fromLogprobs, source: "logprobs" };
      return { ...parseChoice(response.text, options), source: "stated" };
    },
    async split(vars) {
      const response = await ask("split", vars, []);
      return extractJson(response.text)?.parts || [];
    },
  };
}
