// ── NPC 涌现·第二阶段：传闻人物实体化（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { changes: { varTree, room } } 由 commitRound 统一落盘。
import { mapDescriptionToGenParams } from "../../../domain/data/npc/npcDescriptionMapping.js";
import { ensureNpcCombatData } from "../../../domain/rules/npc/npcGeneration.js";
import { npcTradeOf } from "../../../domain/rules/npc/npcTrade.js";
import { materializeNpc } from "../../../domain/rules/npc/roomNpcs.js";
import { clearRumor } from "../../../domain/rules/npc/npcEmergence.js";
import { hasInnerMap } from "../../../domain/rules/map/innerMap.js";

export function materializeEmergence({ p, luck, innerRoomName, npcState }) {
  if (!p.emergedNpcDescription || !p.emergedNpcName) return null;
  const { levelCap, personalityProfile } = mapDescriptionToGenParams(p.emergedNpcDescription);
  return {
    changes: {
      varTree: (prev) => clearRumor(prev, p.emergedNpcName),
      room: (r) => {
        const fixed = ensureNpcCombatData({
          ...(r.npcs.find(n => n.name === p.emergedNpcName) || {}),
          // upsert 路径下原名单里没有此人，名字必须显式带上
          name: p.emergedNpcName,
          personalityProfile,
          // 叙事里登场的人就站在玩家此刻所在的内层房间，不再默认落到锚点
          ...(hasInnerMap(r.name) && innerRoomName ? { innerRoom: innerRoomName } : {}),
        }, { luck, levelCap, trade: npcTradeOf(npcState, { name: p.emergedNpcName }) });
        // materializeNpc 只替换不新增：固定地图原地互动时 writeRoom 只认 r.npcs 名单、
        // 不信 p.room.npcs 的成员增减，所以登场者不存在时必须追加，否则永远进不了屋。
        const npcs = r.npcs.some((n) => n?.name === p.emergedNpcName)
          ? materializeNpc(r.npcs, p.emergedNpcName, fixed)
          : [...r.npcs, fixed];
        return { ...r, npcs };
      },
    },
  };
}
