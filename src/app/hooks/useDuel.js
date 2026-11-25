import { useCallback, useEffect } from "react";
import { featureCtx } from "../runtime/gameRuntime.js";
import { gameActions, gameStore, getGameEpoch, isGameEpochStale } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { lookNpc, recognizeNpc, settleNpcDuel } from "../../features/npc/logic.js";
import { isNpcLooked } from "../../domain/rules/npc/npcAwareness.js";
import { ensureNpcCombatData } from "../../domain/rules/npc/npcGeneration.js";
import { NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";
import { buildDuelNarrationPrompt, duelFactLogs, duelNarrationSlots, parseDuelNarration, phraseNarration } from "../../domain/rules/combat/duelBrief.js";
import { backfillInBackground, insertWhenIdle, newBackfillKey } from "../../engine/ports/backfill.js";
import { askStoryteller, hasApiKey } from "../../engine/ports/storyteller.js";
import { createTurnStaleCheck } from "./useUndo.js";
import { setFactSummary } from "../../domain/rules/prompt/knowledge.js";
import { useNemesisEpithet } from "./useNemesisEpithet.js";

export function consumeDuelRequest(result, {
  opts = {}, isStale, isTalk, interactMode, recognize,
  setActiveTarget, setDuelPending, trace,
}) {
  const npc = result?.duelRequest;
  if (!result?.ok || result.stale || (typeof isStale === "function" && isStale())
    || isTalk || interactMode === "talk" || interactMode === "whisper"
    || opts.settle || opts.settleKind === "duel_invite" || !npc?.name) return false;
  if (recognize) recognize(npc);
  else applyResult(featureCtx(), recognizeNpc(gameStore.getState(), npc), { turn: trace, feature: "npc.duel" });
  setActiveTarget(npc.name);
  setDuelPending(npc);
  return true;
}

// 邀战只出一行系统提示（三五十字），不再整轮请 AI 写，点完立刻弹出切磋确认。
export function duelInviteLine(npc) {
  return `  你向${npc.name}抱拳邀战。${npc.name}略一打量，点头应下，拉开了架势。`;
}

export async function openDuelAfterNarration({ addLog, setDuelPending, isStale }, npc) {
  addLog([{ t: "sys", text: duelInviteLine(npc) }]);
  if (isStale()) return false;
  setDuelPending(npc);
  return true;
}

// 后台补写描写：不占回合、不排队，玩家可以接着打下一场。
// 没配 API 或 AI 失败时用短语池拼句兜底；返回 "ai" / "phrase" / false。
// factId 给了就让战报同一次调用顺带写事实摘要（替代单独一次「事实摘要」调用）；
// 战报失败或被回滚作废时不写，事实保留注册时的结构化兜底摘要。
export async function narrateDuelInBackground(key, rounds, { outcomeText, place, aftermath, factId }, {
  ask = askStoryteller, canAsk = hasApiKey, setLog = gameActions.setLog, retryMs, isStale,
  saveSummary = (id, text) => gameActions.setVarTreeState((prev) => setFactSummary(prev, id, text)),
} = {}) {
  const epoch = getGameEpoch();
  const stale = () => Boolean(isStale?.()) || isGameEpochStale(epoch);
  if (stale()) return false;
  const { sys, user } = buildDuelNarrationPrompt(rounds, { outcomeText, place, aftermath, summary: !!factId });
  const roundCount = Array.isArray(rounds) ? rounds.length : 0;
  let summary = "";
  const viaAi = await backfillInBackground(key, {
    canAsk,
    isStale: stale,
    setLog,
    ask: () => ask(sys, user, { callLabel: "切磋战报", maxTokens: 900 }),
    parse: (text) => {
      const narration = parseDuelNarration(text, roundCount);
      summary = narration?.summary || "";
      return duelNarrationSlots(narration);
    },
    retryMs,
  });
  if (stale()) return false;
  if (viaAi) {
    if (factId && summary) saveSummary(factId, summary);
    return "ai";
  }
  const lines = duelNarrationSlots(phraseNarration(rounds));
  if (!lines) return false;
  return (await insertWhenIdle(key, lines, { setLog, isStale: stale, retryMs })) && "phrase";
}

export function useForcedDuelNpc({ forcedDuelNpc, setDuelingNpc, setForcedDuelNpc }) {
  useEffect(() => {
    if (forcedDuelNpc) {
      setDuelingNpc(forcedDuelNpc);
      setForcedDuelNpc(null);
    }
  }, [forcedDuelNpc]);
}

export function useDuel({
  act, addLog, duelPending, setActiveTarget, setDuelPending, setDuelingNpc,
  duelingNpc, pendingQuestBranch, noteAction, jotNote, aiSummarizeFact, setPendingQuestBranch,
  captureUndo, turnGenerationRef, narrator, interactMode, apiCfg,
}) {
  const { maybeGrantEpithets } = useNemesisEpithet({ apiCfg });
  // WO-16F-F2c：skipCaptureUndo 可选——判官链叙事后接续的交互是同一玩家回合的
  // 后续，不是新动作，绝不能覆盖本回合开头的撤销检查点；按钮老路默认照旧捕获。
  const handleNpcDuel = useCallback((npc, { skipCaptureUndo = false, lethal = false } = {}) => applyResult(featureCtx(), async () => {
    const isStale = createTurnStaleCheck(turnGenerationRef);
    if (!skipCaptureUndo) captureUndo();
    // 没端详过的人不能上来就打——先替他做「细看」这一步，看清楚了
    // 再点一次切磋才真的邀战。
    if (!isNpcLooked(gameStore.getState().varTree, npc.name)) {
      const look = lookNpc(gameStore.getState(), npc);
      applyResult(featureCtx(), look);
      setActiveTarget(npc.name);
      addLog([{ t: "sys", text: `  动手前，你先端详了${npc.name}——掂量清楚再决定动不动手。` }]);
      // 正在私聊/耳语里时 act 会把 look 当成对那个人说的话——端详已经记账了，
      // 描写就免了，直接把细看结果落日志。
      if (interactMode === "talk" || interactMode === "whisper") {
        addLog(look.extraReplies || []);
        return;
      }
      await act("look " + npc.id, look.extraReplies || [], { keepUndo: true, inspect: true });
      return;
    }
    applyResult(featureCtx(), recognizeNpc(gameStore.getState(), npc));
    setActiveTarget(npc.name);
    // WO-23C2d：生死战 lethal 意图沿 duelPending 对象传递——
    // 展开复制不污染原 npc 对象，普通切磋 lethal 恒 false 零串场。
    await openDuelAfterNarration({ addLog, setDuelPending, isStale }, lethal ? { ...npc, lethal: true } : npc);
  }, { feature: "npc.duel" }), [act, addLog, captureUndo, interactMode, setActiveTarget, setDuelPending, turnGenerationRef]);

  const confirmDuel = useCallback(() => applyResult(featureCtx(), () => {
    if (!duelPending) return;
    setDuelingNpc(duelPending);
    setDuelPending(null);
  }, { feature: "duel.confirm" }), [duelPending]);

  const cancelDuel = useCallback(() => applyResult(featureCtx(), () => {
    if (!duelPending) return;
    addLog([{ t: "sys", text: `  你收起架势，这场切磋作罢，${duelPending.name}也顺势松了口气。` }]);
    setDuelPending(null);
  }, { feature: "duel.cancel" }), [duelPending, addLog]);

  const duelFinishHandler = useCallback((outcome, loot, battleLog, grownMoveset, usedItems, remainingHp, dodgeStolenItems) => applyResult(featureCtx(), () => {
    const finishedNpc = duelingNpc;
    const result = settleNpcDuel(gameStore.getState(), finishedNpc, {
      outcome,
      lethal: !!finishedNpc?.lethal,
      loot,
      battleLog,
      reportFollows: true,
      grownMoveset,
      usedItems,
      remainingHp,
      dodgeStolenItems,
      pendingQuestBranch,
      createRespawnNpc: ensureNpcCombatData,
    });
    const questBranch = pendingQuestBranch?.mode === "combat" && finishedNpc?.questBranchFlag === pendingQuestBranch.flag
      ? pendingQuestBranch : null;
    if (questBranch) {
      setPendingQuestBranch(null);
    }
    noteAction("duel");
    setDuelingNpc(null);
    // WO-23C1：结算前后宿敌谱快照——首次入谱/tier 晋升且 epithet 空者
    // 后台排一次 AI 赐号（系统定何时赐，AI 只起名；失败静默不阻塞）。
    const rosterBefore = gameStore.getState().varTree?.世界?.宿敌谱 || {};
    applyResult(featureCtx(), result);
    try {
      const rosterAfter = gameStore.getState().varTree?.世界?.宿敌谱 || {};
      maybeGrantEpithets(rosterBefore, rosterAfter);
    } catch { /* 赐号链路异常绝不阻塞结算 */ }
    if (result.factId && !finishedNpc) aiSummarizeFact(result.factId, result.cue);
    if (finishedNpc) {
      // 系统事实行立刻落日志；描写在后台补，不走 act，玩家不用等。
      const key = newBackfillKey("duel");
      addLog(duelFactLogs(result.reportRounds, key, result.outcomeText));
      // 任务分支战斗打赢后，aftermath（任务数据登记的收尾梗概）交给叙事段写成
      // 结局段——玩家不只看到战况，还看到这件事怎么作结、怎么回归
      //（小牧童：牦牛认人、牵牛回寨、阿索分糌粑）。
      narrateDuelInBackground(key, result.reportRounds, {
        outcomeText: result.outcomeText,
        factId: result.factId,
        place: gameStore.getState().room?.name,
        aftermath: questBranch && outcome === "win"
          ? questBranch.aftermath || `这场打斗是「${questBranch.title}」的一环，写清这件事如何作结、主角如何回归。`
          : "",
      }, {
        ...narrator,
        // 走绑定版 setVarTree，让 varTreeRef 同步，免得下次写 varTree 用旧引用把摘要冲掉
        saveSummary: (id, text) => featureCtx().setVarTree((prev) => setFactSummary(prev, id, text)),
      });
      jotNote({
        text: result.recapNote,
        owner: [{ name: finishedNpc.name, via: VIA.FIRSTHAND }],
        source: NOTE_SOURCE.DUMB,
      });
    }
  }, { feature: "duel.finish" }), [duelingNpc, pendingQuestBranch, noteAction, addLog, jotNote, aiSummarizeFact, setDuelingNpc, setPendingQuestBranch, narrator]);

  const resetDuel = useCallback(() => applyResult(featureCtx(), () => {
    setDuelingNpc(null);
    setPendingQuestBranch(null);
  }, { feature: "duel.reset" }), [setDuelingNpc, setPendingQuestBranch]);

  return { handleNpcDuel, confirmDuel, cancelDuel, duelFinishHandler, resetDuel };
}
