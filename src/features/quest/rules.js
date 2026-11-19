import { getCurrentStage } from "../../quests/questEngine.js";
import { pendingGroundItems } from "../../quests/collect.js";
import { QUCUO_QUESTS } from "../../quests/qucuoQuests.js";

export const collectGroundItemsRule = {
  id: "quest.collect-ground-items",
  deps: (state) => [state.room?.name, state.questProgress, state.inv],
  run(state) {
    const roomName = state.room?.name;
    if (!roomName) return null;
    const pending = pendingGroundItems(roomName, {
      questProgress: state.questProgress || {},
      quests: QUCUO_QUESTS,
      getCurrentStage,
      inv: state.inv || [],
      roomItems: state.room.items || [],
    });
    if (!pending.length) return null;

    return {
      changes: {
        room: (previous) => {
          const items = previous.items || [];
          const have = new Set(items.map((item) => (typeof item === "string" ? item : item.name)));
          const toAdd = pending.filter((item) => !have.has(item.name));
          return toAdd.length ? { ...previous, items: [...items, ...toAdd] } : previous;
        },
      },
    };
  },
};
