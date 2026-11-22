// 角色卡解析器（SillyTavern / RisuAI 通用格式 → 曲措乡内部结构）
// ============================================================================
// 【职责边界】本模块只做「读懂并归一化」，不做决定：
//   · 做：认出载体、解出 JSON、归一字段、清洗脏值、给出分类建议与风险清单
//   · 不做：决定每条去 npcLore 还是 scenario（交导入 UI 让玩家逐条指派）
//   · 不做：执行卡里的任何脚本（见 R3）
//   · 不做：调 AI 抽数值（那是 cardToChar.js 的活）
// 纯函数、零依赖、可单测。
//
// 【为什么这么多容错】下面每条 F-* / R-* 都不是照规范推的，而是拿 8 张真卡
// （142 条世界书条目）实测出来的。规范和现实差得很远，照 SPEC_V3 直写会漏一半。
// 实测样本：断法大陆36 / 万象枢机28 / 魔门宗主萧月寒18 / 哀鸿城破十日记15 /
//          逐玉15 / Anon London13 / 封神异闻录12 / 春明子5
//
// ── 载体与版本 ──
// F1 只认 keyword 精确等于 ccv3 或 chara 的 tEXt/zTXt chunk。NovelAI/ComfyUI 出的
//    图同样带 tEXt（Description/Comment/Software/Source/Title），扫到文本就解会炸。
//    也不能用文件大小判断：实测 NovelAI 图 1.78MB > 多数真卡。
// F2 两个 chunk 都在时优先 ccv3（规范要求）。实测 7/7 双 chunk 卡的两份字节完全
//    相同，所以这个分支实际无差别，但按规范走没成本。
// F3 载体形态与 spec 字段互不相干：实测「哀鸿城破十日记」只有 chara chunk（V2 载体），
//    JSON 里 spec 却写着 chara_card_v3/3.0。两者必须分别读，谁也别推谁。
//
// ── 卡级字段 ──
// F4 六个经典文本字段全部可空，得逐个兜底。实测填充率：character_book 8/8、
//    first_mes 7/8、description 3/8、personality 1/8、scenario 1/8、mes_example 1/8、
//    system_prompt 0/8、post_history_instructions 0/8、creator_notes 0/8。
//    所以 character_book 才是主入口，六字段是兜底而不是相反。
// F5 first_mes 可以为空（春明子 0 字），此时开场白要从 alternate_greetings 取。
//    两种流派量级差 10 倍：封神异闻录 6 个长开场(1878~3038字)、逐玉 7 个短开场(264~422字)。
// F6 卡级 extensions 可以整个为空（哀鸿城破十日记），depth_prompt / tavern_helper
//    都可能是 undefined。
// F7 tavern_helper 类型不一致：Anon London 是数组，其余是 {scripts,variables} 对象。
// F8 V3 新增字段（assets / nickname / source / creator_notes_multilingual）实测
//    0/8 使用率，读了也基本是空，但仍保留读取以便将来。
// F9 name 可能是宏而不是名字：万象枢机的 name 就是字面量 "{{char}}"（模具卡）。
//
// ── 世界书条目 ──
// F10 真位置在 entry.extensions.position（数字枚举），不在规范层的 position 字段。
//     规范层只有 before_char/after_char 两个值，表达不了 @Depth，是有损降级产物。
//     实测 142 条里 22 条（15%）两者打架，断法大陆一张就有 13 条错位。冲突时信 extensions。
// F11 entry.extensions 的键数不固定：实测见过 21 / 30 / 31 三种。一律 .get 式兜底，
//     不能假设任何键存在。
// F12 use_regex 和 selective 都不可信也不恒定：use_regex 127/142(89%) 为真，但
//     「哀鸿城破十日记」15/15 全为假。所以既不能无视也不能照办。判定常驻的正确
//     优先级是：keys 为空且 constant → 常驻，不看 use_regex（照规范办的话，
//     use_regex=true 会要求忽略 constant，那些 keys 为空的常驻条目就永不命中，
//     整个世界观注入不进去）。
// F13 secondary_keys 实测 0/142 非空，所以 selective 实际上从来没生效过，忽略即可。
// F14 keys 元素里可能塞了多个名字，用中文逗号连写：逐玉全卡 keys=['齐旻，阿旻']。
//     ST 会把整串当一个关键词，除非原样出现否则永不命中——原作者发现不了，因为
//     那些条目都是 constant=true，照样常驻。必须按 ，,、;；／/ 再切一次。
//     这一条直接影响 worldbook.js 的 mentioned 判定（scanText.includes(整串) 恒假）。
// F15 keys 元素里可能是宏：封神异闻录的玩家条目 keys=['<user>']。匹配前必须展开。
// F16 同一角色常被拆成多条、keys 完全相同（逐玉：某角色的 二次解释/基础和衣柜/
//     性格/nsfw 四条共 3399 字）。而 npcLore 是一人一条，需按 keys 分组合并。
// F17 单条可以极长：实测最长 29492 字，>10000 字的有 6 条。一条命中就顶穿 token
//     预算，必须设闸。
// F18 V3 的 @@装饰器 实测 0/142 使用（ST 走 extensions 不走装饰器语法），但仍做
//     防御性剥离——规范要求装饰器在进 prompt 前连同前后空行一起去掉，漏了会把
//     "@@depth 4" 当正文喂给模型。
//
// ── 必须拒绝的东西 ──
// R1 骨架卡（模具而非成品）：万象枢机 28 条 content 中位数 0、enabled 全 false、
//    name 是宏、tavern_helper 占卡体积一半。硬吃只会得到一堆空条目。
// R2 超长条目：见 F17。
// R3 前端脚本：tavern_helper / regex_scripts 一律不执行。万象枢机那份脚本 41 万字
//    且 content 里 import 远程 URL——执行等于从第三方地址拉任意 JS 跑在用户机器上。
// R4 抗拒绝类条目：断法大陆有一条 2307 字专门压制模型的拒绝行为。它会跟本项目的
//    ENGINE_IDENTITY 和文体铁律抢方向盘，默认关闭并列进清单交玩家定。
// R5 NSFW 条目：原卡里常是 constant=true 无条件注入（逐玉两条各 1029/1077 字）。
//    本项目有 nsfwOn 开关与 bodyProfile 私密层硬条件，导入时一律挂到开关门下，
//    不照抄它的 constant，否则分层点灯被绕过去。

