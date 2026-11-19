import { ESCORT_QUESTS } from "../../quests/escortQuests.js";
import { BOUNTY_QUESTS } from "../../quests/bountyQuests.js";
import { advanceQuestStages, createQuestProgress, lockExclusiveSiblings } from "../../quests/questEngine.js";
import { applyStageRewards, resolveStageRewards } from "../../quests/questRewards.js";
import { QUCUO_QUESTS } from "../../quests/qucuoQuests.js";

const noOpResult = () => ({ logs: [] });
const invalidAmountResult = () => ({ logs: [{ t: "err", text: "  数额无效" }] });

export function forceAdvanceQuest(state, quest, targetFlag) {
  const nextFlags = (state.flags || []).includes(targetFlag) ? state.flags : [...(state.flags || []), targetFlag];
  let progress = state.questProgress?.[quest.id] || createQuestProgress(quest.id);
  const gameState = { flags: nextFlags, char: state.char };
  const pendingRewards = [];
  while (progress.status === "active") {
    const result = advanceQuestStages(quest, progress, gameState);
    if (!result.advanced) break;
    progress = result.progress;
    if (result.completedStage) {
      const rewards = resolveStageRewards(result.completedStage, result.hitFlags);
      if (rewards) pendingRewards.push(rewards);
    }
    if (result.justCompleted) break;
  }
  let nextProgress = { ...(state.questProgress || {}), [quest.id]: progress };
  if (progress.status === "completed") {
    nextProgress = lockExclusiveSiblings(nextProgress, QUCUO_QUESTS, quest.id);
  }

  const changes = { flags: nextFlags, questProgress: nextProgress };
  const capture = (key) => (value) => {
    const previous = Object.hasOwn(changes, key) ? changes[key] : state[key];
    changes[key] = typeof value === "function" ? value(previous) : value;
  };
  for (const rewards of pendingRewards) {
    applyStageRewards(rewards, {
      setInv: capture("inv"),
      setChar: capture("char"),
      setVarTree: capture("varTree"),
      setFlags: capture("flags"),
    });
  }
  return { changes };
}

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
