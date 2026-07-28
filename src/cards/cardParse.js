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

// ── 常量 ──────────────────────────────────────────────────────────────────────

// SillyTavern 世界书条目的内部位置枚举（entry.extensions.position）
export const ST_POSITION = {
  0: "before_char",
  1: "after_char",
  2: "an_top",
  3: "an_bottom",
  4: "at_depth",
  5: "em_top",
  6: "em_bottom",
};

// entry.extensions.role
export const ST_ROLE = { 0: "system", 1: "user", 2: "assistant" };

// ST 内部位置 → 本项目 13 位注入块（见 tavernMapping.js）
// at_depth 的落点取决于 depth：depth 0 是贴在最末的关键指令，本项目 13 号位是
// JSON schema 的 assistant prefill，塞不得（见 sysBase.js 顶部那段），所以一律
// 落到 11 号位 inChat。
export const POSITION_TO_BLOCK = {
  before_char: "worldInfoBefore",
  after_char: "worldInfoAfter",
  an_top: "authorsNote",
  an_bottom: "authorsNote",
  at_depth: "inChat",
  em_top: "dialogueExamples",
  em_bottom: "dialogueExamples",
};

// 单条长度闸（字符）。超上限拒收，超警戒线标记为需手动确认。
export const ENTRY_LEN_WARN = 2000;
export const ENTRY_LEN_MAX = 8000;

// keys 元素内部的分隔符（F14）
const KEY_SPLIT_RE = /[，,、;；\/／|｜]+/;

// keys/正文里的宏（F15）
const MACRO_RE = /\{\{\s*(user|char)\s*\}\}|<\s*(user|char|bot)\s*>/gi;

// 装饰器行（F18）
const DECORATOR_RE = /^@{2,3}\s*(\S+)(?:\s+(.*))?$/;

// 抗拒绝 / 越狱类条目的识别词（R4）。命中只做标记，不改内容。
const JAILBREAK_HINTS = [
  "抗拒绝", "防拒绝", "拒绝回答", "抗绝望", "防机器人", "破甲", "越狱",
  "不得拒绝", "不能拒绝", "jailbreak", "uncensor", "bypass",
];

// NSFW 条目识别词（R5）
const NSFW_HINTS = ["nsfw", "r18", "18+", "涩涩", "色色", "情色", "性爱", "床戏"];

// ── 载体读取 ──────────────────────────────────────────────────────────────────

