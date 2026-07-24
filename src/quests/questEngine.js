// 任务追踪引擎
// 任务进度独立存储在自己的状态里（不塞进 flags 那个纯字符串数组），
// 因为任务需要结构化数据：当前进度数字、多阶段状态、完成时间等，
// flags 数组只适合"这件事发生没发生"的布尔判定，两者职责不同不该混用。

import { QUEST_TYPE } from "./questTypes.js";

// 一个任务实例的完整结构（数据由预设/剧情作者手写，不是运行时生成）：
// {
//   id: "hunter_learn_quest",
//   type: QUEST_TYPE.LEARN_SKILL,
//   title: "老猎户的考验",
//   giver: "老猎户",           // 委托人NPC名
//   description: "...",
//   requiredCount: 3,          // KILL/COLLECT类用得上，其他类型可省略
//   targetTag: "熊山野兽",     // KILL类用
//   itemId: "...",             // FETCH/COLLECT类用
//   rewardSkillId: "...",      // LEARN_SKILL类：完成后解锁的技能
// }

export function createQuestProgress(questId) {
  return {
    questId,
    status: "active",  // 'active' | 'completed' | 'failed' | 'locked_by_exclusive'
    progress: 0,        // 数字型进度（击杀数/收集数），布尔型任务忽略这个字段
    currentStageIndex: 0, // 多阶段任务链（quest.stages）用，见 advanceQuestStages
    startedAt: Date.now(),
    completedAt: null,
  };
}

// 取当前所处的 stage 对象（仅多阶段任务用，quest.stages 不存在时返回 null）
export function getCurrentStage(quest, progress) {
  if (!quest?.stages?.length || !progress) return null;
  return quest.stages[progress.currentStageIndex ?? 0] ?? null;
}

// 多阶段任务链的核心推进函数：检查当前 stage 的 completionFlag 是否已经出现在
// gameState.flags 里，出现则 currentStageIndex 前进一位；一次调用只推进一格，
// 不会一次跳过多个 stage（即使 flags 里同时躺着好几个 stage 的 flag），
// 这样每个 stage 转换都能被外部调用方（比如 MudRPG.jsx 的 useEffect）单独感知到，
// 用来决定要不要在 log 里提示、要不要触发互斥锁定等后续动作。
// completionFlag 可以是单个字符串，也可以是字符串数组（分支点：玩家选了A/B/C
// 其中任意一支对应的 flag 出现即算这一步过关，具体选了哪支仍留在 flags 里，
// 供后续判断"是哪条分支"用，不会因为改用数组而丢失这个信息）。
// 返回 { progress, advanced, justCompleted, completedStage, hitFlags }：
//   advanced      —— 这次调用是否真的推进了一个 stage
//   justCompleted —— 推进后是否已经是最后一个 stage（即整个任务完成）
//   completedStage—— 刚刚推进过去的那个 stage 对象（供调用方读取 onReach 奖励数据）
//   hitFlags      —— 这次实际命中的 flag（数组，通常只有一个；分支点里是玩家
//                     实际选中的那一支），供 questRewards.js 按分支查具体奖励
export function advanceQuestStages(quest, progress, gameState) {
  if (!quest?.stages?.length || !progress || progress.status !== "active") {
    return { progress, advanced: false, justCompleted: false, completedStage: null, hitFlags: [] };
  }
  const stage = getCurrentStage(quest, progress);
  if (!stage) return { progress, advanced: false, justCompleted: false, completedStage: null, hitFlags: [] };
  const flags = gameState.flags || [];
  const candidateFlags = Array.isArray(stage.completionFlag) ? stage.completionFlag : [stage.completionFlag];
  const hitFlags = candidateFlags.filter(f => flags.includes(f));
  if (!hitFlags.length) return { progress, advanced: false, justCompleted: false, completedStage: null, hitFlags: [] };

  const nextIndex = (progress.currentStageIndex ?? 0) + 1;
  const justCompleted = nextIndex >= quest.stages.length;
  // 结局分支不总是"成功"——比如把线索埋回去、拒绝帮忙这类收尾，叙事上是
  // 任务的"落空"而不是"达成"。stage.outcomeByFlag（按命中的具体flag查）或
  // stage.outcome（整个stage统一的默认值）声明这一点，缺省视为 positive。
  // 参照真实RPG（Fallout/RPG Maker 等）quest状态机普遍把 failed 和 completed
  // 分开记录，不是只有一种"完成"状态。
  let outcome = "positive";
  if (justCompleted) {
    const byFlagOutcome = stage.outcomeByFlag && hitFlags.map(f => stage.outcomeByFlag[f]).find(Boolean);
    outcome = byFlagOutcome || stage.outcome || "positive";
  }
  const nextProgress = {
    ...progress,
    currentStageIndex: nextIndex,
    status: justCompleted ? "completed" : "active",
    outcome: justCompleted ? outcome : progress.outcome,
    completedAt: justCompleted ? Date.now() : progress.completedAt,
  };
  return { progress: nextProgress, advanced: true, justCompleted, completedStage: stage, hitFlags };
}

