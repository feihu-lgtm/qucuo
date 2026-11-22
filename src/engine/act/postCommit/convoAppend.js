// ── convo 条目追加 memory/turn 字段（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { changes: { convo } } 由 commitRound 统一落盘。

export function appendConvo({ newConvo, rawFull, p, time }) {
  return {
    changes: {
      convo: [...newConvo, {
        role: "assistant",
        content: rawFull.slice(0, 500),
        memory: (p?.memory && String(p.memory).trim()) || "",
        turn: time,
      }],
    },
  };
}
