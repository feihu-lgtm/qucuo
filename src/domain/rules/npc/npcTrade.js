// NPC 随身交易·持久化域（设计稿 docs/设计_NPC随身交易.md §3）：
// 存进存档的 npcState 按 NPC id 记 { trade: { sold: {itemId:true}, bought: [item快照] } }。
// 买走的从对方 carriedItems 划走、卖出的记进对方行囊——货随人走闭环，
// 与 stolen（被偷）/ dropped（切磋掉落）三态互斥：一件货只有一个归宿。

export const EMPTY_TRADE = { sold: {}, bought: [] };

// 交易归属按条目身份判：出场固化的 carry 条目带 id（`${npc.id}_ci${i}`），
// 老数据/兜底只有 name 时按 name 对。
export const itemKey = (item) => item?.id ?? item?.name ?? null;

/**
 * 把一次成交动作合并进 NPC 的 trade 记录。delta 是单个动作：
 *   { sold: item }   玩家买走 → sold[itemKey]=true，且从 bought 摘除（买回去的不许重复记）
 *   { bought: item } 玩家卖给 NPC → bought 追加条目快照，并清掉可能存在的 sold 标（失而复得）
 * 纯函数：入参不被改写，返回新对象；入参为空按 EMPTY_TRADE 兜底（老档/首笔交易）。
 * @param {{sold?:object, bought?:Array}} trade
 * @param {{sold?:object, bought?:object}} delta
 */
export function applyNpcTradeDelta(trade = EMPTY_TRADE, delta = {}) {
  const next = { sold: { ...(trade?.sold || {}) }, bought: [...(trade?.bought || [])] };
  const soldKey = itemKey(delta.sold);
  if (soldKey) {
    // 存条目快照不只是 true——重出场时 carriedItems 靠台账剔货，但「这件被卖掉的
    // 是甲刃还是糕点」只有快照答得出（attireExposure 的扒空证据看这里）。
    // 老档里已存的 true 值照常读（truthy 语义不变）。
    const snap = {};
    for (const k of ["name", "category", "slot"]) {
      if (delta.sold?.[k] != null) snap[k] = delta.sold[k];
    }
    next.sold[soldKey] = Object.keys(snap).length ? snap : true;
    next.bought = next.bought.filter(i => itemKey(i) !== soldKey);
  }
  if (delta.bought) {
    const boughtKey = itemKey(delta.bought);
    if (boughtKey) delete next.sold[boughtKey];
    if (!boughtKey || !next.bought.some(i => itemKey(i) === boughtKey)) {
      next.bought.push({ ...delta.bought });
    }
  }
  return next;
}

/**
 * 出场固化（ensureNpcCombatData）的 trade 叠加层：
 *   - sold：从 carriedItems 剔除——除非该件已记 stolen/dropped（归宿已定，互斥检查，
 *     迟到/越权的 sold 标记无权把已偷走/已掉落的货改判成"被买走"）；
 *   - bought：追加不在身上的条目快照（按身份去重），标 stolen:false 重新入袋。
 * @param {Array} carriedItems
 * @param {{sold?:object, bought?:Array}|null|undefined} trade
 */
export function applyTradeToCarriedItems(carriedItems = [], trade) {
  const sold = trade?.sold || {};
  const bought = trade?.bought || [];
  if (!Object.keys(sold).length && !bought.length) return carriedItems;
  // WO-23D0b：台账 bought 实例快照优先于出场固化模板——模板重抽会同 id
  // 再铸一件（`${npc.id}_ci${i}`），若不压掉模板，玩家赎回再卖回的实例
  // （铭文/磨损等实例字段）会被模板货顶掉静默丢账。同一 itemKey 只留台账实例。
  const boughtKeys = new Set(bought.map(itemKey).filter(Boolean));
  const snapshotOf = new Map(bought.filter((b) => itemKey(b)).map((b) => [itemKey(b), b]));
  const swappedKeys = new Set();
  const kept = carriedItems.flatMap(i => {
    if (i.stolen || i.dropped) return [i]; // 已有归宿：sold 无权改判
    const key = itemKey(i);
    // 模板同 id 原位换成台账实例（保序不挪位），实例字段（铭文/磨损）不丢
    if (boughtKeys.has(key) && !swappedKeys.has(key)) {
      swappedKeys.add(key);
      return sold[key] ? [] : [{ ...snapshotOf.get(key), stolen: false, dropped: false }];
    }
    return !sold[key] ? [i] : [];
  });
  const present = new Set(kept.map(itemKey));
  const extras = bought
    .filter(b => itemKey(b) && !present.has(itemKey(b)))
    .map(b => ({ ...b, stolen: false, dropped: false }));
  return extras.length ? [...kept, ...extras] : kept;
}

/**
 * 取某 NPC 的随身交易台账：npcState 按 id 记；落到房间名单里 id 可能丢（老档/AI
 * 新增路人），退一步按 name 找——两边各试一次。
 * @param {object} npcState  gameStore 里的 { [npcId]: { trade } }
 * @param {object} npc
 */
export function npcTradeOf(npcState, npc) {
  if (!npcState) return null;
  const byId = npc?.id ? npcState[npc.id] : null;
  if (byId?.trade) return byId.trade;
  const byName = npc?.name ? npcState[npc.name] : null;
  if (byName?.trade) return byName.trade;
  // 房间实例 id 每回出场可能换（pool_ 前缀/重抽）——台账按当时 id 记的，
  // 靠记录里存的 name 兜底扫一遍。
  if (npc?.name) {
    for (const rec of Object.values(npcState)) {
      if (rec?.name === npc.name && rec.trade) return rec.trade;
    }
  }
  return null;
}
