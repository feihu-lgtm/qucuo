// Web 侧 hook → 命令 id 映射，作为注册表条目并入 COMMAND_REGISTRY：
// 每条 {id, hooks:{组名:[handler 名]}}，HOOK_COMMANDS 由此生成（旧 infra/commands.js
// 字面量的一对一搬运，handler→id 映射完全不变）。
export const HOOK_ENTRIES = [
  { id: "npcLook", hooks: { useScreenHandlers: ["handleNpcLook"] } },
  { id: "npcTalk", hooks: { useScreenHandlers: ["handleNpcTalk"] } },
  { id: "npcGift", hooks: { useScreenHandlers: ["handleNpcGift"] } },
  { id: "companionInvite", hooks: { useScreenHandlers: ["handleInviteCompanion", "handleOcRecruit", "handleStationCompanion", "handleRecallCompanion"] } },
  { id: "itemUseCollect", hooks: { useScreenHandlers: ["handleConsumeItem", "handleCollectGround"] } },
  { id: "npcTrade", hooks: { useScreenHandlers: ["handleNpcTrade", "handleBuyCarry"] } },
  { id: "npcLearnSkill", hooks: { useScreenHandlers: ["handleNpcLearnSkill"], useBuildingHandlers: ["handleBuySkill"] } },
  { id: "npcSteal", hooks: { useScreenHandlers: ["handleNpcSteal"] } },
  { id: "characterGift", hooks: { useScreenHandlers: ["giftToCharacter"] } },
  { id: "menuEquip", hooks: { useScreenHandlers: ["handleToggleEquip"] } },
  { id: "milestoneClaim", hooks: { useScreenHandlers: ["claimMilestone"] } },
  { id: "inn", hooks: { useBuildingHandlers: ["handleBuildingInn", "handleBuildingHeal", "handleClinicService"] } },
  { id: "generalShop", hooks: { useBuildingHandlers: ["handleGamble", "handleServiceOrder", "handleForgeCommission", "handleJadeCraft", "handleAuctionWin"] } },
  { id: "shopBuy", hooks: { useBuildingHandlers: ["handleBuyTangmenItem"] } },
  { id: "shopSell", hooks: { useBuildingHandlers: ["handleSellFactionItem"] } },
  { id: "carriage", hooks: { useBuildingHandlers: ["handleTravel"] } },
  { id: "homeCooking", hooks: { useBuildingHandlers: ["handleCook"] } },
  { id: "prayer", hooks: { useBuildingHandlers: ["handlePray"] } },
  { id: "book", hooks: { useBuildingHandlers: ["handleReadBook", "handleBuyBook", "handleChaojing"] } },
  { id: "bank", hooks: { useBuildingHandlers: ["handleDeposit", "handleWithdraw", "handlePledge", "handleRedeem"] } },
  {
    id: "questChoice",
    hooks: {
      useBuildingHandlers: ["handleAcceptEscort", "handleAcceptBounty", "handleClaimBounty", "handleJoinSect", "handleLeaveSect"],
      useQuestPanel: ["forceAdvanceQuest", "triggerQuestFromPanel", "triggerQuestChoice"],
    },
  },
  { id: "gambleTalk", hooks: { useBuildingHandlers: ["handleGambleSettle"], useCraftingAI: ["handleGambleTalk"] } },
  { id: "festival", hooks: { useBuildingHandlers: ["handleFestivalEnter", "handleFestivalBet", "handleFestivalInvite", "handleFestivalNight", "handleFestivalWubi", "handleFestivalMidnight"] } },
  { id: "typedAction", hooks: { useBuildingHandlers: ["handleListenRumor"] } },
  {
    id: "rightPanelSkills",
    hooks: {
      useProgressionHandlers: ["confessToNarrator", "trainNeigong", "trainWaigong", "breakthroughSkill"],
      usePlayerActionHandlers: ["handleComfort", "handleResolveTrauma", "enterSeaOfMind", "leaveSeaOfMind"],
    },
  },
  { id: "meditate", hooks: { useProgressionHandlers: ["meditate"] } },
  { id: "pigeonLetter", hooks: { usePigeonHandlers: ["pigeonDelayShichen", "sendPigeonLetter", "buyPigeon", "handleCollectPigeons", "handlePostSend"] } },
  { id: "pigeonReply", hooks: { usePigeonHandlers: ["applyPigeonResult"] } },
  { id: "persuasionTurn", hooks: { useQuestPanel: ["savePersuasionProgress", "finishPersuasion"] } },
  { id: "duel", hooks: { useDuel: ["handleNpcDuel", "confirmDuel", "cancelDuel", "duelFinishHandler", "resetDuel"] } },
  { id: "companionSwitch", hooks: { usePlayerActionHandlers: ["handleSwitchCompanion"] } },
  { id: "cardImport", hooks: { useCardImportHandlers: ["handleImportNpcs", "handleImportPlayer", "handleImportWorld"] } },
  { id: "characterCreation", hooks: { useCardImportHandlers: ["handleCreateCharacter", "handleOpeningFinish"] } },
  { id: "bodyProfile", hooks: { useCardImportHandlers: ["handleBodyProfileChange"] } },
  { id: "gambleInspect", hooks: { useCraftingAI: ["handleGambleInspect"] } },
  { id: "forgeGeneration", hooks: { useCraftingAI: ["handleForgeDesign"] } },
  { id: "jadeGeneration", hooks: { useCraftingAI: ["handleJadeDesign"] } },
  { id: "inspect", hooks: { useAiInspect: ["inspectItem"] } },
  { id: "outfitAdvice", hooks: { useOutfitAdvice: ["recommendOutfit"] } },
];

// {useScreenHandlers:{handleNpcLook:"npcLook",...},...}——与旧 HOOK_COMMANDS 字面量同构。
export function buildHookCommands(entries) {
  const groups = {};
  for (const entry of entries) {
    for (const [group, names] of Object.entries(entry.hooks || {})) {
      const map = groups[group] || (groups[group] = {});
      for (const name of names) map[name] = entry.id;
    }
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(groups).map(([group, map]) => [group, Object.freeze(map)]),
  ));
}
