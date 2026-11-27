import { useCallback } from "react";
import { setGambleSession } from "../../store/sessionUiStore.js";
import { forgeDesign } from "../../engine/ports/forgeDesign.js";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { withAI } from "../../engine/ports/withAI.js";
import "../calls/hookCalls.js";
import { presentError } from "../../utils/apiErrors.js";

const webAi = createWebAi();

export function useCraftingAI({
  setInteractMode, setTalkTarget, act, apiCfg, addLog, setTime, jotNote,
}) {
  const handleGambleTalk = useCallback((bidderName, content, ctx) => {
    setGambleSession(ctx || { bidderName });
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
      addLog([{ t: "err", kind: presentError(e).kind, text: `  ${presentError(e).line}，相石没有成功。` }]);
      return "";
    }
  }, [apiCfg, addLog, jotNote]);

  const handleForgeDesign = useCallback(async ({ material, category, requirement }) => {
    try {
      return await forgeDesign({ material, category, requirement }, apiCfg);
    } catch (e) {
      addLog([{ t: "err", kind: presentError(e).kind, text: `  ${presentError(e).line}，铁匠这回没出成样式。` }]);
      return { ok: false, candidates: [] };
    }
  }, [apiCfg, addLog]);

  const handleJadeDesign = useCallback(async ({ material, category, requirement }) => {
    try {
      return await forgeDesign({ material, category, requirement, craft: { shop: "金玉行", maker: "玉匠", wares: "玉器饰物护身之物" } }, apiCfg);
    } catch (e) {
      addLog([{ t: "err", kind: presentError(e).kind, text: `  ${presentError(e).line}，玉匠这回没出成样式。` }]);
      return { ok: false, candidates: [] };
    }
  }, [apiCfg, addLog]);

  return { handleGambleTalk, handleGambleInspect, handleForgeDesign, handleJadeDesign };
}
