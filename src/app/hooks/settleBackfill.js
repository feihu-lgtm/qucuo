// 结算回合后台补写：系统已定的结果不再整轮 act（占回合、等 AI），
// 改为事实行立刻落日志、时辰 +1、事实照旧登记，描写在后台补到事实行下面。
// 和原结算回合的差别：底部选项不刷新，NPC 不再顺口回话。

import { gameStore } from "../../store/gameStore.js";
import { NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";
import { buildSettleNarrationPrompt, parseSettleNarration, settleFactText } from "../../domain/rules/settle/settleBrief.js";
import { tagBackfill } from "../../domain/rules/log/backfill.js";
import { registerMemoryFact } from "../../engine/act/postCommit/memoryFact.js";
import { backfillInBackground, newBackfillKey } from "../../engine/ports/backfill.js";
import { askStoryteller, hasApiKey } from "../../engine/ports/storyteller.js";

export function settleInBackground(cmd, opts = {}, {
  addLog, setTime, setConvo, setVarTree, setLog, jotNote, noteAction,
  getState = () => gameStore.getState(), ask = askStoryteller, canAsk = hasApiKey,
}) {
  const state = getState();
  const fact = settleFactText(cmd);
  const npc = opts.settleNpc || null;
  const room = state.room || {};
  const time = state.time;
  const key = newBackfillKey("settle");

  // 事实行用 cmd 类型：和原结算回合的 `> 结算文本` 回显一样自成一组，不会被并进上一条已折叠的指令下面。
  addLog(tagBackfill([{ t: "cmd", text: `> ${fact}` }], key));
  setTime((t) => t + 1);
  setConvo?.((prev) => [...(prev || []),
    { role: "user", content: cmd },
    { role: "assistant", content: fact, memory: fact, turn: time },
  ]);
  const ledger = registerMemoryFact({ p: { memory: fact }, room, activeTarget: npc, isTalk: false, time });
  if (ledger?.changes?.varTree) setVarTree?.(ledger.changes.varTree);
  jotNote?.({
    text: fact,
    owner: npc ? [{ name: npc, via: VIA.FIRSTHAND }] : [],
    source: NOTE_SOURCE.NARRATIVE,
  });
  noteAction?.("settle");

  const { sys, user } = buildSettleNarrationPrompt(cmd, { place: room.name, npc });
  return backfillInBackground(key, {
    canAsk,
    setLog,
    ask: () => ask(sys, user, { callLabel: "结算描写", maxTokens: 400 }),
    parse: parseSettleNarration,
  });
}
