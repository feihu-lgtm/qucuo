import { useCallback } from "react";
import { forgeDesign } from "../../domain/prompt/extractionEngine.js";
import { NOTE_SOURCE } from "../../domain/memory/note.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { withAI } from "../../domain/prompt/withAI.js";
import "../calls/hookCalls.js";

const webAi = createWebAi();

export function useCraftingAI({
  gambleTalkCtx, setInteractMode, setTalkTarget, act, apiCfg, addLog, setTime, jotNote,
}) {
  const handleGambleTalk = useCallback((bidderName, content, ctx) => {
    gambleTalkCtx.current = ctx || { bidderName };
    setInteractMode("talk");
    setTalkTarget(bidderName);
    act(content);
  }, [act]);

  const handleGambleInspect = useCallback(async (stone, clue) => {
    try {
      const { text } = await withAI("crafting.appraise", { stone, clue }, { ai: webAi, apiCfg });
      const t = (text || "").trim();
      if (t) {
        addLog([{ t: "cmd", text: "> 相石 · 看皮" }, { t: "desc", text: "  " + t }]);
        setTime(x => x + 1);
        jotNote({ text: "在玉石料场相了一块赌石的皮壳，听老师傅讲了一段看皮的门道。", owner: [], source: NOTE_SOURCE.NARRATIVE });
      }
      return t;
    } catch (e) {
      addLog([{ t: "err", text: `  [错误] 相石失败：${e.message}` }]);
      return "";
    }
  }, [apiCfg, addLog, jotNote]);

  const handleForgeDesign = useCallback(async ({ material, category, requirement }) => {
    try {
      return await forgeDesign({ material, category, requirement }, apiCfg);
    } catch (e) {
      addLog([{ t: "err", text: `  [错误] 铁匠铺设计失败：${e.message || e}` }]);
      return { ok: false, candidates: [] };
    }
  }, [apiCfg, addLog]);

  const handleJadeDesign = useCallback(async ({ material, category, requirement }) => {
    try {
      return await forgeDesign({ material, category, requirement, craft: { shop: "金玉行", maker: "玉匠", wares: "玉器饰物护身之物" } }, apiCfg);
    } catch (e) {
      addLog([{ t: "err", text: `  [错误] 金玉行设计失败：${e.message || e}` }]);
      return { ok: false, candidates: [] };
    }
  }, [apiCfg, addLog]);

  return { handleGambleTalk, handleGambleInspect, handleForgeDesign, handleJadeDesign };
}
