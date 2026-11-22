// 势力据点的声誉门禁（合稿「不共戴天」档）：本势力声誉 ≤ -60 时，据点内层只剩锚点能站，
// 往里走就被守卫截回；据点里所有建筑闭门。建筑另可挂 faction + minRep 单独设门槛。
import { factionRepOf } from "./factionRep.js";

export const STRONGHOLD_BAN_REP = -60;

const STRONGHOLDS = {
  鱼定土司: {
    faction: "鱼定土司府",
    anchor: "府门",
    intercept: "巡捕营的骑手横矛拦在石阶下，白玛次仁冷笑一声：「土司有令，此人见一个拿一个。」刀出了鞘，你只能退回府门外。",
    closed: "差役砰地合上门板：「府里有令，不伺候你。」",
  },
};

export function strongholdBan(district, varTree) {
  const hold = STRONGHOLDS[district];
  if (!hold || factionRepOf(varTree, hold.faction) > STRONGHOLD_BAN_REP) return null;
  return hold;
}

export function buildingClosedReason(building, district, varTree) {
  const ban = strongholdBan(district, varTree);
  if (ban) return ban.closed;
  if (building?.minRep != null && factionRepOf(varTree, building.faction) < building.minRep) {
    return building.repLocked || `须${building.faction}声誉 ≥ ${building.minRep}。`;
  }
  return null;
}
