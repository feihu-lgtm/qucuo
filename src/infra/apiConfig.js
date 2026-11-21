// API 配置与统一调用层
import { DEFAULT_WHISPER_WORDS } from "../domain/narrator/narrator.js";
import { observeAi } from "../core/observeAi.js";
import { readSSE } from "./apiSse.js";
import { getStoredVertexHeaders, hasVertexCredential } from "./vertexCredentials.js";
import { getApiModel } from "../core/apiModel.js";
import {
  applyThinkingAnthropic, applyThinkingGemini, applyThinkingOpenAI, clampMaxTokensForProvider,
  migrateProvider, normalizeAnthropicEndpoint, normalizeGeminiBase, normalizeOpenAIEndpoint, PROVIDERS,
} from "./providers.js";
export { importVertexCredential } from "./vertexCredentials.js";
export {
  DEFAULT_ENDPOINTS, isDefaultEndpoint, migrateProvider, providerApiType, PROVIDERS,
  QWEN_DEFAULT_ENDPOINT, QWEN_MAX_TOKENS_CAP,
} from "./providers.js";

const CONFIG_KEY = "wuxia_mud_api_config";

// 目标汉字数 → API 侧的 maxTokens 安全上限。
// 中文一个汉字大约占 1.5-2 个 token，JSON 结构本身（字段名、引号、转义）也要占一部分，
// 这里用 2.2 倍系数 + 300 固定余量，确保 token 上限不会成为字数不够的瓶颈；
// 真正决定"写多少字"的是 prompt 里的文字指令（见 MudRPG.jsx 的 buildSysBase），
// 这个函数算出来的只是一个宽松的安全上限，不是字数控制的主变量。
export function wordCountToMaxTokens(words) {
  // 地板拉到 200000：不只是防止"思考"模型的思考token吃穿正文额度，而是
  // 直接给到几乎不会再因为 maxTokens 不够导致截断的量级。如果实际对接的
  // API/模型本身对 max_tokens 参数有更低的硬性上限（部分第三方兼容接口
  // 可能如此），请求会在那一层报错，需要按具体供应商再调整，这里不做
  // 针对某家供应商的特殊限制。
  return Math.max(200000, Math.round(words * 2.2 + 300));
}

export const API_TYPES = {
  ANTHROPIC: "anthropic",
  OPENAI: "openai",
  GEMINI: "gemini",
  VERTEX: "vertex",
  QWEN: "qwen", // 通义千问（阿里百炼）——协议完全 OpenAI 兼容，内部走 OPENAI 同一套逻辑，
                // 只是预设好 base_url，用户填 key + 模型名（如 qwen3.5-plus-2026-04-20）即可。
};

// 思考档位 → 各家参数的映射由 providers.js 处理。默认 "off"：把 token 全留给正文。
export const THINKING_MODES = ["off", "low", "medium", "high", "custom"];

// 各动作类型的输出字数上限默认值。min 在 buildBudgetInstruction 里自动取 max×0.4。
export const DEFAULT_INTENT_BUDGETS = {
  LOOK:           100,  // 查看/环顾：扫一眼，不用写一篇散文
  MOVE:           200,  // 移动：到达场景描写
  TALK_CASUAL:    250,  // 日常闲聊/送礼：一次对话交换
  EXPLORE_ACTION: 900,  // 调查/搜索/事件行动：剧情类，拉到主叙事同一条 900 线
  COMBAT:         900,  // 战斗/切磋：剧情类，拉到主叙事同一条 900 线
};

// 各类 LLM 调用的输出 token 上限（max_tokens）。这些原来散在代码里写死，
// 现在集中成命名项、全部可在设置里调，范围 0–100000。默认值按"够用又不
// 被思考模型的思考 token 吃穿正文"来定——原来的 120/200/500 这种小值在
// 带思考的模型（如 gemini-3/Gemini2.5）上会被思考吃光额度、正文半句就撞
// length 上限，故默认调大。想省钱可自行调小；想彻底不担心截断可拉到 100000。
export const CALL_TOKEN_LIMIT_MAX = 100000;

