import { callModel, callModelStream } from "../../apiConfig.js";

function asResponse(value) {
  if (typeof value === "string") return { text: value };
  if (typeof value?.text === "string") return value;
  throw new Error("AI response must be a string or an object with a text field");
}

export function createMockAi(replies = [], { onRequest } = {}) {
  let index = 0;
  return {
    async chat(messages, opts) {
      onRequest?.(messages, opts);
      if (index >= replies.length) throw new Error("Mock AI replies exhausted");
      return asResponse(replies[index++]);
    },
  };
}

export function createReplayAi(entries = []) {
  let index = 0;
  return {
    async chat() {
      if (index >= entries.length) throw new Error("Replay AI entries exhausted");
      return asResponse(entries[index++].response);
    },
  };
}

function systemMessages(systemPrompt) {
  if (!systemPrompt) return [];
  if (Array.isArray(systemPrompt)) {
    return systemPrompt.map((block) => ({
      role: "system",
      content: `[${block.tavernLabel || block.tavernBlock || "system"}]\n${block.content || ""}`,
    }));
  }
  return [{ role: "system", content: systemPrompt }];
}

export function createHttpAi({ baseUrl, apiKey, model }) {
  const endpoint = `${String(baseUrl || "").replace(/\/+$/, "")}/chat/completions`;
  return {
    async chat(messages, opts = {}) {
      const cfg = opts.cfg || {};
      const modelOptions = opts.modelOptions || {};
      const maxTokens = modelOptions.maxTokens ?? opts.maxTokens ?? cfg.maxTokens;
      const temperature = modelOptions.temperature ?? opts.temperature ?? cfg.temperature;
      const topP = modelOptions.topP ?? opts.topP ?? cfg.topP;
      const frequencyPenalty = modelOptions.frequencyPenalty ?? opts.frequencyPenalty ?? cfg.frequencyPenalty;
      const presencePenalty = modelOptions.presencePenalty ?? opts.presencePenalty ?? cfg.presencePenalty;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model || cfg.model || model,
          messages: [...systemMessages(opts.systemPrompt), ...messages],
          ...(maxTokens != null ? { max_tokens: maxTokens } : {}),
          ...(temperature != null ? { temperature } : {}),
          ...(topP != null ? { top_p: topP } : {}),
          ...(frequencyPenalty != null ? { frequency_penalty: frequencyPenalty } : {}),
          ...(presencePenalty != null ? { presence_penalty: presencePenalty } : {}),
        }),
        signal: opts.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = String(body?.error?.message || `AI request failed (HTTP ${response.status})`);
        throw new Error(apiKey ? message.split(apiKey).join("[redacted]") : message);
      }
      const body = await response.json();
      const text = body.choices?.[0]?.message?.content;
      if (typeof text !== "string") throw new Error("AI response did not contain message content");
      return { text, finishReason: body.choices?.[0]?.finish_reason };
    },
  };
}

export function createWebAi() {
  const chat = async (messages, opts = {}) => {
    const cfg = opts.cfg;
    if (!cfg || !opts.systemPrompt) throw new Error("Web AI requires cfg and systemPrompt");
    if (opts.stream && cfg.apiType !== "gemini") {
      return callModelStream(cfg, opts.systemPrompt, messages, opts.onChunk, {
        ...(opts.modelOptions || {}),
        intent: opts.intent,
        recallInfo: opts.recallInfo,
      });
    }
    return callModel(cfg, opts.systemPrompt, messages, {
      ...(opts.modelOptions || {}),
      intent: opts.intent,
      recallInfo: opts.recallInfo,
    });
  };
  return { chat, stream: (messages, opts = {}) => chat(messages, { ...opts, stream: true }) };
}

export function createRecordingAi(ai, record) {
  return {
    async chat(messages, opts = {}) {
      const response = await ai.chat(messages, opts);
      await record({
        request: {
          systemPrompt: opts.systemPrompt ?? null,
          messages,
        },
        response: { ...response },
      });
      return response;
    },
  };
}
