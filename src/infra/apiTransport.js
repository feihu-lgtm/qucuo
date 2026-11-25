// AI 统一调用传输层：各供应商协议的请求装配、超时、流式与非流式收发。
// 配置存储/迁移在 apiConfig.js；本文件只管「把请求发出去、把响应收回来」。
import { observeAi } from "./observeAi.js";
import { readSSE, stripReasoning } from "./apiSse.js";
import { getStoredVertexHeaders } from "./vertexCredentials.js";
import { getApiModel } from "./apiModel.js";
import { parseRetryAfter } from "./retryAfter.js";
import {
  API_TYPES, applyThinkingAnthropic, applyThinkingGemini, applyThinkingOpenAI,
  clampMaxTokensForProvider, DEFAULT_CALL_TOKEN_LIMITS, migrateProvider,
  normalizeAnthropicEndpoint, normalizeGeminiBase, normalizeOpenAIEndpoint, PROVIDERS,
  ANTHROPIC_KNOWN_MODELS,
} from "./providers.js";

// Gemini v1beta responseSchema 不接受 additionalProperties 键，递归剔除。
// 棘轮红线禁止 infra 反向引用 utils——本函数与 src/utils/schemaValidate.js 的
// toGeminiResponseSchema 保持同一实现，utils 侧为 engine/domain 消费的正本。
function stripAdditionalProperties(schema) {
  if (Array.isArray(schema)) return schema.map(stripAdditionalProperties);
  if (!schema || typeof schema !== "object") return schema;
  const out = {};
  for (const [key, val] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    out[key] = stripAdditionalProperties(val);
  }
  return out;
}

export function withProxy(url, cfg) {
  if (cfg.corsProxy) return cfg.corsProxy + encodeURIComponent(url);
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "/api/proxy?url=" + encodeURIComponent(url);
  }
  return url;
}

// 读响应体：若回来的是网页(HTML)而非 JSON，抛一句听得懂的中文，而不是
// 让 JSON.parse 甩出 "Unexpected token '<', "<!DOCTYPE"..." 这种天书。
// 这种情况几乎都是：接口地址(baseURL)填错/填漏、中转站挂了、或密钥不对导致跳转到网页。
// ── 带超时的 fetch：AI 接口卡住不能无限等，超时后抛一个可识别的错误 ──
// 默认 60 秒；调用方可用 opts.timeoutMs 覆盖。超时抛 code="timeout" 的错误，
// 供 classifyError 翻成人话。
// 全局请求超时（毫秒）。默认 60 秒；可用 setRequestTimeout 调整（设置里"接口超时"配置项）。
// 千问等较慢的接口，用户可调长，避免主叙事这种长输出频繁超时导致"移动/操作卡住"。
let _requestTimeoutMs = 60000;
export function setRequestTimeout(ms) {
  const v = Number(ms);
  if (Number.isFinite(v) && v >= 10000 && v <= 300000) _requestTimeoutMs = v;
}
export function getRequestTimeout() {
  return _requestTimeoutMs;
}
export async function fetchWithTimeout(url, options = {}, timeoutMs = _requestTimeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (e) {
    if (e.name === "AbortError") {
      const err = new Error(`请求超过 ${Math.round(timeoutMs / 1000)} 秒没有响应`);
      err.code = "timeout";
      throw err;
    }
    // fetch 本身抛错（DNS/连接失败/CORS/断网），标成网络错误
    const err = new Error(e.message || "网络请求失败");
    err.code = "network";
    throw err;
  } finally {
    clearTimeout(timer);
  }
}


export function httpFailure(res, label, requestUrl, vendorMessage) {
  const err = new Error(`${label} HTTP ${res.status}：${vendorMessage}`);
  err.httpStatus = res.status;
  err.vendorMessage = String(vendorMessage);
  err.requestUrl = requestUrl || res.url;
  const retryAfterMs = parseRetryAfter(res.headers?.get?.("retry-after"));
  if (retryAfterMs != null) err.retryAfterMs = retryAfterMs;
  return err;
}

export async function rejectNonStream(res, label, requestUrl = "") {
  if (!res.ok || /text\/html/i.test(res.headers.get("content-type") || "")) await readJsonOrThrow(res, label, requestUrl);
}

