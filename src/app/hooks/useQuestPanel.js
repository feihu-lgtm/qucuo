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
    // 收件人在场而发布人不在 = 玩家站在交付点上——叙事/台词都应该写交付，
    // 不是又去问发布人（村2 在老孙饭馆点 ❢ 曾让旁白演才旦的戏）。
    const stateNow = gameStore.getState();
    const visibleHere = (name) => !!name && (stateNow.room?.npcs || []).some(
      (n) => n.name === name && isNpcVisibleInInnerRoom(stateNow.room?.name, stateNow.innerRoomName, n),
    );
    const delivery = stage.deliver;
    const hasItem = (wanted) => (stateNow.inv || []).some((entry) => {
      const n = typeof entry === "string" ? entry : entry?.name;
      return !!n && (n === wanted || n.includes(wanted) || wanted.includes(n));
    });
    // deliver 阶段空手：任何模式都只提示去备件——script 模式发出的台词会让
    // 叙事回执 flag 空推进（questFlagRule 不看背包）。
    if (delivery && !hasItem(delivery.item)) {
      addLog([{
        t: "sys",
        text: `  「${quest.title}」要把「${delivery.item}」亲手交给${delivery.to}——先去把东西备齐。`,
      }]);
      return;
    }
    const atRecipient = !!(delivery && visibleHere(delivery.to) && !visibleHere(quest.giver));
    if (apiCfg.questTriggerMode === "script") {
      const line = atRecipient
        ? `我把「${delivery.item}」交给${delivery.to}（「${quest.title}」的差事）`
        : isNewlyGiven
          ? `我想找${quest.giver}问问「${quest.title}」这件事`
          : `我继续跟${quest.giver}谈「${quest.title}」的事`;
      act(line);
      return;
    }
    // deliver/collect 阶段不能靠点 ❢ 空推进：收件人不在场时只提示去送，
    // 不落 flag（forceAdvanceQuest 里还有一道同样的闸）。
    if (delivery) {
      // room.npcs 是据点级花名册——收件人要在当前内层房间才算"在场"。
      if (!visibleHere(delivery.to)) {
        addLog([{
          t: "sys",
          text: `  「${quest.title}」要把「${delivery.item}」亲手交给${delivery.to}——得到他跟前再送。`,
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
    await act(
      atRecipient ? `❢ ${quest.title}：把「${delivery.item}」交给${delivery.to}` : `❢ ${quest.title}`,
      [],
      {
        // forcedEvent 必须带上 stage.description——交付戏的主体（巴桑讲税赋
        // 旧事）就在阶段描写里，只写"亲手交给"会把故事主体弄丢。
        forcedEvent: atRecipient
          ? `${stage.description}（玩家亲手把「${delivery.item}」交给${delivery.to}）`
          : stage.description,
        forcedEventNpc: atRecipient ? delivery.to : quest.giver,
        keepUndo: true,
        // 交付件本轮已由 forceAdvanceQuest 结算——叙事回执的 items_rm 不得
        // 再扣一次（重复扣件、或把剧情还回的 keep 件误删）。
        settledItems: delivery ? [delivery.item] : undefined,
      },
    );
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
