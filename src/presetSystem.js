// 酒馆式预设系统
// 完整兼容 SillyTavern 的 Chat Completion 预设 JSON 格式（Master 文件）。
// 核心概念：
// - prompts：素材库，每条独立的 prompt 片段（id/name/role/content/isMarker）
// - order：这次实际要用哪些、按什么顺序（数组顺序即插入顺序），每项 {id, enabled}
// 真实的启用状态和顺序以 order 数组为准，不看 prompts 里各条目自身的 enabled 字段
// （这和酒馆的行为完全一致：prompts 是仓库，order 才是"这次用哪些"的清单）。

const PRESET_STORAGE_KEY = "wuxia_mud_presets";

// 系统保留的占位符 identifier，对应酒馆的 marker:true 条目。
// 我们的引擎里能对应上的：chatHistory（历史对话）、charDescription/scenario（剧本设定）。
// 其余占位符（worldInfoBefore/After、personaDescription、dialogueExamples 等）
// 我们目前没有对应概念，导入时会保留条目但拼装时留空跳过，不报错。
export const MARKER_IDS = new Set([
  "main", "nsfw", "jailbreak", "enhanceDefinitions",
  "worldInfoBefore", "worldInfoAfter", "charDescription", "charPersonality",
  "scenario", "personaDescription", "dialogueExamples", "chatHistory",
]);

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
export function defaultConstraint() {
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
export function renderNarrativeConstraint(c) {
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
      content: `- 不搜索不给隐藏物品，只描述外观
- NPC不主动倒信息，问对才给对答案
- 战斗诚实，弱打强必死
- 物品的装备/卸下完全由玩家在界面上手动操作，你不需要也不能通过任何字段直接把某件物品设为"已装备"——只负责把新物品加入 items_add，装备状态玩家自己管理
- 鼓励玩家用背包里的物品和场景/NPC互动，只要符合逻辑就应该给出合理的互动结果
- char.neigong（内功）/char.waigong（外功）不由你直接修改——这两项现在是战斗伤害公式里的真实倍率，数值必须由玩家花"潜能"主动修炼获得，不能被叙事顺手改变。修炼、历练、顿悟等场景想奖励玩家时，改成在 delta.pot 里多给一些潜能（潜能是玩家用来修炼内外功和武学的资源），不要直接改 neigong/waigong 字段
- char.special 七维为 0-10 的天赋值，只有极重大的奇遇、渡劫、悟道场景才允许改动，且单次不超过1点
- NPC 名单里的〔品阶:X档〕是系统裁决的**战力分级**标记（白＜绿＜蓝＜紫＜橙＜红，越往后战力越悬殊），**只代表数值段位，与人物穿什么衣服毫无关系**——绝不要把它当成衣着设定，不要据此给角色套上对应颜色的袍服（"红档"不等于穿红袍，"白档"不等于穿白衣，衣着、装束、发式一律按该人物自身的外貌与身份设定来写，与档位无关）。但它决定叙事分量：高战力者出场，气度、谈吐、旁人敬畏、随从排面要配得上这个段位，低档杂鱼不该写得深不可测，高档人物也不该写得寒酸掉价——分量靠气场与场面烘托，不靠衣服颜色`,
    }),
    makePromptEntry({
      id: "wenfeng", name: "文体铁律", role: "system",
      content: `白话古文，章回说书人口吻，句句主谓宾齐全，句间逻辑过渡。禁冒号破折号。

【文本区分】
对话用「」包裹，引语用""，心理用*斜体*。旁白不加标记。
例：那猎户啐了一口，「你这后生，莫不是来找死的？」
例：「直娘贼！」他一掌拍在桌上，「这雪山上可没有后悔药卖。」
例：赵老秃眯起眼，「俺在这熊山脚下过了一辈子，见过的后生没一百也有八十。」
例：她转过身去，低声说了句，「明天别来了。」

【写作铁律】
- 每句必须推进剧情、塑造人物或营造氛围，无信息量则删
- 只写发生了什么，不写它意味着什么。信任读者
- 段落结尾以具体动作或台词收束，禁止抽象总结
- 情绪通过行动或台词流露，不用五官特写标注（禁用"眼底闪过""嘴角勾起""瞳孔一缩"）
- 比喻须新颖具体，禁用"涟漪""惊雷""潮水""投石入湖"等陈腐喻体
- 禁止"不是X，而是Y"句式，直接说Y
- 形容词副词不连用，单段成语不超过2个`,
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
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return { presets: [defaultPreset()], activeIndex: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed.presets || !Array.isArray(parsed.presets) || !parsed.presets.length) {
      return { presets: [defaultPreset()], activeIndex: 0 };
    }
    // activeIndex 越界兜底（比如手动改过 localStorage，或者曾经的预设被删掉导致索引错位）
    const activeIndex = (typeof parsed.activeIndex === "number" && parsed.activeIndex >= 0 && parsed.activeIndex < parsed.presets.length)
      ? parsed.activeIndex : 0;
    return { presets: parsed.presets, activeIndex };
  } catch {
    return { presets: [defaultPreset()], activeIndex: 0 };
  }
}

