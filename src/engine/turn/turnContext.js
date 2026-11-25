// 回合流水线的显式上下文（TurnContext）。
// 四段之间只认这一个载体：resolveIntent 产出 plan 段（意图/移动/采集裁决结果），
// narrateTurn / finalizeTurn 消费本工厂组装的 ctx——callDeps、memory、
// prompt、commitDeps 与各 setter/ref 全部在这里点名到位，不再靠隐式全局串场。
// intentPendingStore 的挂起态也在这里快照成 ctx.pending 明传（store 本体仍供
// IntentConfirmBar/useIntentRouter/CLI 读取，属跨界引用，见 PR 标注）。

import { createPromptContext } from "../prompt/index.js";
import * as importedRegistry from "../../domain/rules/cards/importedRegistry.js";
import { COMPANION_LORE, stationedNpcsFor } from "../../domain/rules/companion/companion.js";
import { getCompanionDescForm } from "../../domain/rules/companion/companionForms.js";
import { SEA_OF_MIND } from "../../domain/rules/narrator/seaOfMind.js";
import { CATEGORY_LABEL } from "../../domain/rules/economy/equipment.js";
import { getMapNode } from "../../domain/data/map/qucuoMap.js";
export { createPhaseSetter } from "./phaseSetter.js";

// WO-05 零入度接线：场记板编号器/渲染器经此挂入依赖图（消费方在后续工单）。
export { ensureItemId, resolveEntityByIdOrName } from "../../domain/rules/clapboard/entityId.js";
export { createClapboardEntry, filterEntriesForViewer, renderClapboardSection } from "../../domain/rules/clapboard/clapboard.js";
export { computeCausalBudget, DAILY_LOOT_CAP } from "../../domain/rules/judge/causalBudget.js";

// WO-10 零入度接线：天工铸物/原型创招经此挂入依赖图（消费方在 WO-11/12）。
export { allowedAffixesForBudget, compileAffix, affixCost } from "../../domain/rules/effects/affixPointTable.js";
export { compileEmergentItem } from "../../domain/rules/effects/compileEmergentItem.js";
export { compileEmergentSkill } from "../../domain/rules/effects/compileEmergentSkill.js";

// WO-11 零入度接线：十二律落盘引擎经此挂入依赖图（消费方在 WO-13 主链路）。
export { materializeFacts } from "../../domain/rules/effects/materializeFacts.js";

