// 路线甲纯函数化：返回 { logs, changes } 由 commitRound 统一落盘。
import { filterSnowModelFlags } from "../../domain/rules/quests/snowLeopardQuest.js";
import { isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { set, updateField } from "../../domain/rules/state/applyWrite.js";
import { isLocalQuestFlag } from "../../domain/rules/quests/localStages.js";

export function commitModelFlags({ p, room, innerRoomName, questProgress }) {
  if (p.delta?.flags_add) {
    const npcs = (room?.npcs || []).filter((npc) => isNpcVisibleInInnerRoom(room?.name, innerRoomName, npc));
    p.delta.flags_add = filterSnowModelFlags(p.delta.flags_add, { room: { ...room, npcs }, innerRoomName, questProgress })
      .filter((flag) => !isLocalQuestFlag(flag));
  }
  if (!p.delta?.flags_add?.length) return null;

  return {
    changes: {
      flags: updateField("flags", (flags) => set("flags", [...new Set([...flags, ...p.delta.flags_add])])),
    },
  };
}
