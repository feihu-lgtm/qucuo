import { getRngState, setRngState } from "../utils/rng.js";
import { loadSquares, serializeSquares } from "../domain/rules/map/mapSquares.js";
import { PHASE, turnMonitor, withTurnContext } from "../infra/turnMonitor.js";
import { createWebAi } from "./ports/ai.js";
import { createPhaseSetter } from "./turn/phaseSetter.js";
import { narrateTurn } from "./turn/narrateTurn.js";
import { finalizeTurn } from "./turn/finalizeTurn.js";
import { runShadowJudge, resolveShadowJudgeEnabled } from "./act/shadow/shadowJudge.js";
import { buildPresence } from "./prompt/index.js";

export const ROLLBACK_KEYS = [
  "room", "char", "dao", "skills", "inv", "exp", "pot", "flags",
  "mapData", "time", "varTree", "convo",
];

function setterForKey(key) {
  return key === "varTree" ? "setVarTreeState" : `set${key[0].toUpperCase()}${key.slice(1)}`;
}

// WO-06：跨层 React ref 已清退，事务快照只留 store 状态 + rng + 格子。
function captureSnapshot(getGameState) {
  const state = getGameState();
  return {
    state: Object.fromEntries(ROLLBACK_KEYS.map((key) => [key, state[key]])),
    rngState: getRngState(),
    squares: serializeSquares(),
  };
}

function restoreSnapshot(snapshot, getGameState, actions) {
  for (const key of ROLLBACK_KEYS) {
    if (getGameState()[key] !== snapshot.state[key]) {
      actions[setterForKey(key)](snapshot.state[key]);
    }
  }
  setRngState(snapshot.rngState);
  loadSquares(snapshot.squares);
}

// 回合编排器：事务快照 → narrateTurn（前哨判官+主叙事+尾章校对）
// → finalizeTurn（落盘+记账），任一环节过期/抛错走统一回滚或丢弃路径。
// WO-15：独立软结算通道已整块删除，settle 回合由判官管线裁定。
export async function playTurn(ctx, cmd, opts = {}) {
  const trace = ctx._trace || turnMonitor.start(cmd, { source: "engine", commandId: "turnCommit" });
  const turnCtx = { ...ctx, ai: ctx.ai || createWebAi() };
  const setPhase = createPhaseSetter(ctx, trace);
  const stale = (error) => {
    turnMonitor.transition(trace, PHASE.DISCARDED, "收到过期结果");
    return { ok: false, stale: true, ...(error && { error }) };
  };
  setPhase("machine");
  let snapshot;
  const getGameState = ctx.getGameState;
  const gameActions = ctx.gameActions;
  try {
    snapshot = captureSnapshot(getGameState);
    turnMonitor.add(trace, "app", "事务快照", { kind: "snapshot" });
    turnMonitor.add(trace, "feature", "engine.runTurn");
    turnMonitor.add(trace, "domain", "整理世界状态与叙事上下文");
    ctx.beforeRun?.();
    setPhase("ai");
    const turnOpts = { ...opts };
    const narrated = await narrateTurn(turnCtx, trace, cmd, turnOpts);
    if (narrated.stale) return stale();
    // WO-16D 影子对账：回合前快照切片在 commit 前捕获（store 值不可变，引用即快照）。
    const shadowPre = resolveShadowJudgeEnabled(turnCtx.apiCfg) && !turnCtx.apiCfg?.extractionEnabled && snapshot
      ? {
        inv: snapshot.state.inv, flags: snapshot.state.flags, varTree: snapshot.state.varTree,
        room: snapshot.state.room, questProgress: getGameState?.()?.questProgress,
        char: snapshot.state.char, turn: snapshot.state.time,
        innerRoomName: turnCtx.innerRoomName ?? null,
      }
      : null;
    const finalized = await finalizeTurn({
      ctx: turnCtx, trace, turn: narrated.turn, turnOpts, opts, setPhase,
    });
    // commit 成功且未 stale 才 fire-and-forget；影子吃回合前快照、对比 commit 后现状，
    // 结果只进 trace/内存聚合，异常静默，绝不阻塞回合。
    // settle 双保险：turnCtx.isSettle 是 plan 派生主信号，opts.settle 是调用方直传——
    // 创造模式等路径可能出现 plan 未派生但 opts.settle 为真的回合（runTurnSteps 仍认它），
    // 任一命中都不跑影子（影子只在普通自由行动回合对账）。
    if (shadowPre && finalized?.ok && !finalized?.stale && !turnCtx.isStale?.() && !turnCtx.isSettle && !opts.settle && !opts.isSettle) {
      const liveAfter = getGameState?.() || {};
      const shadowPost = {
        inv: liveAfter.inv, flags: liveAfter.flags, varTree: liveAfter.varTree,
        room: liveAfter.room, turn: liveAfter.time,
      };
      // 同源喂料：在场名单用与 preparedPrompt 完全相同的 buildPresence 口径
      // （内层过滤+同伴出战位并入），吃回合前房间快照——影子输入才与真实判官一致。
      // isTalk 可靠信号在 plan/turnContext，opts.isTalk 仅兜底——普通搭话回合
      // opts 通常不带这个字段，漏掉会让 talkOnly 与在场名单都按非搭话算，对账失真。
      const isTalk = !!(turnCtx.isTalk ?? opts.isTalk);
      const presence = buildPresence({
        isTalk, lockedDestName: turnCtx.lockedDestName,
        room: shadowPre.room || {}, innerRoomName: turnCtx.innerRoomName,
        companionState: getGameState?.()?.companionState,
      });
      void runShadowJudge({
        cmd, preState: shadowPre, postState: shadowPost,
        ai: turnCtx.ai, apiCfg: turnCtx.apiCfg,
        convo: turnCtx.convo || [], isTalk,
        visibleNpcs: presence.visibleNpcsForAI,
        epoch: String(turnCtx.proseEpoch ?? "default"),
        isStale: turnCtx.isStale, epochGuard: turnCtx.proseEpochGuard,
        trace: (layer, label, fields) => turnMonitor.add(trace, layer, label, fields),
      }).catch(() => { /* 影子异常静默 */ });
    }
    return finalized;
  } catch (error) {
    if (ctx.isStale?.()) return stale(error);
    if (snapshot) withTurnContext(trace, () => restoreSnapshot(snapshot, getGameState, gameActions));
    turnMonitor.transition(trace, PHASE.ERROR, String(error));
    return { ok: false, error };
  }
}
