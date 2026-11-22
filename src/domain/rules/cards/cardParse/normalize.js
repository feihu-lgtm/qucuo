// 条目归一与卡级归一（从 cardParse.js 拆出，纯搬运）
// 只做「读懂并归一化」，不做去向决定。

import { splitKeys, stripDecorators, hitAny, MACRO_RE } from "./clean.js";
import { classifyEntry } from "./classify.js";

// SillyTavern 世界书条目的内部位置枚举（entry.extensions.position）
const ST_POSITION = {
  0: "before_char",
  1: "after_char",
  2: "an_top",
  3: "an_bottom",
  4: "at_depth",
  5: "em_top",
  6: "em_bottom",
};

// entry.extensions.role
const ST_ROLE = { 0: "system", 1: "user", 2: "assistant" };

// ST 内部位置 → 本项目 13 位注入块（见 tavernMapping.js）
// at_depth 的落点取决于 depth：depth 0 是贴在最末的关键指令，本项目 13 号位是
// JSON schema 的 assistant prefill，塞不得（见 sysBase.js 顶部那段），所以一律
// 落到 11 号位 inChat。
const POSITION_TO_BLOCK = {
  before_char: "worldInfoBefore",
  after_char: "worldInfoAfter",
  an_top: "authorsNote",
  an_bottom: "authorsNote",
  at_depth: "inChat",
  em_top: "dialogueExamples",
  em_bottom: "dialogueExamples",
};

// 单条长度闸（字符）。超上限拒收，超警戒线标记为需手动确认。
const ENTRY_LEN_WARN = 2000;
export const ENTRY_LEN_MAX = 8000;

// 抗拒绝 / 越狱类条目的识别词（R4）。命中只做标记，不改内容。
const JAILBREAK_HINTS = [
  "抗拒绝", "防拒绝", "拒绝回答", "抗绝望", "防机器人", "破甲", "越狱",
  "不得拒绝", "不能拒绝", "jailbreak", "uncensor", "bypass",
];

// NSFW 条目识别词（R5）
const NSFW_HINTS = ["nsfw", "r18", "18+", "涩涩", "色色", "情色", "性爱", "床戏"];

/**
 * 把一条原始世界书条目归一成中性结构。不判断去向，只描述事实 + 给建议。
 */
export function normalizeEntry(raw, index) {
  const ext = (raw && raw.extensions) || {};
  const { content, decorators } = stripDecorators(raw?.content);
  const { keys, dirty } = splitKeys(raw?.keys);

  // F10：真位置取 extensions.position，规范层 position 只用来报冲突
  const extPos = ST_POSITION[ext.position] || null;
  const specPos = typeof raw?.position === "string" ? raw.position : null;
  const position = extPos || specPos || "before_char";
  const positionConflict = !!(extPos && specPos && extPos !== specPos);

  // F12：常驻判定不看 use_regex。constant 为真即无条件注入（ST 里 constant
  // 优先于 keys，有没有关键词都常驻）。keys 空 + 非 constant → 永不触发的死条目。
  const constant = !!raw?.constant;
  const hasKeys = keys.length > 0;
  const dead = !constant && !hasKeys;

  const len = content.length;
  const label = String(raw?.comment || raw?.name || `条目${index + 1}`);

  const jailbreak = hitAny(`${label}\n${content.slice(0, 400)}`, JAILBREAK_HINTS);
  const nsfw = hitAny(label, NSFW_HINTS);
  const kind = classifyEntry(label, keys);

  return {
    index,
    label,
    kind,                                // 分类建议，非判定（见 classify.js 顶部注释）
    keys,
    // 展开宏之后原始信息就没了，但「这条本来是靠 <user> 触发的」这件事必须留住，
    // 否则玩家角色设定条目会被当成一个叫玩家名字的 NPC 导进 npcLore。
    keysRaw: Array.isArray(raw?.keys) ? raw.keys.slice() : [],
    keysDirty: dirty,                    // F14 命中的脏值原文，供 UI 提示
    keysHaveMacro: keys.some(k => MACRO_RE.test(k)),
    content,
    length: len,
    decorators,                          // F18
    constant,
    alwaysOn: constant,
    dead,                                // keys 空且非常驻 = 永不触发
    enabled: raw?.enabled !== false,
    position,
    positionConflict,                    // F10
    specPosition: specPos,
    depth: typeof ext.depth === "number" ? ext.depth : null,
    role: ST_ROLE[ext.role] || "system",
    order: typeof raw?.insertion_order === "number" ? raw.insertion_order : 0,
    // F11：这些键可能压根不存在，全部兜底
    excludeRecursion: !!ext.exclude_recursion,
    preventRecursion: !!ext.prevent_recursion,
    // 建议落点（13 位块），由调用方决定是否采纳
    suggestBlock: POSITION_TO_BLOCK[position] || "worldInfoBefore",
    // 风险标记
    flags: [
      len > ENTRY_LEN_MAX ? "TOO_LONG" : (len > ENTRY_LEN_WARN ? "LONG" : null),
      jailbreak ? "JAILBREAK" : null,
      nsfw ? "NSFW" : null,
      dirty.length ? "DIRTY_KEYS" : null,
      dead ? "DEAD" : null,
      positionConflict ? "POSITION_CONFLICT" : null,
      len === 0 ? "EMPTY" : null,
    ].filter(Boolean),
    jailbreakHint: jailbreak,
  };
}

