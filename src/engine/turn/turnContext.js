// 回合流水线的显式上下文（TurnContext）。
// 四段之间只认这一个载体：resolveIntent 产出 plan 段（意图/移动/采集裁决结果），
// settleTurn / narrateTurn / finalizeTurn 消费本工厂组装的 ctx——callDeps、memory、
// prompt、commitDeps 与各 setter/ref 全部在这里点名到位，不再靠隐式全局串场。
// intentPendingStore 的挂起态也在这里快照成 ctx.pending 明传（store 本体仍供
// IntentConfirmBar/useIntentRouter/CLI 读取，属跨界引用，见 PR 标注）。

import { createPromptContext } from "../prompt/index.js";
import * as importedRegistry from "../../domain/rules/cards/importedRegistry.js";
import { COMPANION_LORE } from "../../domain/rules/companion/companion.js";
import { getCompanionDescForm } from "../../domain/rules/companion/companionForms.js";
import { SEA_OF_MIND } from "../../domain/rules/narrator/seaOfMind.js";
import { CATEGORY_LABEL } from "../../domain/rules/economy/equipment.js";
import { getMapNode } from "../../domain/data/map/qucuoMap.js";
export { createPhaseSetter } from "./phaseSetter.js";

// 由 plan（resolveIntent 的裁决结果）+ env（hook 注入的状态/引用/胶水）组装 playTurn 的 ctx。
export function createTurnContext({ plan, env }) {
  const { state, refs, io, opts } = env;
  const {
    room, char, inv, skills, dao, flags, mapData, time, preset, narrator,
    convo, nsfwOn, activeTarget, talkTarget, companionState,
    questProgress, pendingQuestBranch, innerRoomName, effectiveSpecialNow,
  } = state;
  const {
    varTreeRef, roomMapRef, gambleTalkCtx, outerDepartRef, pendDirRef,
    pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef, dayMaterialRef,
    roundsSinceLastSaveRef, playedThisSessionRef, timeRef,
  } = refs;
  const {
    addLog, setLog, setVarTree, setRoom, setGambleNegotiation, setInv,
    setChar, setDao, setExp, setPot, setSkills, setMapData, setTime,
    setPendingQuestBranch, setConvo, setCommandPhase, onTurnsInvalidated,
  } = io;
  const {
    isTalk, isSettle, intent, movingDir, lockedDestName,
    destinationLock, collectNote, activeGroundItemForTurn,
  } = plan;
  // apiCfg/gm/isStale 挂在 env 顶层（hook 注入），不进 state。
  const { isStale, _trace, apiCfg, gm } = env;

  // 本回合开始时的 varTree，逻辑读取走 ref 以包含已发生的同步写入。
  const preActVarTree = varTreeRef.current;

  const callDeps = (memory = {}, prepared = {}) => ({
    varTree: memory.varTree ?? varTreeRef.current, gm, isSettle, isTalk, intent, apiCfg, narrator,
    scenario: preset.scenario, budgetInstruction: prepared.budgetInstruction,
    npcLoreBlockWithQuest: prepared.npcLoreBlockWithQuest || "",
    visibleNpcsCount: prepared.visibleNpcsCount || 0, charName: char.name, charBodyProfile: char.bodyProfile,
    pickupJudgment: pickupJudgmentRef.current, cmd: prepared.cmd || env.cmd, convo, nsfwOn,
    ctx: prepared.ctx, recallBlock: memory.recallBlock || "", reunionBlock: prepared.reunionBlock || "",
    infoDomainBlock: memory.infoDomainBlock || "", hist: prepared.hist, mainConvo: prepared.mainConvo,
    lockedDestName,
    gambleTalkCtx: gambleTalkCtx.current, recallInfo: memory.recallInfo,
    inSeaOfMind: room.name === SEA_OF_MIND.district,
    settleNpc: opts.settleNpc, settleKind: opts.settleKind, duelReport: opts.duelReport, giftInfo: opts.giftInfo, learnInfo: opts.learnInfo, settleBeast: !!opts.settleBeast,
    _trace, addLog, setLog, isStale, intentPlan: opts.intentPlan,
  });

  return {
    apiCfg,
    callDeps,
    convo,
    isTalk,
    isSettle,
    isStale,
    _trace,
    pending: env.pending,
    prompt: createPromptContext({
      room, char, inv, skills, dao, flags, questProgress, pendingQuestBranch,
      varTree: preActVarTree, time, preset, companionState, nsfwOn, activeTarget, activeGroundItem: activeGroundItemForTurn, isTalk,
      gm, movingDir, lockedDestName, outerDepart: outerDepartRef.current, innerRoomName, apiCfg,
      destinationLock, pickupJudgment: pickupJudgmentRef.current, categoryLabel: CATEGORY_LABEL,
      encounter: plan.encounterToDescribe, collectNote, intent,
      timeForToday: timeRef.current,
    }, {
      importedNpcLore: importedRegistry.getImportedNpcLore(),
      companionForms: Object.fromEntries(Object.keys(COMPANION_LORE).map(key => [key, getCompanionDescForm(key)])),
    }),
    memory: {
      varTreeLatest: preActVarTree,
      roomNpcNames: room.npcs.map(n => n.name),
      time,
      apiCfg,
      flags,
      recall: { apiCfg, cmd: env.cmd, room, flags, activeTarget, activeGroundItem: activeGroundItemForTurn, isTalk, talkTarget },
    },
    state: { room, char, inv, dao },
    getMapNode,
    beforeRun: io.beforeRun,
    setCommandPhase, setVarTree, effectiveSpecialNow, onTurnsInvalidated,
    refs: {
      varTreeRef, roomMapRef, gambleTalkCtx, outerDepartRef, pendDirRef,
      pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef, dayMaterialRef,
      roundsSinceLastSaveRef, playedThisSessionRef,
    },
    commitDeps: (turnResult) => {
      pickupExtractionFailedRef.current = turnResult.pickupExtractionFailed;
      return {
        p: turnResult.p, mvuCommands: turnResult.mvuCommands, dealResult: turnResult.dealResult,
        rawFull: turnResult.rawFull, narrativeText: turnResult.narrativeText,
        knowledgeTree: turnResult.knowledgeTree, knowledgeTreeBase: turnResult.knowledgeTreeBase,
        isTalk, gm, lockedDestName, room, innerRoomName, time, mapData,
        pendingQuestBranch, apiCfg, activeTarget, talkTarget, effectiveSpecialNow, newConvo: turnResult.newConvo,
        questProgress, char, preserveHp: opts.preserveHp,
        _trace, addLog,
        setVarTree, setRoom, setGambleNegotiation, setInv, setChar, setDao, setExp, setPot,
        setSkills, setFlags: io.setFlags, setMapData, setTime, setPendingQuestBranch, setConvo,
        varTreeRef, roomMapRef, gambleTalkCtx, outerDepartRef, pendDirRef,
        pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef, dayMaterialRef,
        roundsSinceLastSaveRef, playedThisSessionRef,
      };
    },
  };
}
