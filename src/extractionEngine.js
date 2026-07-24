// 提取层引擎：叙事/状态分离模式下，从大模型叙事文本中提取结构化状态变化。
// 大模型只管写故事，这一层（通常是小/快模型）只管把故事转成 JSON 命令。
//
// 每个意图类型的提取范围不同——look 只需要场景刷新，战斗需要 HP/掉落，
// 聊天只需要好感度。按意图精确提问可以大幅提升提取准确率（token 少、任务聚焦）。

import { callModel, cleanJsonString } from "./apiConfig.js";
import { extractMvuBlock } from "./mvu.js";

// ── 全意图公共字段（本轮补齐）──
// 单调用模式下这两个字段由主叙事的 JSON schema 一并产出，双调用模式下主调用只写
// 散文、不产 JSON，而下面各意图的提取 schema 里谁都没要过它们，于是 p.memory 与
// p.mentionedNewNpcs 在双调用下恒为 undefined，连带把三条链整个跳过：
//   · memory → 向量小纸条不写、当日原料不进（日总结没素材）、事实账本不登记
//     （事实账本正是旁白"全知事实"的来源，账本空了她私聊时就真的什么都不知道）
//   · mentionedNewNpcs → NPC 涌现第一阶段（传闻中的人物）永不触发
// 与其在 6 份 schema 里各抄一遍，不如统一拼在每个意图的 user prompt 末尾。
const COMMON_EXTRACT_TAIL = `

除上面那个 JSON 里的字段之外，无论本轮有无状态变化，都请在**同一个顶层 JSON 对象**里额外补上这两个字段：
"memory": 用不超过50字的纯客观事实概括本轮发生了什么（谁在何处做了什么、花了多少、得了什么），供日后回想与旁人提起；确实无足记的琐事（纯环顾、纯赶路且路上无事）可省略此字段。
"mentionedNewNpcs": 数组，填叙事里被提到姓名、但此刻并不在场的**新**具名人物（例如别人口中提起的某个人）。当前在场的人不算，已经出现过的人不算，没有就省略此字段。`;

// 各意图对应的提取 prompt 工厂。
// narrative: 主调用输出的叙事正文
// s: 游戏快照 { room, char, inv, invText, dao, varTree, lockedDestName, lockedExits }
const EXTRACTION_SPECS = {

  META_QUERY: null, // 元问题无需提取状态

  LOOK: {
    system: "你是游戏状态提取器，只做结构化提取，不添加叙事里没有描述到的内容。",
    user: (narrative, s) =>
      `当前场景：${s.room.name}，NPCs：${s.room.npcs.map(n => n.name).join("、") || "无"}，物品：${s.room.items.map(i => i.name).join("、") || "无"}
出口固定（不能改变）：[${s.room.exits.join(",")}]

叙事内容：
${narrative}

根据叙事，输出场景状态更新 JSON（只包含叙事中实际变化的内容，exits 必须原样保持 [${s.room.exits.join(",")}]，无变化则输出 {}）：
{"room":{"desc":"≤80字场景描述","exits":[${s.room.exits.map(e => `"${e}"`).join(",")}],"npcs":[{"name":"","id":"id","brief":"≤15字"}],"items":[{"name":"","id":"id"}]}}`,
  },

  MOVE: {
    system: "你是游戏状态提取器，只做结构化提取，不添加叙事里没有描述到的内容。",
    user: (narrative, s) => {
      const exits = s.lockedExits ? Object.keys(s.lockedExits) : s.room.exits;
      const dest = s.lockedDestName || s.room.name;
      return `玩家到达新地点：${dest}（由系统固定，不能修改）
固定出口：[${exits.join(",")}]（不能修改）

叙事内容：
${narrative}

输出新场景 JSON（name 必须是"${dest}"，exits 必须是 [${exits.map(e => `"${e}"`).join(",")}]）：
{"room":{"name":"${dest}","desc":"≤80字场景描述","exits":[${exits.map(e => `"${e}"`).join(",")}],"npcs":[{"name":"","id":"id","brief":"≤15字"}],"items":[{"name":"","id":"id"}]}}`;
    },
  },

  TALK_CASUAL: {
    system: "你是游戏状态提取器，从叙事中提取 NPC 互动产生的状态变化（好感度、物品交换）。",
    user: (narrative, s) =>
      `当前 NPC 关系：${JSON.stringify(s.varTree?.角色 || {})}

叙事内容：
${narrative}

根据叙事，输出状态变化 JSON（mvu 字段放好感度增减命令；如有物品交换写 delta；无变化输出 {}）：
{"mvu":"_.add('角色.XXX.好感度', N);\n","delta":{"items_add":[],"items_rm":[],"flags_add":[]}}`,
  },

  EXPLORE_ACTION: {
    system: "你是游戏状态提取器，从叙事中提取探索/调查行动产生的状态变化。",
    user: (narrative, s) =>
      `当前场景：${s.room.name}，背包：${s.invText}

叙事内容：
${narrative}

根据叙事，输出变化 JSON（只包含实际变化的字段，无变化输出 {}）：
{"room":{"npcs":[{"name":"","id":"id","brief":"≤15字"}],"items":[{"name":"","id":"id"}]},"delta":{"items_add":[{"name":"","category":"misc","quality":"白"}],"flags_add":[]},"mvu":"_.add('角色.XXX.好感度', N);\n"}`,
  },

  COMBAT: {
    system: "你是游戏状态提取器，从叙事中提取战斗结果（HP 变化、掉落、经验等）。",
    user: (narrative, s) =>
      `当前状态：HP=${s.char.hp.join("/")}，背包：${s.invText}

叙事内容：
${narrative}

根据叙事，输出战斗结果 JSON（hp 是 [当前值, 最大值]；无变化的字段省略；无变化输出 {}）：
{"char":{"hp":[当前,最大值]},"delta":{"items_add":[{"name":"","category":"misc","quality":"白"}],"items_rm":[],"exp":0,"pot":0},"mvu":"_.add('角色.XXX.好感度', -5);\n"}`,
  },

  UNKNOWN: {
    system: "你是游戏状态提取器，从叙事中提取所有发生变化的游戏状态。",
    user: (narrative, s) =>
      `当前状态：场景=${s.room.name}，HP=${s.char.hp.join("/")}，背包=${s.invText}，NPC 关系=${JSON.stringify(s.varTree?.角色 || {})}

叙事内容：
${narrative}

根据叙事，输出所有变化的 JSON（只包含实际变化的字段，未变化的省略，无变化输出 {}）：
{"room":{"desc":"","npcs":[],"items":[]},"char":{"hp":[当前,最大值]},"delta":{"items_add":[],"items_rm":[],"exp":0,"pot":0,"flags_add":[]},"mvu":"_.add(...);\n"}`,
  },
};

