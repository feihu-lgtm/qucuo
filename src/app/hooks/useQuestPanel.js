import { useCallback } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { forceAdvanceQuest as forceAdvanceQuestFeature, playLocalQuestStage } from "../../features/quest/logic.js";
import { buildQuestFoe } from "../../features/quest/combatChoice.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { isQuestChoiceOpen } from "../../domain/rules/quests/questEngine.js";
import { isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";

export function settlePersuasion({ setActivePersuasion, setPersuasionProgress, setChar, forceAdvanceQuest, addLog }, { questId, flag }, result) {
  return applyResult(null, () => {
    setActivePersuasion(null);
    setPersuasionProgress(progress => {
      const rest = { ...progress };
      delete rest[`${questId}|${flag}`];
      return rest;
    });
    if (result.outcome !== "success") {
      addLog([{ t: "sys", text: "  没谈成——这条路暂时没走通，可换个法子再试。" }]);
      return;
    }
    if (result.via === "bribe" && result.cost) {
      setChar(c => ({ ...c, money: (c.money || 0) - result.cost }));
    }
    const quest = QUCUO_QUESTS.find(x => x.id === questId);
    if (quest) {
      forceAdvanceQuest(quest, flag);
      const viaText = result.via === "bribe" ? "使了银子" : result.via === "identity" ? "亮了身份" : "把话说到了点子上";
      addLog([{ t: "affection", text: `  ✓ 你${viaText}，「${quest.title}」推进。` }]);
    }
  }, { feature: "quest.persuasionFinish" });
}

export function runQuestChoice(ctx, entry, choice) {
  return applyResult(null, () => resolveQuestChoice(ctx, entry, choice), { feature: "quest.choose" });
}

async function resolveQuestChoice({
  act, apiCfg, addLog, setPendingQuestBranch, setDuelingNpc,
  setActivePersuasion, setInteractMode, setTalkTarget, captureUndo, forceAdvanceQuest,
  featureCtxRef,
}, entry, pickedChoice) {
  const { quest, stage } = entry;
  let choice = pickedChoice;
  if (quest.localOnly) {
    const state = gameStore.getState();
    choice = getLocalQuestStage(quest, state)?.choices?.find((entry) => entry.flag === pickedChoice.flag);
    if (!choice || !isQuestChoiceOpen(choice, state)) return;
    if (choice.resolve !== "combat") {
      captureUndo();
      return applyResult(featureCtxRef.current, playLocalQuestStage(state, quest, choice.label));
    }
  }
  captureUndo();
  // 战斗分支在剧本模式下也真打，不交给叙事代判输赢。
  if (!quest.localOnly && apiCfg.questTriggerMode === "script" && !(choice.resolve === "combat" && choice.combatNpc)) {
    act(`（关于「${quest.title}」）我选择：${choice.label}`);
    return;
  }
  const resolve = choice.resolve || "auto";

  if (resolve === "combat" && choice.combatNpc) {
    addLog([{ t: "cmd", text: `> ❢ ${quest.title}：${choice.label}` }]);
    // aftermath：打赢后叙事段要写的收尾（怎么作结、怎么回归），见 useDuel.duelFinishHandler
    setPendingQuestBranch({ questId: quest.id, flag: choice.flag, mode: "combat", title: quest.title, aftermath: choice.aftermath });
    setDuelingNpc(buildQuestFoe(choice));
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
  setActivePersuasion, setInteractMode, setTalkTarget, captureUndo, setPersuasionProgress, setChar,
}) {
  const forceAdvanceQuest = useCallback((quest, targetFlag) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, forceAdvanceQuestFeature(gameStore.getState(), quest, targetFlag));
  }, { feature: "quest.advance" }), [captureUndo, featureCtxRef]);

  const triggerQuestFromPanel = useCallback((entry) => applyResult(featureCtxRef.current, async () => {
    const { quest, stage, isNewlyGiven } = entry;
    if (quest.localOnly) {
      captureUndo();
      return applyResult(featureCtxRef.current, playLocalQuestStage(gameStore.getState(), quest));
    }
    if (apiCfg.questTriggerMode === "script") {
      const line = isNewlyGiven
        ? `我想找${quest.giver}问问「${quest.title}」这件事`
        : `我继续跟${quest.giver}谈「${quest.title}」的事`;
      act(line);
      return;
    }
    // deliver/collect 阶段不能靠点 ❢ 空推进：东西不在包里或收件人不在场时，
    // 只提示玩家去送/去采，不落 flag（forceAdvanceQuest 里还有一道同样的闸）。
    const hasItem = (wanted) => (gameStore.getState().inv || []).some((entry) => {
      const n = typeof entry === "string" ? entry : entry?.name;
      return !!n && (n === wanted || n.includes(wanted) || wanted.includes(n));
    });
    const delivery = stage.deliver;
    if (delivery) {
      // room.npcs 是据点级花名册——收件人要在当前内层房间才算"在场"。
      const st = gameStore.getState();
      const targetHere = (st.room?.npcs || []).some(
        (n) => n.name === delivery.to && isNpcVisibleInInnerRoom(st.room?.name, st.innerRoomName, n),
      );
      if (!hasItem(delivery.item) || !targetHere) {
        addLog([{
          t: "sys",
          text: `  「${quest.title}」要把「${delivery.item}」亲手交给${delivery.to}${hasItem(delivery.item) ? "——得到他跟前再送" : "——先去把东西备齐"}。`,
        }]);
        return;
      }
    }
    const collectReqs = stage.collect ? (Array.isArray(stage.collect) ? stage.collect : [stage.collect]) : [];
    const missing = collectReqs.find((c) => c?.item && !hasItem(c.item));
    if (missing) {
      addLog([{ t: "sys", text: `  「${quest.title}」还差「${missing.item}」没到手${missing.at ? `——去${missing.at}取` : ""}。` }]);
      return;
    }
    const targetFlag = Array.isArray(stage.completionFlag) ? stage.completionFlag[0] : stage.completionFlag;
    forceAdvanceQuest(quest, targetFlag);
    addLog([
      { t: "quest", text: `  ❖ ${entry.isNewlyGiven ? "任务开启" : "任务推进"} 「${quest.title}」` },
      { t: "sys", text: `  〔详情可查任务面板〕` },
    ]);
    await act(`❢ ${quest.title}`, [], { forcedEvent: stage.description, forcedEventNpc: quest.giver, keepUndo: true });
  }, { feature: "quest.trigger" }), [act, apiCfg, forceAdvanceQuest, addLog, captureUndo, featureCtxRef]);

  const triggerQuestChoice = useCallback((entry, choice) => runQuestChoice({
    act, apiCfg, addLog, setPendingQuestBranch, setDuelingNpc,
    setActivePersuasion, setInteractMode, setTalkTarget, captureUndo, forceAdvanceQuest, featureCtxRef,
  }, entry, choice), [
    act, apiCfg, addLog, setPendingQuestBranch, setDuelingNpc,
    setActivePersuasion, setInteractMode, setTalkTarget, captureUndo, forceAdvanceQuest, featureCtxRef,
  ]);

  const savePersuasionProgress = useCallback((key, progress) => applyResult(featureCtxRef.current, () => {
    setPersuasionProgress(m => ({ ...m, [key]: progress }));
  }, { feature: "quest.persuasionProgress" }), [featureCtxRef, setPersuasionProgress]);

  const finishPersuasion = useCallback((active, result) => settlePersuasion({
    setActivePersuasion, setPersuasionProgress, setChar, forceAdvanceQuest, addLog,
  }, active, result), [setActivePersuasion, setPersuasionProgress, setChar, forceAdvanceQuest, addLog]);

  return { forceAdvanceQuest, triggerQuestFromPanel, triggerQuestChoice, savePersuasionProgress, finishPersuasion };
}
