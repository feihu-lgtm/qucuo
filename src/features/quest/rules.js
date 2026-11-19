import { alreadySatisfiedCollectStages, pendingGroundItems } from "../../domain/quests/collect.js";
import { QUCUO_QUESTS } from "../../domain/quests/qucuoQuests.js";
import { ESCORT_QUESTS } from "../../domain/quests/escortQuests.js";
import {
  advanceQuestStages,
  canBypassExclusive,
  createQuestProgress,
  getCurrentStage,
  isQuestGateOpen,
  lockExclusiveSiblings,
} from "../../domain/quests/questEngine.js";
import { resolveEnding } from "../../domain/quests/endingResolver.js";
import { getKeyItemState, initKeyItemTracking, transferKeyItem } from "../../domain/quests/itemTracking.js";
import { applyStageRewards, resolveStageRewards } from "../../domain/quests/questRewards.js";
import { makeTusiRobe, ownedSafeHouseKeys } from "../../domain/map/safeHouse.js";

const applyUpdate = (previous, update) => (
  typeof update === "function" ? update(previous) : update
);
const currentTime = (ctx) => ctx.getNow?.() ?? Date.now();

function createUpdateCollector(state) {
  const keys = ["char", "flags", "inv", "questProgress", "varTree"];
  const initial = {
    char: state.char || {},
    flags: state.flags || [],
    inv: state.inv || [],
    questProgress: state.questProgress || {},
    varTree: state.varTree || {},
  };
  const current = { ...initial };
  const updates = Object.fromEntries(keys.map((key) => [key, []]));
  const add = (key, update) => {
    updates[key].push(update);
    current[key] = applyUpdate(current[key], update);
  };
  const setters = {
    setChar: (update) => add("char", update),
    setFlags: (update) => add("flags", update),
    setInv: (update) => add("inv", update),
    setQuestProgress: (update) => add("questProgress", update),
    setVarTree: (update) => add("varTree", update),
  };
  const changes = () => Object.fromEntries(keys
    .filter((key) => updates[key].length)
    .map((key) => [key, (previous) => updates[key].reduce(
      (value, update) => applyUpdate(value, update),
      previous ?? initial[key],
    )]));
  return { add, current, setters, changes };
}

function forceAdvanceCollectQuest(state, quest, targetFlag, now) {
  const flags = state.flags || [];
  const nextFlags = flags.includes(targetFlag) ? flags : [...flags, targetFlag];
  let progress = state.questProgress?.[quest.id] || createQuestProgress(quest.id, now);
  const gameState = { flags: nextFlags, char: state.char || {} };
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
  const updates = createUpdateCollector(state);
  updates.add("flags", (previous) => previous.includes(targetFlag) ? previous : [...previous, targetFlag]);
  updates.add("questProgress", (previous) => ({ ...previous, ...Object.fromEntries(
    Object.entries(nextProgress).filter(([id, value]) => state.questProgress?.[id] !== value),
  ) }));
  for (const rewards of pendingRewards) applyStageRewards(rewards, updates.setters, now);
  return updates.changes();
}

export const alreadySatisfiedCollectRule = {
  id: "quest.already-satisfied-collect",
  deps: (state) => [state.questProgress, state.inv],
  run(state, ctx = {}) {
    const now = currentTime(ctx);
    const [done] = alreadySatisfiedCollectStages({
      questProgress: state.questProgress || {},
      quests: QUCUO_QUESTS,
      getCurrentStage,
      inv: state.inv || [],
    });
    if (!done) return null;
    return {
      changes: forceAdvanceCollectQuest(state, done.quest, done.flag, now),
      logs: [{ t: "affection", text: `  ✓ 采集所需之物早已在身，「${done.quest.title}」自动推进。` }],
    };
  },
};

export const escortArrivalRule = {
  id: "quest.escort-arrival",
  deps: (state) => [state.room?.name],
  run(state) {
    if (!state.room?.name) return null;
    const activeEscort = ESCORT_QUESTS.find((quest) => (
      state.questProgress?.[quest.id]?.active
      && quest.targetLocation === state.room.name
      && !(state.flags || []).includes(`quest_done_${quest.id}`)
    ));
    if (!activeEscort) return null;
    return {
      logs: [{
        t: "sys",
        text: `  ※ 护镖任务「${activeEscort.title}」目的地到了，在此处找到 ${activeEscort.targetNpc} 交货即可完成。`,
      }],
    };
  },
};

