// WO-16D 影子对账·类目映射（纯函数，单一事实源）
// 五类目：inv 物品增减 / flags 旗标 / affection 好感 / money 银钱 / npcs 在场名单。
// diff 器与判官投影器共用本文件的形状与键名，防双轨漂移。

// 审计结论：仓内钱币无独立玩家状态（银钱以物品/以物易物流通），不虚构钱币 diff——
// money 类目整体移除，待「币种/以物易物重新界定」后再议。
export const SHADOW_CATEGORIES = ["inv", "flags", "affection", "npcs"];

export function emptyCategories() {
  return {
    inv: { add: [], rm: [] },
    flags: { add: [] },
    affection: {}, // npc -> delta
    npcs: { add: [], rm: [] },
  };
}

const itemKey = (entry) => (typeof entry === "string" ? entry : entry?.id || entry?.name || "");
export { itemKey };


// 判官 facts → 五类目投影（op 级直投，不经过 materializeFacts 的状态编译——
// 影子只要语义对齐不要落账形状；条件券 conditional 不计入，因为它本来就可能作废）。
export function projectFacts(facts = []) {
  const out = emptyCategories();
  for (const fact of facts || []) {
    if (!fact || typeof fact !== "object" || fact.conditional) continue;
    switch (fact.op) {
      case "GRANT_ITEM": {
        if (fact.to === "player" || !fact.from) out.inv.add.push(fact.itemId || fact.itemName || "");
        else out.inv.rm.push(fact.itemId || fact.itemName || "");
        break;
      }
      case "TRANSFER_ITEM": {
        out.inv.rm.push(fact.itemId || fact.itemName || "");
        break;
      }
      case "MUTATE_SOCIAL": {
        if (fact.npc && Number.isFinite(fact.delta)) {
          out.affection[fact.npc] = (out.affection[fact.npc] || 0) + fact.delta;
        }
        break;
      }
      case "ADVANCE_QUEST": {
        if (fact.flag) out.flags.add.push(fact.flag);
        break;
      }
      case "ALTER_WORLD_SCENE": {
        if (fact.npc) out.npcs.add.push(fact.npc);
        break;
      }
      default:
        break;
    }
  }
  return out;
}
