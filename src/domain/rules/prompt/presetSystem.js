import { upgradeLegacyDefaults } from "./presetLegacy.js";
// W-STYLE：长文案单源——文体铁律全文逐字存 src/copy/wenfeng.txt（copy-gate 新规，禁止内联）
import { loadCopy } from "../../../copy/loadCopy.js";
const wenfengCopy = loadCopy("wenfeng.txt");
// 酒馆式预设系统（结构沿用 SillyTavern 的 Chat Completion 预设；编辑器和导入导出已下线）
// 核心概念：
// - prompts：素材库，每条独立的 prompt 片段（id/name/role/content/isMarker）
// - order：这次实际要用哪些、按什么顺序（数组顺序即插入顺序），每项 {id, enabled}
// 真实的启用状态和顺序以 order 数组为准，不看 prompts 里各条目自身的 enabled 字段
// （这和酒馆的行为完全一致：prompts 是仓库，order 才是"这次用哪些"的清单）。

const PRESET_STORAGE_KEY = "wuxia_mud_presets";

// 我们引擎能实际填充内容的占位符
const FILLABLE_MARKERS = new Set(["chatHistory", "charDescription", "scenario"]);

// type: "text"（普通自由文本，兼容原有条目和酒馆导入）| "narrativeConstraint"（本轮
// 新增，结构化叙事约束条目，见下方 renderNarrativeConstraint）。老数据没有 type 字段
// 时一律按 "text" 处理，保证向后兼容不炸。
export function makePromptEntry({ id, name, role = "system", content = "", isMarker = false, type = "text", constraint = null }) {
  return {
    id: id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name, role, content, isMarker, type,
    constraint: type === "narrativeConstraint" ? (constraint || defaultConstraint()) : null,
  };
}

// 结构化叙事约束的默认配置。所有字段都是"不启用"的空值/false，用户按需打开。
function defaultConstraint() {
  return {
    wordCountMin: null,      // 字数下限，null=不限制
    wordCountMax: null,      // 字数上限，null=不限制
    bannedWords: [],         // 禁用词数组，比如["一丝","不容置疑"]
    bannedPatterns: [],      // 禁用句式数组，比如["不是X，而是Y"]
    noColonDash: false,      // 禁冒号破折号
    dialogueQuoteMark: false,// 对话必须用「」包裹
    noAbstractSummary: false,// 禁止段落用抽象总结收尾
    maxIdiomsPerParagraph: null, // 单段最多几个成语，null=不限制
  };
}

// 把结构化约束配置渲染成一段自然语言指令文字，拼进最终 prompt。只有真正配置了
// （非默认空值）的项才会出现在生成的文字里，避免给模型看一堆"不限制"的废话。
function renderNarrativeConstraint(c) {
  if (!c) return "";
  const lines = [];
  if (c.wordCountMin != null || c.wordCountMax != null) {
    if (c.wordCountMin != null && c.wordCountMax != null) lines.push(`本段字数须控制在 ${c.wordCountMin}-${c.wordCountMax} 字之间`);
    else if (c.wordCountMax != null) lines.push(`本段字数不超过 ${c.wordCountMax} 字`);
    else lines.push(`本段字数不少于 ${c.wordCountMin} 字`);
  }
  if (c.bannedWords?.length) lines.push(`禁止使用以下词汇：${c.bannedWords.join("、")}`);
  if (c.bannedPatterns?.length) lines.push(`禁止使用以下句式：${c.bannedPatterns.join("；")}`);
  if (c.noColonDash) lines.push("禁用冒号、破折号");
  if (c.dialogueQuoteMark) lines.push("对话必须用「」包裹，不加「」的对话不要混在旁白里");
  if (c.noAbstractSummary) lines.push("段落结尾以具体动作或台词收束，禁止用抽象总结句收尾");
  if (c.maxIdiomsPerParagraph != null) lines.push(`单段成语数量不超过 ${c.maxIdiomsPerParagraph} 个`);
  if (!lines.length) return "";
  return lines.map(l => `- ${l}`).join("\n");
}


