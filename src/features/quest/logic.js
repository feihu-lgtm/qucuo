import { ESCORT_QUESTS } from "../../domain/quests/escortQuests.js";
import { BOUNTY_QUESTS } from "../../domain/quests/bountyQuests.js";
import { advanceQuestStages, createQuestProgress, lockExclusiveSiblings } from "../../domain/quests/questEngine.js";
import { applyStageRewards, resolveStageRewards } from "../../domain/quests/questRewards.js";
import { QUCUO_QUESTS } from "../../domain/quests/qucuoQuests.js";
import { set, updateField } from "../../domain/state/applyWrite.js";

const noOpResult = () => ({ logs: [] });
const invalidAmountResult = () => ({ logs: [{ t: "err", text: "  数额无效" }] });

export function forceAdvanceQuest(state, quest, targetFlag, now) {
  const flags = state.flags || [];
  const addedFlag = flags.includes(targetFlag) ? flags : [...flags, targetFlag];
  let progress = state.questProgress?.[quest.id] || createQuestProgress(quest.id, now);
  const gameState = { flags: addedFlag, char: state.char || {} };
  const pendingRewards = [];

  while (progress.status === "active") {
    const result = advanceQuestStages(quest, progress, gameState, now);
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

  const flagUpdates = [updateField("flags", (prev) => set("flags", prev.includes(targetFlag) ? prev : [...prev, targetFlag]))];
  const changedProgress = Object.fromEntries(
    Object.entries(nextProgress).filter(([id, value]) => state.questProgress?.[id] !== value),
  );
  const changes = {
    flags: (prev) => flagUpdates.reduce((value, update) => update(value), prev || []),
    questProgress: (prev) => ({ ...(prev || {}), ...changedProgress }),
  };
  const local = {
    inv: state.inv || [],
    char: state.char || {},
    varTree: state.varTree || {},
    flags: addedFlag,
  };
  const varTreeUpdates = [];
  const invUpdates = [];
  const charUpdates = [];
  const setters = {
    setInv: (update) => {
      invUpdates.push(update);
      local.inv = typeof update === "function" ? update(local.inv) : update;
    },
    setChar: (update) => {
      charUpdates.push(update);
      local.char = typeof update === "function" ? update(local.char) : update;
    },
    setVarTree: (update) => {
      varTreeUpdates.push(update);
      local.varTree = typeof update === "function" ? update(local.varTree) : update;
    },
    setFlags: (update) => {
      flagUpdates.push(update);
      local.flags = typeof update === "function" ? update(local.flags) : update;
    },
  };

  for (const rewards of pendingRewards) applyStageRewards(rewards, setters, now);
  if (invUpdates.length) {
    changes.inv = (prev) => invUpdates.reduce(
      (value, update) => typeof update === "function" ? update(value) : update,
      prev || [],
    );
  }
  if (charUpdates.length) {
    changes.char = (prev) => charUpdates.reduce(
      (value, update) => typeof update === "function" ? update(value) : update,
      prev || {},
    );
  }
  changes.flags = (prev) => flagUpdates.reduce(
    (value, update) => typeof update === "function" ? update(value) : update,
    prev || [],
  );
  if (varTreeUpdates.length) {
    changes.varTree = (prev) => varTreeUpdates.reduce(
      (tree, update) => typeof update === "function" ? update(tree) : update,
      prev || {},
    );
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