export const questFlagRule = {
  id: "quest.flag-triggers",
  deps: (state) => [state.flags],
  run(state, { getNow } = {}) {
    const now = getNow?.() ?? Date.now();
    const flags = state.flags || [];
    const questProgress = state.questProgress || {};
    const gameState = { flags, char: state.char || {} };
    const stageQuests = QUCUO_QUESTS.filter((quest) => quest.stages?.length);
    let next = { ...questProgress };
    let changed = false;
    const justCompletedIds = [];
    const pendingRewards = [];
    const logs = [];

    for (const quest of stageQuests) {
      if (!isQuestGateOpen(quest, next, flags)) continue;
      if (quest.id === "hidden_all_collect_line" && !canBypassExclusive(gameState)) continue;

      let progress = next[quest.id];
      if (!progress) {
        const firstFlag = quest.stages[0].completionFlag;
        const firstFlagHit = Array.isArray(firstFlag)
          ? firstFlag.some((flag) => flags.includes(flag))
          : flags.includes(firstFlag);
        if (!firstFlagHit) continue;
        progress = createQuestProgress(quest.id, now);
        changed = true;
      }
      if (progress.status !== "active") continue;

      let advancedAny = false;
      while (progress.status === "active") {
        const result = advanceQuestStages(quest, progress, gameState, now);
        if (!result.advanced) break;
        progress = result.progress;
        advancedAny = true;
        if (result.completedStage) {
          const rewards = resolveStageRewards(result.completedStage, result.hitFlags);
          if (rewards) pendingRewards.push(rewards);
        }
        if (result.justCompleted) {
          justCompletedIds.push(quest.id);
          break;
        }
      }
      if (advancedAny) {
        next[quest.id] = progress;
        changed = true;
      }
    }

    for (const questId of justCompletedIds) {
      next = lockExclusiveSiblings(next, QUCUO_QUESTS, questId);
      changed = true;
      const quest = stageQuests.find((entry) => entry.id === questId);
      logs.push({ t: "sys", text: `  ※ 任务「${quest.title}」已完成。${quest.rewardText || ""}` });
    }

    const updates = createUpdateCollector(state);
    if (changed) updates.add("questProgress", next);
    for (const rewards of pendingRewards) applyStageRewards(rewards, updates.setters, now);

    if (justCompletedIds.length) {
      updates.add("varTree", (previous) => {
        let nextTree = initKeyItemTracking(previous);
        if (justCompletedIds.includes("zhaxi_line")) {
          nextTree = transferKeyItem(nextTree, "虎胆", "土司府", "抵税所得，库房封存", state.time, "扎西献虎胆抵税，管家「明年照收」");
        }
        return nextTree;
      });
    } else if (flags.includes("quest_zhaxi_s3") && getKeyItemState(updates.current.varTree, "虎胆")?.holder !== "扎西") {
      updates.add("varTree", (previous) => transferKeyItem(
        initKeyItemTracking(previous),
        "虎胆",
        "扎西",
        "已猎得，尚未献出",
        state.time,
        "扎西在熊山猎得虎胆",
      ));
    } else if (flags.includes("quest_allin_s2") && getKeyItemState(updates.current.varTree, "虎胆")?.holder !== "玩家") {
      updates.add("varTree", (previous) => transferKeyItem(
        initKeyItemTracking(previous),
        "虎胆",
        "玩家",
        "夜闯土司府偷回",
        state.time,
        "玩家夜闯土司府偷回虎胆",
      ));
    }

    const ending = resolveEnding(gameState);
    if (ending && !flags.includes(`story_ending_${ending}`)) {
      updates.add("flags", (previous) => [...new Set([...previous, `story_ending_${ending}`])]);
      logs.push({ t: "sys", text: `  ※ 「虎胆三重门」结局已判定：${ending}` });
    }

    const changes = updates.changes();
    if (!Object.keys(changes).length && !logs.length) return null;
    return { changes, logs };
  },
};

export const estateStartRule = {
  id: "quest.estate-start",
  deps: (state) => [state.innerRoomName],
  run(state) {
    if (state.innerRoomName !== "溪边小屋") return null;
    return {
      changes: {
        flags: (previous) => previous.includes("tutorial_estate_started")
          ? previous
          : [...previous, "tutorial_estate_started"],
      },
    };
  },
};

