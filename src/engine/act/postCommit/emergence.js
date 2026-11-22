// ── NPC 涌现·第二阶段：传闻人物实体化（原 commitRound 内嵌块）──
import { mapDescriptionToGenParams } from "../../../domain/data/npc/npcDescriptionMapping.js";
import { ensureNpcCombatData } from "../../../domain/rules/npc/npcGeneration.js";
import { materializeNpc } from "../../../domain/rules/npc/roomNpcs.js";
import { clearRumor } from "../../../domain/rules/npc/npcEmergence.js";

export function materializeEmergence(d, { luck }) {
  if (d.p.emergedNpcDescription && d.p.emergedNpcName) {
    const { levelCap, personalityProfile } = mapDescriptionToGenParams(d.p.emergedNpcDescription);
    d.setVarTree(prev => clearRumor(prev, d.p.emergedNpcName));
    d.setRoom(r => ({
      ...r,
      npcs: materializeNpc(r.npcs, d.p.emergedNpcName,
        ensureNpcCombatData({ ...(r.npcs.find(n => n.name === d.p.emergedNpcName) || {}), personalityProfile }, { luck, levelCap })),
    }));
  }
}
