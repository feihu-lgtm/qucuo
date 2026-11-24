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
    next.sold[soldKey] = true;
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
  const kept = carriedItems.filter(i => {
    if (i.stolen || i.dropped) return true; // 已有归宿：sold 无权改判
    return !sold[itemKey(i)];
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
  return byName?.trade ?? null;
}
