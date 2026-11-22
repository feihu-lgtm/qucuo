import { QUCUO_QUESTS } from "../../data/quests/qucuoQuests.js";
import { isNpcVisibleInInnerRoom } from "../map/innerMap.js";
import { getCurrentStage, isQuestGateOpen } from "./questEngine.js";

const list = (value) => Array.isArray(value) ? value : value ? [value] : [];
const localQuests = QUCUO_QUESTS.filter((quest) => quest.localOnly);
const systemFlags = new Set(localQuests.flatMap((quest) => quest.stages.flatMap((stage) => [
  ...list(stage.completionFlag),
  ...list(stage.onReach?.flags),
  ...Object.values(stage.onReach?.byFlag || {}).flatMap((reward) => list(reward.flags)),
])));

export function isLocalQuestFlag(flag) {
  return systemFlags.has(flag);
}

export function getLocalQuestStage(quest, state) {
  if (!quest.localOnly || !isQuestGateOpen(quest, state.questProgress, state.flags)) return null;
  const progress = state.questProgress?.[quest.id];
  if (progress && progress.status !== "active") return null;
  const stage = progress ? getCurrentStage(quest, progress) : quest.stages[0];
  if (!stage) return null;
  const { room, innerRoomName } = state;
  const { district, inner } = stage.requireLocation || {};
  if ((district && room?.name !== district) || (inner && innerRoomName !== inner)) return null;
  if (stage.giver !== null && quest.giver && !room?.npcs?.some((npc) =>
    npc.name === quest.giver && !npc.imported
    && (!quest.giverId || npc.id === quest.giverId || npc.id === `pool_${quest.giverId}`)
    && isNpcVisibleInInnerRoom(room.name, innerRoomName, npc))) return null;
  const requirement = stage.requiresShopSpendOrItem;
  if (requirement && !(state.char?.shopSpend?.[requirement.shopKey] >= requirement.amount)
    && !state.inv?.some((item) => item?.id === requirement.itemId)) return null;
  return stage;
}

export function isLocalQuestStageFlag(stage, flag) {
  return !!stage && list(stage.completionFlag).includes(flag);
}
