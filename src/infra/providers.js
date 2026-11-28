const OPENAI = (id, label, endpoint, options = {}) => ({
  id, label, protocol: "openai", endpoint, altEndpoints: [], auth: "bearer", extraHeaders: {},
  thinking: "none", maxTokensField: "max_tokens", maxTokensCap: null,
  corsProxyRequired: false, models: [], ...options,
});

export const PROVIDERS = {
  openai: OPENAI("openai", "OpenAI", "https://api.openai.com/v1/chat/completions", {
    thinking: "openai-effort", maxTokensField: "max_completion_tokens",
    models: ["gpt-5.6", "gpt-5.4-mini", "gpt-4.1"],
  }),
  anthropic: {
    id: "anthropic", label: "Anthropic Claude", protocol: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages", altEndpoints: [], auth: "x-api-key",
    extraHeaders: { "anthropic-dangerous-direct-browser-access": "true" }, thinking: "anthropic", maxTokensField: "max_tokens",
    maxTokensCap: null, corsProxyRequired: false,
    models: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  },
  gemini: {
    id: "gemini", label: "Google Gemini", protocol: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models", altEndpoints: [],
    auth: "header-key", extraHeaders: {}, thinking: "gemini", maxTokensField: "max_tokens",
    maxTokensCap: null, corsProxyRequired: false,
    models: ["gemini-3.8-flash", "gemini-4-argon", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"],
  },
  vertex: {
    id: "vertex", label: "Vertex AI", protocol: "vertex",
    endpoint: "https://aiplatform.googleapis.com/v1/projects/{project}/locations/global/endpoints/openapi/chat/completions",
    altEndpoints: [], auth: "adc", extraHeaders: {}, thinking: "vertex",
    maxTokensField: "max_tokens", maxTokensCap: null, corsProxyRequired: false,
    models: ["gemini-3.8-flash", "gemini-4-argon", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"],
  },
  openrouter: OPENAI("openrouter", "OpenRouter", "https://openrouter.ai/api/v1/chat/completions", {
    extraHeaders: { "HTTP-Referer": "https://feihu-lgtm.github.io/qucuo/", "X-Title": "曲措乡" },
    thinking: "openai-effort",
  }),
  deepseek: OPENAI("deepseek", "DeepSeek", "https://api.deepseek.com/chat/completions", { thinking: "deepseek" }),
  qwen: OPENAI("qwen", "通义千问", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    altEndpoints: [{ label: "国际", url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions" }],
    thinking: "qwen-enable", maxTokensCap: 65536,
  }),
  moonshot: OPENAI("moonshot", "月之暗面 Kimi", "https://api.moonshot.cn/v1/chat/completions", {
    altEndpoints: [{ label: "国际", url: "https://api.moonshot.ai/v1/chat/completions" }],
    thinking: "moonshot",
    models: ["kimi-k2-0711-preview", "moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-latest", "kimi-thinking-preview"],
  }),
  zhipu: OPENAI("zhipu", "智谱 GLM", "https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    altEndpoints: [{ label: "z.ai", url: "https://api.z.ai/api/paas/v4/chat/completions" }],
    extraHeaders: { "Accept-Language": "en-US,en" }, thinking: "zhipu", corsProxyRequired: true,
    models: [
      "glm-5.2", "glm-5-turbo", "glm-5v-turbo", "glm-5.1", "glm-5", "glm-4.7",
      "glm-4.7-flash", "glm-4.7-flashx", "glm-4.6", "glm-4.6v", "glm-4.6v-flash",
      "glm-4.6v-flashx", "glm-4.5v", "glm-4.5", "glm-4.5-air", "glm-4.5-x",
      "glm-4.5-airx", "glm-4.5-flash", "glm-4-32b-0414-128k", "autoglm-phone-multilingual",
    ],
  }),
  siliconflow: OPENAI("siliconflow", "硅基流动", "https://api.siliconflow.cn/v1/chat/completions", {
    altEndpoints: [{ label: "国际", url: "https://api.siliconflow.com/v1/chat/completions" }],
  }),
  minimax: OPENAI("minimax", "MiniMax", "https://api.minimaxi.com/v1/chat/completions", {
    altEndpoints: [{ label: "国际", url: "https://api.minimax.io/v1/chat/completions" }],
    models: [
      "MiniMax-M2.7", "MiniMax-M2.7-highspeed", "MiniMax-M2.5", "MiniMax-M2.5-highspeed",
      "MiniMax-M2.1", "MiniMax-M2.1-highspeed", "MiniMax-M2", "M2-her",
    ],
  }),
  volcengine: OPENAI("volcengine", "火山方舟·豆包", "https://ark.cn-beijing.volces.com/api/v3/chat/completions"),
  qianfan: OPENAI("qianfan", "百度千帆", "https://qianfan.baidubce.com/v2/chat/completions"),
  mistral: OPENAI("mistral", "Mistral", "https://api.mistral.ai/v1/chat/completions"),
  groq: OPENAI("groq", "Groq", "https://api.groq.com/openai/v1/chat/completions", {
    models: [
      "qwen/qwen3-32b", "deepseek-r1-distill-llama-70b", "gemma2-9b-it",
      "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct",
      "llama-3.1-8b-instant", "llama-3.3-70b-versatile", "llama-guard-3-8b",
      "llama3-70b-8192", "llama3-8b-8192", "mistral-saba-24b",
    ],
  }),
  xai: OPENAI("xai", "xAI", "https://api.x.ai/v1/chat/completions", { thinking: "openai-effort" }),
  perplexity: OPENAI("perplexity", "Perplexity", "https://api.perplexity.ai/chat/completions", {
    thinking: "openai-effort",
    models: ["sonar", "sonar-pro", "sonar-reasoning", "sonar-reasoning-pro", "sonar-deep-research", "r1-1776"],
  }),
  fireworks: OPENAI("fireworks", "Fireworks AI", "https://api.fireworks.ai/inference/v1/chat/completions", { thinking: "openai-effort" }),
  together: OPENAI("together", "Together AI", "https://api.together.xyz/v1/chat/completions"),
  cohere: OPENAI("cohere", "Cohere", "https://api.cohere.ai/compatibility/v1/chat/completions", {
    models: [
      "c4ai-aya-23-8b", "c4ai-aya-23", "c4ai-aya-expanse-8b", "c4ai-aya-expanse-32b",
      "c4ai-aya-vision-8b", "c4ai-aya-vision-32b", "command", "command-r", "command-r-plus",
      "command-a-03-2025", "command-a-vision-07-2025",
    ],
  }),
  custom: OPENAI("custom", "自定义（OpenAI 兼容）", "https://api.openai.com/v1/chat/completions", {
    thinking: "openai-effort",
  }),
};

export const QWEN_DEFAULT_ENDPOINT = PROVIDERS.qwen.endpoint;
export const QWEN_MAX_TOKENS_CAP = 32768;

export const DEFAULT_ENDPOINTS = {
  anthropic: PROVIDERS.anthropic.endpoint,
  openai: PROVIDERS.openai.endpoint,
  gemini: PROVIDERS.gemini.endpoint,
  qwen: PROVIDERS.qwen.endpoint,
};

const trimSlashes = value => String(value || "").trim().replace(/\/+$/, "");

export function providerApiType(providerId) {
  const provider = PROVIDERS[providerId] || PROVIDERS.custom;
  if (provider.protocol === "anthropic" || provider.protocol === "gemini" || provider.protocol === "vertex") return provider.protocol;
  return providerId === "qwen" ? "qwen" : "openai";
}

export function migrateProvider(cfg = {}) {
  const source = cfg && typeof cfg === "object" ? cfg : {};
  const savedProvider = Object.prototype.hasOwnProperty.call(PROVIDERS, source.provider) ? source.provider : "";
  let providerId = savedProvider && (!source.apiType || providerApiType(savedProvider) === source.apiType)
    ? savedProvider : "";

  if (!providerId) {
    if (["anthropic", "gemini", "vertex"].includes(source.apiType)) providerId = source.apiType;
    const endpoint = trimSlashes(source.endpoint);
    if (!providerId && (!source.apiType || ["openai", "qwen"].includes(source.apiType))) {
      const protocol = source.apiType ? "openai" : null;
      providerId = Object.values(PROVIDERS).find(provider =>
        provider.id !== "custom" && (!protocol || provider.protocol === protocol) &&
        [provider.endpoint, ...provider.altEndpoints.map(alt => alt.url)].some(url => trimSlashes(url) === endpoint),
      )?.id || "";
      if (!providerId && endpoint === "https://api.deepseek.com/v1/chat/completions") providerId = "deepseek";
    }
    if (!providerId && source.apiType === "qwen") providerId = "qwen";
    if (!providerId && source.apiType === "openai" && endpoint === trimSlashes(PROVIDERS.openai.endpoint)) providerId = "openai";
    if (!providerId) providerId = "custom";
  }

  return { ...source, provider: providerId, apiType: providerApiType(providerId) };
}

export function isDefaultEndpoint(endpoint) {
  if (!String(endpoint || "").trim()) return true;
  const normalized = trimSlashes(endpoint);
  return Object.values(PROVIDERS).some(provider =>
    [provider.endpoint, ...provider.altEndpoints.map(alt => alt.url)]
      .some(url => trimSlashes(url) === normalized),
  ) || normalized === "https://api.deepseek.com/v1/chat/completions";
}

export function normalizeOpenAIEndpoint(endpoint, autoComplete = false) {
  const url = String(endpoint || "").trim().replace(/\/+$/, "");
  if (!autoComplete || !url) return url;
  if (url.endsWith("/chat/completions")) return url;
  if (url.endsWith("/v1")) return url + "/chat/completions";
  return url + "/v1/chat/completions";
}

export function normalizeAnthropicEndpoint(endpoint) {
  const url = String(endpoint || "").trim().replace(/\/+$/, "");
  if (url.endsWith("/messages")) return url;
  if (url.endsWith("/v1")) return url + "/messages";
  return url + "/v1/messages";
}

export function normalizeGeminiBase(endpoint) {
  let url = String(endpoint || "").trim().replace(/\/+$/, "");
  url = url.replace(/\/models\/[^/]+:generateContent.*$/, "/models");
  if (url.endsWith("/models")) return url;
  if (/\/v1(beta)?$/.test(url)) return url + "/models";
  return url + "/v1beta/models";
}

export function clampMaxTokensForProvider(maxTokens, cfg, provider = PROVIDERS[cfg?.provider] || PROVIDERS.custom) {
  if (provider.id === "qwen") {
    const override = Number(cfg.qwenMaxTokens);
    const cap = override > 0 ? Math.min(override, provider.maxTokensCap) : QWEN_MAX_TOKENS_CAP;
    const requested = Number(maxTokens);
    return Math.max(1, Math.min(Number.isFinite(requested) ? requested : cap, cap));
  }
  if (provider.id === "vertex") return Math.min(maxTokens ?? 65535, 65535);
  const modelCap = provider.id === "minimax" && cfg.model === "M2-her" ? 2048 : provider.maxTokensCap;
  if (modelCap == null) return maxTokens;
  const requested = Number(maxTokens);
  return Math.max(1, Math.min(Number.isFinite(requested) ? requested : modelCap, modelCap));
}

function thinkingEffort(cfg) {
  const mode = cfg.thinkingMode || "off";
  const budget = Number(cfg.thinkingBudget) || 0;
  return mode === "custom"
    ? (budget <= 0 ? "off" : budget < 1024 ? "low" : budget < 4096 ? "medium" : "high")
    : mode;
}

const THINKING_BUDGET_BY_MODE = { low: 512, medium: 2048, high: 8192 };

// ── Gemini 3 及以后（3.x、4 系列）的调用口径 ────────────────────────────────
// 依据 Gemini API 官方文档（2026-10 版：What's new in Gemini 3.6 / 3.8 Flash / Gemini 4 Argon、Thinking、Caching）：
// 1. 思考只认 thinkingLevel（low / medium / high，个别型号另有 minimal），不能与 thinkingBudget 同传。
// 2. minimal 只有 3 Flash、3.5 / 3.6 Flash、3.1 / 3.5 Flash-Lite 支持；3.7 / 3.8 Flash 与 Gemini 4 传 minimal 直接报错。
// 3. temperature / top_p / top_k 自 3.6 起弃用、被忽略，后续型号会直接报 400；3 系列官方也建议不改默认采样，统一不传。
// 4. maxOutputTokens 同时计入思考与正文；Gemini 4 官方建议显式设置时不低于 32768，想省 token 应降思考档而不是压上限。
// 5. 请求末尾不能是 model 轮（预填），否则 400。
const GEMINI_STRIP = (model) => String(model || "").replace(/^google\//, "").replace(/^models\//, "");

// 3 系列及以后的统一识别口径（原 isGemini3Model 只认 gemini-3，漏了 Gemini 4），custom/openai 中转与官方通道同吃。
export function isGeminiLevelModel(model) {
  return /^gemini-(?:[3-9]|\d{2,})(?:[.-]|$)/i.test(GEMINI_STRIP(model));
}

export const GEMINI_MINIMAL_THINKING = [
  /^gemini-3(?:\.[56])?-flash(?:-preview)?$/i,
  /^gemini-3\.[15]-flash-lite(?:-preview)?$/i,
];

// 「思考关」在 3 系列以后只能压到最低档：支持 minimal 的给 minimal，其余给 low。
export function geminiOffThinkingLevel(model) {
  const id = GEMINI_STRIP(model);
  return GEMINI_MINIMAL_THINKING.some((re) => re.test(id)) ? "minimal" : "low";
}

// 思考档：off → 最低档；low/medium/high 原样（minimal 只在支持的型号上出现）。
export function geminiThinkingLevel(model, effort) {
  return ["low", "medium", "high"].includes(effort) ? effort : geminiOffThinkingLevel(model);
}

// 输出上限下限：思考与正文共用额度，上限太低会在思考里耗尽、正文截断。计费只按实际生成量，抬高下限不增加花费。
export function geminiMinOutputTokens(model) {
  if (!isGeminiLevelModel(model)) return 0;
  return /^gemini-(?:[4-9]|\d{2,})/i.test(GEMINI_STRIP(model)) ? 32768 : 8192;
}

// 末尾的 model 轮（预填）在 3.6 以后会 400：把它们并成一条 user 轮，提示接着写。
export function dropTrailingModelTurns(messages) {
  let end = messages.length;
  while (end > 0 && messages[end - 1].role === "assistant") end--;
  if (end === messages.length) return messages;
  const text = messages.slice(end).map((m) => m.content).filter((c) => c?.trim()).join("\n");
  const kept = messages.slice(0, end);
  if (text) kept.push({ role: "user", content: "（请直接接着下面这段继续写，不要重复）\n" + text });
  return kept;
}

function supportsOpenAIReasoning(model) {
  return /^(?:o1|o3(?:-[\w.-]+)?|o4-mini(?:-[\w.-]+)?|gpt-5(?:[.-][\w.-]+)?|gpt-6-astra(?:-[\w.-]+)?)$/i.test(model || "");
}

export function applyThinkingOpenAI(body, cfg, provider, vertex, opts = {}) {
  const effort = thinkingEffort(cfg);
  const enabled = effort !== "off";
  switch (provider.thinking) {
    case "vertex":
      body.reasoning_effort = vertex.vertexReasoningEffort(body.model, effort);
      break;
    case "qwen-enable":
      body.enable_thinking = enabled;
      break;
    case "deepseek":
      body.thinking = { type: enabled ? "enabled" : "disabled" };
      if (enabled) body.reasoning_effort = effort;
      break;
    case "zhipu":
    case "moonshot":
      body.thinking = { type: enabled ? "enabled" : "disabled" };
      break;
    case "openai-effort":
      // A1：Gemini 3 走 OpenAI 兼容协议必须显式下发 reasoning_effort——
      // 不识别的中转默认档会狂烧思考 token（前哨中位 217）。思考关=minimal，
      // 其余按设置 low/medium/high；绝不同时下 extra_body.google.thinking_config。
      if (isGeminiLevelModel(cfg.model)) {
        body.reasoning_effort = geminiThinkingLevel(cfg.model, effort);
        delete body.extra_body;
      } else if (provider.id === "openrouter") {
        body.reasoning = enabled ? { exclude: false, effort } : { exclude: true };
      } else if (enabled && (
        supportsOpenAIReasoning(cfg.model) ||
        (provider.id === "custom" && /^koboldcpp\/.+$/i.test(cfg.model || ""))
      )) {
        body.reasoning_effort = cfg.model === "gpt-5.3-chat-latest" ? "medium" : effort;
      } else if (enabled && !["openai", "custom"].includes(provider.id)) {
        body.reasoning_effort = provider.id === "xai" && effort !== "high" ? "low" : effort;
      }
      break;
  }
  applyShortCallOpenAI(body, provider, opts);
}

// 识别/分类这类短调用（opts.disableThinking）：Gemini 2.5 在 Vertex 上即便 reasoning_effort=low 也会思考，
// 思考 token 吃光输出预算后 JSON 被截断；改用 thinking_budget 关掉思考（2.5 Pro 不能为 0，取下限 128）。
// opts.jsonOnly：对文档确认支持 response_format 的服务请求 JSON 输出。
const JSON_MODE_PROVIDERS = new Set(["vertex", "openai", "deepseek"]);

export function applyShortCallOpenAI(body, provider, opts = {}) {
  const model = String(body.model || "").replace(/^google\//, "");
  // A1：短调用关思考——Gemini 3 在 OpenAI 兼容通道下发 reasoning_effort minimal，
  // 与 thinking 主链互不叠加（主链 delete extra_body，此处不下 extra_body）。
  if (opts.disableThinking && provider.thinking === "openai-effort" && isGeminiLevelModel(model)) {
    body.reasoning_effort = geminiOffThinkingLevel(model);
  }
  if (opts.disableThinking && provider.thinking === "vertex" && /^gemini-2\.5/i.test(model)) {
    delete body.reasoning_effort;
    body.extra_body = { google: { thinking_config: { thinking_budget: /pro/i.test(model) ? 128 : 0, include_thoughts: false } } };
  }
  if (opts.jsonOnly && JSON_MODE_PROVIDERS.has(provider.id)) body.response_format = { type: "json_object" };
  // 原生结构化输出：文档确认支持 json_schema 的三家挂 strict schema；其余兼容服务商退回 json_object。
  if (opts.schema) {
    if (["openai", "vertex", "openrouter"].includes(provider.id)) {
      // schema 带 strictCompatible:false 元数据（开放词条对象等不满足 OpenAI strict subset
      // 的形状）时回退 json_object 免服务端 400——本地 validateJsonSchema 校验照常。
      if (opts.schema.strictCompatible === false) {
        body.response_format = { type: "json_object" };
      } else {
        body.response_format = { type: "json_schema", json_schema: { name: opts.schema.name, strict: true, schema: opts.schema.schema } };
      }
    } else {
      body.response_format = { type: "json_object" };
    }
  }
}

export function applyThinkingGemini(genConfig, cfg, opts = {}) {
  const model = cfg.model || "";
  if (opts?.disableThinking) {
    if (isGeminiLevelModel(model)) {
      genConfig.thinkingConfig = { thinkingLevel: geminiOffThinkingLevel(model) };
    } else {
      const minBudget = /gemini-2\.5-pro/i.test(model) ? 128 : 0;
      const budget = opts.thinkingBudget !== undefined ? Math.max(minBudget, Number(opts.thinkingBudget) || 0) : minBudget;
      genConfig.thinkingConfig = { thinkingBudget: budget };
    }
    return;
  }
  const mode = cfg.thinkingMode || "off";
  const effort = thinkingEffort(cfg);
  if (isGeminiLevelModel(model)) {
    // 不传 thinkingConfig 时 3.8 Flash / Gemini 4 按默认 medium 思考；设置里选「关」要真的压到最低档。
    genConfig.thinkingConfig = { thinkingLevel: geminiThinkingLevel(model, effort) };
  } else {
    const budget = mode === "custom" ? Math.max(0, Number(cfg.thinkingBudget) || 0) : THINKING_BUDGET_BY_MODE[mode] || 0;
    genConfig.thinkingConfig = { thinkingBudget: budget };
  }
}

// Gemini 原生 generateContent / streamGenerateContent 的请求头与请求体（非流式与流式共用一处）。
// - 系统提示走 systemInstruction，不再拼进第一条 user 消息（第一条不是 user 时系统提示会整段丢失；
//   放在 systemInstruction 里也让固定前缀稳定，利于隐式缓存——3.8 Flash 与 Gemini 4 前缀需达 4096 token 才计入）。
// - 密钥放 x-goog-api-key 请求头，不进 URL（URL 会进代理日志、浏览器历史与报错原文）。
// - 3 系列以后：不传采样参数、思考只用 thinkingLevel、输出上限设下限、去掉末尾预填的 model 轮。
export function buildGeminiRequest({ cfg, provider, systemText, messages, maxOutputTokens, sampling = {}, opts = {} }) {
  const model = cfg.model || "";
  const level = isGeminiLevelModel(model);
  const turns = level ? dropTrailingModelTurns(messages) : messages;
  const contents = turns.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const genConfig = { maxOutputTokens: Math.max(maxOutputTokens || 0, geminiMinOutputTokens(model)) || undefined };
  if (!level) {
    if (sampling.temperature != null) genConfig.temperature = sampling.temperature;
    if (sampling.topP != null) genConfig.topP = sampling.topP;
    if (sampling.topK != null) genConfig.topK = sampling.topK;
    if (sampling.frequencyPenalty != null) genConfig.frequencyPenalty = sampling.frequencyPenalty;
    if (sampling.presencePenalty != null) genConfig.presencePenalty = sampling.presencePenalty;
  }
  if (opts.jsonOnly) genConfig.responseMimeType = "application/json";
  applyThinkingGemini(genConfig, cfg, opts);
  const body = { contents, generationConfig: genConfig };
  if (systemText && String(systemText).trim()) body.systemInstruction = { parts: [{ text: String(systemText) }] };
  const headers = { ...(provider?.extraHeaders || {}), "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey || "" };
  return { headers, body };
}

// OpenAI 兼容通道（Vertex、OpenRouter、自定义中转）上跑 Gemini 3+ / 4：同样不传采样参数、输出上限设下限。
export function adaptOpenAIBodyForGemini(body) {
  if (!isGeminiLevelModel(body.model)) return body;
  delete body.temperature;
  delete body.top_p;
  delete body.top_k;
  for (const field of ["max_tokens", "max_completion_tokens"]) {
    if (body[field] != null) body[field] = Math.max(Number(body[field]) || 0, geminiMinOutputTokens(body.model));
  }
  return body;
}

export function applyThinkingAnthropic(body, cfg, maxTokens) {
  const mode = cfg.thinkingMode || "off";
  if (mode === "off") return;
  const budget = mode === "custom" ? (Number(cfg.thinkingBudget) || 0) : THINKING_BUDGET_BY_MODE[mode] || 0;
  if (budget > 0 && budget < maxTokens) {
    body.thinking = { type: "enabled", budget_tokens: budget };
    delete body.temperature;
    delete body.top_p;
    delete body.top_k;
  }
}

export const API_TYPES = {
  ANTHROPIC: "anthropic",
  OPENAI: "openai",
  GEMINI: "gemini",
  VERTEX: "vertex",
  QWEN: "qwen", // 通义千问（阿里百炼）——协议完全 OpenAI 兼容，内部走 OPENAI 同一套逻辑，
                // 只是预设好 base_url，用户填 key + 模型名（如 qwen3.5-plus-2026-04-20）即可。
};

// 各类 LLM 调用的输出 token 上限（max_tokens）。这些原来散在代码里写死，
// 现在集中成命名项、全部可在设置里调，范围 0–100000。默认值按"够用又不
// 被思考模型的思考 token 吃穿正文"来定——原来的 120/200/500 这种小值在
// 带思考的模型（如 gemini-3/Gemini2.5）上会被思考吃光额度、正文半句就撞
// length 上限，故默认调大。想省钱可自行调小；想彻底不担心截断可拉到 100000。
export const CALL_TOKEN_LIMIT_MAX = 100000;

export const DEFAULT_CALL_TOKEN_LIMITS = {
  narratorWhisper: 6000, // 私聊旁白（MudRPG talkToNarrator）。原写死 600，是上一轮
                         // 「9处写死抽成配置」漏网的第 10 处；带思考的模型下思考 token
                         // 与正文共用额度，600 被吃穿后正文半句就撞 length 截断。
  pigeonReply:    3000,  // 飞鸽回信书信体（MudRPG 飞鸽回信）
  inspect:        4000,  // 查看物品/武学介绍（MudRPG inspect 缓存）
  persuasion:     2000,  // 说服台词（persuasion.js）
  extraction:     2000,  // 结构化小调用（记忆召回/前哨听意等）
  knowledge:      2000,  // 事实抽取（knowledge.js）
  daySummary:     2000,  // 日总结（大纸条）后台归纳（memory/daySummary.js）
  direction:       200,  // 方位单字判定（qucuoMap.js，本只答一个字，默认给小但可调大）
  connectionTest:  200,  // 连接测试 ping（apiConfig/debugConsole，思考模型下 50 会返空，故默认给 200）
  prep:           3000,  // world.prep 休整期后台备料（WO-24B，主模型低档思考）
};

// Anthropic 官方没有公开的模型列表接口，返回一份已知模型的静态清单
export const ANTHROPIC_KNOWN_MODELS = [
  "claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5-20251001", "claude-fable-5",
];