// 默认预设：把我们原本硬编码在 buildSysBase 里的内容拆成几条可编辑的 prompt 片段
// 框子顺序设计原则：世界观先铺（给模型背景） → 规则次之（操作约束） →
// 文体铁律压轴（离生成点最近，风格指令记忆最深） → 对话历史永远最后
export function defaultPreset() {
  const prompts = [
    makePromptEntry({
      id: "scenario", name: "剧本设定", role: "system", isMarker: true, content: "",
    }),
    makePromptEntry({
      id: "genrules", name: "通用规则", role: "system",
      content: `- 不搜索不给隐藏物品，只写外观
- NPC不主动倒信息，问对才答
- 战斗诚实，弱打强必死
- 装备/卸下全由玩家手动操作；禁用字段设已装备，新物品只写 items_add
- 背包物品与场景/NPC互动，合逻辑就给合理结果
- 禁直接改 char.neigong/char.waigong（须玩家花潜能修炼）；修炼、历练、顿悟的奖励改在 delta.pot 给潜能
- char.special 七维 0-10 天赋值，仅极重大奇遇/渡劫/悟道可改，单次≤1点
- NPC〔品阶:X档〕是战力分级（白＜绿＜蓝＜紫＜橙＜红，越后越悬殊），仅数值段位，禁据此给角色套同色衣服（衣着按人物自身外貌身份写）；高档靠气度谈吐排面撑场不写寒酸，低档不写得深不可测`,
    }),
    makePromptEntry({
      id: "wenfeng", name: "文体铁律", role: "system",
      content: wenfengCopy,
    }),
    makePromptEntry({
      id: "chatHistory", name: "对话历史", role: "system", isMarker: true, content: "",
    }),
  ];
  return {
    name: "默认预设",
    prompts,
    order: prompts.map(p => ({ id: p.id, enabled: true })),
    temperature: null, // null 表示跟随 apiConfig 的全局设置，不覆盖
    maxTokens: null,
    // 采样参数（本轮新增）：同样 null = 跟随全局 apiConfig 设置，不强行覆盖。
    // 具体哪家 API 真正支持哪个字段，由 apiConfig.js 的 callModel 按 apiType 分别判断，
    // 这里只负责存这份配置意图。
    topP: null,
    topK: null,
    frequencyPenalty: null,
    presencePenalty: null,
  };
}

// 把当前激活预设里配置的采样参数（temperature/maxTokens/topP/topK/frequencyPenalty/
// presencePenalty）覆盖进 apiCfg，供调用方传给 callModel。只有预设里显式配置过（非
// null）的字段才覆盖，null 的沿用 apiCfg 原有的全局设置——这样"预设里不设置就跟随
// 全局"这个约定对所有采样参数都成立，不只是原来就支持的 temperature/maxTokens。
export function applyPresetOverrides(apiCfg, preset) {
  if (!preset) return apiCfg;
  const overrides = {};
  if (preset.temperature != null) overrides.temperature = preset.temperature;
  // maxTokens 保底：酒馆预设的 openai_max_tokens 常常设得很小（历史上是按对话轮数
  // 而非本作按字数换算的字数预算设计的），若直接采用会顶穿本地字数换算得出的安全
  // 上限，导致主叙事被 length 截断。取预设值与全局配置里较大的那个，只做保底，
  // 不影响预设本身就设得比全局更宽松的情况。
  if (preset.maxTokens != null) overrides.maxTokens = Math.max(preset.maxTokens, apiCfg.maxTokens || 4096);
  if (preset.topP != null) overrides.topP = preset.topP;
  if (preset.topK != null) overrides.topK = preset.topK;
  if (preset.frequencyPenalty != null) overrides.frequencyPenalty = preset.frequencyPenalty;
  if (preset.presencePenalty != null) overrides.presencePenalty = preset.presencePenalty;
  return { ...apiCfg, ...overrides };
}

export function loadAllPresets() {
  try {
    if (typeof localStorage === "undefined") return { presets: [defaultPreset()], activeIndex: 0 };
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return { presets: [defaultPreset()], activeIndex: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed.presets || !Array.isArray(parsed.presets) || !parsed.presets.length) {
      return { presets: [defaultPreset()], activeIndex: 0 };
    }
    // activeIndex 越界兜底（比如手动改过 localStorage，或者曾经的预设被删掉导致索引错位）
    const activeIndex = (typeof parsed.activeIndex === "number" && parsed.activeIndex >= 0 && parsed.activeIndex < parsed.presets.length)
      ? parsed.activeIndex : 0;
    const defaults = Object.fromEntries(defaultPreset().prompts.map((entry) => [entry.id, entry.content]));
    return { presets: parsed.presets.map((preset) => upgradeLegacyDefaults(preset, defaults)), activeIndex };
  } catch {
    return { presets: [defaultPreset()], activeIndex: 0 };
  }
}

export function getActivePreset() {
  const { presets, activeIndex } = loadAllPresets();
  return presets[activeIndex] || defaultPreset();
}

// 把一个预设 + 填充内容，拼装成最终的 system prompt 文本。
// fillers: { chatHistory, charDescription, scenario } 具体内容由调用方传入
// （chatHistory 通常不适合直接拼进 system prompt，这里主要用于 charDescription/scenario 这类）
export function assemblePrompt(preset, fillers = {}) {
  const byId = Object.fromEntries(preset.prompts.map(p => [p.id, p]));
  const parts = [];
  for (const entry of preset.order) {
    if (!entry.enabled) continue;
    const p = byId[entry.id];
    if (!p) continue; // order 里引用了不存在的条目，跳过
    if (p.isMarker) {
      if (FILLABLE_MARKERS.has(p.id) && fillers[p.id]) {
        parts.push(fillers[p.id]);
      }
      // 不可填充的占位符（worldInfo等）留空跳过，不报错
      continue;
    }
    if (p.type === "narrativeConstraint") {
      const rendered = renderNarrativeConstraint(p.constraint);
      if (rendered) parts.push(rendered);
      continue;
    }
    if (p.content && p.content.trim()) parts.push(p.content);
  }
  return parts.join("\n\n");
}
