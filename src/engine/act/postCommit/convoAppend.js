// ── convo 条目追加 memory/turn 字段（原 commitRound 内嵌块）──

export function appendConvo(d) {
  d.setConvo([...d.newConvo, {
    role: "assistant",
    content: d.rawFull.slice(0, 500),
    memory: (d.p?.memory && String(d.p.memory).trim()) || "",
    turn: d.time,
  }]);
}