export function clampMaxTokensForType(maxTokens, cfg) {
  const migrated = migrateProvider(cfg);
  return clampMaxTokensForProvider(maxTokens, migrated);
}
export const DEFAULT_CALL_TOKEN_LIMITS = {
  narratorWhisper: 6000, // 私聊旁白（MudRPG talkToNarrator）。原写死 600，是上一轮
                         // 「9处写死抽成配置」漏网的第 10 处；带思考的模型下思考 token
                         // 与正文共用额度，600 被吃穿后正文半句就撞 length 截断。
  pigeonReply:    3000,  // 飞鸽回信书信体（MudRPG 飞鸽回信）
  inspect:        4000,  // 查看物品/武学介绍（MudRPG inspect 缓存）
  persuasion:     2000,  // 说服台词（persuasion.js）
  extraction:     2000,  // 意图/方位抽取（extractionEngine.js）
  knowledge:      2000,  // 事实抽取（knowledge.js）
  daySummary:     2000,  // 日总结（大纸条）后台归纳（memory/daySummary.js）
  direction:       200,  // 方位单字判定（qucuoMap.js，本只答一个字，默认给小但可调大）
  connectionTest:  200,  // 连接测试 ping（apiConfig/debugConsole，思考模型下 50 会返空，故默认给 200）
};

