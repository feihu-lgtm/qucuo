import { useCallback } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { forceAdvanceQuest as forceAdvanceQuestFeature } from "../../features/quest/logic.js";
import { ensureNpcCombatData } from "../../domain/npc/npcGeneration.js";

export function runQuestChoice(ctx, entry, choice) {
  return applyResult(null, () => resolveQuestChoice(ctx, entry, choice), { feature: "quest.choose" });
}

async function resolveQuestChoice({
  act, apiCfg, addLog, setPendingQuestBranch, setDuelingNpc,
  setActivePersuasion, setInteractMode, setTalkTarget, captureUndo, forceAdvanceQuest,
}, entry, choice) {
  captureUndo();
  const { quest, stage } = entry;
  if (apiCfg.questTriggerMode === "script") {
    act(`（关于「${quest.title}」）我选择：${choice.label}`);
    return;
  }
  const resolve = choice.resolve || "auto";

  if (resolve === "combat" && choice.combatNpc) {
    addLog([{ t: "cmd", text: `> ❢ ${quest.title}：${choice.label}` }]);
    setPendingQuestBranch({ questId: quest.id, flag: choice.flag, mode: "combat" });
    const foe = ensureNpcCombatData({
      id: `questfoe_${choice.flag}_${Date.now()}`,
      name: choice.combatNpc.name,
      levelCap: choice.combatNpc.levelCap ?? 1,
      tag: choice.combatNpc.tag,
      hostile: true,
      questBranchFlag: choice.flag,
    }, { levelCap: choice.combatNpc.levelCap ?? 1 });
    setDuelingNpc(foe);
    return;
  }

  if (resolve === "talk") {
    addLog([{ t: "cmd", text: `> ❢ ${quest.title}：${choice.label}` }]);
    if (choice.persuade) {
      setActivePersuasion({ persuade: choice.persuade, questId: quest.id, flag: choice.flag });
      return;
    }
    setPendingQuestBranch({ questId: quest.id, flag: choice.flag, mode: "talk", goal: choice.talkGoal });
    setInteractMode("talk");
    setTalkTarget(choice.talkTarget || quest.giver);
    addLog([
      { t: "sys", text: `  你决定${choice.label}。` },
      { t: "sys", text: `  〔说赢了对方才会松口。〕` },
    ]);
    return;
  }

  forceAdvanceQuest(quest, choice.flag);
  addLog([
    { t: "quest", text: `  ❖ 任务推进 「${quest.title}」——你选择：${choice.label}` },
    { t: "sys", text: `  〔详情可查任务面板〕` },
  ]);
  await act(`❢ ${quest.title}：${choice.label}`, [], { forcedEvent: `${stage.description}（玩家的选择：${choice.label}）`, forcedEventNpc: quest.giver, keepUndo: true });
}

export function useQuestPanel({
  act, apiCfg, addLog, featureCtxRef, setPendingQuestBranch, setDuelingNpc,
  setActivePersuasion, setInteractMode, setTalkTarget, captureUndo,
}) {
  const forceAdvanceQuest = useCallback((quest, targetFlag) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, forceAdvanceQuestFeature(gameStore.getState(), quest, targetFlag));
  }, { feature: "quest.advance" }), [captureUndo, featureCtxRef]);

  const triggerQuestFromPanel = useCallback((entry) => applyResult(featureCtxRef.current, async () => {
    const { quest, stage, isNewlyGiven } = entry;
    if (apiCfg.questTriggerMode === "script") {
      const line = isNewlyGiven
        ? `我想找${quest.giver}问问「${quest.title}」这件事`
        : `我继续跟${quest.giver}谈「${quest.title}」的事`;
      act(line);
      return;
    }
    const targetFlag = Array.isArray(stage.completionFlag) ? stage.completionFlag[0] : stage.completionFlag;
    forceAdvanceQuest(quest, targetFlag);
    addLog([
      { t: "quest", text: `  ❖ ${entry.isNewlyGiven ? "任务开启" : "任务推进"} 「${quest.title}」` },
      { t: "sys", text: `  〔详情可查任务面板〕` },
    ]);
    await act(`❢ ${quest.title}`, [], { forcedEvent: stage.description, forcedEventNpc: quest.giver, keepUndo: true });
  }, { feature: "quest.trigger" }), [act, apiCfg, forceAdvanceQuest, addLog, featureCtxRef]);

  const triggerQuestChoice = useCallback((entry, choice) => runQuestChoice({
    act, apiCfg, addLog, setPendingQuestBranch, setDuelingNpc,
    setActivePersuasion, setInteractMode, setTalkTarget, captureUndo, forceAdvanceQuest,
  }, entry, choice), [
    act, apiCfg, addLog, setPendingQuestBranch, setDuelingNpc,
    setActivePersuasion, setInteractMode, setTalkTarget, captureUndo, forceAdvanceQuest,
  ]);

  return { forceAdvanceQuest, triggerQuestFromPanel, triggerQuestChoice };
}
