// 回合流水线第三段：主叙事生成 + 状态提取。
// 职责只有一件事：调 runTurn 拿到 { p, turn 结果 }；解析、验收、提取重试都在
// runTurn 内部。过期结果（stale）在这里识别后原样上报，由 playTurn 统一走丢弃路径。

import { runTurn } from "../runTurn.js";

export async function narrateTurn(ctx, trace, cmd, turnOpts) {
  const turn = await runTurn({ ...ctx, _trace: trace }, cmd, turnOpts);
  if (turn.stale || ctx.isStale?.()) return { stale: true };
  return { turn };
}
