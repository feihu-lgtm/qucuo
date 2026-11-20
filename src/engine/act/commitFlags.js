import { filterSnowModelFlags } from "../../domain/quests/snowLeopardQuest.js";
import { QUCUO_QUESTS } from "../../domain/quests/qucuoQuests.js";
import { isNpcVisibleInInnerRoom } from "../../domain/map/innerMap.js";

export function commitModelFlags(d) {
  if (d.p.delta?.flags_add) {
    const npcs = (d.room?.npcs || []).filter((npc) => isNpcVisibleInInnerRoom(d.room?.name, d.innerRoomName, npc));
    d.p.delta.flags_add = filterSnowModelFlags(d.p.delta.flags_add, { ...d, room: { ...d.room, npcs } });
  }
  if (d.p.delta?.flags_add?.length) {
    d.setFlags(f => [...new Set([...f, ...d.p.delta.flags_add])]);
    // 说服型任务分支：AI 吐出了成功 flag，说明玩家把对方说动了——
    // 清挂起态（停止继续注入说服判定），forceAdvance 交给现有的 flag→stage 推进链。
    if (d.pendingQuestBranch?.mode === "talk" && d.p.delta.flags_add.includes(d.pendingQuestBranch.flag)) {
      const pq2 = QUCUO_QUESTS.find(x => x.id === d.pendingQuestBranch.questId);
      if (pq2) d.addLog([{ t: "affection", text: `  ✓ 你把话说到了点子上，「${pq2.title}」推进。` }]);
      d.setPendingQuestBranch(null);
    }
  }
}
