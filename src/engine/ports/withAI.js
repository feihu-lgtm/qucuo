import { getDef } from "../../domain/prompt/registry.js";
import { buildPrompt } from "../../domain/prompt/buildPrompt.js";

// 统一 AI 调用入口：拼装提示词、解析 token 上限、执行校验与兜底
export async function withAI(
  callId,
  ctx = {},
  { ai, apiCfg, overrides, isStale, throwOnError = true } = {},
) {
  const call = getDef("call", callId);
  if (!call) throw new Error(`Unknown call spec: ${callId}`);

  const built = buildPrompt(callId, ctx, { overrides });
  const maxTokens = (call.tokenLimitKey ? apiCfg?.callTokenLimits?.[call.tokenLimitKey] : undefined)
    ?? call.defaultMaxTokens;
  const promptMeta = { ...built, maxTokens };

  const failOrFallback = (reason, { text = "", finishReason, error } = {}) => {
    if (call.offline) {
      return {
        ok: false,
        text,
        finishReason,
        data: call.offline(ctx, reason),
        ...(error ? { error } : {}),
        promptMeta,
      };
    }
    if (error && throwOnError) throw error;
    return {
      ok: false,
      text,
      finishReason,
      data: null,
      error: error || new Error(reason),
      promptMeta,
    };
  };

  if (!ai || apiCfg?.offline) {
    const err = new Error(!ai ? "AI port is required" : "offline_mode");
    return failOrFallback(err.message, { error: err });
  }

  try {
    const callLabel = typeof call.label === "function" ? call.label(ctx) : call.label;
    const cfg = typeof call.cfg === "function" ? call.cfg(apiCfg, ctx) : apiCfg;
    const extraModelOptions = typeof call.modelOptions === "function" ? call.modelOptions(ctx) : call.modelOptions;
    const res = await ai.chat(built.messages, {
      cfg,
      systemPrompt: built.system,
      modelOptions: { ...(extraModelOptions || {}), maxTokens, callLabel },
    });
    if (isStale?.()) {
      return { ok: false, text: "", finishReason: res?.finishReason, data: null, promptMeta };
    }
    const text = res?.text || "";
    if (call.vet) {
      const vetted = call.vet(text, ctx);
      if (!vetted?.ok) {
        return failOrFallback(vetted?.reason || "vet_failed", { text, finishReason: res?.finishReason });
      }
      return {
        ok: true,
        text,
        finishReason: res?.finishReason,
        data: "value" in vetted ? vetted.value : text,
        promptMeta,
      };
    }
    return {
      ok: true,
      text,
      finishReason: res?.finishReason,
      data: text,
      promptMeta,
    };
  } catch (error) {
    return failOrFallback(error?.message || "ai_error", { error });
  }
}