function bytesToLatin1(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

// base64 → UTF-8 字符串。浏览器走 atob + TextDecoder，Node 走 Buffer。
function b64ToUtf8(b64) {
  const clean = b64.replace(/\s+/g, "");
  if (typeof atob === "function") {
    const bin = atob(clean);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(arr);
  }
  // eslint-disable-next-line no-undef
  return Buffer.from(clean, "base64").toString("utf-8");
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPng(bytes) {
  if (!bytes || bytes.length < 8) return false;
  return PNG_MAGIC.every((b, i) => bytes[i] === b);
}

/**
 * 读出 PNG 里的全部文本 chunk。
 * zTXt 需要 inflate，浏览器端没有内置同步 inflate，所以这里只记录它的存在、
 * 不解压（实测 8 张卡全部用 tEXt，没有一张用 zTXt，属于理论分支）。
 * @returns {{texts: Record<string,string>, zipped: string[]}} texts 的值是 latin1 原文
 */
export function readPngTextChunks(bytes) {
  if (!isPng(bytes)) throw new Error("不是 PNG 文件");
  const texts = {};
  const zipped = [];
  let i = 8;
  while (i + 8 <= bytes.length) {
    const len = (bytes[i] << 24 | bytes[i + 1] << 16 | bytes[i + 2] << 8 | bytes[i + 3]) >>> 0;
    const type = bytesToLatin1(bytes.subarray(i + 4, i + 8));
    if (type === "IEND") break;
    if (type === "tEXt" || type === "zTXt") {
      const body = bytes.subarray(i + 8, i + 8 + len);
      const zero = body.indexOf(0);
      if (zero > 0) {
        const kw = bytesToLatin1(body.subarray(0, zero));
        if (type === "tEXt") texts[kw] = bytesToLatin1(body.subarray(zero + 1));
        else zipped.push(kw);
      }
    }
    i += 12 + len;
  }
  return { texts, zipped };
}

/**
 * 从 PNG 字节里取出角色卡 JSON。
 * F1：只认 keyword 精确等于 ccv3/chara。F2：两个都在时用 ccv3。
 */
export function extractCardJsonFromPng(bytes) {
  const { texts, zipped } = readPngTextChunks(bytes);
  const hasCcv3 = Object.prototype.hasOwnProperty.call(texts, "ccv3");
  const hasChara = Object.prototype.hasOwnProperty.call(texts, "chara");
  if (!hasCcv3 && !hasChara) {
    const found = Object.keys(texts).concat(zipped);
    const err = new Error(
      found.length
        ? `这张 PNG 里没有角色卡数据（只有 ${found.join("/")} 这些无关的文本块，多半是 AI 出图的元数据）`
        : "这张 PNG 里没有任何文本块，是一张普通图片"
    );
    err.code = "NOT_A_CARD";
    err.chunks = found;
    throw err;
  }
  const raw = hasCcv3 ? texts.ccv3 : texts.chara;
  // latin1 字符串本身就是 base64 的 ASCII 内容，直接解
  return {
    json: b64ToUtf8(raw),
    carrier: {
      hasCcv3, hasChara,
      used: hasCcv3 ? "ccv3" : "chara",
      // F3：只有 chara 时是 V2 载体，但这不代表内容是 V2，spec 字段要另读
      carrierGeneration: hasCcv3 ? "v3" : "v2",
    },
  };
}

// ── 脏值清洗 ──────────────────────────────────────────────────────────────────

/** F14：把 keys 里逗号连写的元素切开，去重去空。返回 {keys, dirty} */
export function splitKeys(rawKeys) {
  const out = [];
  const dirty = [];
  for (const k of (Array.isArray(rawKeys) ? rawKeys : [])) {
    if (typeof k !== "string") continue;
    const t = k.trim();
    if (!t) continue;
    if (KEY_SPLIT_RE.test(t)) {
      dirty.push(t);
      for (const part of t.split(KEY_SPLIT_RE)) {
        const p = part.trim();
        if (p) out.push(p);
      }
    } else {
      out.push(t);
    }
  }
  return { keys: Array.from(new Set(out)), dirty };
}

/** F15/CBS：展开 {{user}} {{char}} <user> <char> <bot>。names 缺省时原样保留。 */
export function expandMacros(text, names = {}) {
  if (typeof text !== "string" || !text) return text || "";
  const user = names.user || "";
  const char = names.char || "";
  return text.replace(MACRO_RE, (m, g1, g2) => {
    const which = (g1 || g2 || "").toLowerCase();
    if (which === "user") return user || m;
    if (which === "char" || which === "bot") return char || m;
    return m;
  });
}

/**
 * F18：剥离 content 开头的装饰器行，连同前后空行。
 * 规范说装饰器必须在进 prompt 前去掉；这里同时把解析出的装饰器回传，
 * 万一以后遇到真用装饰器的卡，@@position / @@role / @@depth 可以接上。
 */
export function stripDecorators(content) {
  if (typeof content !== "string" || !content) return { content: "", decorators: [] };
  const lines = content.split("\n");
  const decorators = [];
  const kept = [];
  let stillHeader = true;
  for (const line of lines) {
    const t = line.trim();
    if (stillHeader && t.startsWith("@@")) {
      const m = t.match(DECORATOR_RE);
      if (m) {
        decorators.push({
          name: m[1].replace(/^@+/, ""),
          value: (m[2] || "").trim(),
          fallback: t.startsWith("@@@"),
        });
        continue;
      }
    }
    if (stillHeader && !t) {
      // 装饰器区里的空行跟着一起吃掉，直到出现正文
      if (decorators.length && kept.length === 0) continue;
    }
    if (t) stillHeader = false;
    kept.push(line);
  }
  return { content: kept.join("\n").trim(), decorators };
}

function hitAny(text, hints) {
  const low = (text || "").toLowerCase();
  return hints.find(h => low.includes(h.toLowerCase())) || null;
}

// ── 条目分类建议 ──────────────────────────────────────────────────────────────
// 【为什么只是"建议"而不是判定】实测跑完 8 张卡后发现，光看 keys 根本分不出
// 人物和势力：断法大陆的「人类（别名 瓦兰迪亚/王国/骑士/公爵）」和封神异闻录的
// 「金灵圣母（别名 师尊）」在数据形状上一模一样，都是 keys[0]+别名。真正的线索
// 在 comment 的命名习惯里，而每个作者的习惯都不同。所以这里出的是建议，最终
// 去向必须由玩家在导入界面逐条指派——机器猜错一条，就会把一个门派当人写活。
const KIND_RULES = [
  // 玩家自身：keys 里带 user 宏，或 comment 直接写 <user>
  { kind: "player", test: (l, k) => /<\s*user\s*>|\{\{\s*user\s*\}\}/i.test(l) || k.some(x => /<\s*user\s*>|\{\{\s*user\s*\}\}/i.test(x)) },
  // 框架/格式类：这类不该进世界观，多半要丢或转成引擎自己的规则
  { kind: "meta", test: (l) => /回复格式|输出格式|状态栏|变量|initvar|cot|深度思考|叙事核心|叙事规范|双语|格式增强|防止掉格式|协议/i.test(l) },
  // 规则/机制
  // 「规律/处境/逻辑/体系/共主」这几个词是实测补的：断法大陆的「混血儿·处境与
  // 能力规律」和封神异闻录的「人间共主」，光看形状跟人物条目一模一样，靠这些
  // 词才分得开——否则一个种族规律会被当活人写进叙事。
  { kind: "rule", test: (l) => /铁律|规则|设定-|机制|境界|实力|礼仪|斗法|法宝|阵法|技术|时代背景|好感|规律|处境|逻辑|体系|共主|国运/i.test(l) },
  // 势力/种族/组织
  { kind: "faction", test: (l) => /势力|种族|门派|宗门|邦联|汗国|城邦|教会|学士会|王朝|王国|帮派/i.test(l) },
  // 地点
  { kind: "place", test: (l) => /地点|地理|王都|城|关$|雄关|福地|山$|岛$|林地|场域|空间|市$|村$|镇$/i.test(l) },
  // 资源/物品
  // 注意「衣柜」不在这里：实测春明子和逐玉两张卡都有「衣柜」条目，写的是角色
  // 平时穿什么，属于人物外貌设定而不是物品清单，放 item 会把角色拆散。
  { kind: "item", test: (l) => /资源|物品|装备|武器|铠甲|矿|钢材/i.test(l) },
  // 人物：放最后，前面都没命中才当人。
  // 第二个判据要求 label 严格长于 keys[0]：「埃德蒙四世·瓦兰迪亚」「齐旻性格」
  // 这种是"名字+修饰"，能确认在描述一个具名对象；而 label 与 keys[0] 完全相同
  // 时（「人间共主」「三霄」）标签没提供任何额外信息，宁可判不出来交给玩家，
  // 也不要猜——猜错的代价是让 AI 把一个概念当人演。
  { kind: "person", test: (l, k) => /人物|角色|主角|次要角色|主要角色|性格|画像|二次解释|衣柜|外貌|容貌|身材/i.test(l)
      || (k[0] && k[0].length >= 2 && l !== k[0] && l.includes(k[0])) },
];

export function classifyEntry(label, keys) {
  for (const r of KIND_RULES) {
    if (r.test(label || "", keys || [])) return r.kind;
  }
  return "unknown";
}

// ── 条目归一 ──────────────────────────────────────────────────────────────────

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
    kind,                                // 分类建议，非判定（见 KIND_RULES 上方注释）
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
 * F16：把 keys 完全相同的多条合并成一条候选 npcLore。
 * 逐玉那种「一个角色四条（性格/衣柜/二次解释/nsfw）keys 全一样」的写法，
 * 直接导进去会变成四个同名 npcLore 条目，matchNpcLore 一命中全亮。
 * 合并时保留各段的小标题，NSFW 段单独拆出来交给 nsfwOn 开关（R5）。
 */
export function groupEntriesByKeys(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!e.keys.length) continue;
    const sig = e.keys.slice().sort().join("\u0000");
    if (!map.has(sig)) map.set(sig, []);
    map.get(sig).push(e);
  }
  const groups = [];
  for (const [, list] of map) {
    if (list.length === 1) {
      groups.push({ keys: list[0].keys, parts: list, merged: false });
      continue;
    }
    groups.push({
      keys: list[0].keys,
      parts: list.slice().sort((a, b) => a.order - b.order),
      merged: true,
    });
  }
  return groups;
}

