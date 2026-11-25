// ============================================================================
// 人物旧账 —— 每个具名 NPC 的小账本，挂在 varTree.角色[name].旧账
// ----------------------------------------------------------------------------
// 记的是"这个人与少侠之间的客观旧账"：恩怨、人情、承诺、怒气缘由。
// 由回合末的记账调用（domain/memory/bookkeep.js）逐轮追加，
// 旁白/私语需要时可取出念给当事人听（"你忘了？上月你在村口……"）。
// 纯函数、不可变更新，旧存档没有该字段也能正常读写。
// ============================================================================

import { merge } from "../state/applyPatches.js";

export const LEDGER_MAX_LINES = 5; // 每人最多留 5 条，旧的先滚
export const LEDGER_LINE_MAX = 40; // 每条最多 40 字

// ── WO-21A 五类心账兼容层（varTree.角色[name].心账）─────────────────────
export const HEART_LEDGER_TAGS = Object.freeze(["恩", "怨", "欠", "诺", "见"]);
export const LEGACY_HEART_LEDGER_TAG_MAP = Object.freeze({ 谊: "恩", 隙: "怨", 和: "见" });
const HEART_TAG_SET = new Set(HEART_LEDGER_TAGS);

export function isValidHeartLedgerTag(tag) {
  return typeof tag === "string" && HEART_TAG_SET.has(tag.trim());
}

export function normalizeHeartLedgerTag(rawTag) {
  const clean = typeof rawTag === "string" ? rawTag.trim() : "";
  if (HEART_TAG_SET.has(clean)) return { tag: clean, known: true, migratedFrom: null };
  if (clean && Object.prototype.hasOwnProperty.call(LEGACY_HEART_LEDGER_TAG_MAP, clean)) {
    return { tag: LEGACY_HEART_LEDGER_TAG_MAP[clean], known: true, migratedFrom: clean };
  }
  return { tag: clean || "未归类", known: false, migratedFrom: null };
}

/**
 * 归一化读取某 NPC 的心账列表：
 *   - 兼容旧值 谊→恩、隙→怨、和→见，以及 { kind, reason } 与 { tag, summary } 两种结构；
 *   - unknown 旧类目保留可读不崩，isKnownTag 为 false；
 *   - 统一输出预留结构 { id, tag, summary, chunkId, turn, place, isKnownTag, legacyTag }，
 *     无 chunkId 的旧账保留展示。
 * @param {unknown} rawEntries
 * @returns {Array<{id: string, tag: string, summary: string, chunkId: string|null, turn: number, place: string, isKnownTag: boolean, legacyTag: string|null}>}
 */
export function normalizeLedgerEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) return [];
  const out = [];
  rawEntries.forEach((entry, idx) => {
    if (!entry) return;
    if (typeof entry === "string") {
      const text = entry.trim();
      if (!text) return;
      out.push({ id: `hl_legacy_${idx}`, tag: "见", summary: text, chunkId: null, turn: 0, place: "", isKnownTag: true, legacyTag: null });
      return;
    }
    if (typeof entry !== "object") return;
    const turn = Number.isFinite(entry.turn) ? entry.turn : 0;
    const { tag, known, migratedFrom } = normalizeHeartLedgerTag(entry.tag ?? entry.kind);
    const summary = String(entry.summary ?? entry.reason ?? "").trim();
    const chunkId = typeof entry.chunkId === "string" && entry.chunkId.trim() ? entry.chunkId.trim() : null;
    const place = typeof entry.place === "string" ? entry.place.trim() : "";
    const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : `hl_${turn}_${idx}`;
    out.push({ id, tag, summary, chunkId, turn, place, isKnownTag: known, legacyTag: migratedFrom });
  });
  return out;
}

/**
 * 构造可写入的 WO-21A 心账条目：新写口仅允许 恩/怨/欠/诺/见 五类，
 * 旧类目（谊/隙/和）与未知类目均拒绝写入并返回 null。
 */
export function createHeartLedgerEntry(entry = {}) {
  const tag = typeof entry?.tag === "string" ? entry.tag.trim() : "";
  if (!isValidHeartLedgerTag(tag)) return null;
  const summary = String(entry.summary ?? entry.reason ?? "").trim();
  const turn = Number.isFinite(entry.turn) ? entry.turn : 0;
  const place = typeof entry.place === "string" ? entry.place.trim() : "";
  const chunkId = typeof entry.chunkId === "string" && entry.chunkId.trim() ? entry.chunkId.trim() : null;
  const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : `hl_${turn}_${tag}_${summary.slice(0, 8) || "item"}`;
  return { id, tag, summary, chunkId, turn, place };
}

export function heartLedgerToPatches(varTree, name, entry) {
  const clean = createHeartLedgerEntry(entry);
  if (!clean || !name) return [];
  const existing = Array.isArray(varTree?.角色?.[name]?.心账) ? varTree.角色[name].心账 : [];
  return [merge(["varTree", "角色", name, "心账"], [...existing, clean])];
}

export function groupHeartLedgerByTag(entries = []) {
  const groups = { 恩: [], 怨: [], 欠: [], 诺: [], 见: [] };
  const unknown = [];
  for (const item of entries || []) {
    if (item && HEART_TAG_SET.has(item.tag)) groups[item.tag].push(item);
    else if (item) unknown.push(item);
  }
  return { groups, unknown };
}

const EMPTY_LEDGER = Object.freeze({ lines: [], updatedTurn: 0 });

/**
 * 读取某 NPC 的旧账。旧存档/无账目时返回空账本 { lines: [], updatedTurn: 0 }。
 * @param {object} varTree
 * @param {string} name   NPC 名
 * @returns {{lines: string[], updatedTurn: number}}
 */
export function getLedger(varTree, name) {
  const raw = varTree?.角色?.[name]?.旧账;
  if (!raw || typeof raw !== "object") return { ...EMPTY_LEDGER, lines: [] };
  const lines = Array.isArray(raw.lines)
    ? raw.lines.filter((l) => typeof l === "string" && l.trim())
    : [];
  const updatedTurn = Number.isFinite(raw.updatedTurn) ? raw.updatedTurn : 0;
  return { lines, updatedTurn };
}

/**
 * 往某 NPC 的旧账追加账目的 Patch 生成器：去重、去空、每条截到 40 字、
 * 全账只留最新 5 条，产出一条 merge patch（写入统一走 applyPatches）。
 * 该 NPC 在 varTree.角色 里还没建档时，merge 会自动建出来。
 * @param {object} varTree      当前树（只读，用于合并既有账目）
 * @param {string} name
 * @param {string[]} newLines  本轮新记的账目（可空）
 * @param {number} turn        当前回合数
 * @returns {object[]} Patch[]
 */
export function ledgerToPatches(varTree, name, newLines, turn) {
  const base = varTree ?? {};
  const existing = getLedger(base, name).lines;
  const incoming = (Array.isArray(newLines) ? newLines : [])
    .map((l) => (typeof l === "string" ? l.trim() : ""))
    .filter(Boolean)
    .map((l) => (l.length > LEDGER_LINE_MAX ? l.slice(0, LEDGER_LINE_MAX) : l));
  const merged = [];
  for (const line of [...existing, ...incoming]) {
    if (!merged.includes(line)) merged.push(line);
  }
  const lines = merged.slice(-LEDGER_MAX_LINES);
  return [merge(["varTree", "角色", name, "旧账"], { lines, updatedTurn: turn })];
}