export function defaultConfig() {
  return {
    apiType: API_TYPES.ANTHROPIC,
    provider: "anthropic",
    endpoint: PROVIDERS.anthropic.endpoint,
    apiKey: "",
    vertexProject: "",
    vertexLocation: "global",
    model: "claude-sonnet-4-6",
    temperature: 1.0,
    targetWordCount: 900, // 用户真正关心的：这一轮想要大约多少个汉字，不是 token 数
    maxTokens: wordCountToMaxTokens(900), // 由 targetWordCount 换算出的 API token 上限，是安全余量，不是字数控制的主变量
    // 私聊旁白的目标字数，按好感度五档分别配置（出厂 100/200/300/400/500）。
    // 主叙事有「篇幅要求」硬指令（buildSysBase 的 lenNote），私聊此前一个字的
    // 篇幅指令都没有，模型没有长度目标就按聊天默认长度走、每次只回几十字。
    // 分档而不是给一个固定值：冷淡期的她本就没什么话，篇幅跟着好感度一起解锁，
    // 与文风、攻略档位同一条曲线。分界线见 narrator.js 的 AFFECTION_TIERS。
    narratorWhisperWords: { ...DEFAULT_WHISPER_WORDS },
    // 旁白专属世界书：只注入私聊通道的自定义设定，玩家在「旁白」tab 里自由编辑。
    // 只进私聊、不进主叙事——主叙事的世界观走预设/scenario 那一套，这里写的是
    // "只有她自己知道的事"（她的来历、她对玩家的私下看法、想让她记住的梗）。
    narratorLorebook: "",
    contextWindow: 16, // 保留最近多少轮历史
    // 召回精排（可选）：开了之后每轮多一次 /rerank 调用，用 cross-encoder
    // 对粗排候选做精排。粗排（三路RRF含词法）基线已经不差，所以默认关——
    // 想要精度的人自己开，跟 extractionEnabled 一个待遇。
    rerankEnabled: false,
    rerankEndpoint: "",   // 留空则复用 embedding 的 endpoint
    rerankApiKey: "",     // 留空则复用 embedding 的 key
    rerankModel: "BAAI/bge-reranker-v2-m3",
    corsProxy: "", // 可选：形如 https://your-proxy.com/?url=
    // OpenAI 兼容地址是否自动补全 /v1/chat/completions 那半句。默认关：
    // 有的中转站/供应商地址本就是完整或非标准路径，自动补反而变 404，
    // 所以改成显式勾选、勾了才补，不勾就用户填什么原样发什么。
    openaiAutoComplete: false,
    streamEnabled: false, // 流式输出开关，默认关闭（不影响现有行为）
    // 思考/推理控制（可在设置里大改特改）。默认 off：把 token 全留给正文，
    // 避免 Gemini 2.5 等模型的思考 token 吃穿额度导致正文被截断。
    thinkingMode: "off", // off | low | medium | high | custom
    thinkingBudget: 1024, // 仅 custom 模式生效：自定义思考 token 预算
    // 各动作类型篇幅上限（上面 DEFAULT_INTENT_BUDGETS 是出厂值，可在设置里单独调）
    intentBudgets: { ...DEFAULT_INTENT_BUDGETS },
    // 各类 LLM 调用的输出 token 上限（原来散在代码里写死，现集中可调，范围 0–100000）
    callTokenLimits: { ...DEFAULT_CALL_TOKEN_LIMITS },
    // 提取层（叙事/状态分离模式）：大模型只输出叙事，小模型按意图提取状态变化
    extractionEnabled: false,
    extractionModel: "",  // 空 = 沿用主模型；填入后所有意图共用此模型
    extractionModels: {   // 各意图可单独指定（空 = 回退到 extractionModel）
      LOOK: "", MOVE: "", TALK_CASUAL: "", EXPLORE_ACTION: "", COMBAT: "", UNKNOWN: "",
    },
    // 向量化记忆（可选）
    embeddingEnabled: false,
    embeddingEndpoint: "",
    embeddingKey: "",
    embeddingModel: "",
    // 自动存档：每 N 回合写一次；0 = 每次行动后立即写（旧行为）
    autoSaveEvery: 5,
    // 感叹号任务面板的触发方式（本轮新增）：
    //   "script"  —— 纯台本 harness，不调AI，直接展示 questScripts.js 里
    //                 写死的固定文本（前提是这个节点已经登记过台本，没登记
    //                 的节点这个模式下会退化成走原有的主叙事对话流程）
    //   "prompt"  —— 专属prompt harness，触发本身由系统强制判定（不再等
    //                 AI自己在flags_add里吐flag），但改用一套只服务这个
    //                 任务节点、把AI自由度锁死在该事件范围内的专属system
    //                 prompt去生成具体文字，AI只负责组织语言，"这件事
    //                 发生不发生"这个决定权已经不在AI手里
    // 默认 "prompt"，因为这是这次要重点验证的新机制；"script" 保留作为
    // 更强制、但覆盖面受限于台本登记情况的备选项。
    questTriggerMode: "prompt",
  };
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultConfig();
    const saved = JSON.parse(raw);
    const migrated = migrateProvider(saved);
    const merged = { ...defaultConfig(), ...migrated };
    // 嵌套兜底：callTokenLimits / intentBudgets 是对象，浅合并会整体替换、
    // 丢掉新增项，故按 默认 <- 存档 的顺序逐键补全，确保九项/五项始终齐全。
    merged.callTokenLimits = { ...DEFAULT_CALL_TOKEN_LIMITS, ...(saved.callTokenLimits || {}) };
    merged.intentBudgets = { ...DEFAULT_INTENT_BUDGETS, ...(saved.intentBudgets || {}) };
    merged.narratorWhisperWords = { ...DEFAULT_WHISPER_WORDS, ...(saved.narratorWhisperWords || {}) };
    // 迁移：剧情类两档（战斗/事件行动）由旧出厂值 700/500 上调到 900 线。
    // 只把\"恰好等于旧默认\"的值顶上来（几乎必是没手动改过的），用户特意调过的别值不动。
    if (merged.intentBudgets.COMBAT === 700) merged.intentBudgets.COMBAT = 900;
    if (merged.intentBudgets.EXPLORE_ACTION === 500) merged.intentBudgets.EXPLORE_ACTION = 900;
    // 迁移：旧版本只有 maxTokens 概念，没有 targetWordCount。
    // 如果读到的是旧存档（有 maxTokens 但没存过 targetWordCount），
    // 用旧 maxTokens 反推一个大致对应的字数，避免用户体感突然跳变。
    if (saved.maxTokens != null && saved.targetWordCount == null) {
      merged.targetWordCount = Math.max(100, Math.round((saved.maxTokens - 300) / 2.2));
      merged.maxTokens = wordCountToMaxTokens(merged.targetWordCount);
    }
    return merged;
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(migrateProvider(cfg)));
}

