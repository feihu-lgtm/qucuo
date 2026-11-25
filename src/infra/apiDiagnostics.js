import { observeAi } from "./observeAi.js";
import { readSSE, stripReasoning } from "./apiSse.js";
import { getApiModel } from "./apiModel.js";
import { withProxy, httpFailure, callModel, fetchWithTimeout, readJsonOrThrow, setRequestTimeout, rejectNonStream, formatBlock, fetchOpenAI, isOpenAICompatible } from "./apiTransport.js";
import { API_TYPES, migrateProvider, DEFAULT_CALL_TOKEN_LIMITS, PROVIDERS,
  normalizeOpenAIEndpoint, normalizeAnthropicEndpoint, normalizeGeminiBase,
  applyThinkingAnthropic, applyThinkingGemini, applyThinkingOpenAI,
  clampMaxTokensForProvider, ANTHROPIC_KNOWN_MODELS } from "./providers.js";

export async function testConnection(cfg) {
  try {
    const { text } = await callModel(cfg, "你是一个测试助手。", [{ role: "user", content: "请回复：连接成功" }], { maxTokens: cfg.callTokenLimits?.connectionTest ?? DEFAULT_CALL_TOKEN_LIMITS.connectionTest });
    return text;
  } catch (error) {
    if (migrateProvider(cfg).provider === "vertex" && !error.requestUrl) {
      const { buildVertexEndpoint } = await import("./vertexAdc.js");
      error.requestUrl = buildVertexEndpoint(cfg.vertexProject, cfg.vertexLocation);
    }
    throw error;
  }
}

// 流式调用：通过 onChunk(deltaText) 回调逐段返回文本，onDone(fullText) 在结束时给出完整拼接结果。
// 支持 Anthropic / OpenAI 兼容 / Gemini 原生（streamGenerateContent?alt=sse）三种 SSE 协议。
export function callModelStream(cfg, systemPrompt, messages, onChunk, opts = {}) {
  const migrated = migrateProvider(cfg);
  return observeAi(messages, { ...opts, cfg: migrated, systemPrompt, onChunk, stream: true },
    (chunk) => requestStream(migrated, systemPrompt, messages, chunk, opts));
}

async function requestStream(cfg, systemPrompt, messages, onChunk, opts) {
  if (cfg.timeoutMs) setRequestTimeout(cfg.timeoutMs);
  const maxTokens = opts.maxTokens ?? cfg.maxTokens;
  const temperature = opts.temperature ?? cfg.temperature;

  try {
    let full = "";
    let finishReason, usage; // 捕获停止原因与 token 用量，供 Pipeline 判断"是正常收尾还是被 length 截断"

    if (cfg.apiType === API_TYPES.ANTHROPIC) {
      const provider = PROVIDERS[cfg.provider];
      const url = withProxy(normalizeAnthropicEndpoint(cfg.endpoint || provider.endpoint), cfg);
      const system = Array.isArray(systemPrompt)
        ? (systemPrompt.length === 1 ? formatBlock(systemPrompt[0]) : systemPrompt.map(b => ({ type: "text", text: formatBlock(b) })))
        : systemPrompt;
      const maxOutputTokens = clampMaxTokensForProvider(maxTokens, cfg, provider);
      const abody = { model: cfg.model, [provider.maxTokensField]: maxOutputTokens, temperature, system, messages, stream: true };
      applyThinkingAnthropic(abody, cfg, maxOutputTokens);
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json", ...provider.extraHeaders, "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(abody),
      });
      await rejectNonStream(res, "Anthropic 流式调用", url);
      await readSSE(res, (eventData) => {
        if (eventData.type === "content_block_delta" && eventData.delta?.text) {
          full += eventData.delta.text;
          onChunk(eventData.delta.text, full);
        } else if (eventData.type === "message_delta") {
          // Anthropic 在 message_delta 事件里给出最终 stop_reason 和累计 output token
          if (eventData.delta?.stop_reason) finishReason = eventData.delta.stop_reason;
          if (eventData.usage) usage = { ...usage, ...eventData.usage };
        } else if (eventData.type === "message_start" && eventData.message?.usage) {
          usage = { ...usage, ...eventData.message.usage };
        }
      });

    } else if (isOpenAICompatible(cfg.apiType)) {
      const res = await fetchOpenAI(cfg, systemPrompt, messages, opts, true);
      await rejectNonStream(res, "OpenAI 兼容流式调用");
      await readSSE(res, (eventData) => {
        const delta = eventData.choices?.[0]?.delta?.content || "";
        if (delta) { full += delta; onChunk(delta, full); }
        // finish_reason 出现在最后一个带 choices 的事件里；usage 需请求时开了 include_usage 才会在末尾单独一个事件给出
        if (eventData.choices?.[0]?.finish_reason) finishReason = eventData.choices[0].finish_reason;
        if (eventData.usage) usage = eventData.usage;
      });

    } else if (cfg.apiType === API_TYPES.GEMINI) {
      // Gemini 原生 SSE：streamGenerateContent?alt=sse，每个事件的 candidates[0].content.parts
      // 只带增量文本；usageMetadata 在末帧给出（含 cachedContentTokenCount 缓存命中数）。
      const provider = PROVIDERS[cfg.provider];
      const base = normalizeGeminiBase(cfg.endpoint || provider.endpoint);
      const url = withProxy(`${base}/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cfg.apiKey)}`, cfg);
      const contents = messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      if (contents.length && contents[0].role === "user") {
        const systemText = Array.isArray(systemPrompt) ? systemPrompt.map(formatBlock).join("\n\n") : systemPrompt;
        contents[0].parts[0].text = systemText + "\n\n" + contents[0].parts[0].text;
      }
      const genConfig = { temperature, maxOutputTokens: clampMaxTokensForProvider(maxTokens, cfg, provider) };
      if (opts.jsonOnly) genConfig.responseMimeType = "application/json";
      applyThinkingGemini(genConfig, cfg, opts);
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { ...provider.extraHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ contents, generationConfig: genConfig }),
      });
      await rejectNonStream(res, "Gemini 流式调用", url);
      await readSSE(res, (eventData) => {
        const parts = eventData.candidates?.[0]?.content?.parts;
        const delta = parts?.map(p => p.text || "").join("") || "";
        if (delta) { full += delta; onChunk(delta, full); }
        if (eventData.candidates?.[0]?.finishReason) finishReason = eventData.candidates[0].finishReason;
        if (eventData.usageMetadata) usage = eventData.usageMetadata;
      });

    } else {
      throw new Error(`未知的 API 类型: ${cfg.apiType}`);
    }

    return { text: stripReasoning(full), finishReason, usage };

  } catch (err) {
    throw err;
  }
}

