// 引擎段共用的阶段切换器：先通知上层回调（app 的 setCommandPhase），再推进监控相位。
// 单独成文件是因为 playTurn（含 CLI 路径）只需要它，不能拖进 turnContext.js 的
// 前端资源依赖（portraits 的 .webp 在 node 下无法加载）。

import { PHASE, turnMonitor } from "../../infra/turnMonitor.js";

export function createPhaseSetter(ctx, trace) {
  return (phase) => {
    ctx.setCommandPhase?.(phase, trace);
    const next = { machine: PHASE.MACHINE, ai: PHASE.AI_WAIT, commit: PHASE.COMMIT }[phase];
    if (trace.phase !== next) turnMonitor.transition(trace, next);
  };
}
