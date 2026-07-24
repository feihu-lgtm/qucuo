// 小纸条 · 统一写入（记忆系统地基 · TODO 1）
// ------------------------------------------------------------------
// 这是「写小纸条」的唯一入口：系统和 AI 都走这里，带 owner 参数。
// 设计定稿见 docs/交接_借鉴总结系统.md 第 2 节 & 2.5 节。四类来源日后都接这里：
//   ① 主叙事 AI 吐的 memory  → 公共小纸条（owner 空）
//   ② 对话/私聊              → owner = 对话对象（私聊 = 你俩私有）
//   ③ 哑动作(打坐/练功/内移/交易) → 系统直接写电报体
//   ④ 飞鸽                   → 全文线照旧 + 额外私有小纸条(owner=对方)
//
// 本次（地基第一步）只把「公共小纸条带 owner 写入」跑通——现有主叙事路径改走
// writeNote(owner=[])，schema 里 owner 字段正式立起来。私有召回门（按在场人过滤）、
// 哑动作补记、私聊/飞鸽产条留给后续 TODO，届时只是给 writeNote 传不同 owner，
// 不必再改这层。
//
// owner 三态（全系统枢纽）：
//   owner 空/[]      → 公共见闻，谁都能语义捞（visibility=public）
//   owner 单人       → 私有记忆，只在该人在场/对话/回信时浮现（visibility=private）
//   owner 多人       → 在场者共同目击，相关时浮现（visibility=private，但知情人多个）
// 每个 owner 项：{ name, via }，via ∈ 亲历/目击/传闻（供 AI 判口吻 + 信息隔离）。

import { getEmbedding, embeddingReady, embeddingFingerprint } from "./embeddingService.js";
import { addMemory, getAllMemories } from "./memoryStore.js";

export const VIA = { FIRSTHAND: "亲历", WITNESS: "目击", HEARSAY: "传闻" };
export const NOTE_SOURCE = {
  NARRATIVE: "narrative", // 主叙事 AI 顺手吐
  TALK: "talk",           // 对话模式
  WHISPER: "whisper",     // 私聊旁白/当面私语
  DUMB: "dumb",           // 哑动作系统补记（电报体）
  PIGEON: "pigeon",       // 飞鸽额外产的私有条
};

// 归一化 owner 成 [{name, via}]，按 name 去重、via 缺省"目击"。
// 接受：null / [] / "名字" / ["名字",...] / [{name,via},...] / 混合。
export function normalizeOwner(owner) {
  if (!owner) return [];
  const arr = Array.isArray(owner) ? owner : [owner];
  const seen = new Map();
  for (const o of arr) {
    if (!o) continue;
    const name = typeof o === "string" ? o : o.name;
    if (!name) continue;
    const via = (typeof o === "object" && o.via) ? o.via : VIA.WITNESS;
    if (!seen.has(name)) seen.set(name, { name, via });
  }
  return Array.from(seen.values());
}

// owner 名单 → 可见性档：空=public，单人=private，多人=shared。
export function ownerTier(ownerList) {
  const n = (ownerList || []).length;
  if (n === 0) return "public";
  if (n === 1) return "private";
  return "shared";
}

// 纯函数·私有召回门：一条小纸条此刻是否该对当前语境浮现。
//   owner 非空（私有/共同目击）→ 须 owner 里至少一人在场（presentNames）。
//   owner 空 + 旧 visibility=private（历史 flag 私有）→ 须对应 flag 已解锁。
//   其余（公共）→ 恒可见。
// present/flags 传数组或 Set 均可。抽成纯函数便于 debug.mjs 单测、recall 层直接调。
export function noteVisibleTo(record, { presentNames = [], unlockedFlags = [] } = {}) {
  const owner = Array.isArray(record.owner) ? record.owner : [];
  if (owner.length) {
    const present = presentNames instanceof Set ? presentNames : new Set(presentNames);
    return owner.some(o => o && present.has(o.name));
  }
  if (record.visibility === "private") {
    const flags = unlockedFlags instanceof Set ? unlockedFlags : new Set(unlockedFlags);
    return !!(record.requiredFlag && flags.has(record.requiredFlag));
  }
  return true;
}

// 从摘要里挑出提到的已知实体（人物/地点名），纯字符串包含匹配，不做分词猜测。
// owner 里的人名一律并入 entities——保证私有/共同目击的小纸条日后能被「人路」召回带出。
function extractEntities(text, knownNames = [], ownerList = []) {
  const t = String(text || "");
  const hitInText = knownNames.filter(n => n && t.includes(n));
  const ownerNames = ownerList.map(o => o.name);
  return Array.from(new Set([...hitInText, ...ownerNames]));
}

