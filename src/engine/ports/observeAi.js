import { turnMonitor } from "../../core/turnMonitor.js";

export const observed = Symbol("observed-ai");

export async function observeAi(messages, opts, request) {
  if (opts[observed]) return request(opts.onChunk);
  const { cfg = {}, modelOptions = {} } = opts;
  const call = turnMonitor.beginAi(opts.turn, {
    apiType: cfg.apiType,
    model: opts.model || cfg.model,
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
    call.end({ success: true, response: result.text, finishReason: result.finishReason, usage: result.usage });
    return result;
  } catch (error) {
    call.end({ success: false, error: error.message || String(error) });
    throw error;
  }
}
