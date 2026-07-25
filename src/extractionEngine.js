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
// memory 摘要统一用玩家角色名字第三人称叙述，不用"你/我/玩家"这几种代词混着写——
// 事实账本(knowledge.js)的摘要要在多处被复用（旁白全知视角、其他NPC传闻转述、飞鸽书信
// 里提起），人称一旦不统一，转述出来的句子会主客体错乱、读起来别扭。跟 MudRPG.jsx 里
// buildSysBase（单调用/主叙事模式）的同一条约束保持一致，双调用的提取层这边不能漏掉。
function commonExtractTail(playerName) {
  const name = playerName || "主角";
  return `

除上面那个 JSON 里的字段之外，无论本轮有无状态变化，都请在**同一个顶层 JSON 对象**里额外补上这两个字段：
"memory": 用不超过50字的纯客观事实概括本轮发生了什么（谁在何处做了什么、花了多少、得了什么），一律用"${name}"称呼玩家角色，不要用"你/我/玩家"，供日后回想与旁人提起；确实无足记的琐事（纯环顾、纯赶路且路上无事）可省略此字段。
"mentionedNewNpcs": 数组，填叙事里被提到姓名、但此刻并不在场的**新**具名人物（例如别人口中提起的某个人）。当前在场的人不算，已经出现过的人不算，没有就省略此字段。`;
}

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

  // 送礼专属提取——不是从叙事"读心"式倒推好感度变不变、变多少，而是直接钉死结论：
  // 这个世界收礼必因礼貌/信义/心情而高兴，本轮好感度只能是正向增量，且按礼物的
  // 品阶/描述给出有依据的幅度参考。settleOpts 由调用方在命中 settleKind:"gift" 时传入
  // （见 MudRPG.jsx handleNpcGift/giftToCharacter），未命中时仍走上面通用 TALK_CASUAL。
  GIFT: {
    system: "你是游戏状态提取器，专门处理送礼场景的好感度结算——这个世界收礼必然让人欣喜，好感度只能往上走，不做\"读心\"式判断。",
    user: (narrative, s, settleOpts) => {
      const info = settleOpts?.giftInfo || {};
      const [lo, hi] = info.range || [2, 4];
      const suggested = info.suggestedDelta ?? Math.round((lo + hi) / 2);
      return `${settleOpts?.settleNpc || "对方"}刚收到玩家赠送的礼物：${info.itemName ? `「${info.itemName}」` : "一件物品"}，品阶【${info.quality || "白"}】${info.categoryLabel ? `，类别「${info.categoryLabel}」` : ""}${info.desc ? `。物件描述：${info.desc}` : ""}

叙事内容：
${narrative}

【铁律】不管叙事写得含蓄还是热络，送礼这一轮${settleOpts?.settleNpc || "对方"}对玩家的好感度只能上升、不得为 0 或负数——按这件礼物的品阶与来历，建议幅度落在 +${lo}~+${hi} 之间（品阶越高、描述越贵重取上沿，寻常物件取下沿）。物品交换写进 delta（礼物已由系统扣除，此处不需要重复处理 items_rm）。
输出 JSON（mvu 字段必须是一条正向 _.add 好感度指令）：
{"mvu":"_.add('角色.${settleOpts?.settleNpc || "XXX"}.好感度', ${suggested});\n","delta":{"items_add":[],"flags_add":[]}}`;
    },
  },

  // 伙伴认主专属提取——雪豹是"前世羁绊、认主忠贞"的设定，不是从0慢慢培养的
  // 陌生关系，所以不用 _.add 微调而是直接 _.set 一个较高的初始好感度。跟 GIFT
  // 一样不做"读心"式判断，直接钉死结论。settleOpts 由调用方在命中
  // settleKind:"companion_invite" 时传入（见 MudRPG.jsx handleInviteCompanion）。
  COMPANION_INVITE: {
    system: "你是游戏状态提取器，专门处理伙伴认主场景的好感度结算——雪豹认主是前世羁绊使然，好感度应直接给一个较高的初始值，不做\"读心\"式判断。",
    user: (narrative, s, settleOpts) => {
      const npcName = settleOpts?.settleNpc || "雪豹";
      return `${npcName}刚刚接受了玩家的邀请，正式结为同行的伙伴——这是前世便结下的羁绊，它认准了玩家便是这片雪域高原真正的主人，忠贞无二。

叙事内容：
${narrative}

【铁律】不管叙事写得含蓄还是热络，这一轮${npcName}对玩家的好感度都应直接设为一个较高的初始值（40~55之间，体现"前世羁绊、一见如故"而非从零培养），不得低于30。
输出 JSON（mvu 字段必须是一条 _.set 好感度指令，用 set 不用 add——这是初次登场，不是在已有基础上增减）：
{"mvu":"_.set('角色.${npcName}.好感度', 45);\n","delta":{"items_add":[],"flags_add":[]}}`;
    },
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
{"char":{"hp":[当前,最大值]},"delta":{"items_add":[{"name":"","category":"misc","quality":"白"}],"items_rm":[],"exp":0,"pot":0},"mvu":""}
mvu 字段留空即可，除非叙事里**明确写出**某个 NPC 因这场战斗对玩家的观感发生了具体变化（比如"她被这份身手镇住"或"他为你这般不知好歹而恼怒"这类清楚的态度转折）——只有这种情况才补一条 _.add('角色.姓名.好感度', N)（N 按实际情节合理给正或负）。单纯"某人在场围观/搭话"本身不构成好感变化的理由，战斗对手若只是路人也不必强行给好感度；不要把"这是一场战斗"当成"必须扣某人好感"的默认规则。`,
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
// settleOpts：结算轮专属上下文（目前只用于送礼场景），由 MudRPG.jsx 在 opts.settleKind
// 命中时传入 { settleKind, settleNpc, giftInfo }——双调用模式下好感度判定完全交给
// 提取层，主叙事的散文不产 <mvu>，所以"送礼必须给正向好感"这条铁律必须在这里也落一份，
// 不能只加在 buildSysBase（那边只管单调用/双调用主叙事文风，管不到提取层怎么判好感）。
export async function callExtraction(intentCode, narrative, state, apiCfg, settleOpts = null) {
  // settleKind → 专属提取spec 的映射表。不用 if-else 链一个个判断，是因为这类
  // "结算轮专属spec"以后大概率还会继续加（新的伙伴/新的特殊结算场景），映射表
  // 比继续堆叠 if-else 更容易扩展——加一个新 settleKind 只需要在这张表里加一行。
  const SETTLE_KIND_SPECS = { gift: "GIFT", companion_invite: "COMPANION_INVITE" };
  const settleSpecKey = settleOpts?.settleNpc ? SETTLE_KIND_SPECS[settleOpts?.settleKind] : null;
  // 不能用 || 回退：META_QUERY 显式为 null（本意图不提取状态），
  // null || UNKNOWN 会让它错误地落到 UNKNOWN，使下面的 !spec 判断成为死代码。
  const spec = settleSpecKey
    ? EXTRACTION_SPECS[settleSpecKey]
    : (Object.prototype.hasOwnProperty.call(EXTRACTION_SPECS, intentCode)
      ? EXTRACTION_SPECS[intentCode]
      : EXTRACTION_SPECS.UNKNOWN);
  if (!spec) return null;

  const cfg = buildExtractionCfg(settleSpecKey || intentCode, apiCfg);
  const systemPrompt = spec.system;
  // 公共字段（memory / mentionedNewNpcs）统一拼在每个意图的 user prompt 末尾，
  // 免得在 6 份 schema 里各抄一遍、加一个字段要改六处。
  const userContent = spec.user(narrative, state, settleOpts) + commonExtractTail(state.char?.name);

  const { text } = await callModel(cfg, systemPrompt, [{ role: "user", content: userContent }], { maxTokens: apiCfg.callTokenLimits?.extraction ?? 2000, callLabel: `状态提取(${intentCode})` });

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
