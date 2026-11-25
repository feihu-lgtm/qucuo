// WO-17 正文按段切分器 + 他人斜体心理剥离
// ------------------------------------------------------------------
// 把主叙事正文按自然段切成契约 A 的 ProseChunk（kind:"raw_memory"）。
// 纯函数，禁 Date.now/Math.random；witnesses/location/turn 一律由调用方
// 从系统上下文喂入，本模块不信任何模型自证字段。

// 锚点标记 ⟦F…⟧ 玩家不可见，入段落库前剥除；锚点与段落的对应关系进 anchorFactIds。
const ANCHOR_RE = /⟦(F\d+_\d+)⟧/g;

// 斜体心理段：*…*（不跨段、不含星号）。格式本身无主语——归属只能靠上下文推断。
const ITALIC_RE = /\*([^*\n]+)\*/g;

// 视角人证据：第二人称与玩家通称；他人证据：第三人称代词/心理想法动词。
// 注意「我」不作证据——心理段内本来就是第一人称自述，谁的心理都一样。
const VIEWER_HINTS = ["你", "少侠"];
const OTHER_HINTS = ["他", "她", "它", "他们", "她们", "它们", "心想", "暗想", "暗道", "寻思", "腹诽", "默念"];

// 在斜体段前的窗口内找最近的归属证据。返回 "viewer"|"other"|null。
// 名字证据：viewerName 命中算 viewer；他人名字无法无表识别——但「X+心想/暗道」
// 句式里动词本身是 other 强证据，已含在 OTHER_HINTS。
function attributeItalic(before, viewerName) {
  const window = before.slice(-24);
  let best = null;
  let bestDist = Infinity;
  const scan = (hints, kind) => {
    for (const hint of hints) {
      const idx = window.lastIndexOf(hint);
      if (idx >= 0) {
        const dist = window.length - idx;
        if (dist < bestDist) { bestDist = dist; best = kind; }
      }
    }
  };
  scan([viewerName, ...VIEWER_HINTS].filter(Boolean), "viewer");
  scan(OTHER_HINTS, "other");
  return best;
}

// 剥除非视角人物的 *斜体心理*，只保留可见言行。
// 口径（拿不准保留——剥掉的原文永不可恢复）：
//   1. 归属证据明确是他人（第三人称代词/心理动词更近）→ 剥；
//   2. 归属证据明确是视角人（viewerName/你/少侠更近）→ 留；
//   3. 无证据/证据平局 → 留。
// viewerName 为空时视作旁白/玩家视角通称处理。
export function stripOtherInnerThoughts(text, viewerName = "") {
  const src = String(text || "");
  let out = "";
  let cursor = 0;
  for (const match of src.matchAll(ITALIC_RE)) {
    const start = match.index;
    const attribution = attributeItalic(src.slice(0, start), viewerName);
    out += src.slice(cursor, start);
    if (attribution !== "other") {
      out += match[0]; // 视角人或无归属：保留原文（含星号标记）
    }
    cursor = start + match[0].length;
  }
  out += src.slice(cursor);
  // 剥除后可能留下连续空格/孤 punctuation 前空白，轻度归整（不改字）
  return out.replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ");
}

// 按自然段切分正文为契约 A ProseChunk[]。
//   rawProse     正文原文（可含 ⟦F⟧ 锚点与 *斜体*）
//   turn/location/witnesses 系统上下文（必传，witnesses 数组或 ["*"]）
//   anchoredFacts 本回合判官 facts id 列表（可选）——段落文本里埋了哪个锚就索引哪个
// 产出字段：id/kind/turn/location/witnesses/entities/publicText/rawText/importance/anchorFactIds
// entities 迁移期只收 witnesses 中的人名（实体编号归 WO-18 检索期细化）；
// importance 粗分：段落带锚点事实=2（要紧），否则 1（寻常）。
export function splitProseIntoChunks(rawProse, { turn, location, witnesses = [], anchoredFacts = [] } = {}) {
  const prose = String(rawProse || "");
  if (!prose.trim()) return [];
  const paragraphs = prose.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
  const factSet = new Set(anchoredFacts || []);
  const chunks = [];
  let seq = 0;
  for (const para of paragraphs) {
    seq += 1;
    const anchorIds = [];
    const stripped = para.replace(ANCHOR_RE, (_, fid) => {
      anchorIds.push(fid);
      return "";
    }).replace(/⟦⟧/g, "").trim();
    if (!stripped) continue; // 整段只有锚点/空白，不成段
    const anchored = anchorIds.filter((fid) => !factSet.size || factSet.has(fid));
    chunks.push({
      id: `P${turn}_${seq}`,
      kind: "raw_memory",
      turn,
      location: location || "",
      witnesses: Array.isArray(witnesses) && witnesses.length ? [...witnesses] : ["*"],
      entities: (Array.isArray(witnesses) ? witnesses : []).filter((w) => w && w !== "*" && w !== "主角"),
      publicText: stripOtherInnerThoughts(stripped, "主角"),
      rawText: stripped,
      importance: anchored.length ? 2 : 1,
      anchorFactIds: anchorIds,
    });
  }
  return chunks;
}
