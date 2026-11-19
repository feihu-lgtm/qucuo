import { ESCORT_QUESTS } from "../../quests/escortQuests.js";
import { BOUNTY_QUESTS } from "../../quests/bountyQuests.js";

const noOpResult = () => ({ logs: [] });
const invalidAmountResult = () => ({ logs: [{ t: "err", text: "  数额无效" }] });

export function acceptEscort(state, questRef) {
  const quest = ESCORT_QUESTS.find((entry) => entry.id === questRef?.id);
  if (!quest) return noOpResult();
  if (quest.fromLocations && !quest.fromLocations.includes(state.room?.name)) return noOpResult();
  if ((state.flags || []).includes(`quest_done_${quest.id}`) || state.questProgress?.[quest.id]?.active) {
    return noOpResult();
  }

  return {
    changes: {
      questProgress: { ...(state.questProgress || {}), [quest.id]: { active: true } },
    },
    settle: `接下护镖任务「${quest.title}」，目标是前往${quest.targetLocation}找${quest.targetNpc}交货`,
  };
}

export function acceptBounty(state, questRef) {
  const quest = BOUNTY_QUESTS.find((entry) => entry.id === questRef?.id);
  if (!quest) return noOpResult();
  if ((state.flags || []).includes(`quest_done_${quest.id}`) || state.questProgress?.[quest.id]?.active) {
    return noOpResult();
  }

  return {
    changes: {
      questProgress: { ...(state.questProgress || {}), [quest.id]: { active: true, count: 0 } },
    },
    settle: `接下悬赏「${quest.title}」`,
  };
}

export function claimBounty(state, questRef) {
  const quest = BOUNTY_QUESTS.find((entry) => entry.id === questRef?.id);
  if (!quest || (state.flags || []).includes(`quest_done_${quest.id}`)) return noOpResult();
  const progress = state.questProgress?.[quest.id];
  if (!progress?.active || progress.count < (quest.requiredCount || 1)) return noOpResult();
  if (!Number.isFinite(quest.reward) || quest.reward < 0 || !Number.isFinite(quest.karmaBonus || 0)) {
    return invalidAmountResult();
  }

  return {
    changes: {
      questProgress: { ...(state.questProgress || {}), [quest.id]: { active: false } },
      flags: [...(state.flags || []), `quest_done_${quest.id}`],
      char: { ...state.char, money: (state.char.money || 0) + quest.reward },
      dao: { ...(state.dao || {}), karma: ((state.dao || {}).karma || 0) + (quest.karmaBonus || 0) },
      pot: (state.pot || 0) + 10,
    },
    settle: `回来交付悬赏「${quest.title}」，领取赏金${quest.reward}两`,
  };
}
