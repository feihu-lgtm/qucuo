// ── 选项延时浮现（原 commitRound 内嵌块）──
// 路线甲纯函数化：不直接写日志，返回 { delayedLogs, delayMs } 由 commitRound 统一调度落盘。

export function emitChoices({ choices }) {
  if (!choices?.length) return null;
  return {
    delayMs: 650,
    delayedLogs: [
      { t: "sys", text: "" },
      { t: "choice", text: "  你可以：" },
      ...choices.map((c, i) => ({ t: "choice", text: `  [${String.fromCharCode(65 + i)}] ${c}`, action: c })),
    ],
  };
}
