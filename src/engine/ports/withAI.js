import { getPromptDef } from "../../domain/rules/prompt/registry.js";
import { buildPrompt, estimatePromptTokens } from "../../domain/rules/prompt/buildPrompt.js";

const THINKING_TAG_RE = /<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>|<think(?:ing)?\b[^>]*>[\s\S]*$/gi;

function resolveCallCfg(call, apiCfg, ctx) {
  const baseCfg = typeof call.cfg === "function" ? call.cfg(apiCfg, ctx) : apiCfg;
  if (call.tier === "flavor") {
    return { ...(baseCfg || {}), thinkingMode: "off" };
  }
  return baseCfg;
}

// 统一 AI 调用入口：拼装提示词（含 6 槽位与自定义总装）、解析 token 上限、流式与路由透传、执行校验与兜底
export async function withAI(
  callId,
  ctx = {},
  {
    ai,
    apiCfg,
    overrides,
    isStale,
    stream,
    onChunk,
    model,
    recallInfo,
    intent,
    turn,
    temperature,
    maxTokens: optMaxTokens,
    callLabel: optCallLabel,
    modelOptions: optModelOptions,
    throwOnError = true,
  } = {},
) {
  const call = getPromptDef("call", callId);
  if (!call) throw new Error(`Unknown call spec: ${callId}`);

  const built = typeof call.assemble === "function"
    ? call.assemble(ctx, { overrides })
    : buildPrompt(callId, ctx, { overrides });
  const defaultMax = typeof call.defaultMaxTokens === "function"
    ? call.defaultMaxTokens(ctx)
    : call.defaultMaxTokens;
  const cfg = built.cfg !== undefined ? built.cfg : resolveCallCfg(call, apiCfg, ctx);
  const maxTokens = optMaxTokens
    ?? (call.tokenLimitKey ? apiCfg?.callTokenLimits?.[call.tokenLimitKey] : undefined)
    ?? built.maxTokens
    ?? defaultMax;
  const tokenEstimate = built.tokenEstimate ?? estimatePromptTokens(built.system, built.messages);
  const promptMeta = { ...built, maxTokens, tokenEstimate };

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
  if (isStale?.()) {
    return { ok: false, text: "", finishReason: "stale", data: null, promptMeta };
  }

  try {
    const callLabel = optCallLabel ?? built.callLabel ?? (typeof call.label === "function" ? call.label(ctx) : call.label);
    const extraModelOptions = typeof call.modelOptions === "function" ? call.modelOptions(ctx) : call.modelOptions;
    const modelOptions = {
      ...(call.tier === "flavor" ? { disableThinking: true, thinkingBudget: 0 } : {}),
      ...(extraModelOptions || {}),
      ...(optModelOptions || {}),
      ...(maxTokens !== undefined ? { maxTokens } : {}),
      ...(callLabel !== undefined ? { callLabel } : {}),
    };
    const effectiveStream = stream !== undefined ? stream : built.stream;
    const effectiveIntent = intent !== undefined ? intent : built.intent;
    const effectiveRecallInfo = recallInfo !== undefined ? recallInfo : built.recallInfo;
    const chatOpts = {
      ...(cfg !== undefined ? { cfg } : {}),
      systemPrompt: built.system,
      modelOptions,
      ...(effectiveStream !== undefined ? { stream: effectiveStream } : {}),
      ...(typeof onChunk === "function" ? { onChunk } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(optMaxTokens !== undefined ? { maxTokens: optMaxTokens } : {}),
      ...(effectiveRecallInfo !== undefined ? { recallInfo: effectiveRecallInfo } : {}),
      ...(effectiveIntent !== undefined ? { intent: effectiveIntent } : {}),
      ...(turn !== undefined ? { turn } : {}),
    };
    const res = await ai.chat(built.messages, chatOpts);
    if (isStale?.()) {
      return { ok: false, text: "", finishReason: res?.finishReason, data: null, promptMeta };
    }
    const rawText = res?.text || "";
    const text = (call.tier === "flavor" || modelOptions.disableThinking) ? rawText.replace(THINKING_TAG_RE, "").trim() : rawText;
    const passthrough = {
      ...(res?.raw !== undefined ? { raw: res.raw } : {}),
      ...(res?.logprobs !== undefined ? { logprobs: res.logprobs } : {}),
      ...(res?.usage !== undefined ? { usage: res.usage } : {}),
    };
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
        ...passthrough,
      };
    }
    return {
      ok: true,
      text,
      finishReason: res?.finishReason,
      data: text,
      promptMeta,
      ...passthrough,
    };
  } catch (error) {
    return failOrFallback(error?.message || "ai_error", { error });
  }
}