/**
 * 把一个 keys 分组转成 npcLore 形状 {name, aliases, entry}。
 * 约定：keys[0] 当本名，其余当别名——实测这是中文卡的普遍写法
 * （封神异闻录 ['三霄娘娘','云霄','碧霄','琼霄']、断法大陆 ['雷纳德','格雷公爵',…]）。
 * 注意这只是「候选」，本名到底是哪个仍应让玩家在导入界面确认：有些条目一条塞
 * 好几个人（封神异闻录的「次要角色」2129 字里有五六个人名），机器分不开。
 */
export function groupToNpcLore(group, { includeNsfw = false } = {}) {
  const parts = group.parts.filter(p => includeNsfw || !p.flags.includes("NSFW"));
  if (!parts.length) return null;
  const body = parts
    .map(p => (parts.length > 1 ? `【${p.label}】\n${p.content}` : p.content))
    .join("\n");
  return {
    name: group.keys[0],
    aliases: group.keys.slice(1),
    entry: body,
    // 供 UI 展示：这条是几段合出来的、总共多长、含哪些风险
    _meta: {
      mergedFrom: parts.map(p => p.label),
      length: body.length,
      flags: Array.from(new Set(parts.flatMap(p => p.flags))),
      multiPerson: group.keys.length > 3, // 启发式：keys 太多可能一条塞了多人
    },
  };
}

