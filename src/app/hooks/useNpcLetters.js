// 主动来信的后台半：到点的在途信生成正文落地（AI 现写，失败/无 API 按人设兜底），
// 鸽子落下一声响铃；「信」面板开着就把未读清零。
import { useCallback, useEffect, useRef } from "react";
import { featureCtx } from "../runtime/gameRuntime.js";
import { gameStore, getGameEpoch, isGameEpochStale, useGameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { applyInboundLetter, dueInboundLetters, findNpcObject, inboundFallbackLine, markAllLettersRead } from "../../features/pigeon/inbound.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { withAI } from "../../engine/ports/withAI.js";
import "../../domain/rules/prompt/calls/sideCalls.js";
import { turnMonitor } from "../../infra/turnMonitor.js";
import { OVERLAY, useOverlay } from "../../store/uiStore.js";
import { playLetterChime } from "../../infra/sfx.js";

const webAi = createWebAi();

export function useNpcLetters({ apiCfg }) {
  const processing = useRef(new Set());
  const time = useGameStore((s) => s.time);
  const varTree = useGameStore((s) => s.varTree);
  const lettersOpen = useOverlay(OVERLAY.LETTERS);

  const deliverLetter = useCallback(async (letter) => {
    const epoch = getGameEpoch();
    const isStale = () => isGameEpochStale(epoch);
    const state = gameStore.getState();
    const npc = findNpcObject(state, letter.npcName);
    let text = null;
    try {
      const { ok, text: aiText } = await withAI("pigeon.inbound", {
        state,
        letter: { ...letter, npc },
        preset: state.preset,
        trace: (paths) => {
          const turn = turnMonitor.start("NPC 来信", { background: true, source: "background-ai" });
          turnMonitor.add(turn, "domain", "提示词引用缺失", { status: "warn", detail: paths.join("、") });
          turnMonitor.finish(turn);
        },
      }, { ai: webAi, apiCfg, isStale });
      if (ok) text = aiText;
    } catch { /* 无 API/失败 → 人设兜底句 */ }
    finally {
      processing.current.delete(letter.id);
    }
    if (isStale()) return;
    // 生成期间玩家可能读/换档：待发名单里已没有这封信，就不许落进新档。
    const latestState = gameStore.getState();
    const stillPending = (latestState.varTree?.世界?.来信待发 || []).some((l) => l.id === letter.id);
    if (!stillPending) return;
    if (!text?.trim()) text = inboundFallbackLine(latestState, letter);
    applyResult(featureCtx(), applyInboundLetter(latestState, letter, text), { feature: "pigeon.inbound", background: true });
    playLetterChime();
  }, [apiCfg]);

  useEffect(() => {
    const due = dueInboundLetters(gameStore.getState()).filter((l) => !processing.current.has(l.id));
    if (!due.length) return;
    due.forEach((l) => { processing.current.add(l.id); deliverLetter(l); });
  }, [time, varTree, deliverLetter]);

  // 打开「信」面板：全部未读清零（顶栏计数同步消失）
  useEffect(() => {
    if (!lettersOpen) return;
    const res = markAllLettersRead(gameStore.getState());
    if (res.changes) applyResult(featureCtx(), res, { feature: "pigeon.lettersRead", background: true });
  }, [lettersOpen]);
}
