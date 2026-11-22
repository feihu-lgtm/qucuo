// ============================================================================
// 人物旧账 —— 每个具名 NPC 的小账本，挂在 varTree.角色[name].旧账
// ----------------------------------------------------------------------------
// 记的是"这个人与少侠之间的客观旧账"：恩怨、人情、承诺、怒气缘由。
// 由回合末的记账调用（domain/memory/bookkeep.js）逐轮追加，
// 旁白/私语需要时可取出念给当事人听（"你忘了？上月你在村口……"）。
// 纯函数、不可变更新，旧存档没有该字段也能正常读写。
// ============================================================================

export const LEDGER_MAX_LINES = 5; // 每人最多留 5 条，旧的先滚
export const LEDGER_LINE_MAX = 40; // 每条最多 40 字

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
 * 往某 NPC 的旧账追加账目。去重、去空、每条截到 40 字、全账只留最新 5 条。
 * 返回新 varTree，不改原对象；该 NPC 在 varTree.角色 里还没建档时会建出来。
 * @param {object} varTree
 * @param {string} name
 * @param {string[]} newLines  本轮新记的账目（可空）
 * @param {number} turn        当前回合数
 * @returns {object} 新 varTree
 */
export function applyLedgerUpdate(varTree, name, newLines, turn) {
  const base = varTree ?? {};
  const chars = base.角色 ?? {};
  const npc = chars[name] ?? {};
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
  return {
    ...base,
    角色: {
      ...chars,
      [name]: {
        ...npc,
        旧账: { lines, updatedTurn: turn },
      },
    },
  };
}