// 公共字段规整（就地修改并返回同一个对象）。
// 提取模型通常是小/快模型，格式服从度不如主模型：memory 可能吐成对象或数字、
// mentionedNewNpcs 可能吐成单个字符串或"甲、乙"这样的逗号串。下游
// （writeNote / registerFact / recordRumoredNpcs）都假定 string 与 string[]，
// 这里一次性收拾干净——脏数据一旦写进事实账本，日后再查是谁写的就很麻烦。
// 空值直接删掉而不是留空串：下游一律用 if (p.memory) 判断，留空串等于多绕一圈。
export function normalizeExtractedFields(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  if (parsed.memory != null && typeof parsed.memory !== "string") {
    parsed.memory = String(parsed.memory);
  }
  if (parsed.memory != null && !parsed.memory.trim()) delete parsed.memory;

  if (parsed.mentionedNewNpcs != null) {
    const raw = parsed.mentionedNewNpcs;
    const list = Array.isArray(raw) ? raw
      : typeof raw === "string" ? raw.split(/[，,、\s]+/)
      : [];
    const cleaned = Array.from(new Set(list.map(x => String(x ?? "").trim()).filter(Boolean)));
    if (cleaned.length) parsed.mentionedNewNpcs = cleaned;
    else delete parsed.mentionedNewNpcs;
  }
  return parsed;
}

// 从 apiCfg 解析出这个意图应该用哪个模型（intent-specific > 默认提取模型 > 主模型）。
export function buildExtractionCfg(intentCode, apiCfg) {
  const model =
    (apiCfg.extractionModels?.[intentCode]) ||
    apiCfg.extractionModel ||
    apiCfg.model;
  return {
    ...apiCfg,
    model,
    thinkingMode: "off",  // 提取是结构化任务，不需要思考
    maxTokens: apiCfg.callTokenLimits?.extraction ?? 2000,      // 提取结果很短，给足但不浪费（可在设置里调，上限 100000）
  };
}

// 调用提取层，返回 { p, mvuCommands, parseFailed }（p/mvuCommands 与 parseMainResponse 返回结构相同，可直接复用状态应用代码）。
// 如果这个意图不需要状态提取（META_QUERY），返回 null。
export async function callExtraction(intentCode, narrative, state, apiCfg) {
  // 不能用 || 回退：META_QUERY 显式为 null（本意图不提取状态），
  // null || UNKNOWN 会让它错误地落到 UNKNOWN，使下面的 !spec 判断成为死代码。
  const spec = Object.prototype.hasOwnProperty.call(EXTRACTION_SPECS, intentCode)
    ? EXTRACTION_SPECS[intentCode]
    : EXTRACTION_SPECS.UNKNOWN;
  if (!spec) return null;

  const cfg = buildExtractionCfg(intentCode, apiCfg);
  const systemPrompt = spec.system;
  // 公共字段（memory / mentionedNewNpcs）统一拼在每个意图的 user prompt 末尾，
  // 免得在 6 份 schema 里各抄一遍、加一个字段要改六处。
  const userContent = spec.user(narrative, state) + COMMON_EXTRACT_TAIL;

  const { text } = await callModel(cfg, systemPrompt, [{ role: "user", content: userContent }], { maxTokens: apiCfg.callTokenLimits?.extraction ?? 2000 });

  // 解析 JSON
  let js = text.replace(/```json\s*|```\s*/g, "").trim();
  const i0 = js.indexOf("{"), i1 = js.lastIndexOf("}");
  if (i0 >= 0 && i1 > i0) js = js.slice(i0, i1 + 1);
  js = cleanJsonString(js);

  let parsed = {};
  let parseFailed = false;
  try { parsed = JSON.parse(js); } catch { parsed = {}; parseFailed = true; }

  normalizeExtractedFields(parsed);

  // 从 JSON 的 "mvu" 字符串字段提取 MVU 指令（复用 extractMvuBlock 的正则解析）
  let mvuCommands = [];
  if (parsed.mvu && typeof parsed.mvu === "string") {
    const { commands } = extractMvuBlock(`<mvu>${parsed.mvu}</mvu>`);
    mvuCommands = commands;
    delete parsed.mvu;
  }

  // parseFailed：提取模型返回了无法解析的内容（被截断/没按格式输出），调用方
  // 据此提示"本轮状态未更新"——此前解析失败被静默吞掉，玩家毫无感知。
  return { p: parsed, mvuCommands, parseFailed };
}
