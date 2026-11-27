import { turnMonitor } from "./turnMonitor.js";
import { getApiModel } from "./apiModel.js";
import { scrubCredentialPatterns } from "./textRedaction.js";

export const observed = Symbol("observed-ai");

export async function observeAi(messages, opts, request) {
  if (opts[observed]) return request(opts.onChunk);
  const { cfg = {}, modelOptions = {} } = opts;
  const call = turnMonitor.beginAi(opts.turn, {
    apiType: cfg.apiType,
    model: opts.model || getApiModel(cfg),
    callLabel: opts.callLabel || modelOptions.callLabel || "AI 调用",
    systemPrompt: opts.systemPrompt,
    userMessages: messages,
    recall: opts.recallInfo,
    intent: opts.intent,
    maxTokens: modelOptions.maxTokens ?? opts.maxTokens ?? cfg.maxTokens,
    temperature: modelOptions.temperature ?? opts.temperature ?? cfg.temperature,
    streamed: !!opts.stream,
  });
  try {
    const result = await request((...args) => {
      call.chunk();
      opts.onChunk?.(...args);
    });
    // 各家缓存命中字段统一归一化为 cachedTokens：OpenAI cached_tokens /
    // Anthropic cache_read_input_tokens / Gemini cachedContentTokenCount，
    // 随 usage 一起写入流水线诊断日志，供 TraceViewer 观察前缀缓存命中率。
    const usage = result.usage;
    // W-FIX3：补 OpenAI 兼容中转常见变体——顶层 usage.cached_tokens 与
    // usage.prompt_cache_hit_tokens（部分中转不走 prompt_tokens_details 嵌套），
    // 排查 cachedTokens 全零是字段名差异还是前缀不足 1024 tokens。
    const cachedTokens = usage?.prompt_tokens_details?.cached_tokens
      ?? usage?.cache_read_input_tokens
      ?? usage?.cachedContentTokenCount
      ?? usage?.cached_tokens
      ?? usage?.prompt_cache_hit_tokens
      ?? 0;
    // A1：dev 下短调用（disableThinking→reasoning_effort minimal）思考 token 超 200
    // 说明中转/端点吞了思考档参数——警告进 turnMonitor 全流程日志（TraceViewer 可见），
    // 只记模型与调用 id，不记正文/密钥。
    const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens;
    if (import.meta.env?.DEV && modelOptions.disableThinking && Number(reasoningTokens) > 200) {
      call.warn(`短调用 reasoning_tokens=${reasoningTokens} 超 200——中转可能吞了 reasoning_effort`, {
        model: opts.model || getApiModel(cfg),
        callId: result.raw?.id || "n/a",
        reasoningTokens,
      });
    }
    call.end({ success: true, response: result.text, finishReason: result.finishReason, usage, cachedTokens });
    return result;
  } catch (error) {
    call.end({ success: false, error: scrubCredentialPatterns(String(error?.message || error)), httpStatus: error?.httpStatus });
    throw error;
  }
}
