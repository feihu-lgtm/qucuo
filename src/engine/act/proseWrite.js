// 原文段落写挂（WO-18）：回合尾章定稿后把实际上屏正文切段落库。
// ------------------------------------------------------------------
// 口径钉死：
// · 文本用最终上屏 narrativeText（含系统补锚短句）——系统补写的事实不能在记忆里消失；
//   chunker 会剥 ⟦F…⟧ 锚点标记，锚点 id 保留进 anchorFactIds。
// · witnesses/location/turn 全部系统上下文，不信模型一个字。
// · witnesses 最小区分：私聊搭话回合 = 玩家+搭话对象（防串味）；
//   其余回合 = 玩家+在场 NPC 全员。
// · 护栏按存档代次不按回合 stale：上一回合正文是历史事实，玩家开新回合
//   不妨碍补写；真正要防的是读档/换存档后的错档写入。guard 由 hook 层注入
//   （捕获回合开始时的 gameEpoch），落库前再核一次。
// · 全程 fire-and-forget + 静默降级：段落库是增量层，写失败绝不阻断游戏。

import { splitProseIntoChunks } from "../../domain/rules/memory/proseChunker.js";

// addChunks/listChunks 由 ports 层转手注入（engine 不得直连 infra——层级棘轮只减不增）；
// 未注入时静默跳过，测试/裸引擎路径不受影响。
export function writeTurnProse(args = {}) {
  const { narrativeText, turn, location, playerName, roomNpcNames = [], isTalk = false, talkTarget = "", anchoredFacts = [], guard, addChunks, seqAlloc } = args || {};
  try {
    const text = String(narrativeText || "").trim();
    if (!text || !Number.isFinite(turn) || turn <= 0) return;
    const witnesses = isTalk && talkTarget
      ? [playerName, talkTarget].filter(Boolean)
      : [playerName, ...roomNpcNames].filter(Boolean);
    if (typeof addChunks !== "function") return;

    // 同步切分+同步预留 seq：allocator 在 fire 的同一 tick 内原子递增 store 的
    // proseSeq，两次同回合写挂（连搭话）不撞号——替代已废弃的 listChunksByTurn
    // 数存量方案（那对 fire-and-forget 并发写入仍会撞）。allocator 缺失的裸
    // 引擎/测试路径降级 legacy id 形状（P<turn>_<seq>，从 1 起）。
    // 单次切分后按 allocator 结果回填 id/seq/branchId——不重复切两遍。
    const chunks = splitProseIntoChunks(text, {
      turn, location: location || "", witnesses, anchoredFacts,
      viewerName: playerName || "主角",
    });
    if (!chunks.length) return;
    const alloc = typeof seqAlloc === "function" ? seqAlloc(chunks.length) : null;
    if (alloc?.branchId) {
      chunks.forEach((c, i) => {
        const seq = alloc.startSeq + i;
        c.id = `${alloc.branchId}_${turn}_${seq}`;
        c.seq = seq;
        c.branchId = alloc.branchId;
      });
    }
    void (async () => {
      // 读档/换存档往往发生在回合结束后的空窗——落库前最后核一次代次；
      // 挡不住毫秒级竞态的全部，但用户驱动的存档切换是秒级动作，这一道足够。
      // 正确性兜底在分支/upTo 可见性，不在本护栏。
      if (guard?.()) return;
      await addChunks(chunks);
    })().catch(() => { /* 增量层写失败静默降级 */ });
  } catch (_) {
    /* 切分异常同样静默——绝不能影响主链路 */
  }
}
