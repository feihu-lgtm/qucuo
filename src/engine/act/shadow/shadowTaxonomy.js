// WO-16D 影子对账·类目映射（纯函数，单一事实源）
// 五类目：inv 物品增减 / flags 旗标 / affection 好感 / money 银钱 / npcs 在场名单。
// diff 器与判官投影器共用本文件的形状与键名，防双轨漂移。

// 审计结论：仓内钱币无独立玩家状态（银钱以物品/以物易物流通），不虚构钱币 diff——
// money 类目整体移除，待「币种/以物易物重新界定」后再议。
// WO-16D-M1 补四类目：vitals 气血/银两（char.hp[0]/char.money 数值增减）、skills 技能增删、
// cultivation 修为（exp/pot 数值增量）、quest 任务推进语义投影。money 不复活大类——
// 银两作为 vitals.money 子项随气血同列（char.money 可精确 diff，见 shadowDiff）。
export const SHADOW_CATEGORIES = ["inv", "flags", "affection", "npcs", "vitals", "skills", "cultivation", "quest"];

export function emptyCategories() {
  return {
    inv: { add: [], rm: [] },
    flags: { add: [] },
    affection: {}, // npc -> delta
    npcs: { add: [], rm: [] },
    vitals: { hp: 0, money: 0 },
    skills: { add: [], rm: [] },
    cultivation: { exp: 0, pot: 0 },
    quest: { advance: [] },
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
        // 判官事实的好感增量字段是 affectionDelta（judgeTurn L150 口径），兼容旧 delta。
        const d = Number.isFinite(fact.affectionDelta) ? fact.affectionDelta : fact.delta;
        if (fact.npc && Number.isFinite(d)) {
          out.affection[fact.npc] = (out.affection[fact.npc] || 0) + d;
        }
        break;
      }
      case "ADVANCE_QUEST": {
        if (fact.flag) out.flags.add.push(fact.flag);
        // quest 语义投影：只认 questId——flag 已由 flags 类目覆盖，无 questId 无法语义归因不硬造
        if (fact.questId) out.quest.advance.push(fact.questId);
        break;
      }
      case "CHANGE_VITALS_SILVER": {
        if (Number.isFinite(fact.hpDelta)) out.vitals.hp += fact.hpDelta;
        if (Number.isFinite(fact.moneyDelta)) out.vitals.money += fact.moneyDelta;
        break;
      }
      case "BESTOW_SKILL": {
        // 天机券空白未填名的 BESTOW_SKILL 无可归因标识——跳过不硬造（券填名后事实带 skillName）
        const sk = fact.skillName || fact.skill || fact.skillId || "";
        if (sk) out.skills.add.push(sk);
        break;
      }
      case "PROGRESS_CULTIVATION": {
        if (Number.isFinite(fact.expDelta)) out.cultivation.exp += fact.expDelta;
        if (Number.isFinite(fact.potDelta)) out.cultivation.pot += fact.potDelta;
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