// ── 多套配置（profiles）：存不同渠道/不同 key 的整套配置，随时切换，不用每次重填 ──
// 存在一条独立 localStorage 键里，结构 { profiles: [{ name, cfg, savedAt }] }。
// 与当前激活配置（CONFIG_KEY）相互独立：切换某套 profile = 把它的 cfg 写回 CONFIG_KEY。
const CONFIG_PROFILES_KEY = "wuxia_mud_api_config_profiles";

export function listConfigProfiles() {
  try {
    const raw = localStorage.getItem(CONFIG_PROFILES_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data.profiles) ? data.profiles : [];
  } catch { return []; }
}

function writeConfigProfiles(profiles) {
  localStorage.setItem(CONFIG_PROFILES_KEY, JSON.stringify({ profiles }));
}

// 存一套配置（同名覆盖）。cfg 里含 apiKey，落在本地 localStorage，不上传任何服务器。
export function saveConfigProfile(name, cfg) {
  const nm = (name || "").trim() || `配置${Date.now()}`;
  const profiles = listConfigProfiles().filter(p => p.name !== nm);
  profiles.push({ name: nm, cfg: migrateProvider(cfg), savedAt: Date.now() });
  writeConfigProfiles(profiles);
  return nm;
}

export function loadConfigProfile(name) {
  const p = listConfigProfiles().find(x => x.name === name);
  return p ? migrateProvider(p.cfg) : null;
}

export function deleteConfigProfile(name) {
  writeConfigProfiles(listConfigProfiles().filter(p => p.name !== name));
}

// 导出所有配置 profile（含当前激活配置）为一段 JSON 文本，供下载落盘。
export function exportConfigProfiles(currentCfg) {
  return JSON.stringify({
    kind: "qucuo-config-export",
    version: 1,
    exportedAt: Date.now(),
    current: currentCfg ? migrateProvider(currentCfg) : null,
    profiles: listConfigProfiles().map(profile => ({ ...profile, cfg: migrateProvider(profile.cfg) })),
  }, null, 2);
}

// 从导出的 JSON 文本导入配置 profile（合并：同名覆盖）。返回导入条数。
export function importConfigProfiles(jsonText) {
  const data = JSON.parse(jsonText);
  const incoming = Array.isArray(data.profiles) ? data.profiles : [];
  const byName = new Map(listConfigProfiles().map(p => [p.name, p]));
  for (const p of incoming) {
    if (p && p.name && p.cfg) byName.set(p.name, { name: p.name, cfg: migrateProvider(p.cfg), savedAt: p.savedAt || Date.now() });
  }
  writeConfigProfiles([...byName.values()]);
  return incoming.length;
}

function withProxy(url, cfg) {
  if (cfg.corsProxy) return cfg.corsProxy + encodeURIComponent(url);
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "/api/proxy?url=" + encodeURIComponent(url);
  }
  return url;
}

