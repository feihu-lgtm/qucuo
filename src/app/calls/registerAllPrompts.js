// 总控管理台启动装配入口：确保单/双/多调用及全仓后台异步调用的 registry 定义均已加载。
import "../../domain/rules/prompt/calls/unifiedCalls.js";
import "../../domain/rules/prompt/calls/domainCalls.js";
import "../../domain/rules/prompt/calls/sideCalls.js";
import "../../domain/rules/settle/judge.js";
import "../../domain/rules/memory/bookkeep.js";
import "../../engine/ports/storyteller.js";
import "../../engine/ports/cardScan/scanCalls.js";
import "../../engine/turn/intakeTurn.js";
import "./hookCalls.js";

export function ensureAllPromptsRegistered() {
  return true;
}
