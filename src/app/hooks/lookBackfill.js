// 无缓存的「环顾四周」不再整轮 act：地名、出口、在场人物立刻落日志，时辰 +1，
// 房间描写在后台补到事实行下面。没配 API 或 AI 出错时只留事实行。
import { gameStore, getGameEpoch, isGameEpochStale } from "../../store/gameStore.js";
import { QUCUO_MAP } from "../../domain/data/map/qucuoMap.js";
import { getInnerRoom, visibleInnerExits } from "../../domain/rules/map/innerMap.js";
import { buildLookNarrationPrompt, roomLookFact } from "../../domain/rules/map/lookBrief.js";
import { parseSettleNarration } from "../../domain/rules/settle/settleBrief.js";
import { getPresentNpcs } from "../../domain/rules/state/fields.js";
import { tagBackfill } from "../../domain/rules/log/backfill.js";
import { backfillInBackground, newBackfillKey } from "../../engine/ports/backfill.js";
import { askStoryteller, hasApiKey } from "../../engine/ports/storyteller.js";

export function lookScene(state = {}) {
  const room = state.room || {};
  const inner = state.innerRoomName && getInnerRoom(room.name, state.innerRoomName);
  const exits = inner
    ? visibleInnerExits(room.name, state.innerRoomName, state)
    : (QUCUO_MAP[room.name]?.exits || room.exits || {});
  return {
    place: inner ? `${room.name}·${state.innerRoomName}` : (room.name || ""),
    base: inner?.desc || QUCUO_MAP[room.name]?.desc || room.desc || "",
    exits,
    npcs: getPresentNpcs({ room, innerRoomName: state.innerRoomName }),
  };
}

export function lookInBackground(cmd, {
  addLog, setTime, setConvo, setLog, noteAction,
  getState = () => gameStore.getState(), ask = askStoryteller, canAsk = hasApiKey,
}) {
  const epoch = getGameEpoch();
  const state = getState();
  const scene = lookScene(state);
  const fact = roomLookFact(scene);
  const key = newBackfillKey("look");

  addLog([{ t: "cmd", text: `> ${cmd}` }, ...tagBackfill([{ t: "sys", text: `  ${fact}` }], key)]);
  setTime((t) => t + 1);
  setConvo?.((prev) => [...(prev || []),
    { role: "user", content: cmd, kind: "look" },
    { role: "assistant", content: fact, kind: "look" },
  ]);
  noteAction?.("action");

  const { sys, user } = buildLookNarrationPrompt(scene);
  return backfillInBackground(key, {
    canAsk,
    isStale: () => isGameEpochStale(epoch),
    setLog,
    ask: () => ask(sys, user, { callLabel: "环顾描写", maxTokens: 400 }),
    parse: parseSettleNarration,
  });
}