export async function readJsonOrThrow(res, label, requestUrl = "") {
  const bodyText = await res.text();
  if (res.ok && !bodyText.trim()) {
    const err = new Error(`${label}：接口返回了空响应（HTTP ${res.status}）`);
    err.code = "empty";
    err.httpStatus = res.status;
    err.requestUrl = requestUrl || res.url;
    throw err;
  }
  const head = bodyText.trimStart().slice(0, 1);
  const looksHtml = head === "<" || /text\/html/i.test(res.headers.get("content-type") || "");
  if (looksHtml) {
    const err = new Error(`${label}：接口返回的是网页而不是数据（HTTP ${res.status}）。`);
    err.code = "html";
    err.httpStatus = res.status;
    err.requestUrl = requestUrl || res.url;
    throw err;
  }
  try {
    const json = JSON.parse(bodyText);
    // 状态码非 2xx 但返回了合法 JSON（多为 {error:{...}}）：把 HTTP 码显式带上，
    // 供 classifyError 按 401/429/5xx 归类。原始 error message 也保留。
    if (!res.ok) {
      const apiMsg = json?.error?.message || json?.message || bodyText.slice(0, 120);
      throw httpFailure(res, label, requestUrl, apiMsg);
    }
    return json;
  } catch (e) {
    if (e.httpStatus) throw e; // 上面主动抛的带码错误，直接透传
    if (!res.ok) {
      throw httpFailure(res, label, requestUrl, bodyText.trim() ? bodyText.slice(0, 120) : "响应体为空");
    }
    const err = new Error(`${label}：接口返回的内容无法解析（HTTP ${res.status}）。返回开头是「${bodyText.slice(0, 60)}」——请检查设置里的接口地址和接口类型。`);
    err.code = "unparsable";
    err.httpStatus = res.status;
    err.requestUrl = requestUrl || res.url;
    throw err;
  }
}

// 把带 tavernBlock/tavernLabel 的 system 块格式化为纯文本，供不支持结构化的 API 使用。
export function formatBlock(b) {
  return `[${b.tavernLabel || b.tavernBlock || "system"}]\n${b.content || ""}`;
}


export const isOpenAICompatible = type => [API_TYPES.OPENAI, API_TYPES.QWEN, API_TYPES.VERTEX].includes(type);

export async function fetchOpenAI(cfg, systemPrompt, messages, opts, stream = false) {
  const provider = PROVIDERS[cfg.provider] || PROVIDERS.custom;
  const vertex = provider.protocol === "vertex" ? await import("./vertexAdc.js") : null;
  const url = vertex ? vertex.buildVertexEndpoint(cfg.vertexProject, cfg.vertexLocation)
    : withProxy(normalizeOpenAIEndpoint(
      cfg.endpoint || provider.endpoint,
      provider.id === "custom" && cfg.openaiAutoComplete,
    ), cfg);
  const system = Array.isArray(systemPrompt) ? systemPrompt.map(formatBlock) : [systemPrompt];
  const maxTokens = opts.maxTokens ?? cfg.maxTokens;
  const tokenField = provider.maxTokensField;
  const body = {
    model: getApiModel(cfg), [tokenField]: clampMaxTokensForProvider(maxTokens, cfg, provider),
    temperature: opts.temperature ?? cfg.temperature,
    messages: [...system.map(content => ({ role: "system", content })), ...(vertex ? vertex.prepareVertexMessages(messages) : messages)],
  };
  if (stream) Object.assign(body, { stream: true, stream_options: { include_usage: true } });
  else for (const [option, field] of [["topP", "top_p"], ["frequencyPenalty", "frequency_penalty"], ["presencePenalty", "presence_penalty"]]) {
    const value = opts[option] ?? cfg[option];
    if (value != null) body[field] = value;
  }
  applyThinkingOpenAI(body, cfg, provider, vertex, opts);
  const auth = vertex ? await (opts.getVertexHeaders || (() => getStoredVertexHeaders(fetchWithTimeout)))()
    : { Authorization: `Bearer ${cfg.apiKey}` };
  try {
    const res = await fetchWithTimeout(url, {
      method: "POST", headers: { "Content-Type": "application/json", ...provider.extraHeaders, ...auth },
      body: JSON.stringify(body), ...(vertex ? { redirect: "error" } : {}),
    });
    if (vertex && !res.ok) throw await vertex.vertexResponseError(res, auth.Authorization);
    if (stream) return res;
    return vertex ? await res.json().catch(() => { throw new Error("Vertex AI 返回的内容无法解析"); })
      : await readJsonOrThrow(res, "OpenAI 兼容调用", url);
  } catch (error) {
    if (vertex && error.code === "network") throw new Error("Vertex AI 网络请求失败");
    throw error;
  }
}

