import { useCallback, useEffect, useRef } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import {
  applyPigeonReply,
  failPigeonReply,
  processPigeons,
  recordPigeonNpcLocations,
} from "../../features/pigeon/logic.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { withAI } from "../../domain/rules/prompt/withAI.js";
import "../../domain/rules/prompt/calls/sideCalls.js";
import { turnMonitor } from "../../core/turnMonitor.js";

const webAi = createWebAi();

export function usePigeonReplies({
  room, apiCfg, preset, applyPigeonResult, time, varTree, featureCtxRef,
}) {
  const pigeonProcessing = useRef(new Set());

  useEffect(() => {
    const result = recordPigeonNpcLocations(gameStore.getState());
    if (result.changes) applyResult(featureCtxRef.current, result, { feature: "pigeon.recordNpcLocations", background: true });
  }, [room.name, room.npcs]);

  const replyPigeonLetter = useCallback(async (letter) => {
    const { id } = letter;
    const state = gameStore.getState();
    try {
      const { text } = await withAI("pigeon.reply", {
        state,
        letter,
        preset,
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
  }, [apiCfg, preset, applyPigeonResult]);

  useEffect(() => {
    const due = processPigeons(gameStore.getState()).filter(l => !pigeonProcessing.current.has(l.id));
    if (!due.length) return;
    due.forEach(l => { pigeonProcessing.current.add(l.id); replyPigeonLetter(l); });
  }, [time, varTree, replyPigeonLetter]);
}
