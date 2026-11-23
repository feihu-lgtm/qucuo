import { useCallback, useEffect, useRef } from "react";
import { gameStore, useGameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import {
  applyPigeonReply,
  failPigeonReply,
  processPigeons,
  recordPigeonNpcLocations,
} from "../../features/pigeon/logic.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { withAI } from "../../engine/ports/withAI.js";
import "../../domain/rules/prompt/calls/sideCalls.js";
import { turnMonitor } from "../../engine/ports/turnMonitor.js";

const webAi = createWebAi();

export function usePigeonReplies({
  apiCfg, applyPigeonResult, featureCtxRef,
}) {
  const pigeonProcessing = useRef(new Set());
  // 两条 effect 的触发依赖：房名/在场 NPC、时辰、varTree——hook 内直订 store，不经参数。
  const roomName = useGameStore((s) => s.room?.name);
  const roomNpcs = useGameStore((s) => s.room?.npcs);
  const time = useGameStore((s) => s.time);
  const varTree = useGameStore((s) => s.varTree);

  useEffect(() => {
    const result = recordPigeonNpcLocations(gameStore.getState());
    if (result.changes) applyResult(featureCtxRef.current, result, { feature: "pigeon.recordNpcLocations", background: true });
  }, [roomName, roomNpcs]);

  const replyPigeonLetter = useCallback(async (letter) => {
    const { id } = letter;
    const state = gameStore.getState();
    try {
      const { text } = await withAI("pigeon.reply", {
        state,
        letter,
        preset: state.preset,
        trace: (paths) => {
          const turn = turnMonitor.start("飞鸽回信", { background: true, source: "background-ai" });
          turnMonitor.add(turn, "domain", "提示词引用缺失", { status: "warn", detail: paths.join("、") });
          turnMonitor.finish(turn);
        },
      }, { ai: webAi, apiCfg });
      applyPigeonResult(applyPigeonReply(state, letter, text), { feature: "pigeon.reply", background: true });
    } catch {
      pigeonProcessing.current.delete(id);
      applyPigeonResult(failPigeonReply(gameStore.getState(), letter), { feature: "pigeon.reply", background: true });
    }
  }, [apiCfg, applyPigeonResult]);

  useEffect(() => {
    const due = processPigeons(gameStore.getState()).filter(l => !pigeonProcessing.current.has(l.id));
    if (!due.length) return;
    due.forEach(l => { pigeonProcessing.current.add(l.id); replyPigeonLetter(l); });
  }, [time, varTree, replyPigeonLetter]);
}