// ── 卡级归一 ──────────────────────────────────────────────────────────────────

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

// ── 风险体检 ──────────────────────────────────────────────────────────────────

/**
 * 给出「这张卡能不能导、要拒什么」的结论。不改数据，只出报告。
 */
export function assessCard(card) {
  const es = card.entries;
  const n = es.length;
  const lens = es.map(e => e.length);
  const nonEmpty = lens.filter(x => x > 0);
  const medianLen = n ? lens.slice().sort((a, b) => a - b)[Math.floor(n / 2)] : 0;

  const blockers = [];
  const warnings = [];

  // R1 骨架卡：三个信号同时成立才判，避免误伤正常的小卡
  const allDisabled = n > 0 && es.every(e => !e.enabled);
  const mostlyEmpty = n > 0 && nonEmpty.length / n < 0.5;
  const helperHeavy = !!(card.scripts.tavernHelper && card.scripts.tavernHelper.size > 100000);
  if ((allDisabled && mostlyEmpty) || (mostlyEmpty && helperHeavy) || (card.nameIsMacro && mostlyEmpty)) {
    blockers.push({
      code: "SKELETON_CARD",
      msg: "这是一张模具卡（世界书条目大多为空、或整体关闭、或名字是宏），"
        + "内容要靠配套的预设和前端脚本在运行时生成。本引擎导入它只会得到一堆空条目。",
    });
  }

  // R3 脚本
  if (card.scripts.remoteImport) {
    warnings.push({
      code: "REMOTE_SCRIPT",
      msg: `卡里的前端脚本会从远程地址拉代码执行（${card.scripts.tavernHelper?.size} 字符）。`
        + "本引擎不执行任何卡内脚本，这部分会被完整忽略。",
    });
  } else if (card.scripts.tavernHelper || card.scripts.regexScripts) {
    warnings.push({
      code: "SCRIPT_IGNORED",
      msg: `卡里带 ${card.scripts.regexScripts} 条正则脚本`
        + `${card.scripts.tavernHelper ? " 和一套酒馆助手界面" : ""}，本引擎不支持，已忽略。`,
    });
  }
  if (card.scripts.otherExtensionKeys.length) {
    warnings.push({
      code: "UNKNOWN_EXTENSION",
      msg: `卡里有本引擎不认识的第三方扩展数据：${card.scripts.otherExtensionKeys.join("、")}，已忽略。`,
    });
  }

  // R2 超长
  const tooLong = es.filter(e => e.flags.includes("TOO_LONG"));
  if (tooLong.length) {
    warnings.push({
      code: "ENTRY_TOO_LONG",
      msg: `有 ${tooLong.length} 条超过 ${ENTRY_LEN_MAX} 字（最长 ${Math.max(...tooLong.map(e => e.length))} 字）。`
        + "一条命中就会顶穿单轮的 token 预算，默认不导入，需要的话请手动挑段落。",
      entries: tooLong.map(e => ({ label: e.label, length: e.length })),
    });
  }

  // R4 抗拒绝
  const jb = es.filter(e => e.flags.includes("JAILBREAK"));
  if (jb.length) {
    warnings.push({
      code: "JAILBREAK_ENTRY",
      msg: `有 ${jb.length} 条像是用来压制模型拒绝行为的指令。它们会跟本引擎自己的`
        + "身份声明和文体铁律抢方向盘，默认关闭。",
      entries: jb.map(e => ({ label: e.label, hint: e.jailbreakHint, length: e.length })),
    });
  }

  // R5 NSFW
  const nsfw = es.filter(e => e.flags.includes("NSFW"));
  if (nsfw.length) {
    warnings.push({
      code: "NSFW_ENTRY",
      msg: `有 ${nsfw.length} 条是成人向内容，原卡里它们无条件常驻。`
        + "导入后会改为挂在本引擎的开关下，关着就一个字不发。",
      entries: nsfw.map(e => ({ label: e.label, length: e.length })),
    });
  }

  // F14 脏 keys
  const dirty = es.filter(e => e.flags.includes("DIRTY_KEYS"));
  if (dirty.length) {
    warnings.push({
      code: "DIRTY_KEYS",
      msg: `有 ${dirty.length} 条的关键词把多个名字用逗号写在了一格里`
        + "（在酒馆里这样写其实永远匹配不上，作者多半没发现）。导入时已自动拆开。",
      entries: dirty.map(e => ({ label: e.label, raw: e.keysDirty })),
    });
  }

  // 死条目
  const dead = es.filter(e => e.flags.includes("DEAD"));
  if (dead.length) {
    warnings.push({
      code: "DEAD_ENTRY",
      msg: `有 ${dead.length} 条既没有关键词也不是常驻，在原卡里就永远不会被触发。`,
      entries: dead.map(e => ({ label: e.label, length: e.length })),
    });
  }

  // F10 位置冲突（只报数，解析已按 extensions 为准处理）
  const conflict = es.filter(e => e.positionConflict);
  if (conflict.length) {
    warnings.push({
      code: "POSITION_CONFLICT",
      msg: `有 ${conflict.length} 条的规范位置与酒馆内部位置不一致，已按内部位置为准。`,
    });
  }

  // 六字段是否可用作兜底
  const f = card.fields;
  const usableFields = Object.entries(f).filter(([, v]) => v && v.length > 20).map(([k]) => k);

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    stats: {
      entries: n,
      entriesEmpty: n - nonEmpty.length,
      totalLength: lens.reduce((a, b) => a + b, 0),
      maxLength: n ? Math.max(...lens) : 0,
      medianLength: medianLen,
      alwaysOn: es.filter(e => e.alwaysOn).length,
      openings: card.openings.length,
      usableFields,
    },
  };
}

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
