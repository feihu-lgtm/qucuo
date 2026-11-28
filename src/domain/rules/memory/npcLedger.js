// 人物旧账 —— 每个具名 NPC 的小账本，挂在 varTree.角色[name].旧账
// ----------------------------------------------------------------------------
// 写径壳：merge 依赖 applyPatches（其链进 fields 注册表），读径叶子已拆 npcLedgerCore.js
// ——clapboard 等被 fields 反向依赖的模块只吃叶子，不再把整棵注册表拉成循环依赖。
// 全部导出与旧 npcLedger.js 一致，旧消费方零改动。

import { merge } from "../state/applyPatches.js";
import { createHeartLedgerEntry, getLedger, LEDGER_MAX_LINES, LEDGER_LINE_MAX } from "./npcLedgerCore.js";

export * from "./npcLedgerCore.js";

export function heartLedgerToPatches(varTree, name, entry) {
  const clean = createHeartLedgerEntry(entry);
  if (!clean || !name) return [];
  const existing = Array.isArray(varTree?.角色?.[name]?.心账) ? varTree.角色[name].心账 : [];
  return [merge(["varTree", "角色", name, "心账"], [...existing, clean])];
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
