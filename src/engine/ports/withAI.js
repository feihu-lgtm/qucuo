import { getPromptDef } from "../../domain/rules/prompt/registry.js";
import { buildPrompt } from "../../domain/rules/prompt/buildPrompt.js";

const THINKING_TAG_RE = /<thinking>[\s\S]*?<\/thinking>/g;

function resolveCallCfg(call, apiCfg, ctx) {
  const baseCfg = typeof call.cfg === "function" ? call.cfg(apiCfg, ctx) : apiCfg;
  if (call.tier === "flavor") {
    return { ...(baseCfg || {}), thinkingMode: "off" };
  }
  return baseCfg;
}

// 统一 AI 调用入口：拼装提示词、解析 token 上限、执行校验与兜底
export async function withAI(
  callId,
  ctx = {},
  { ai, apiCfg, overrides, isStale, stream, onChunk, throwOnError = true } = {},
) {
  const call = getPromptDef("call", callId);
  if (!call) throw new Error(`Unknown call spec: ${callId}`);

  const built = buildPrompt(callId, ctx, { overrides });
  const defaultMax = typeof call.defaultMaxTokens === "function"
    ? call.defaultMaxTokens(ctx)
    : call.defaultMaxTokens;
  const maxTokens = (call.tokenLimitKey ? apiCfg?.callTokenLimits?.[call.tokenLimitKey] : undefined)
    ?? defaultMax;
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
    const cfg = resolveCallCfg(call, apiCfg, ctx);
    const extraModelOptions = typeof call.modelOptions === "function" ? call.modelOptions(ctx) : call.modelOptions;
    const chatOpts = {
      cfg,
      systemPrompt: built.system,
      modelOptions: { ...(extraModelOptions || {}), maxTokens, callLabel },
      ...(stream !== undefined ? { stream } : {}),
      ...(typeof onChunk === "function" ? { onChunk } : {}),
    };
    const res = await ai.chat(built.messages, chatOpts);
    if (isStale?.()) {
      return { ok: false, text: "", finishReason: res?.finishReason, data: null, promptMeta };
    }
    const rawText = res?.text || "";
    const text = call.tier === "flavor" ? rawText.replace(THINKING_TAG_RE, "").trim() : rawText;
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