let _seq = 0;

// 纯函数：拼一条小纸条记录（不含 embedding/fingerprint，便于 debug.mjs 单测）。
// text 为空返回 null。owner/ownerTier/visibility/entities/place/source 都在这里定死。
export function buildNoteRecord({
  text,
  turn = 0,
  owner = [],
  place = null,
  source = NOTE_SOURCE.NARRATIVE,
  knownNames = [],
  seq = 0,
}) {
  const clean = String(text || "").trim();
  if (!clean) return null;
  const ownerList = normalizeOwner(owner);
  const tier = ownerTier(ownerList);
  return {
    id: `mem_${turn}_${Date.now().toString(36)}_${seq}`,
    text: clean,
    turn,
    owner: ownerList,            // 新枢纽字段：知情人名单 [{name,via}]
    ownerTier: tier,             // public|private|shared（冗余存，召回不必重算）
    // 兼容旧召回门：visibility 字段保留。owner 空→public；单人/多人→private。
    // requiredFlag 走 owner 模式后不再需要 flag 门，恒 null（旧结构字段留着不碍事）。
    visibility: tier === "public" ? "public" : "private",
    requiredFlag: null,
    place,                       // 据点名，供「场景路」召回
    source,                      // 来源标签，供日总结/调试区分
    entities: extractEntities(clean, knownNames, ownerList),
    createdAt: Date.now(),
  };
}

// 异步副作用：embedding + 入库。这是「写小纸条」的统一入口。
// fire-and-forget 语义（调用方不必 await）：没开 embedding / 取不到向量 / 库写失败
// 一律静默返回 null，绝不阻断主流程，也不纳入回合回滚（只在成功路径调）。
export async function writeNote({
  cfg,
  text,
  turn = 0,
  owner = [],
  place = null,
  source = NOTE_SOURCE.NARRATIVE,
  knownNames = [],
}) {
  if (!embeddingReady(cfg)) return null;
  const base = buildNoteRecord({ text, turn, owner, place, source, knownNames, seq: _seq++ });
  if (!base) return null;
  try {
    const vec = await getEmbedding(cfg, base.text);
    if (!vec) return null; // 取不到向量就不入库（宁可不存，也不存没向量的死记录）
    const record = {
      ...base,
      embedding: Array.from(vec), // Float32Array → 普通数组，才能进 IndexedDB
      fingerprint: embeddingFingerprint(cfg),
    };
    await addMemory(record);
    return record;
  } catch (err) {
    console.warn("[note] 小纸条入库失败（静默跳过）：", err.message || err);
    return null;
  }
}

// ── 召回前对账：指纹漂移自愈 ──────────────────────────────────────────────────
// 我们的小纸条自带向量、无单独清单，故不存在参考项目那种「孤儿/缺失」二分。
// 我们的对账针对「换 embedding 模型」这一实况：模型一换，指纹(fingerprint)变，
// 老纸条在 recallWithVisibility 里被 `m.fingerprint === fp` 过滤掉、永远召不回、白占库。
// 对账 = 把指纹过期的老纸条用当前模型重算向量、写回（补），让记忆不因换模型而永久失联。
// 不做删除：宁可暂时召不回，也绝不丢记忆（重算失败就留着，下回合再试）。

// 纯函数：从一批记录里挑出「有文本、但指纹与当前不符」的（可 debug.mjs 单测）。
export function findStaleNotes(notes, fingerprint) {
  return (notes || []).filter(n => n && n.text && n.fingerprint !== fingerprint);
}

// 有界重嵌：每次最多重算 maxPerRun 条指纹过期的纸条（后台自愈，不阻断游戏）。
// fire-and-forget 调用；没开 embedding、无过期条、失败一律静默返回已处理数。
export async function reembedStaleNotes({ cfg, maxPerRun = 3 }) {
  if (!embeddingReady(cfg)) return 0;
  try {
    const fp = embeddingFingerprint(cfg);
    const all = await getAllMemories();
    const stale = findStaleNotes(all, fp).slice(0, maxPerRun);
    let n = 0;
    for (const rec of stale) {
      const vec = await getEmbedding(cfg, rec.text);
      if (!vec) continue;
      await addMemory({ ...rec, embedding: Array.from(vec), fingerprint: fp }); // 同 id 覆盖
      n++;
    }
    return n;
  } catch {
    return 0;
  }
}
