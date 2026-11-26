// 名字 → 数据条目：在场名单 → 常驻人物表 → 地宫冒险者池 → 游走池 → 导入注册表；
// 查不到给 {name} 裸壳。原在 features/pigeon/inbound.js——飞鸽回信 prompt（domain 层）
// 也要用，下移 domain 消灭层逆向。（importedRegistry 由调用方注入，本层不碰 infra。）
import { RESIDENT_NPCS } from "../../data/npc/residentNpcs.js";
import { ADVENTURER_BY_NAME } from "../../data/dungeon/adventurers.js";
import { ADVENTURER_IP_BY_NAME } from "../../data/dungeon/adventurersIP.js";
import { NPC_POOL } from "../../data/npc/npcPool.js";

export function findNpcObject(state, npcName, importedRegistry = null) {
  const imported = importedRegistry?.getImportedNpc?.(npcName) || null;
  return (state.room?.npcs || []).find((npc) => npc.name === npcName)
    || Object.values(RESIDENT_NPCS).flat().find((npc) => npc.name === npcName)
    || ADVENTURER_BY_NAME[npcName]
    || ADVENTURER_IP_BY_NAME[npcName]
    || NPC_POOL.find((npc) => npc.name === npcName)
    || imported
    || { name: npcName };
}
