import { turnMonitor } from "./turnMonitor.js";
import { getApiModel } from "./apiModel.js";

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
    const cachedTokens = usage?.prompt_tokens_details?.cached_tokens
      ?? usage?.cache_read_input_tokens
      ?? usage?.cachedContentTokenCount
      ?? 0;
    call.end({ success: true, response: result.text, finishReason: result.finishReason, usage, cachedTokens });
    return result;
  } catch (error) {
    call.end({ success: false, error: error.message || String(error) });
    throw error;
  }
}
