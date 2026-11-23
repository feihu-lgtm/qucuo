// 回合监视运行时由 engine/app 启动时注入（features 层不反依赖 infra/engine）。
// web 由 engine/commands/index.js 绑定，CLI runner 经同一模块间接受益；
// 直接调 applyResult 的测试需自行 bindTurnRuntime 注入 infra/turnMonitor 的符号。
let runtime;
export function bindTurnRuntime(rt) {
  runtime = rt;
}
export function turnRuntime() {
  if (!runtime) throw new Error("turnRuntime 未注入：请由 engine/app 入口调用 bindTurnRuntime");
  return runtime;
}
