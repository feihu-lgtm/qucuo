// ── WO-23D1 器物觉醒 deterministic 战绩账本（纯函数，无 AI，不升品阶）────────
// 账本 varTree.世界.器物谱[itemId] = {itemId,name,category,wins,nemesisKills,
//   awakenReady,awakened,firstTurn,lastTurn,lastBattleKey}
// 只跟踪背包里 category==="weapon" && equipped && id 的武器——严格按 id 不按名字，
// 旧档无 id 不追踪。wins>=5 或 nemesisKills>=1 置 awakenReady；
// 红档/已觉醒封顶后仍记 wins 但不再 ready。物品丢失/卖出账本保留但不可觉醒。
// 本单不做：AI 铭文、升 quality、UI——只出 deterministic 查询 API awakenableWeapons。

export function weaponLedgerEntry(item, turn) {
  return {
    itemId: item.id, name: item.name || "", category: item.category || "weapon",
    wins: 0, nemesisKills: 0, awakenReady: false, awakened: false,
    firstTurn: turn, lastTurn: turn, lastBattleKey: "",
  };
}

function isRed(item) {
  return item?.quality === "红" || item?.quality === "red";
}

// 记一场胜场（纯函数：输入 ledger/inv 不原地改；无账返回 null）。
// battleKey = `${turn}:${npcKey}` 同场幂等防重放连刷；nemesisKill=true 额外计斩。
export function recordWeaponVictory(ledger, item, { turn = 0, battleKey = "", nemesisKill = false } = {}) {
  if (!item?.id || item.category !== "weapon" || !item.equipped) return null;
  const entries = { ...(ledger || {}) };
  const prev = entries[item.id];
  if (prev && prev.lastBattleKey === battleKey && battleKey) return null; // 同场幂等
  const next = { ...(prev || weaponLedgerEntry(item, turn)), lastTurn: turn, lastBattleKey: battleKey };
  next.name = item.name || next.name;
  next.wins = (prev?.wins || 0) + 1;
  if (nemesisKill) next.nemesisKills = (prev?.nemesisKills || 0) + 1;
  // ready 闸：未觉醒且非红档才置；红档/awakened 封顶后仍记 wins 不 ready
  if (!next.awakened && !isRed(item) && (next.wins >= 5 || next.nemesisKills >= 1)) {
    next.awakenReady = true;
  }
  entries[item.id] = next;
  return entries;
}

// 休整期查询 API（deterministic）：背包中可觉醒武器——ready && 未觉醒 && 非红档。
// 严格按 id 核背包，账本残留但物品不在背包的不出。
export function awakenableWeapons(state) {
  const ledger = state?.varTree?.世界?.器物谱 || {};
  const inv = Array.isArray(state?.inv) ? state.inv : [];
  return inv.filter((it) =>
    it?.id && it.category === "weapon" && it.equipped &&
    ledger[it.id]?.awakenReady && !ledger[it.id]?.awakened && !isRed(it));
}