// 统一调用入口。返回 { text, raw } ；text 是模型输出的纯文本。
// systemPrompt: string | [{role:'system', content:string, tavernBlock?, tavernLabel?}]
// messages: [{role:'user'|'assistant', content:string}]
export function callModel(cfg, systemPrompt, messages, opts = {}) {
  const migrated = migrateProvider(cfg);
  return observeAi(messages, { ...opts, cfg: migrated, systemPrompt }, () => requestModel(migrated, systemPrompt, messages, opts));
}

async function requestModel(cfg, systemPrompt, messages, opts) {
  if (cfg.timeoutMs) setRequestTimeout(cfg.timeoutMs);
  const maxTokens = opts.maxTokens ?? cfg.maxTokens;
  const temperature = opts.temperature ?? cfg.temperature;
  // 采样参数（本轮新增）：top_p/top_k/frequency_penalty/presence_penalty 这几个概念
  // 在三家 API 之间并不通用——Anthropic 没有 frequency/presence penalty 这两个概念，
  // OpenAI 没有 top_k，Gemini 全都支持。且 Anthropic 的 Opus 4.8 这类"自适应采样"模型
  // 直接拒绝 temperature/top_p/top_k（传了就 400）。所以这里只是统一收集这几个可选值，
  // 真正决定"传给谁、传哪几个"的判断放在各家分支内部，不支持的字段静默跳过，
  // 而不是无脑塞进请求体导致报错。留空（undefined/null）的字段一律不传，跟随各 API
  // 自己的默认值。
  const topP = opts.topP ?? cfg.topP ?? null;
  const topK = opts.topK ?? cfg.topK ?? null;
  const frequencyPenalty = opts.frequencyPenalty ?? cfg.frequencyPenalty ?? null;
  const presencePenalty = opts.presencePenalty ?? cfg.presencePenalty ?? null;
  try {
    let text, raw, finishReason, usage;

    if (cfg.apiType === API_TYPES.ANTHROPIC) {
      const provider = PROVIDERS[cfg.provider];
      const url = withProxy(normalizeAnthropicEndpoint(cfg.endpoint || provider.endpoint), cfg);
      const system = Array.isArray(systemPrompt)
        ? (systemPrompt.length === 1 ? formatBlock(systemPrompt[0]) : systemPrompt.map(b => ({ type: "text", text: formatBlock(b) })))
        : systemPrompt;
      const maxOutputTokens = clampMaxTokensForProvider(maxTokens, cfg, provider);
      const abody = { model: cfg.model, [provider.maxTokensField]: maxOutputTokens, system, messages };
      // Opus 4.8（及未来同类"自适应采样"模型）直接拒绝任何采样参数——传了就 400。
      // 判断依据是模型名包含 opus-4-8/opus-4.8 这类标识；命中就完全不传任何采样参数，
      // 让模型用它自己的自适应采样，静默跳过而不是让整轮请求失败。
      const rejectsSampling = /opus-4[.-]8|opus4\.8/i.test(cfg.model || "");
      if (!rejectsSampling) {
        // Anthropic 文档要求 temperature 和 top_p 二选一，不能同传；有 top_p 就优先用 top_p，
        // 没有才退回 temperature（沿用原有默认行为，不影响没配置过采样参数的老用户）。
        if (topP != null) abody.top_p = topP;
        else abody.temperature = temperature;
        if (topK != null) abody.top_k = topK;
        // frequency_penalty/presence_penalty：Anthropic API 没有这两个概念，永远不传。
      }
      applyThinkingAnthropic(abody, cfg, maxOutputTokens);
      // 原生结构化输出：Anthropic 没有 response_format，用单工具强制——挂唯一工具并
      // tool_choice 点名，模型只能以 tool_use.input 的形式吐出合规 JSON。
      if (opts.schema) {
        abody.tools = [{ name: opts.schema.name, input_schema: opts.schema.schema }];
        abody.tool_choice = { type: "tool", name: opts.schema.name };
      }
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...provider.extraHeaders,
          "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(abody),
      });
      raw = await readJsonOrThrow(res, "Anthropic 调用", url);
      if (raw.error) throw new Error(raw.error.message || "Anthropic API 错误");
      // 单工具强制结构化时，答案在 tool_use 块的 input 里——序列化回 text 与纯文本通路对齐。
      const toolUseBlock = opts.schema && raw.content?.find((b) => b.type === "tool_use" && b.name === opts.schema.name);
      text = toolUseBlock
        ? JSON.stringify(toolUseBlock.input ?? {})
        : stripReasoning(raw.content?.map(b => b.text || "").join("") || "");
      finishReason = raw.stop_reason;
      usage = raw.usage;

    } else if (isOpenAICompatible(cfg.apiType)) {
      raw = await fetchOpenAI(cfg, systemPrompt, messages, opts);
      if (raw.error) throw new Error((cfg.apiType !== API_TYPES.VERTEX && raw.error.message) || "OpenAI 兼容 API 错误");
      text = stripReasoning(raw.choices?.[0]?.message?.content || "");
      finishReason = raw.choices?.[0]?.finish_reason;
      usage = raw.usage;

    } else if (cfg.apiType === API_TYPES.GEMINI) {
      const provider = PROVIDERS[cfg.provider];
      const base = normalizeGeminiBase(cfg.endpoint || provider.endpoint);
      const url = withProxy(`${base}/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`, cfg);
      const contents = messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      if (contents.length && contents[0].role === "user") {
        const systemText = Array.isArray(systemPrompt) ? systemPrompt.map(formatBlock).join("\n\n") : systemPrompt;
        contents[0].parts[0].text = systemText + "\n\n" + contents[0].parts[0].text;
      }
      const genConfig = { temperature, maxOutputTokens: clampMaxTokensForProvider(maxTokens, cfg, provider) };
      // Gemini 的 generationConfig 原生支持这四个字段，直接按官方字段名传。
      if (topP != null) genConfig.topP = topP;
      if (topK != null) genConfig.topK = topK;
      if (frequencyPenalty != null) genConfig.frequencyPenalty = frequencyPenalty;
      if (presencePenalty != null) genConfig.presencePenalty = presencePenalty;
      // 结构化抽取任务（角色卡扫描）要求纯 JSON 输出。官方接口支持这个字段，但
      // 第三方反代常常把它过滤掉，所以调用方那边**不能只靠它**——提示词里同样
      // 要写死"只输出 JSON"，并对返回值做剥围栏/截取的容错解析。这里加上是因为
      // 原生支持时它确实能显著降低跑偏率，成本为零。
      if (opts.jsonOnly) genConfig.responseMimeType = "application/json";
      // 原生结构化输出：responseSchema 走 v1beta 官方字段；additionalProperties 键 Gemini 不收，递归剔除。
      if (opts.schema) {
        genConfig.responseMimeType = "application/json";
        genConfig.responseSchema = stripAdditionalProperties(opts.schema.schema);
      }
      applyThinkingGemini(genConfig, cfg, opts);
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { ...provider.extraHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ contents, generationConfig: genConfig }),
      });
      raw = await readJsonOrThrow(res, "Gemini 调用", url);
      if (raw.error) throw new Error(raw.error.message || "Gemini API 错误");
      text = stripReasoning(raw.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "");
      finishReason = raw.candidates?.[0]?.finishReason;
      usage = raw.usageMetadata;

    } else {
      throw new Error(`未知的 API 类型: ${cfg.apiType}`);
    }

    return { text, raw, finishReason, usage };

  } catch (err) {
    throw err;
  }
}

// 连接测试：发一条最小的问候消息，确认 key/endpoint/model 都配置正确
