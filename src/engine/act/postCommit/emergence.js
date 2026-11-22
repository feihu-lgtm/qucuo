// ── NPC 涌现·第二阶段：传闻人物实体化（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { changes: { varTree, room } } 由 commitRound 统一落盘。
import { mapDescriptionToGenParams } from "../../../domain/data/npc/npcDescriptionMapping.js";
import { ensureNpcCombatData } from "../../../domain/rules/npc/npcGeneration.js";
import { materializeNpc } from "../../../domain/rules/npc/roomNpcs.js";
import { clearRumor } from "../../../domain/rules/npc/npcEmergence.js";

export function materializeEmergence({ p, luck }) {
  if (!p.emergedNpcDescription || !p.emergedNpcName) return null;
  const { levelCap, personalityProfile } = mapDescriptionToGenParams(p.emergedNpcDescription);
  return {
    changes: {
      varTree: (prev) => clearRumor(prev, p.emergedNpcName),
      room: (r) => ({
        ...r,
        npcs: materializeNpc(r.npcs, p.emergedNpcName,
          ensureNpcCombatData({ ...(r.npcs.find(n => n.name === p.emergedNpcName) || {}), personalityProfile }, { luck, levelCap })),
      }),
    },
  };
}
