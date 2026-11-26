// 回合流水线第三段：主叙事生成 + 状态提取。
// 职责只有一件事：调 runTurn 拿到 { p, turn 结果 }；解析、验收、提取重试都在
// runTurn 内部。过期结果（stale）在这里识别后原样上报，由 playTurn 统一走丢弃路径。

import { runTurn } from "../runTurn.js";

export async function narrateTurn(ctx, trace, cmd, turnOpts) {
  const turn = await runTurn({ ...ctx, _trace: trace }, cmd, turnOpts);
  if (turn.stale || ctx.isStale?.()) return { stale: true };
  // 夜班双修虫②：亲密拒决信号透传外层——runTurn 早返把 intimacyRefused 放在载荷
  // 顶层，narrateTurn 包一层 {turn} 后 playTurn 读不到，拒决回合漏进 finalize 无载荷
  // 炸回合整体回滚（连拒词与扣好感都抹掉）。透传让 playTurn 早退收口。
  if (turn.intimacyRefused) return { turn, intimacyRefused: true };
  return { turn };
}
