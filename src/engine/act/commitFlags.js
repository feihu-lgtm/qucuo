// 路线甲纯函数化：返回 { logs, changes } 由 commitRound 统一落盘。
import { filterSnowModelFlags } from "../../domain/rules/quests/snowLeopardQuest.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { set, updateField } from "../../domain/rules/state/applyWrite.js";
import { isLocalQuestFlag } from "../../domain/rules/quests/localStages.js";

export function commitModelFlags({ p, room, innerRoomName, questProgress, pendingQuestBranch }) {
  if (p.delta?.flags_add) {
    const npcs = (room?.npcs || []).filter((npc) => isNpcVisibleInInnerRoom(room?.name, innerRoomName, npc));
    p.delta.flags_add = filterSnowModelFlags(p.delta.flags_add, { room: { ...room, npcs }, innerRoomName, questProgress })
      .filter((flag) => !isLocalQuestFlag(flag));
  }
  if (!p.delta?.flags_add?.length) return null;

  const out = {
    changes: {
      flags: updateField("flags", (flags) => set("flags", [...new Set([...flags, ...p.delta.flags_add])])),
    },
  };
  // 说服型任务分支：AI 吐出了成功 flag，说明玩家把对方说动了——
  // 清挂起态（停止继续注入说服判定），forceAdvance 交给现有的 flag→stage 推进链。
  if (pendingQuestBranch?.mode === "talk" && p.delta.flags_add.includes(pendingQuestBranch.flag)) {
    const pq2 = QUCUO_QUESTS.find(x => x.id === pendingQuestBranch.questId);
    if (pq2) out.logs = [{ t: "affection", text: `  ✓ 你把话说到了点子上，「${pq2.title}」推进。` }];
    out.changes.pendingQuestBranch = null;
  }
  return out;
}
