// 查看 NPC 不再整轮 act：系统卡片立刻落日志，时辰 +1，外貌描写在后台补到卡片下面。
// 没配 API 或 AI 出错时只留卡片。
import { gameStore } from "../../store/gameStore.js";
import { buildNpcLookPrompt, npcLookCard } from "../../domain/rules/npc/npcLookBrief.js";
import { parseSettleNarration } from "../../domain/rules/settle/settleBrief.js";
import { tagBackfill } from "../../domain/rules/log/backfill.js";
import { backfillInBackground, newBackfillKey } from "../../engine/ports/backfill.js";
import { askStoryteller, hasApiKey } from "../../engine/ports/storyteller.js";

export function lookNpcInBackground(npc, extraReplies = [], {
  addLog, setTime, setConvo, setLog,
  getState = () => gameStore.getState(), ask = askStoryteller, canAsk = hasApiKey,
}) {
  const state = getState();
  const cmd = `看 ${npc.name}`;
  const card = [...npcLookCard(npc), ...extraReplies];
  const key = newBackfillKey("npcLook");

  // 描写跟在整张卡片下面：只给最后一行打 key。
  addLog([{ t: "cmd", text: `> ${cmd}` }, ...card.slice(0, -1), ...tagBackfill(card.slice(-1), key)]);
  setTime((t) => t + 1);
  setConvo?.((prev) => [...(prev || []),
    { role: "user", content: cmd },
    { role: "assistant", content: card.map((row) => row.text.trim()).join("；") },
  ]);

  const { sys, user } = buildNpcLookPrompt(npc, { place: state.room?.name || "" });
  return backfillInBackground(key, {
    canAsk,
    setLog,
    ask: () => ask(sys, user, { callLabel: "端详描写", maxTokens: 400 }),
    parse: parseSettleNarration,
  });
}
