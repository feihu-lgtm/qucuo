// 战斗内道具栏（消耗品系统第1步）的纯函数：可用丹药清单、服药构造的临时疗伤招。
import { MOVE_TYPE } from "../../../domain/rules/combat/moveTypes.js";

// 战斗内可用的消耗品：只列即时救命类（A档）——回血/回气/解异常/假死保命。
// 临时六维、战前餐这类作用于时间线的 buff（B档）在战斗外吃更合理，战斗内不列出，
// 免得玩家在这里嗑一颗只在"下一场"才生效的战前餐、白白浪费一个回合。
// usedItems 里已经嗑过的份数要从可用数量里扣掉（同名药可能背包有多件）。
export const isBattleUsableConsumable = (c) =>
  !!c && (c.hpRestore || c.energyRestore || c.dispel || c.dispelAll || c.rebirthOnce);

export function listBattleItems(playerInv, usedItems) {
  const counts = {};
  for (const it of (playerInv || [])) {
    if (it && typeof it === "object" && isBattleUsableConsumable(it.consumable)) {
      counts[it.name] = counts[it.name] || { item: it, total: 0 };
      counts[it.name].total += 1;
    }
  }
  for (const name of usedItems) {
    if (counts[name]) counts[name].total -= 1;
  }
  return Object.values(counts).filter(x => x.total > 0);
}

// 把一件消耗品的即时效果构造成临时"疗伤型"状态招，交给 handleSelectMove 走正常回合结算。
export function consumablePseudoMove(invItem) {
  const c = invItem.consumable || {};
  const pseudoMove = {
    id: `__consume_${invItem.name}`,
    name: `服「${invItem.name}」`,
    type: MOVE_TYPE.STATUS, fromItem: true,
    energyCost: 0,
    baseDamageMultiplier: 0,
  };
  if (c.hpRestore) pseudoMove.hpRestore = c.hpRestore;
  if (c.energyRestore) pseudoMove.energyRestore = c.energyRestore;
  // 解异常：药品用 dispel:true 或 dispelAll:true 标记，统一走招式的 dispelSelf 通道，
  // 清掉自身控制/掉血类状态。
  if (c.dispel || c.dispelAll) pseudoMove.dispelSelf = true;
  // dispelAll 是全解：连印记一起清掉。
  if (c.dispelAll) pseudoMove.dispelMarks = true;
  // 假死保命：不是即时数值，标一个开关，结算里 _armRebirth 备好本场续命一次。
  const armRebirth = !!c.rebirthOnce;
  return { pseudoMove, armRebirth };
}