const ESTATE_ANNOUNCEMENT = "玩家摩挲着溪边小屋钥匙柄上那截褪色的红绳，忽然意识到：曲措乡境内有四栋落了锁的房子，四把钥匙散在四条路上，门后藏着无数的宝藏与秘密——一个有趣的营生浮上心头。请写一两句白话古文点拨：有个有趣的任务出现了，不妨点开任务面板看看。不要替玩家做决定。";
const ESTATE_COMPLETION = "玩家集齐了曲措乡四栋房子的钥匙——溪边小屋、山间别墅、弟子别院、蜀王庄，四份家产尽握在手。正当此时，有人捧来一套土司礼服相赠。请写两三句白话古文：四宅齐备、在曲措乡站稳脚跟的滋味，以及换上土司礼服那一刻的体面与感慨。";

export const estateAnnouncementRule = {
  id: "quest.estate-announcement",
  deps: (state) => [state.flags],
  run(state, ctx = {}) {
    const now = currentTime(ctx);
    const flags = state.flags || [];
    if (!flags.includes("tutorial_estate_started") || flags.includes("tutorial_estate_announced")) return null;
    const count = ownedSafeHouseKeys(state.inv).length;
    return {
      changes: {
        flags: (previous) => previous.includes("tutorial_estate_announced")
          ? previous
          : [...previous, "tutorial_estate_announced"],
        questProgress: (previous) => previous.tutorial_four_estates ? previous : {
          ...previous,
          tutorial_four_estates: {
            ...createQuestProgress("tutorial_four_estates", now),
            currentStageIndex: Math.max(0, count - 1),
            progress: count,
          },
        },
      },
      settle: ESTATE_ANNOUNCEMENT,
    };
  },
};

export const estateProgressRule = {
  id: "quest.estate-progress",
  deps: (state) => [state.inv, state.questProgress, state.flags],
  run(state, ctx = {}) {
    const now = currentTime(ctx);
    const progress = state.questProgress?.tutorial_four_estates;
    if (!progress || progress.status !== "active") return null;
    const count = ownedSafeHouseKeys(state.inv).length;
    if (count >= 4) {
      if ((state.flags || []).includes("tutorial_estate_rewarded")) return null;
      return {
        changes: {
          flags: (previous) => previous.includes("tutorial_estate_rewarded")
            ? previous
            : [...previous, "tutorial_estate_rewarded"],
          questProgress: (previous) => ({
            ...previous,
            tutorial_four_estates: {
              ...previous.tutorial_four_estates,
              status: "completed",
              currentStageIndex: 4,
              progress: 4,
              completedAt: now,
            },
          }),
          inv: (previous) => [...previous, makeTusiRobe()],
        },
        logs: [{ t: "sys", text: "  ※ 任务「四宅家产」已完成。有人捧来一套土司礼服，放进了你的行囊。" }],
        settle: ESTATE_COMPLETION,
      };
    }
    const index = Math.max(0, count - 1);
    if ((progress.currentStageIndex ?? 0) === index) return null;
    return {
      changes: {
        questProgress: (previous) => ({
          ...previous,
          tutorial_four_estates: {
            ...previous.tutorial_four_estates,
            currentStageIndex: index,
            progress: count,
          },
        }),
      },
    };
  },
};

export const collectGroundItemsRule = {
  id: "quest.collect-ground-items",
  deps: (state) => [state.room?.name, state.questProgress, state.inv],
  run(state) {
    const roomName = state.room?.name;
    if (!roomName) return null;
    const pending = pendingGroundItems(roomName, {
      questProgress: state.questProgress || {},
      quests: QUCUO_QUESTS,
      getCurrentStage,
      inv: state.inv || [],
      roomItems: state.room.items || [],
    });
    if (!pending.length) return null;

    return {
      changes: {
        room: (previous) => {
          const items = previous.items || [];
          const have = new Set(items.map((item) => (typeof item === "string" ? item : item.name)));
          const toAdd = pending.filter((item) => !have.has(item.name));
          return toAdd.length ? { ...previous, items: [...items, ...toAdd] } : previous;
        },
      },
    };
  },
};