/**
 * 归一化整张卡。
 * @param {object} rawCard 解析出来的卡 JSON（可能是 {spec,data:{…}} 也可能是裸 V1）
 * @param {object} carrier extractCardJsonFromPng 回传的载体信息
 */
export function normalizeCard(rawCard, carrier = {}) {
  const data = (rawCard && typeof rawCard.data === "object" && rawCard.data) || rawCard || {};
  const ext = data.extensions || {};
  const book = data.character_book || null;
  const rawEntries = (book && Array.isArray(book.entries) && book.entries) || [];

  const entries = rawEntries.map((e, i) => normalizeEntry(e, i));

  // F5：开场白 = first_mes + alternate_greetings，去掉空串
  const openings = [data.first_mes, ...(Array.isArray(data.alternate_greetings) ? data.alternate_greetings : [])]
    .map(s => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);

  // R3：脚本一律不执行，只统计并回报
  const helper = ext.tavern_helper;
  const helperBlob = helper ? JSON.stringify(helper) : "";
  const scripts = {
    // F7：类型可能是数组也可能是对象
    tavernHelper: helper ? { type: Array.isArray(helper) ? "array" : "object", size: helperBlob.length } : null,
    regexScripts: Array.isArray(ext.regex_scripts) ? ext.regex_scripts.length : 0,
    remoteImport: /import\s*[('"]|https?:\/\//.test(helperBlob),
    otherExtensionKeys: Object.keys(ext).filter(
      k => !["talkativeness", "fav", "world", "depth_prompt", "regex_scripts", "tavern_helper"].includes(k)
    ),
  };

  const nameRaw = typeof data.name === "string" ? data.name : "";

  return {
    // F3：载体与 spec 分别记录
    carrier,
    spec: rawCard?.spec || null,
    specVersion: rawCard?.spec_version || null,

    name: nameRaw,
    nameIsMacro: MACRO_RE.test(nameRaw),      // F9
    nickname: data.nickname || null,
    creator: data.creator || "",
    characterVersion: data.character_version || "",
    tags: Array.isArray(data.tags) ? data.tags : [],

    // F4：六字段一律兜底成字符串
    fields: {
      description: data.description || "",
      personality: data.personality || "",
      scenario: data.scenario || "",
      mesExample: data.mes_example || "",
      systemPrompt: data.system_prompt || "",
      postHistoryInstructions: data.post_history_instructions || "",
      creatorNotes: data.creator_notes || "",
    },

    openings,
    bookName: (book && book.name) || "",
    entries,
    // F6/F8：读了但基本都空，留着不碍事
    depthPrompt: ext.depth_prompt || null,
    assets: Array.isArray(data.assets) ? data.assets : [],
    source: Array.isArray(data.source) ? data.source : [],

    scripts,
  };
}