export function saveAllPresets(state) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(state));
}

// ── 收藏/模板库（本轮新增）──
// 独立于任何单个预设的全局片段库：把常用的 prompt 片段（比如"哈八股禁词表"这种
// 反复要用的通用规则）存起来，可以一键拖/插进任意预设的激活链或库存区，不用每次
// 重新打字。存储上跟"预设"完全分离（不属于 presets 数组里的任何一份），删掉某个
// 预设不会影响收藏库，反之亦然。
const PRESET_LIBRARY_STORAGE_KEY = "wuxia_mud_preset_library";

export function loadPresetLibrary() {
  try {
    const raw = localStorage.getItem(PRESET_LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePresetLibrary(items) {
  localStorage.setItem(PRESET_LIBRARY_STORAGE_KEY, JSON.stringify(items));
}

// 把某个预设里的一条 prompt 存入收藏库（复制一份，脱离原预设的 id 引用关系，
// 存入库里的副本有自己独立的 id，避免以后原预设改了内容、库里的模板跟着变）。
export function addToLibrary(promptEntry) {
  const lib = loadPresetLibrary();
  const copy = makePromptEntry({
    name: promptEntry.name, role: promptEntry.role, content: promptEntry.content, isMarker: false,
    type: promptEntry.type || "text",
    constraint: promptEntry.constraint || null,
  });
  savePresetLibrary([...lib, copy]);
  return copy;
}

export function removeFromLibrary(libId) {
  savePresetLibrary(loadPresetLibrary().filter(x => x.id !== libId));
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

// ── 导入/导出酒馆格式 ──

// 从酒馆 Chat Completion 预设 JSON（Master 文件）转换成我们的内部结构
export function importFromTavernFormat(json, presetName) {
  const rawPrompts = json.prompts || [];
  const rawOrderWrapper = (json.prompt_order && json.prompt_order[0]) || { order: [] };
  const rawOrder = rawOrderWrapper.order || [];

  const prompts = rawPrompts.map(p => makePromptEntry({
    id: p.identifier,
    name: p.name || p.identifier,
    role: p.role || "system",
    content: p.content || "",
    // 是否是"系统占位符"只看 marker 字段本身，不能再用 MARKER_IDS.has(identifier)
    // 做兜底判断——真实酒馆预设里，有些普通自定义文本条目会复用 main/jailbreak/
    // enhanceDefinitions/nsfw 这类习惯性 identifier 名字，marker 字段却明确是
    // false（说明创作者就是把它当普通内容条目写的），如果仍按 identifier 名字
    // 兜底判定为占位符，会把这些本该可编辑的真实文字内容，误判成"运行时自动填充、
    // 不能手动编辑"的系统槽位，导致它们的内容彻底不见了。只有当 p.marker 明确为
    // true，或者压根没有 marker 字段（老格式兼容）时才退回按 identifier 判断。
    isMarker: typeof p.marker === "boolean" ? p.marker : MARKER_IDS.has(p.identifier),
  }));

  // ── 顺序/启用状态来源（本轮修复严重 bug）──
  // 酒馆导出文件存在两种常见形态：
  //   A) 标准形态：prompt_order[0].order 是非空数组，每项 {identifier, enabled}
  //      按数组顺序 = 真实顺序，enabled 以这里为准（这是我们原来唯一支持的形态）。
  //   B) 变体形态（很多真实预设文件是这样，比如角色卡/预设合集导出）：
  //      prompt_order[0].order 是空数组，顺序信息根本不在这里，而是 prompts
  //      数组本身的物理顺序就是顺序，每条 prompt 自带的 enabled 字段才是真实
  //      的启用状态。
  // 之前的实现只认形态 A，遇到形态 B 时 rawOrder 为空，"兜底"逻辑会把 *所有*
  // 条目不分青红皂白全部塞进 order 且强制 enabled:false——相当于导入即把整个
  // 预设的开关状态清空重置，完全无视了每条 prompt 本来就带着的真实 enabled 值，
  // 导致导入一份本来有十几条正常开启的预设后，界面上会显示"全部关闭"，这是
  // 一个会让预设实质不可用的严重错误。
  // 判断依据很简单：rawOrder 有内容就走形态 A；rawOrder 为空且 prompts 非空
  // 就走形态 B，直接用 prompts 数组顺序 + 各自的 p.enabled 字段。
  const promptIds = new Set(prompts.map(p => p.id));
  let order;
  if (rawOrder.length > 0) {
    // 形态 A：标准酒馆格式，order 数组决定真实的顺序和启用状态
    order = rawOrder
      .filter(o => promptIds.has(o.identifier))
      .map(o => ({ id: o.identifier, enabled: !!o.enabled }));
    // 少数条目可能没出现在 order 里（理论上不应该，但做个兜底），追加到末尾且禁用——
    // 这条兜底只在"确实走了标准 order 流程、只是个别条目遗漏"时才合理触发。
    for (const p of prompts) {
      if (!order.some(o => o.id === p.id)) order.push({ id: p.id, enabled: false });
    }
  } else {
    // 形态 B：order 为空，改用 prompts 数组的物理顺序作为真实顺序，
    // 并尊重每条 prompt 自带的 enabled 字段。
    // 缺失时的默认值取 false（未启用）而不是 true——酒馆里普遍的实际习惯是：
    // 显式写 enabled:true/false 的条目，状态就以这个值为准；完全没写这个字段的，
    // 通常是"添加了但从没勾选启用过"的草稿/备用片段，语义上更接近"未启用"，
    // 而不是"忘了写、其实想开启"。误判成 true 的后果尤其严重：会让制作者本来
    // 精心关闭、留作备选的大段内容（比如多个互斥的"文风（选一）"候选项之一）
    // 意外全部生效，叠加出制作者完全没设计过的组合效果。
    order = rawPrompts.map(p => ({
      id: p.identifier,
      enabled: p.enabled === true,
    }));
  }

  return {
    name: presetName || "导入的预设",
    prompts,
    order,
    temperature: typeof json.temperature === "number" ? json.temperature : null,
    maxTokens: typeof json.openai_max_tokens === "number" ? json.openai_max_tokens : null,
    topP: typeof json.top_p === "number" ? json.top_p : null,
    topK: typeof json.top_k === "number" ? json.top_k : null,
    frequencyPenalty: typeof json.frequency_penalty === "number" ? json.frequency_penalty : null,
    presencePenalty: typeof json.presence_penalty === "number" ? json.presence_penalty : null,
  };
}

// 导出成酒馆兼容的 JSON 结构（可以再导入回酒馆，或者分享给别人）
export function exportToTavernFormat(preset) {
  const out = {
    temperature: preset.temperature ?? 1,
    openai_max_tokens: preset.maxTokens ?? 1200,
    openai_max_context: 200000,
    prompts: preset.prompts.map(p => ({
      identifier: p.id,
      name: p.name,
      role: p.role,
      content: p.content,
      marker: p.isMarker,
      enabled: true,
    })),
    prompt_order: [{
      character_id: 100001,
      order: preset.order.map(o => ({ identifier: o.id, enabled: o.enabled })),
    }],
  };
  // 只有明确配置过（非 null）才写出，避免给不需要这些字段的导入方（比如没有这些
  // 概念的老版本工具）塞进多余字段。
  if (preset.topP != null) out.top_p = preset.topP;
  if (preset.topK != null) out.top_k = preset.topK;
  if (preset.frequencyPenalty != null) out.frequency_penalty = preset.frequencyPenalty;
  if (preset.presencePenalty != null) out.presence_penalty = preset.presencePenalty;
  return out;
}