// 由 plan（resolveIntent 的裁决结果）+ env（hook 注入的状态/引用/胶水）组装 playTurn 的 ctx。
export function createTurnContext({ plan, env }) {
  const { state, refs, io, opts } = env;
  const {
    room, char, inv, skills, dao, flags, mapData, time, preset, narrator,
    convo, nsfwOn, activeTarget, talkTarget, companionState,
    questProgress, pendingQuestBranch, innerRoomName, effectiveSpecialNow,
  } = state;
  // WO-06：12 个跨层 React ref 全部清退——varTree/time 直读 store（io.getGameState），
  // 移动/拾取裁决值走 plan 只读字段，roomCache/gambleSession 进 store，
  // 存档计数进 autosaveScheduler 模块状态，dayMaterial 走 io 注入回调。
  const {
    addLog, setLog, setVarTree, setRoom, setGambleNegotiation, setInv,
    setChar, setDao, setExp, setPot, setSkills, setMapData, setTime,
    setPendingQuestBranch, setConvo, setCommandPhase, onTurnsInvalidated,
    getGameState, gameActions, subscribeGameReplaced,
  } = io;
  const {
    isTalk, isSettle, intent, movingDir, lockedDestName,
    destinationLock, collectNote, activeGroundItemForTurn, intimateTicket,
    pendDir, outerDepart, pickupJudgment, collectGranted,
  } = plan;
  // apiCfg/gm/isStale 挂在 env 顶层（hook 注入），不进 state。
  const { isStale, _trace, apiCfg, gm, proseEpochGuard, proseSink, proseEpoch, proseSeqAlloc, executeJudgeRoutes } = env;

  // 本回合开始时的 varTree：store 直读即为最新（zustand 写读同步）。
  const preActVarTree = getGameState?.()?.varTree ?? {};

  const callDeps = (memory = {}, prepared = {}) => ({
    varTree: memory.varTree ?? getGameState?.()?.varTree, gm, isSettle, isTalk, intent, apiCfg, narrator, room, time,
    scenario: preset.scenario, budgetInstruction: prepared.budgetInstruction,
    npcLoreBlockWithQuest: prepared.npcLoreBlockWithQuest || "",
    visibleNpcsCount: prepared.visibleNpcsCount || 0, charName: char.name, charBodyProfile: char.bodyProfile,
    pickupJudgment, cmd: prepared.cmd || env.cmd, convo, nsfwOn,
    ctx: prepared.ctx, recallBlock: memory.recallBlock || "", reunionBlock: prepared.reunionBlock || "",
    infoDomainBlock: memory.infoDomainBlock || "", hist: prepared.hist, mainConvo: prepared.mainConvo,
    lockedDestName,
    gambleTalkCtx: io.getGambleSession?.() ?? null, recallInfo: memory.recallInfo,
    inSeaOfMind: room.name === SEA_OF_MIND.district,
    settleNpc: opts.settleNpc, settleKind: opts.settleKind, giftInfo: opts.giftInfo, learnInfo: opts.learnInfo, settleBeast: !!opts.settleBeast,
    _trace, addLog, setLog, isStale, intentPlan: opts.intentPlan,
  });

  return {
    apiCfg,
    callDeps,
    convo,
    // WO-16E：gm/innerRoomName/encounter 顶层透传——判官授信（budgetInput）、
    // WO-16D 影子同源喂料、WO-22A 影子容器都依赖这三字段，不能只进 prompt/commitDeps。
    gm,
    innerRoomName,
    encounter: plan.encounterToDescribe || null,
    isTalk,
    isSettle,
    isStale,
    proseEpochGuard,
    proseSink,
    proseEpoch,
    proseSeqAlloc,
    talkTarget,
    executeJudgeRoutes: executeJudgeRoutes || null,
    _trace,
    pending: env.pending,
    prompt: createPromptContext({
      room, char, inv, skills, dao, flags, questProgress, pendingQuestBranch,
      varTree: preActVarTree, time, preset, companionState, nsfwOn, activeTarget, activeGroundItem: activeGroundItemForTurn, isTalk,
      gm, movingDir, lockedDestName, outerDepart, innerRoomName, apiCfg,
      destinationLock, pickupJudgment, categoryLabel: CATEGORY_LABEL,
      encounter: plan.encounterToDescribe, collectNote, intent,
      npcState: getGameState?.()?.npcState,
      timeForToday: getGameState?.()?.time,
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
      recall: { apiCfg, cmd: env.cmd, room, flags, activeTarget, activeGroundItem: activeGroundItemForTurn, isTalk, talkTarget,
        followingNames: [
          ...Object.entries(companionState || {})
            .filter(([, c]) => c?.unlocked && !c?.stationed)
            .map(([, c]) => c.label || c.data?.name).filter(Boolean),
          // 留守在当前房的同伴也算在场——名字不进 room.npcs，召回时不至于看不见
          ...stationedNpcsFor(companionState, { district: room?.name, roomId: innerRoomName || room?.name, roomName: innerRoomName || room?.name }).map(n => n.name),
        ] },
    },
    state: { room, char, inv, dao },
    getMapNode,
    beforeRun: io.beforeRun,
    setCommandPhase, setVarTree, effectiveSpecialNow, onTurnsInvalidated,
    getGameState, gameActions, subscribeGameReplaced,
    commitDeps: (turnResult) => ({
        p: turnResult.p, mvuCommands: turnResult.mvuCommands, dealResult: turnResult.dealResult,
        derivedRespondedNpcs: turnResult.derivedRespondedNpcs || null,
        judgePipelineActive: turnResult.judgePipelineActive || false,
        intimateTicket,
        pickupExtractionFailed: turnResult.pickupExtractionFailed,
        rawFull: turnResult.rawFull, narrativeText: turnResult.narrativeText,
        knowledgeTree: turnResult.knowledgeTree, knowledgeTreeBase: turnResult.knowledgeTreeBase,
        isTalk, gm, lockedDestName, room, innerRoomName, time, mapData,
        pendingQuestBranch, apiCfg, activeTarget, talkTarget, effectiveSpecialNow, newConvo: turnResult.newConvo,
        questProgress, char, preserveHp: opts.preserveHp, npcState: getGameState?.()?.npcState,
        companionState: getGameState?.()?.companionState,
        // WO-06：移动/拾取裁决值走 plan 只读字段直传（原跨层 ref）
        pendDir, outerDepart, pickupJudgment, collectGranted,
        _trace, addLog, getGameState,
        getGambleSession: io.getGambleSession, setGambleSession: io.setGambleSession,
        appendDayMaterial: io.appendDayMaterial,
        setVarTree, setRoom, setGambleNegotiation, setInv, setChar, setDao, setExp, setPot,
        setSkills, setFlags: io.setFlags, setMapData, setTime, setPendingQuestBranch, setConvo, setCompanionState: io.setCompanionState, setClaimedMilestones: io.setClaimedMilestones,
      }),
  };
}
