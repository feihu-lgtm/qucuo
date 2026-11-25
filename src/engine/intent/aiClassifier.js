// 把现有 AI 端口包装成行动识别的 classifier 端口：整句一次调用，返回 { actions }，
// 以后换成专用分类模型，只需另写一个同形状的实现。
// 识别调用（经 withAI 统一出口）：关思考、要 JSON、输出预算 ≥1024；回复被长度截断时抛 IntentTruncatedError，不静默回落。
import { SYSTEM_PROMPT, renderPrompt, extractJson } from "../../domain/rules/intent/prompts.js";
import { ensureUnifiedCalls } from "../../domain/rules/prompt/calls/unifiedCalls.js";
import { withAI } from "../ports/withAI.js";

const LABEL = "行动识别·整句";
const LENGTH_REASONS = new Set(["length", "max_tokens", "MAX_TOKENS"]);
export const INTENT_TRUNCATED = "INTENT_TRUNCATED";

export class IntentTruncatedError extends Error {
  constructor(question, text, finishReason) {
    super(`行动识别回复被截断（${question}，finish_reason=${finishReason}）：输出预算被思考或长回复用尽`);
    Object.assign(this, { name: "IntentTruncatedError", code: INTENT_TRUNCATED, question, text, finishReason });
  }
}

function finishReasonOf(response) {
  return response?.finishReason ?? response?.raw?.choices?.[0]?.finish_reason ?? response?.raw?.candidates?.[0]?.finishReason ?? null;
}

export function createAiClassifier(ai, { model, cfg, temperature = 0, maxTokens = 1024, onResponse } = {}) {
  return {
    // 整句只发这一次请求；回复不是合法 JSON 时返回空行动列表，由闸门回落自由行动。
    async recognize(vars) {
      ensureUnifiedCalls();
      const prompt = renderPrompt("recognize", vars);
      const startedAt = Date.now();
      const modelOptions = { temperature, maxTokens, jsonOnly: true, disableThinking: true, thinkingBudget: 0 };
      const response = await withAI(
        "intent.classify",
        { systemPrompt: SYSTEM_PROMPT, prompt, callLabel: LABEL, maxTokens, cfg },
        { ai, apiCfg: cfg, stream: false, model, temperature, maxTokens, callLabel: LABEL, modelOptions },
      );
      const finishReason = finishReasonOf(response);
      onResponse?.({ question: "recognize", text: response.text ?? "", finishReason, usage: response.usage ?? response.raw?.usage ?? null, ms: Date.now() - startedAt });
      if (LENGTH_REASONS.has(String(finishReason))) throw new IntentTruncatedError("recognize", response.text ?? "", finishReason);
      const json = extractJson(response.text);
      return Array.isArray(json?.actions) ? json : { actions: [], parseFailed: true };
    },
  };
}