// 剥离思考内容：把 <think>/<thinking> 块（含被截断未闭合的尾巴）从文本里去掉，
// 防止模型把思考过程漏进正文。对齐姬侠传/墨染两家的响应端处理。
function stripReasoning(text) {
  if (!text) return text;
  let t = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").replace(/<think>[\s\S]*?<\/think>/gi, "");
  // 未闭合的思考起始标签：从它开始到结尾一并丢弃
  const m = t.match(/<think(?:ing)?>[\s\S]*$/i);
  if (m) t = t.slice(0, m.index);
  return t.trim();
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
async function fetchWithTimeout(url, options = {}, timeoutMs = _requestTimeoutMs) {
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

// ── 错误分类：把五花八门的原始错误翻成玩家看得懂的话 + 给出处理建议 ──
// 返回 { kind, icon, title, detail, hint }，供 UI 分级展示。
function redactErrorValue(value, apiKey = "") {
  let text = String(value || "");
  if (apiKey) text = text.split(apiKey).join("[REDACTED]");
  return text
    .replace(/\bBearer\s+[^\s,;"']+/gi, "Bearer [REDACTED]")
    .replace(/(authorization\s*[:=]\s*)[^\s,;"']+/gi, "$1[REDACTED]")
    .replace(/(x-api-key\s*[:=]\s*)[^\s,;"']+/gi, "$1[REDACTED]")
    .replace(/([?&](?:key|api[_-]?key|token)=)[^&\s]*/gi, "$1[REDACTED]");
}

function redactRequestUrl(value, apiKey) {
  if (!value) return "";
  try {
    const url = new URL(value);
    for (const key of ["key", "api_key", "apikey", "token", "access_token"]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return redactErrorValue(url.toString(), apiKey);
  } catch {
    return redactErrorValue(value, apiKey);
  }
}

function connectionError(err, apiKey) {
  const msg = redactErrorValue(err?.message || err, apiKey);
  const status = Number(err?.httpStatus) || Number(msg.match(/\bHTTP\s+(\d{3})\b/i)?.[1]);
  const requestUrl = redactRequestUrl(err?.requestUrl, apiKey);
  const result = (code, cause, fix, kind) => ({ code, cause, fix, kind });
  if (err?.code === "html" || /网页而不是数据|text\/html|<!DOCTYPE|<html/i.test(msg)) {
    return result("HTML", "地址填成了网页", "检查接口地址", "endpoint");
  }
  if (status === 400) {
    const vendorMessage = redactErrorValue(err?.vendorMessage || msg, apiKey).slice(0, 80);
    return result("400", `参数被拒${vendorMessage ? `：${vendorMessage}` : ""}`, "检查模型名和请求参数", "parameter");
  }
  if (status === 401 || status === 403) return result(String(status), "Key 无效或没权限", "检查 API Key 与账号权限", "auth");
  if (status === 404) return result("404", "地址或模型名不对", `检查请求地址：${requestUrl || "确认接口地址和模型名"}`, "endpoint");
  if (status === 429) return result("429", "限流或余额不足", "稍后重试或检查账户额度", "quota");
  if (status >= 500 && status <= 599) return result(String(status), "厂商服务出错，稍后再试", "稍后重试", "server");
  if (err?.code === "timeout" || /超过|timeout|timed out/i.test(msg)) {
    const seconds = msg.match(/(?:超过|after)\s*(\d+)/i)?.[1] || "?";
    return result("超时", `${seconds}秒没响应`, "检查网络或延长超时设置", "timeout");
  }
  if (err?.code === "network" || err instanceof TypeError || /Failed to fetch|NetworkError|ERR_/i.test(msg)) {
    return result("网络", "网络或浏览器被拦", "可能需要 CORS 代理", "network");
  }
  return result("错误", msg.slice(0, 80) || "请求失败", "检查网络和接口配置", "unknown");
}

export function classifyError(err, options = {}) {
  const msg = String(err?.message || err || "");
  const code = err?.code;
  const has = (...ks) => ks.some(k => msg.includes(k));
  if (options.connection) {
    const connection = connectionError(err, options.apiKey);
    return { kind: connection.kind, connection };
  }

  if (code === "timeout" || has("超过", "timeout", "timed out")) {
    return { kind: "timeout", icon: "⏱", title: "接口超时", detail: msg, hint: "网络慢或模型太忙。可稍等重试，或在设置里换个更快的模型/中转站。" };
  }
  if (code === "network" || has("Failed to fetch", "NetworkError", "网络请求失败", "ERR_")) {
    return { kind: "network", icon: "🔌", title: "连不上接口", detail: msg, hint: "检查网络；若用中转站，确认地址能访问、没被墙。" };
  }
  if (has("401", "403", "invalid api key", "authentication", "unauthorized", "密钥", "api key")) {
    return { kind: "auth", icon: "🔑", title: "密钥/鉴权有误", detail: msg, hint: "到设置里核对 API 密钥是否填对、有没有多余空格、是否过期。" };
  }
  if (has("429", "rate limit", "quota", "insufficient", "余额", "额度", "billing", "exceeded")) {
    return { kind: "quota", icon: "💳", title: "额度/限流", detail: msg, hint: "触发限流或余额不足。等一会儿重试，或去服务商充值/提额。" };
  }
  if (has("网页而不是数据", "无法解析", "HTML", "<!DOCTYPE", "<html")) {
    return { kind: "endpoint", icon: "🧭", title: "接口地址可能填错", detail: msg, hint: "接口返回的是网页不是数据。检查设置里的接口地址是否完整、类型是否选对。" };
  }
  if (has("JSON", "parse", "Unexpected token", "解析", "格式")) {
    return { kind: "format", icon: "📦", title: "返回格式异常", detail: msg, hint: "模型没按要求返回结构化数据。重试一次；常发生可换模型或调低输出长度。" };
  }
  if (has("500", "502", "503", "504", "overloaded", "server error", "服务")) {
    return { kind: "server", icon: "🛠", title: "服务端出错", detail: msg, hint: "对方服务器临时故障或过载，稍后重试。" };
  }
  return { kind: "unknown", icon: "⚠", title: "出错了", detail: msg, hint: "可重试一次；反复出现请把这条错误发给作者。" };
}

async function readJsonOrThrow(res, label, requestUrl = "") {
  const bodyText = await res.text();
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
      const err = new Error(`${label} HTTP ${res.status}：${apiMsg}`);
      err.httpStatus = res.status;
      err.vendorMessage = String(apiMsg);
      err.requestUrl = requestUrl || res.url;
      throw err;
    }
    return json;
  } catch (e) {
    if (e.httpStatus) throw e; // 上面主动抛的带码错误，直接透传
    if (!res.ok) {
      const vendorMessage = bodyText.slice(0, 120) || e.message;
      const err = new Error(`${label} HTTP ${res.status}：${vendorMessage}`);
      err.httpStatus = res.status;
      err.vendorMessage = vendorMessage;
      err.requestUrl = requestUrl || res.url;
      throw err;
    }
    throw new Error(`${label}：接口返回的内容无法解析（HTTP ${res.status}）。返回开头是「${bodyText.slice(0, 60)}」——请检查设置里的接口地址与密钥。`);
  }
}

// JSON 容错清洗：AI 经常在 JSON 里混入中文标点、多余逗号、未闭合括号，
// 在 JSON.parse 之前先做一轮清洗，能挽救相当一部分本来会解析失败的响应。
// 参考做法：中文引号/逗号/冒号转英文、去掉行内注释、补全缺失的收尾括号。
export function cleanJsonString(str) {
  if (!str) return str;
  // 中文单引号 → 英文单引号（JSON 字符串用双引号定界，单引号怎么转都无害）
  str = str.replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, "'");
  // 中文标点 → 英文（只处理结构性符号，不动内容里的中文逗号顿号等——
  // 但 JSON 结构外的中文标点本就不该出现在 key/分隔符位置，这里只做最常见的误用修正）
  str = str.replace(/：/g, ":").replace(/，(?=\s*[}\]"])/g, ",");
  // 去掉行内 // 注释（简单启发式，避免误伤字符串内容中的双斜杠）
  str = str.replace(/([^:"])\/\/[^\n]*/g, "$1");
  // 去掉 /* */ 块注释
  str = str.replace(/\/\*[\s\S]*?\*\//g, "");
  // 去掉控制字符
  str = str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  // 去掉结尾多余逗号（trailing comma），重复执行到不再变化为止
  let prev;
  do { prev = str; str = str.replace(/,\s*([}\]])/g, "$1"); } while (str !== prev);
  str = str.trim();
  // 中文双引号按位置判定：字符串外的结构性中文引号（如模型把 key/值整个用 “”
  // 包起来）转成英文引号挽救解析；字符串**内部**的中文引号是合法内容
  // （如 desc 里 写着“天都”二字），一律保留——此前无差别全转英文，反而把
  // 本来合法的 JSON 砸出未配对引号、解析必挂，提取层整份作废（兽骨变"路遇之物"真凶）。
  // 判据：引号外侧（跳过空白）紧邻 {:,[ 或行首 → 结构性开引号；
  // 内侧紧邻 :,]} 或行尾 → 结构性闭引号；其余视为内容。
  const CN_DQUOTE = /[\u201c\u201d\u201e\u201f\u2033\u2036]/;
  const OPEN_SIDE = /[{[:,]/;   // 结构开引号外侧可能紧邻的符号
  const CLOSE_SIDE = /[}\]:,]/; // 结构闭引号内侧可能紧邻的符号
  let out = "", inString = false, escape = false, braces = 0, brackets = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escape) { out += c; escape = false; continue; }
    if (inString) {
      if (c === "\\") { escape = true; out += c; continue; }
      if (c === '"') { inString = false; out += c; continue; }
      if (CN_DQUOTE.test(c)) {
        let j = i + 1; while (j < str.length && /\s/.test(str[j])) j++;
        if (j >= str.length || CLOSE_SIDE.test(str[j])) { inString = false; out += '"'; continue; }
      }
      out += c; continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (CN_DQUOTE.test(c)) {
      let j = i - 1; while (j >= 0 && /\s/.test(str[j])) j--;
      if (j < 0 || OPEN_SIDE.test(str[j])) { inString = true; out += '"'; continue; }
      out += c; continue;
    }
    if (c === "{") braces++; else if (c === "}") braces--;
    else if (c === "[") brackets++; else if (c === "]") brackets--;
    out += c;
  }
  str = out;
  // 补全未闭合的括号（流式截断或 maxTokens 用尽时常见）
  while (brackets > 0) { str += "]"; brackets--; }
  while (braces > 0) { str += "}"; braces--; }
  str = str.replace(/,\s*([}\]])/g, "$1");
  return str;
}

// 把带 tavernBlock/tavernLabel 的 system 块格式化为纯文本，供不支持结构化的 API 使用。
function formatBlock(b) {
  return `[${b.tavernLabel || b.tavernBlock || "system"}]\n${b.content || ""}`;
}

export function hasApiCredentials(cfg) {
  return migrateProvider(cfg).apiType === API_TYPES.VERTEX ? hasVertexCredential() : !!String(cfg.apiKey || "").trim();
}

const isOpenAICompatible = type => [API_TYPES.OPENAI, API_TYPES.QWEN, API_TYPES.VERTEX].includes(type);

async function fetchOpenAI(cfg, systemPrompt, messages, opts, stream = false) {
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
      text = stripReasoning(raw.content?.map(b => b.text || "").join("") || "");
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
      applyThinkingGemini(genConfig, cfg);
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
// 只支持 Anthropic 和 OpenAI 兼容格式的 SSE 协议；Gemini 流式协议差异较大，暂不支持，
// 调用方应在 UI 层根据 cfg.apiType 决定是否允许勾选"流式输出"。
export function callModelStream(cfg, systemPrompt, messages, onChunk, opts = {}) {
  const migrated = migrateProvider(cfg);
  return observeAi(messages, { ...opts, cfg: migrated, systemPrompt, onChunk, stream: true },
    (chunk) => requestStream(migrated, systemPrompt, messages, chunk, opts));
}

async function requestStream(cfg, systemPrompt, messages, onChunk, opts) {
  if (cfg.timeoutMs) setRequestTimeout(cfg.timeoutMs);
  const maxTokens = opts.maxTokens ?? cfg.maxTokens;
  const temperature = opts.temperature ?? cfg.temperature;

  if (cfg.apiType === API_TYPES.GEMINI) {
    throw new Error("Gemini 暂不支持流式输出，请在设置里关闭流式开关或切换 API 类型");
  }

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
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error?.message || `Anthropic API HTTP ${res.status}`);
      }
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
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error?.message || `OpenAI 兼容 API HTTP ${res.status}`);
      }
      await readSSE(res, (eventData) => {
        const delta = eventData.choices?.[0]?.delta?.content || "";
        if (delta) { full += delta; onChunk(delta, full); }
        // finish_reason 出现在最后一个带 choices 的事件里；usage 需请求时开了 include_usage 才会在末尾单独一个事件给出
        if (eventData.choices?.[0]?.finish_reason) finishReason = eventData.choices[0].finish_reason;
        if (eventData.usage) usage = eventData.usage;
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
const ANTHROPIC_KNOWN_MODELS = [
  "claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5-20251001", "claude-fable-5",
];

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
