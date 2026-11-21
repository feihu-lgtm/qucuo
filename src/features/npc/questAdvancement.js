import { QUCUO_QUESTS } from "../../domain/quests/qucuoQuests.js";
import { createQuestProgress, advanceQuestStages, lockExclusiveSiblings } from "../../domain/quests/questEngine.js";
import { applyStageRewards, resolveStageRewards } from "../../domain/quests/questRewards.js";
import { set, updateField } from "../../domain/state/applyWrite.js";

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
  return changes;
}
