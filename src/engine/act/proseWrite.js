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
  const { narrativeText, turn, location, playerName, roomNpcNames = [], isTalk = false, talkTarget = "", anchoredFacts = [], guard, addChunks, listChunksByTurn } = args || {};
  try {
    const text = String(narrativeText || "").trim();
    if (!text || !Number.isFinite(turn) || turn <= 0) return;
    const witnesses = isTalk && talkTarget
      ? [playerName, talkTarget].filter(Boolean)
      : [playerName, ...roomNpcNames].filter(Boolean);
    if (typeof addChunks !== "function") return;
    void (async () => {
      // 读档/换存档往往发生在回合结束后的空窗——落库前最后核一次代次；
      // 挡不住毫秒级竞态的全部，但用户驱动的存档切换是秒级动作，这一道足够。
      if (guard?.()) return;
      // 同回合多次写挂（连搭两次话/连续行动）seq 接续不撞号覆盖：
      // 数一下同代同回合已有几段，从其后接着编号。
      let seqOffset = 0;
      if (typeof listChunksByTurn === "function") {
        try {
          const existing = await listChunksByTurn(turn);
          seqOffset = existing.length;
        } catch (_) { /* 数不出来就从 0 起——宁可覆盖一段也不卡死写挂 */ }
      }
      if (guard?.()) return;
      const chunks = splitProseIntoChunks(text, {
        turn,
        location: location || "",
        witnesses,
        anchoredFacts,
        viewerName: playerName || "主角",
        seqOffset,
      });
      if (!chunks.length) return;
      await addChunks(chunks);
    })().catch(() => { /* 增量层写失败静默降级 */ });
  } catch (_) {
    /* 切分异常同样静默——绝不能影响主链路 */
  }
}