// 自动检测可用模型列表。
// - OpenAI 兼容（含 DeepSeek 等）：真实调用 GET /models
// - Gemini：真实调用 GET /v1beta/models
// - Anthropic：官方没有公开的模型列表接口，返回一份已知模型的静态清单
export async function listModels(cfg) {
  const config = migrateProvider(cfg);
  const provider = PROVIDERS[config.provider];
  if (provider.protocol === "vertex") throw new Error("Vertex AI 请手动填写模型名称");
  if (provider.protocol === "anthropic") {
    return ANTHROPIC_KNOWN_MODELS;
  }

  if (provider.protocol === "openai") {
    // 模型列表要请求 <base>/models。base 从用户地址稳妥推导，不走自动补全逻辑：
    // 地址里含 /chat/completions 就砍掉取 base；否则把用户填的（去尾斜杠）直接当 base。
    const endpoint = config.endpoint || provider.endpoint;
    const base = normalizeOpenAIEndpoint(endpoint, provider.id === "custom" && config.openaiAutoComplete)
      .replace(/\/chat\/completions$/, "");
    const url = withProxy(`${base}/models`, config);
    const res = await fetchWithTimeout(url, {
      headers: { ...provider.extraHeaders, Authorization: `Bearer ${config.apiKey}` },
    });
    const data = await readJsonOrThrow(res, "获取模型列表");
    if (data.error) throw new Error(data.error.message || "获取模型列表失败");
    const list = (data.data || []).map(m => m.id).sort();
    if (!list.length) throw new Error("接口返回了空的模型列表");
    return list;
  }

  if (provider.protocol === "gemini") {
    const cleanBase = normalizeGeminiBase(config.endpoint || provider.endpoint);
    const url = withProxy(`${cleanBase}?key=${encodeURIComponent(config.apiKey)}`, config);
    const res = await fetch(url, { headers: provider.extraHeaders });
    const data = await readJsonOrThrow(res, "获取模型列表");
    if (data.error) throw new Error(data.error.message || "获取模型列表失败");
    const list = (data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => m.name.replace(/^models\//, ""))
      .sort();
    if (!list.length) throw new Error("接口返回了空的模型列表");
    return list;
  }

  throw new Error(`未知的 API 类型: ${config.apiType}`);
}

