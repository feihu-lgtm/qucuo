// 金鸟金蛋开奖后，元朵朵的当场反应：开奖卡片先落，她的反应稍后追加——
// 有 API 由 AI 现写一句（人设+奖项分档喂进小 prompt）；没 API 或 AI 失败
// 按反应档挑手写兜底句。不插占位行，写完才来，免得留一条「……」挂尾巴。
import { gameActions, getGameEpoch, isGameEpochStale } from "../../store/gameStore.js";
import { eggFallbackLine, eggReactionPrompt } from "../../domain/rules/npc/goldenEgg.js";
import { parseSettleNarration } from "../../domain/rules/settle/settleBrief.js";
import { askStoryteller, hasApiKey } from "../../engine/ports/storyteller.js";

export async function duoduoEggReaction(prize, tier, {
  addLog, rng = Math.random,
  ask = askStoryteller, canAsk = hasApiKey, isStale,
} = {}) {
  const epoch = getGameEpoch();
  const stale = () => isStale?.() || isGameEpochStale(epoch);
  if (stale()) return null;
  const log = addLog || ((lines) => gameActions.setLog((p) => [...p, ...lines]));
  const fallback = () => log([{ t: "sys", text: `  ${eggFallbackLine(tier, rng)}` }]);
  if (!canAsk()) { fallback(); return null; }
  try {
    const text = await ask(
      ...(() => { const { sys, user } = eggReactionPrompt({ prize, tier }); return [sys, user]; })(),
      { callLabel: "朵朵开奖反应", maxTokens: 1000 },
    );
    if (stale()) return null;
    const lines = text ? parseSettleNarration(text) : null;
    if (lines?.length) { log(lines); return lines; }
    fallback();
    return null;
  } catch {
    if (!stale()) fallback();
    return null;
  }
}
