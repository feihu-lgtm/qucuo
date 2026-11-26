import { trainCost } from "../features/cultivation/logic.js";
import { NNPC_STAGE } from "../domain/rules/narrator/narrator.js";
import { narratorVars } from "../domain/rules/prompt/mvu.js";
import { SECT_ENTRY } from "../domain/rules/character/sectEntry.js";
import { SEA_OF_MIND, canEnterSea } from "../domain/rules/narrator/seaOfMind.js";
import { setPearlForm, setSnowLeopardForm } from "../domain/rules/companion/portraits.js";
import { getRngState } from "../utils/rng.js";
import { CURRENT_VERSION } from "../utils/version.js";

export function buildOverlayCtx({ ui, game, overlayState, autosave, actions, addLog, effectiveSpecialNow, onGameStarted }) {
  const { showSettings, showCharCreate, showOpening, showBody, showMusicPanel, showHomestead } = overlayState;
  const { cardImportHandlers, screenHandlers, duelHandlers, questPanel, aiInspect, outfitAdvice, handleInscribeWeapon } = actions;
  return {
    dispatchCommand: actions.dispatchCommand,
    // apiCfg/settingsInitialTab/uiScale/font/nsfwOn 已迁 sessionUiStore，OverlayHost 直接订阅。
    buildCurrentSnapshot: autosave.buildCurrentSnapshot,
    applySnapshot: (...args) => {
      const result = autosave.applySnapshot(...args);
      onGameStarted?.();
      return result;
    }, varTree: game.varTree, setVarTree: game.setVarTree,
    narrator: game.narrator, setNarrator: game.setNarrator, getLiveBlockText: ui.getLiveBlockText,
    showSettings, showCharCreate, showOpening, showBody, showMusicPanel, showHomestead,
    char: game.char, setChar: game.setChar, inv: game.inv, setInv: game.setInv,
    innerRoomName: game.innerRoomName, addLog,
    recommendOutfit: outfitAdvice.recommendOutfit, outfitState: ui.outfitState,
    handleCreateCharacter: (...args) => {
      onGameStarted?.();
      return cardImportHandlers.handleCreateCharacter(...args);
    },
    handleOpeningFinish: cardImportHandlers.handleOpeningFinish,
    handleBodyProfileChange: cardImportHandlers.handleBodyProfileChange,
    globalOverlays: {
      // isDayMode/apiCfg/activeNpcMenu/activeItemMenu/characterPageTarget 已迁 sessionUiStore。
      char: game.char, inv: game.inv, skills: game.skills,
      varTree: game.varTree, room: game.room, innerRoomName: game.innerRoomName, time: game.time,
      flags: game.flags, questProgress: game.questProgress,
      effectiveSpecialNow, companionState: game.companionState,
      // loading 等交互输入态已迁 sessionUiStore，面板直接订阅，不再经 ui 透传。
      claimedMilestones: game.claimedMilestones, claimMilestone: screenHandlers.claimMilestone,
      giftToCharacter: screenHandlers.giftToCharacter,
      narratorStage: game.narrator.stage,
      onImportNpcs: cardImportHandlers.handleImportNpcs,
      onImportPlayer: cardImportHandlers.handleImportPlayer,
      onImportWorld: cardImportHandlers.handleImportWorld,
      portraits: ui.portraits, setPortraits: ui.setPortraits,
      buildBugReportTurns: ui.buildBugReportTurns,
      debugSources: {
        save: autosave.buildCurrentSnapshot,
        recentLog: game.log,
        conversation: game.convo,
        // apiConfig 由 GlobalOverlays 用订阅值注入
        version: CURRENT_VERSION,
        rngState: getRngState,
      },
      handleNpcLook: screenHandlers.handleNpcLook, handleNpcTalk: screenHandlers.handleNpcTalk,
      handleNpcGift: screenHandlers.handleNpcGift, handleNpcDuel: duelHandlers.handleNpcDuel,
      handleNpcSteal: screenHandlers.handleNpcSteal, handleNpcLearnSkill: screenHandlers.handleNpcLearnSkill,
      handleNpcTrade: screenHandlers.handleNpcTrade, handleInviteCompanion: screenHandlers.handleInviteCompanion,
      handleRecruitNemesis: screenHandlers.handleRecruitNemesis,
      handleOcRecruit: screenHandlers.handleOcRecruit, handleRecallCompanion: screenHandlers.handleRecallCompanion,
      handleGoldenEgg: screenHandlers.handleGoldenEgg,
      inspectItem: aiInspect.inspectItem, handleConsumeItem: screenHandlers.handleConsumeItem,
      handleCollectGround: screenHandlers.handleCollectGround, handleToggleEquip: screenHandlers.handleToggleEquip,
      handleInscribeWeapon,
      // activePersuasion/duelingNpc 已迁 sessionUiStore，GlobalOverlays 直接订阅。
      persuasionProgress: game.persuasionProgress,
      savePersuasionProgress: questPanel.savePersuasionProgress, finishPersuasion: questPanel.finishPersuasion,
      resetDuel: duelHandlers.resetDuel, duelFinishHandler: duelHandlers.duelFinishHandler,
    },
  };
}

export function buildLayoutCtx({ ui, game, overlayHost, autosave, actions, activeBuffs, addLog, jotNote }) {
  const {
    autoTravelTo, questPanel, pigeonHandlers, duelHandlers, screenHandlers,
    buildingHandlers, craftingAI, playerActionHandlers, progressionHandlers, aiInspect,
  } = actions;
  const inSeaOfMind = game.room.name === SEA_OF_MIND.district;
  const seaGate = canEnterSea({
    flags: game.flags, varTree: game.varTree,
    districtName: game.room.name, innerRoomName: game.innerRoomName,
  });
  return {
    overlayHost,
    addLog,
    jotNote,
    activeBuffs,
    setVarTree: game.setVarTree,
    setSnowLeopardForm,
    setPearlForm,
    trainCost,
    ui,
    autosave: {
      autoSaveError: autosave.autoSaveError,
      lastAutoSave: autosave.lastAutoSave,
    },
    derived: {
      inSeaOfMind,
      seaGate,
      seaTraumaActive: game.narrator.stage === NNPC_STAGE.SEA_CRASHED && game.room.name === SEA_OF_MIND.district,
      narratorVarsNow: narratorVars(game.varTree),
      invNames: game.inv.map(i => (typeof i === "string" ? i : i?.name)).filter(Boolean),
      sectMasterAffection: game.varTree.角色?.[SECT_ENTRY.master]?.好感度 ?? 0,
    },
    turn: {
      rollbackBlocked: actions.rollbackBlocked,
      stopRunning: actions.stopRunning,
      dispatchCommand: actions.dispatchCommand,
      rollbackOneStep: actions.rollbackOneStep,
      captureUndo: actions.captureUndo,
      act: actions.act,
      autoTravelTo,
      teleportLookRef: actions.teleportLookRef,
      effectiveSpecialNow: actions.effectiveSpecialNow,
      onKey: actions.onKey,
    },
    handlers: {
      questPanel,
      pigeonHandlers,
      duelHandlers,
      screenHandlers,
      buildingHandlers,
      craftingAI,
      playerActionHandlers,
      progressionHandlers,
      aiInspect,
    },
  };
}
