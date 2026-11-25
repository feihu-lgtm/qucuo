// WO-16F-F2c 交互意向收集（纯函数，不碰网络/存储/UI）
// ------------------------------------------------------------------
// duel/trade 不在叙事前结算——它们是交互式子系统（战斗回合机/商店货架），
// 只能在叙事完成后由 app 层复用 intentRouter runDeferred 接原入口。
// 本模块只做收集与预校验，输出最小形状 {kind,target,text}，domain 不 import app/features。

export const DEFERRED_INTENT_KINDS = new Set(["duel", "trade"]);

// 从 intake actions 收集交互意向：
//   · condition≠「无」不收（前提未裁，与路由同闸）
//   · target 必须在场且不是「无」（不在场写失败回执原因）
//   · 同 kind+target 去重留首条
// 返回 { intents, failures }——failures 供回执写「未能如愿」，绝不静默。
export function collectDeferredIntents(actions = [], { npcs = [], isTalk = false } = {}) {
  const intents = [];
  const failures = [];
  if (isTalk) return { intents, failures };
  const present = new Set((npcs || []).map((n) => n?.name).filter(Boolean));
  const seen = new Set();
  for (const action of actions || []) {
    if (!DEFERRED_INTENT_KINDS.has(action?.kind)) continue;
    if (action.condition && action.condition !== "无") continue; // 前提未裁由调用方 trace
    const target = typeof action.target === "string" && action.target !== "无" ? action.target : "";
    if (!target) {
      failures.push({ kind: action.kind, reason: "没有明确的对象" });
      continue;
    }
    if (!present.has(target)) {
      failures.push({ kind: action.kind, target, reason: `${target}不在场` });
      continue;
    }
    const key = `${action.kind}|${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    intents.push({ kind: action.kind, target, text: String(action.text || "") });
  }
  return { intents, failures };
}

// 意向回执文案（判官铁律块注入用）——措辞必须是「系统已受理的交互意向」：
// duel 只许写抱拳邀战/摆开架势，不得写已开打或胜负；
// trade 只许写开口问价/请对方拿货来看，不得写已成交。
export function deferredIntentReceipt(intent) {
  if (intent.kind === "duel") {
    return `你向${intent.target}抱拳邀战——系统已受理交互意向，正文只写邀战与架势，不得写已开打或胜负。`;
  }
  return `你向${intent.target}开口问价——系统已受理交互意向，正文只写问价与看货，不得写已成交。`;
}

export function deferredFailureReceipt(failure) {
  const label = failure.kind === "duel" ? "邀战" : "问价";
  return `${label}未能如愿（${failure.reason}）——系统未受理，叙事不得写成已发起。`;
}
