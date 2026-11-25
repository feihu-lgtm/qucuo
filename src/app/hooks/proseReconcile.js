// 读档后原文段落谱系 reconcile（按需分叉，用户拍板口径）
// ------------------------------------------------------------------
// 恢复快照后异步执行：
//   1. 无谱系老存档：建根分支写回 store，并把 convo/小纸条迁移进根分支
//      （WO-17 迁移器，确定性 id + put 幂等）。
//   2. 查当前头分支是否存在 turn > 存档 time 的段落（旧未来）：
//      有才把原头 upTo 截到存档 time、接新头分支、proseSeq 归零；
//      没有就沿原分支继续，绝不分叉——分叉只发生在已有未来内容时，
//      所以不需要空分支压缩。
//   3. 全程 gameEpoch 代次护栏：两次读档串台/迟到 reconcile 直接丢弃；
//      任何一步失败按不分叉降级（宁可不分叉也不可错分叉）。
import { gameStore, isGameEpochStale, ensureProseLineageInStore, mergeProseSeqFloor, applyProseLineageFork } from "../../store/gameStore.js";
import { headBranch } from "../../domain/rules/memory/lineage.js";
import { migrateLegacyConvoAndNotes, addProseChunks, getProseChunksByBranch } from "../../engine/ports/recallBlock.js";
import { getAllMemories } from "../../engine/ports/recallWithVisibility.js";

export async function reconcileProseLineageAfterLoad(snap, { epoch } = {}) {
  const stale = () => (epoch != null ? isGameEpochStale(epoch) : false);
  try {
    if (stale()) return;
    const norm = ensureProseLineageInStore();
    let migratedSeqHigh = 0;
    if (norm.created) {
      // 老存档首读迁移：convo + 小纸条 → 根分支初始段落（失败静默，不阻断分叉判断）
      try {
        const notes = await getAllMemories().catch(() => []);
        const chunks = migrateLegacyConvoAndNotes(snap, {
          notes: (notes || []).map((n) => ({ ...n, owner: n.owner })),
          branchId: headBranch(norm.lineage)?.b || "",
          seqStart: 1,
        });
        if (chunks.length && !stale()) {
          await addProseChunks(chunks);
          // 迁移占用的 seq 计入 proseSeq，后续正文接续不撞号
          migratedSeqHigh = chunks.length;
          if (!stale()) mergeProseSeqFloor(chunks.length);
        }
      } catch (_) { /* 迁移失败不阻断游戏 */ }
    }
    if (stale()) return;
    // 按需分叉：头分支存在 turn > 存档 time 的段才叉
    const cur = gameStore.getState();
    const head = headBranch(cur.proseLineage);
    if (!head || head.upTo !== null) return;
    const saveTime = Number(snap?.time) || 0;
    // seq 粒度边界：快照里的 proseSeq 是该存档点已分配的最大 seq——搭话回合
    // time 不递增，turn===saveTime 时只能靠 seq 判未来，否则 undo 对搭话完全失效。
    // 刚迁移进根的段落是存档自身的内容不是未来——seq 水位要计入迁移占用
    const saveSeq = Math.max(Number.isFinite(snap?.proseSeq) ? snap.proseSeq : 0, migratedSeqHigh);
    const branchChunks = await getProseChunksByBranch(head.b);
    if (stale()) return;
    const hasFuture = branchChunks.some((c) => {
      if (!Number.isFinite(c?.turn)) return false;
      if (c.turn > saveTime) return true;
      if (c.turn === saveTime && Number.isFinite(c?.seq) && c.seq > saveSeq) return true;
      return false;
    });
    if (!hasFuture) return;
    if (stale()) return;
    applyProseLineageFork(saveTime, saveSeq);
  } catch (_) {
    /* 失败按不分叉降级 */
  }
}
