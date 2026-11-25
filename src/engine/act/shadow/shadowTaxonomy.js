// WO-16D 影子对账·类目映射（纯函数，单一事实源）
// 五类目：inv 物品增减 / flags 旗标 / affection 好感 / money 银钱 / npcs 在场名单。
// diff 器与判官投影器共用本文件的形状与键名，防双轨漂移。

// 审计结论：仓内钱币无独立玩家状态（银钱以物品/以物易物流通），不虚构钱币 diff——
// money 类目整体移除，待「币种/以物易物重新界定」后再议。
// WO-16D-M1 补四类目：vitals 气血/银两（char.hp[0]/char.money 数值增减）、skills 技能增删、
// cultivation 修为（exp/pot 数值增量）、quest 任务推进语义投影。money 不复活大类——
// 银两作为 vitals.money 子项随气血同列（char.money 可精确 diff，见 shadowDiff）。
export const SHADOW_CATEGORIES = ["inv", "flags", "affection", "npcs", "vitals", "skills", "cultivation", "quest", "world"];

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
    world: {}, // 世界变量 numeric leaf -> delta（威望 等 varTree.世界 标量）
  };
}

// S5 归一裁决：同一物的 id/名字差异不得误报——双边统一「名字优先、id 兜底」。
// 判官事实带 itemId+itemName、单调用 inv 条目带 id+name，语义同一性按名字对齐。
const itemKey = (entry) => (typeof entry === "string" ? entry : entry?.name || entry?.id || "");
const factItemKey = (fact) => fact?.itemName || fact?.itemId || "";
export { itemKey, factItemKey };

// S5 feature 路由类目豁免映射：这些 kind 有系统 deterministic 前路
// （intentRouter/feature 层），影子按 intake actions 命中即把对应类目标不参与比较。
//   equip    装备/卸下 → inv（ deterministic 穿脱，inv 变化不走判官）
//   use_item 吃喝敷药  → inv+vitals（消耗品扣件/回血走系统前路）
//   take     拾取      → inv（collectGranted deterministic 拾取）
//   invite   邀同行    → affection（同伴系统结算好感不经判官）
export const FEATURE_ROUTED_KIND_CATS = {
  equip: ["inv"],
  use_item: ["inv", "vitals"],
  take: ["inv"],
  invite: ["affection"],
  // S7 裁决：trade 属延期交互路由（runDeferred→商店 UI），判官链只受理问价/看货
  // 意向，成交发生在后续商店操作——同回合单调用直接记账不参与覆盖率对比。
  // 粒度说明：vitals 为整类目豁免（hp+money 不可分）——与 use_item 既有先例同口径；
  // trade 回合几乎无 hp 变动，误豁免风险可忽略，为最小正确实现。
  trade: ["inv", "vitals"],
};

export function featureRoutedCats(actions = []) {
  const out = new Set();
  for (const a of actions || []) {
    // Review 修（S5）：带前提的条件动作（「要是/如果……就」）在 live router 里
    // 跳过不执行——并未真走 feature 路由，豁免会把判官漏判洗成盲区。
    if (a?.condition && a.condition !== "无") continue;
    for (const cat of FEATURE_ROUTED_KIND_CATS[a?.kind] || []) out.add(cat);
  }
  return [...out];
}


// 判官 facts → 五类目投影（op 级直投，不经过 materializeFacts 的状态编译——
// 影子只要语义对齐不要落账形状；条件券 conditional 不计入，因为它本来就可能作废）。
export function projectFacts(facts = []) {
  const out = emptyCategories();
  for (const fact of facts || []) {
    if (!fact || typeof fact !== "object" || fact.conditional) continue;
    switch (fact.op) {
      case "GRANT_ITEM": {
        if (fact.to === "player" || !fact.from) out.inv.add.push(factItemKey(fact));
        else out.inv.rm.push(factItemKey(fact));
        break;
      }
      case "TRANSFER_ITEM": {
        // S5 双向投影：与单调用 items_add/items_rm 同口径——玩家失去记 rm
        // （give 送礼），玩家获得记 add（steal 得手），不再单向只记 rm。
        const k = factItemKey(fact);
        if (fact.to === "player") out.inv.add.push(k);
        else out.inv.rm.push(k);
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
