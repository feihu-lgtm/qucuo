// 场记板条目渲染器（WO-05，契约 A）
// ============================================================================
// 场记板是江湖的"事实正本"：每条 ClapboardEntry 记录一件确发生过的事、
// 谁知道它、涉及哪些实体。判官定案、记忆召回、活人切片（后续工单）都从这里取料。
// 本模块三个纯函数：造条目、按视角过滤知情范围、按字数预算渲染成提示词段落。
// 全部纯函数，禁 Date.now / Math.random。

// kind 枚举（契约 A 冻结，严禁自造）：world_law 世界法则 / diegetic_state 体感态势 /
// npc_soul 角色灵魂切片 / raw_memory 原文记忆 / fact_index 事实索引 / pact 江湖契约 /
// nemesis 宿敌 / prep_seed 备料种子 / quest_slip 任务便签。
export const CLAPBOARD_KINDS = [
  "world_law", "diegetic_state", "npc_soul", "raw_memory", "fact_index",
  "pact", "nemesis", "prep_seed", "quest_slip",
];

// 各 kind 的 id 前缀规则（契约 A）：raw_memory 用原文段落号 P<回合>_<段号>，
// pact/prep_seed 用带种类前缀的全形，其余事实类用 F<回合>_<序号>。
const ID_PREFIX = { raw_memory: "P", pact: "pact_", prep_seed: "prep_" };

function deriveId(kind, turn, seq) {
  const t = Number.isInteger(turn) ? turn : 0;
  const s = Number.isInteger(seq) ? seq : 0;
  if (kind === "pact") return `pact_${t}_${s}`;
  if (kind === "prep_seed") return `prep_${t}_${s}`;
  return `${ID_PREFIX[kind] || "F"}${t}_${s}`;
}

// 规范化一条场记板条目。spec 缺 id 时按 kind+turn+seq 推导；
// kind 不在冻结枚举内时降级为 fact_index（宁可在案，不可因错分类丢事实）。
export function createClapboardEntry(spec = {}) {
  const kind = CLAPBOARD_KINDS.includes(spec.kind) ? spec.kind : "fact_index";
  const importance = [1, 2, 3].includes(spec.importance) ? spec.importance : 1;
  return {
    id: typeof spec.id === "string" && spec.id ? spec.id : deriveId(kind, spec.turn, spec.seq),
    kind,
    turn: Number.isInteger(spec.turn) ? spec.turn : 0,
    location: spec.location || "",
    // 空数组或 ["*"] 代表公共常识；非空则仅名单内角色可见。
    witnesses: Array.isArray(spec.witnesses) ? [...spec.witnesses] : [],
    entities: Array.isArray(spec.entities) ? [...spec.entities] : [],
    publicText: spec.publicText || "",
    rawText: spec.rawText || "",
    importance,
  };
}

// 全知视角：player/narrator/主角 看已知全集（原文不动，含他人心理）。
const FULL_VIEWERS = new Set(["player", "narrator", "主角"]);

// 按视角过滤知情范围：
//   · 全知视角 → 原样返回全集；
//   · NPC 视角 → 只看 witnesses 为空（公共常识）、含 "*" 或含自己名字的条目；
//     且 raw_memory 条目只能读 publicText（他人的 *斜体心理* 对他不可见，
//     这里直接把 rawText 覆写成 publicText，下游想泄也泄不出去）。
export function filterEntriesForViewer(entries, viewerName) {
  if (!Array.isArray(entries)) return [];
  if (FULL_VIEWERS.has(viewerName)) return entries.slice();
  return entries
    .filter((e) => {
      const w = e.witnesses;
      if (!Array.isArray(w) || w.length === 0) return true;
      return w.includes("*") || w.includes(viewerName);
    })
    .map((e) => (e.kind === "raw_memory" ? { ...e, rawText: e.publicText } : e));
}

// 把条目渲染成提示词段落，字数预算 budgetChars 内尽量装重要的：
// 按 importance 降序 → turn 降序 → id 字典序排定优先级，顺序装到预算耗尽。
// 一条都装不下返回空串（调用方据此整段不挂，不硬塞）。渲染文本统一取 rawText——
// NPC 视角的条目经 filterEntriesForViewer 后 rawText 已是 publicText，不会泄密；
// rawText 缺失时回退 publicText。
export function renderClapboardSection(entries, budgetChars = 600) {
  if (!Array.isArray(entries) || !entries.length || budgetChars <= 0) return "";
  const ranked = [...entries].sort((a, b) =>
    (b.importance - a.importance) || (b.turn - a.turn) || String(a.id).localeCompare(String(b.id)));
  const lines = [];
  let used = 0;
  for (const e of ranked) {
    const text = e.rawText || e.publicText || "";
    if (!text) continue;
    const line = `【${e.id}】${text}`;
    if (used + line.length > budgetChars) continue;
    lines.push(line);
    used += line.length;
  }
  return lines.join("\n");
}
