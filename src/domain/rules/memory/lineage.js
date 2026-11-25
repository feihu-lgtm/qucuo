// 原文段落时间线谱系（纯函数）——读档按需分叉方案
// ------------------------------------------------------------------
// 模型：proseLineage = [{ b, upTo }]，按时间顺序排列；upTo===null 的是头分支
// （当前正在写入的活分支），非头分支的 upTo 是它被截断的回合（含）。
// proseSeq = 当前头分支内已用最大 seq（同步 allocator 预留递增）。
//
// 读档分叉语义（用户拍板「按需分叉」）：
//   读回到 turn=T 的存档后，若头分支里已存在 turn>T 的段落（旧未来），
//   才把原头 upTo 截为 T、接一条新头分支；没有旧未来就沿原分支继续写。
//   分叉只发生在已有未来内容时，所以不需要空分支压缩。

// 分支 id 全局唯一（段落库是所有存档共用的 IndexedDB，id 撞了会串档）。
// 允许含下划线之外的字符也无所谓——chunk 显式存 seq 字段，不靠拆 id。
export function newBranchId() {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function headBranch(lineage) {
  if (!Array.isArray(lineage) || !lineage.length) return null;
  return lineage.find((e) => e && e.upTo === null) || lineage[lineage.length - 1] || null;
}

// 规范化：缺谱系/空谱系 → 建一条根分支。返回 { proseLineage, proseSeq, created }。
// 纯函数不写 store——调用方负责把结果写回（created 为 true 时说明发生了补建）。
export function ensureProseLineage(state) {
  const lineage = Array.isArray(state?.proseLineage) ? state.proseLineage.filter((e) => e && e.b) : [];
  if (lineage.length && headBranch(lineage)) {
    return { proseLineage: lineage, proseSeq: Number.isFinite(state?.proseSeq) ? state.proseSeq : 0, created: false };
  }
  const root = { b: newBranchId(), upTo: null };
  return { proseLineage: [...lineage, root], proseSeq: 0, created: true };
}

// 分叉：把头分支截断到 atTurn（含），接新头。返回 { proseLineage, proseSeq:0 }。
// 幂等保护：头分支 upTo 已经 <= atTurn 说明已经叉过，原样返回。
export function forkLineage(lineage, atTurn) {
  const head = headBranch(lineage);
  if (!head) return ensureProseLineage({ proseLineage: lineage });
  if (head.upTo !== null) return { proseLineage: lineage, proseSeq: 0 }; // 无头状态异常，不写
  const idx = lineage.indexOf(head);
  const truncated = { ...head, upTo: atTurn };
  const fork = { b: newBranchId(), upTo: null };
  const next = [...lineage];
  next[idx] = truncated;
  next.push(fork);
  return { proseLineage: next, proseSeq: 0 };
}

// 段落可见的时间线口径：
//   chunk.branchId 必须命中谱系某分支；非头分支要求 turn<=该分支 upTo；
//   头分支要求 turn<=currentTurn。无 branchId 旧段一律不可见（WO-17 过渡库
//   从未接主链路，判死比串档安全）。
export function branchVisible(chunk, lineage, currentTurn) {
  const bid = chunk?.branchId;
  if (!bid || !Array.isArray(lineage)) return false;
  const branch = lineage.find((e) => e && e.b === bid);
  if (!branch) return false;
  const turn = chunk?.turn;
  if (!Number.isFinite(turn)) return false;
  if (branch.upTo === null) {
    return Number.isFinite(currentTurn) ? turn <= currentTurn : true;
  }
  return turn <= branch.upTo;
}