// 任务开启前置条件的统一判断——鱼定村村1-村6这类有前后依赖/分支排斥的任务链
// 需要三种简单的门槛，字段全部可选：
//   requiresQuestCompleted: string | string[]  —— 列出的任务必须全部 completed（AND）
//   requiresAnyOf:          string[]           —— 列出的任务里至少一个 completed（OR）
//   blockedByFlags:         string[]           —— flags 里只要出现其中任意一个就锁死
//                                                （比如村2走了C分支，村6就再也开不了）
// 不涉及互斥锁（exclusiveGroup）那套逻辑，两者可以同时用在同一个任务上。
export function isQuestGateOpen(quest, allProgress, flags) {
  const isDone = (qid) => allProgress?.[qid]?.status === "completed";
  if (quest.requiresQuestCompleted) {
    const list = Array.isArray(quest.requiresQuestCompleted) ? quest.requiresQuestCompleted : [quest.requiresQuestCompleted];
    if (!list.every(isDone)) return false;
  }
  if (quest.requiresAnyOf?.length && !quest.requiresAnyOf.some(isDone)) return false;
  if (quest.blockedByFlags?.length && quest.blockedByFlags.some(f => flags?.includes(f))) return false;
  return true;
}

// 互斥关系：完成某个任务后，把同一 exclusiveGroup 里的其他任务标记为
// locked_by_exclusive（除非该任务已经完成/本身就不在同组）。虎胆三重门
// 三方线互斥的核心机制——见第七章7.2。
export function lockExclusiveSiblings(allProgress, quests, completedQuestId) {
  const completed = quests.find(q => q.id === completedQuestId);
  if (!completed?.exclusiveGroup) return allProgress;
  const next = { ...allProgress };
  for (const [qid, p] of Object.entries(allProgress)) {
    if (qid === completedQuestId || p?.status === "completed") continue;
    const q = quests.find(x => x.id === qid);
    if (q?.exclusiveGroup === completed.exclusiveGroup) {
      next[qid] = { ...p, status: "locked_by_exclusive" };
    }
  }
  return next;
}

// 隐藏全收集线的"绕过互斥锁"判定，单独写一个函数，不复用普通互斥逻辑。
// "学识"="悟性"、"福缘"="气运" 别名映射，总纲第八章8.2节第5条已拍板确定，
// 不新增属性维度（见 曲措乡_总纲_v3.md 第七章7.2/第八章8.2）
export function canBypassExclusive(gameState) {
  const xueshi = gameState.char?.special?.悟性 ?? 0; // 学识 = 悟性（别名）
  const fuyuan = gameState.char?.special?.气运 ?? 0;  // 福缘 = 气运（别名）
  return xueshi >= 10 && fuyuan >= 10;
}

// 判断某个任务是否已完成——按类型分派到不同的判断逻辑。
// 这个函数只做"数值是否达标"的判断，不涉及UI/日志，调用方自己决定
// 判断结果之后要做什么（弹提示、发奖励等）。
export function checkQuestCompletion(quest, progress, gameState) {
  if (!progress) return false;

  // 多阶段任务链：完成条件是"已经推进到最后一个 stage 之后"，只看
  // currentStageIndex，不依赖 status 是否已经被 advanceQuestStages 同步
  // 翻转过——这样无论调用方在 stage 推进前还是推进后查询，结果都一致，
  // 不会因为 status 已经变成 "completed"（不等于 "active"）而被下面那条
  // 通用guard误伤，导致明明已经完成却报告未完成。
  if (quest.stages?.length) {
    return (progress.currentStageIndex ?? 0) >= quest.stages.length;
  }
  if (progress.status !== "active") return false;

  switch (quest.type) {
    case QUEST_TYPE.KILL:
    case QUEST_TYPE.COLLECT:
      return progress.progress >= (quest.requiredCount ?? 1);

    case QUEST_TYPE.FETCH:
      // 背包里是否已经有这件指定物品
      return gameState.inv?.some(i => (typeof i === "string" ? i : i.id) === quest.itemId);

    case QUEST_TYPE.TALK:
    case QUEST_TYPE.PUZZLE:
    case QUEST_TYPE.ROMANCE:
    case QUEST_TYPE.MYSTERY:
      // 这几类通常靠AI在剧情推进时通过 flags_add 标记一个专属flag来表示完成，
      // 而不是靠系统本地数值判断——因为"说服成功了没有""线索找齐了没有"这种
      // 判断天然需要理解叙事内容，不是纯数字能表达的。
      return gameState.flags?.includes(`quest_done_${quest.id}`) ?? false;

    case QUEST_TYPE.ESCORT:
    case QUEST_TYPE.RESCUE:
      return gameState.flags?.includes(`quest_done_${quest.id}`) ?? false;

    case QUEST_TYPE.LEARN_SKILL:
      // 拜师学艺类任务的完成条件比较特殊：不是"做了某件事"，
      // 而是"好感度达标 + 剧情flag达标"两个条件同时满足，见 learnSkill.js
      return false; // 由 canLearnSkillFrom() 单独判断，这里不重复实现

    default:
      // 其余类型（murder/delivery/defend/conquest/dungeon/join_faction/
      // boss_loot/unlock_map/artifact/bounty/chain/timed）在这一版都走
      // "剧情flag标记完成"这条统一路径，先把骨架跑通，各类型的精细化
      // 判断逻辑（比如TIMED类的超时检测）留到后续按需补充。
      return gameState.flags?.includes(`quest_done_${quest.id}`) ?? false;
  }
}

// 推进任务进度：KILL/COLLECT类每次触发相关事件时调用一次
export function advanceQuestProgress(progress, amount = 1) {
  return { ...progress, progress: (progress.progress || 0) + amount };
}

export function completeQuest(progress) {
  return { ...progress, status: "completed", completedAt: Date.now() };
}