import { extractCardJsonFromPng } from "./cardParse/carrier.js";
import { expandMacros } from "./cardParse/clean.js";
import { normalizeCard } from "./cardParse/normalize.js";
import { assessCard } from "./cardParse/assess.js";
import { groupEntriesByKeys, groupToNpcLore } from "./cardParse/group.js";

export { isPng } from "./cardParse/carrier.js";
export { groupEntriesByKeys, groupToNpcLore } from "./cardParse/group.js";

// ── 主入口 ────────────────────────────────────────────────────────────────────

/**
 * 解析一张角色卡。
 * @param {Uint8Array|string} input PNG 字节，或卡 JSON 文本
 * @param {object} opts { playerName, charName } 用于展开宏
 * @returns {{card, report, npcLoreCandidates}}
 */
export function parseCharacterCard(input, opts = {}) {
  let rawJson;
  let carrier = { used: "json", carrierGeneration: "json", hasCcv3: false, hasChara: false };

  if (typeof input === "string") {
    rawJson = input;
  } else {
    const out = extractCardJsonFromPng(input);
    rawJson = out.json;
    carrier = out.carrier;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    const err = new Error("角色卡里的数据不是合法 JSON，文件可能已损坏");
    err.code = "BAD_JSON";
    throw err;
  }

  // 同一个 .json 后缀下混着三种东西，先认清是哪种（实测踩过：把一份 138 条
  // prompts 的酒馆预设当成卡分析了）
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    if (parsed.prompts && parsed.prompt_order) {
      const err = new Error(
        `这是一份酒馆预设（${(parsed.prompts || []).length} 条 prompts），不是角色卡。`
        + "预设请走「预设管理」里的导入。"
      );
      err.code = "IS_PRESET";
      throw err;
    }
    const body = (typeof parsed.data === "object" && parsed.data) || parsed;
    if (parsed.entries && !body.name) {
      const n = Array.isArray(parsed.entries) ? parsed.entries.length : Object.keys(parsed.entries).length;
      const err = new Error(`这是一本独立世界书（${n} 条），不是角色卡。`);
      err.code = "IS_LOREBOOK";
      throw err;
    }
  }

  const card = normalizeCard(parsed, carrier);
  const report = assessCard(card);

  // 宏展开：keys 与正文都做（F15）。名字缺省时原样保留，不塞空串。
  // 注意顺序：normalizeEntry 已经把展开前的 keys 存进 keysRaw 了，分类也已按
  // 原始形态判过，所以这里展开不会影响 kind。
  const names = { user: opts.playerName || "", char: opts.charName || card.name || "" };
  for (const e of card.entries) {
    e.keys = e.keys.map(k => expandMacros(k, names));
    e.content = expandMacros(e.content, names);
  }
  card.openings = card.openings.map(s => expandMacros(s, names));

  // ── 候选分流 ──
  // 只有分类建议为 person / unknown 的才进 npcLore 候选。此前不分类，结果
  // 「人类（别名 瓦兰迪亚/王国/骑士/公爵）」这种种族条目和「金灵圣母」一起
  // 被当人物导进去了，一注入就等于让 AI 把一个种族当活人写。
  const alive = card.entries.filter(
    e => !e.dead && !e.flags.includes("TOO_LONG") && e.content
  );

  // 玩家自身设定：原卡靠 <user> 宏触发，去向是 7 号位 persona，不是 npcLore
  const personaEntries = alive.filter(e => e.kind === "player");
  const personaCandidate = personaEntries.length
    ? personaEntries.map(e => e.content).join("\n\n")
    : "";

  // 只有明确判为 person 的才进 npcLore。分不出来的一律进 unclassified 让玩家指派——
  // 实测让 unknown 默认进 npcLore 的后果是「西周」「人间共主」这类被当成活人。
  const forNpc = alive.filter(e => e.keys.length && e.kind === "person");
  const npcLoreCandidates = groupEntriesByKeys(forNpc)
    .map(g => groupToNpcLore(g, { includeNsfw: false }))
    .filter(Boolean);

  const unclassified = alive
    .filter(e => e.kind === "unknown")
    .map(e => ({ label: e.label, keys: e.keys, length: e.length, constant: e.constant }));

  // 世界观/规则类：这些该去 scenario 分段，按建议落点归拢
  const worldCandidates = alive
    .filter(e => ["faction", "place", "rule", "item"].includes(e.kind))
    .map(e => ({ label: e.label, kind: e.kind, keys: e.keys, content: e.content, block: e.suggestBlock }));

  // 框架/格式类：默认不导入，列出来让玩家看见都有什么
  const metaEntries = alive
    .filter(e => e.kind === "meta")
    .map(e => ({ label: e.label, length: e.length }));

  return { card, report, npcLoreCandidates, personaCandidate, worldCandidates, metaEntries, unclassified };
}

export default parseCharacterCard;
