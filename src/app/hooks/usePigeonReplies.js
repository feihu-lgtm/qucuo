import { useCallback, useEffect, useRef } from "react";
import { featureCtx } from "../runtime/gameRuntime.js";
import { gameStore, getGameEpoch, isGameEpochStale, useGameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import {
  applyPigeonReply,
  failPigeonReply,
  processPigeons,
  recordPigeonNpcLocations,
  retryPigeonReply,
} from "../../features/pigeon/logic.js";
import { findNpcObject } from "../../features/pigeon/inbound.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { withAI } from "../../engine/ports/withAI.js";
import "../../domain/rules/prompt/calls/sideCalls.js";
import { turnMonitor } from "../../infra/turnMonitor.js";

const webAi = createWebAi();

export function usePigeonReplies({
  apiCfg, applyPigeonResult,
}) {
  const pigeonProcessing = useRef(new Set());
  // 两条 effect 的触发依赖：房名/在场 NPC、时辰、varTree——hook 内直订 store，不经参数。
  const roomName = useGameStore((s) => s.room?.name);
  const roomNpcs = useGameStore((s) => s.room?.npcs);
  const time = useGameStore((s) => s.time);
  const varTree = useGameStore((s) => s.varTree);

  useEffect(() => {
    const result = recordPigeonNpcLocations(gameStore.getState());
    if (result.changes) applyResult(featureCtx(), result, { feature: "pigeon.recordNpcLocations", background: true });
  }, [roomName, roomNpcs]);

  const replyPigeonLetter = useCallback(async (letter) => {
    const { id } = letter;
    const epoch = getGameEpoch();
    const state = gameStore.getState();
    const isStale = () => isGameEpochStale(epoch);
    const hasPendingLetter = (cur) => (cur?.varTree?.世界?.飞鸽待回 || []).some((l) => l.id === id);
    try {
      const { ok, text } = await withAI("pigeon.reply", {
        state,
        // 夜班急修：不在场 NPC 不再裸壳进 prompt——按 pigeon.inbound 同口径全链路解析
        // 完整人设/随身/品阶，回信质量才立得住。
        letter: { ...letter, npc: findNpcObject(state, letter.npcName) },
        preset: state.preset,
        trace: (paths) => {
          const turn = turnMonitor.start("飞鸽回信", { background: true, source: "background-ai" });
          turnMonitor.add(turn, "domain", "提示词引用缺失", { status: "warn", detail: paths.join("、") });
          turnMonitor.finish(turn);
        },
      }, { ai: webAi, apiCfg, isStale });
      if (!ok || isStale()) return;
      const latestState = gameStore.getState();
      if (!hasPendingLetter(latestState)) return;
      applyPigeonResult(applyPigeonReply(latestState, letter, text), { feature: "pigeon.reply", background: true });
    } catch {
      // 夜班急修：上游超时/抖动一次不定死——attempts<2 留信重试，到 3 次才迷路兜底。
      if (isStale()) return;
      const latestState = gameStore.getState();
      if (!hasPendingLetter(latestState)) return;
      const attempts = (letter.attempts || 0) + 1;
      const result = attempts >= 3
        ? failPigeonReply(latestState, letter)
        : retryPigeonReply(latestState, letter);
      applyPigeonResult(result, { feature: "pigeon.reply", background: true });
    } finally {
      pigeonProcessing.current.delete(id);
    }
  }, [apiCfg, applyPigeonResult]);

  useEffect(() => {
    const due = processPigeons(gameStore.getState()).filter(l => !pigeonProcessing.current.has(l.id));
    if (!due.length) return;
    due.forEach(l => { pigeonProcessing.current.add(l.id); replyPigeonLetter(l); });
  }, [time, varTree, replyPigeonLetter]);
}
