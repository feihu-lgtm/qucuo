// API 配置：localStorage 存储、迁移、多套 profile，以及对外统一导出口。
// 供应商表/协议适配在 providers.js；请求收发在 apiTransport.js；
// 错误分类在 utils/apiErrors.js；JSON 清洗在 utils/jsonClean.js。
import { hasVertexCredential } from "./vertexCredentials.js";
import {
  API_TYPES, DEFAULT_CALL_TOKEN_LIMITS, migrateProvider, PROVIDERS,
} from "./providers.js";
export { importVertexCredential } from "./vertexCredentials.js";
export {
  API_TYPES, CALL_TOKEN_LIMIT_MAX, DEFAULT_CALL_TOKEN_LIMITS, DEFAULT_ENDPOINTS,
  isDefaultEndpoint, migrateProvider, providerApiType, PROVIDERS,
  QWEN_DEFAULT_ENDPOINT, QWEN_MAX_TOKENS_CAP,
} from "./providers.js";
export { callModel } from "./apiTransport.js";
export { callModelStream, listModels, testConnection } from "./apiDiagnostics.js";

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


// 思考档位 → 各家参数的映射由 providers.js 处理。默认 "off"：把 token 全留给正文。
// 各动作类型的输出字数上限默认值。min 在 buildBudgetInstruction 里自动取 max×0.4。
export const DEFAULT_INTENT_BUDGETS = {
  LOOK:           100,  // 查看/环顾：扫一眼，不用写一篇散文
  MOVE:           200,  // 移动：到达场景描写
  TALK_CASUAL:    250,  // 日常闲聊/送礼：一次对话交换
  EXPLORE_ACTION: 900,  // 调查/搜索/事件行动：剧情类，拉到主叙事同一条 900 线
  COMBAT:         900,  // 战斗/切磋：剧情类，拉到主叙事同一条 900 线
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
    // 空对象=未自定义；缺省档位数由 domain 侧（narrator.js AFFECTION_TIERS）在读取处逐键垫底。
    narratorWhisperWords: {},
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
    // 提取层（叙事/状态分离模式）：大模型只输出叙事正文，状态由系统/软结算裁决后
    // 小模型按意图提取残余字段；settle 回合跳过提取。关掉则回到单调用 JSON 老路
    //（回放/离线兜底，确定性 fixture 依赖它）。
    extractionEnabled: false,
    // 判官管线（WO-13）：前哨听意+纯函数判官+锚点流式+尾章校对落账。默认开；
    // 关掉回到旧提取/单调用链路（留一个迭代供 CLI 老录制回放对比）。
    judgePipelineEnabled: true,
    // 行动识别默认开：打字与按钮落到同一套系统结算路径；想要原来自由行动的用户可在设置里关。
    intentRecognitionEnabled: true,
    bookkeepEnabled: true,
    softSettleEnabled: true,
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
    if (saved.narratorWhisperWords) merged.narratorWhisperWords = saved.narratorWhisperWords;
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


export function hasApiCredentials(cfg) {
  return migrateProvider(cfg).apiType === API_TYPES.VERTEX ? hasVertexCredential() : !!String(cfg.apiKey || "").trim();
}
export { parseRetryAfter } from "./retryAfter.js";
