import { useCallback } from "react";
import { callModel } from "../../apiConfig.js";
import { forgeDesign } from "../../extractionEngine.js";
import { NOTE_SOURCE } from "../../memory/note.js";

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
      const sys = `你是曲措乡这个武侠世界的说书人。玩家在天都镇玉石料场端详一块未开的赌石，请一位老师傅的口吻看皮相石。用3-5句章回说书人口吻，把下面的看皮线索演成一段相石评语（可用"雾""砂""蟒带"等行话），只说表象与吉凶暗示，绝不断言内里种水成色，绝不编造线索之外的判断。纯文本，不要JSON。`;
      const lines = [
        `皮壳：${clue.skinLabel}——${clue.skinClue}`,
        clue.changKouHint ? `场口眼力：${clue.changKouHint}` : "（认不出场口来历，悟性眼力未及）",
        clue.mistHint ? `雾象：${clue.mistHint}` : "",
      ].filter(Boolean).join("\n");
      const { text } = await callModel(apiCfg, sys, [{ role: "user", content: lines }], { maxTokens: apiCfg.callTokenLimits?.inspect ?? 4000, callLabel: "赌石相石" });
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
