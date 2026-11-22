import { useCallback } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import {
  buySkill as buySkillFeature,
  buyBook as buyBookFeature,
  cookMeal,
  gamble as gambleFeature,
  healAtHospital,
  listenToRumor,
  orderService,
  pray as prayFeature,
  readBook as readBookFeature,
  restAtInn,
  travelByCarriage,
} from "../../features/buildings/logic.js";
import {
  commissionForge,
  craftJade,
  settleGambleStone,
} from "../../features/crafting/logic.js";
import {
  acceptBounty,
  acceptEscort,
  claimBounty,
} from "../../features/quest/logic.js";
import {
  deposit as depositFeature,
  pledge as pledgeFeature,
  redeem as redeemFeature,
  withdraw as withdrawFeature,
} from "../../features/bank/logic.js";
import { joinSect } from "../../features/sect/logic.js";
import { auctionWin } from "../../features/auction/logic.js";
import { buyTangmenItem } from "../../features/buildings/tangmenShop.js";

export function useBuildingHandlers({ activeBuilding, setActiveBuilding, featureCtxRef, roomMapRef, captureUndo }) {
  const handleBuyTangmenItem = useCallback((name) => applyResult(featureCtxRef.current, () => {
    const result = buyTangmenItem(gameStore.getState(), name);
    if (result.changes) captureUndo();
    applyResult(featureCtxRef.current, result);
  }, { feature: "building.buyTangmenItem" }), [captureUndo, featureCtxRef]);

  const handleBuildingInn = useCallback((cost, roomType) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    const result = restAtInn(gameStore.getState(), {
      cost,
      roomType,
      buildingName: activeBuilding?.name,
    });
    applyResult(featureCtxRef.current, result);
  }, { feature: "building.restAtInn" }), [activeBuilding, captureUndo]);

  const handleBuildingHeal = useCallback((cost, healAmt) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, healAtHospital(gameStore.getState(), {
      cost,
      healAmt,
      buildingName: activeBuilding?.name,
    }));
  }, { feature: "building.healAtHospital" }), [activeBuilding, captureUndo]);

  const handleBuySkill = useCallback((catalogItem) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, buySkillFeature(gameStore.getState(), catalogItem));
  }, { feature: "building.buySkill" }), [captureUndo]);

  const handleGamble = useCallback(({ mode, bet, luck, dayIdx }) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, gambleFeature(gameStore.getState(), {
      mode,
      bet,
      luck,
      dayIdx,
      maxBet: activeBuilding?.maxBet,
    }));
  }, { feature: "building.gamble" }), [activeBuilding, captureUndo]);

  const handleTravel = useCallback((dest, price) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    const state = gameStore.getState();
    const roomMap = {
      ...roomMapRef.current,
      ...(state.room?.name ? {
        [state.room.name]: {
          items: [...(state.room.items || [])],
          npcs: [...(state.room.npcs || [])],
        },
      } : {}),
    };
    const result = travelByCarriage(state, dest, price, { roomMap });
    if (result.changes?.room && state.room?.name) {
      roomMapRef.current[state.room.name] = roomMap[state.room.name];
    }
    applyResult(featureCtxRef.current, result);
    if (result.changes) setActiveBuilding(null);
  }, { feature: "building.travel" }), [captureUndo]);

  const handleServiceOrder = useCallback((item, karmaChange = 0) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, orderService(gameStore.getState(), item, karmaChange));
  }, { feature: "building.serviceOrder" }), [captureUndo]);

  const handleCook = useCallback(({ materials, technique, cookware, freestyle, dish }) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, cookMeal(gameStore.getState(), {
      materials,
      technique,
      cookware,
      freestyle,
      dish,
      buildingName: activeBuilding?.name,
    }));
  }, { feature: "building.cook" }), [activeBuilding, captureUndo]);

  const handlePray = useCallback(() => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, prayFeature(
      gameStore.getState(),
      activeBuilding?.karmaPerPray || 10,
    ));
  }, { feature: "building.pray" }), [activeBuilding, captureUndo]);

  const handleReadBook = useCallback((book) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, readBookFeature(gameStore.getState(), book));
  }, { feature: "building.readBook" }), [captureUndo]);

  const handleBuyBook = useCallback((book) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, buyBookFeature(gameStore.getState(), book));
  }, { feature: "building.buyBook" }), [captureUndo]);

  const handleDeposit = useCallback((amount) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, depositFeature(gameStore.getState(), amount));
  }, { feature: "building.deposit" }), [captureUndo]);

  const handleWithdraw = useCallback(() => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, withdrawFeature(gameStore.getState()));
  }, { feature: "building.withdraw" }), [captureUndo]);

  const handlePledge = useCallback((item, pledgeValue) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, pledgeFeature(gameStore.getState(), item.id, pledgeValue));
  }, { feature: "building.pledge" }), [captureUndo]);

  const handleRedeem = useCallback((index, redeemCost) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, redeemFeature(gameStore.getState(), index, redeemCost));
  }, { feature: "building.redeem" }), [captureUndo]);

  const handleAcceptEscort = useCallback((quest) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, acceptEscort(gameStore.getState(), quest));
  }, { feature: "building.acceptEscort" }), [captureUndo]);

  const handleAcceptBounty = useCallback((quest) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, acceptBounty(gameStore.getState(), quest));
  }, { feature: "building.acceptBounty" }), [captureUndo]);

  const handleClaimBounty = useCallback((quest) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, claimBounty(gameStore.getState(), quest));
  }, { feature: "building.claimBounty" }), [captureUndo]);

  const handleGambleSettle = useCallback((res) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    const result = settleGambleStone(gameStore.getState(), res);
    applyResult(featureCtxRef.current, result);
    if (res.type !== "buy" && result.changes) setActiveBuilding(null);
  }, { feature: "building.gambleSettle" }), [captureUndo]);

  const handleForgeCommission = useCallback((chosen, luck, currentTime, cost, threeFields) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, commissionForge(gameStore.getState(), {
      chosen, luck, currentTime, cost, threeFields,
    }));
  }, { feature: "building.forgeCommission" }), [captureUndo]);

  const handleJadeCraft = useCallback((chosen, jadeItemId, currentTime, threeFields) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, craftJade(gameStore.getState(), {
      chosen, jadeItemId, currentTime, threeFields,
    }));
  }, { feature: "building.jadeCraft" }), [captureUndo]);

  const handleListenRumor = useCallback((rumor, cost) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, listenToRumor(gameStore.getState(), rumor, cost));
  }, { feature: "building.listenRumor" }), [captureUndo]);

  const handleJoinSect = useCallback(() => applyResult(featureCtxRef.current, () => {
    captureUndo();
    const result = joinSect(gameStore.getState());
    if (result.changes) setActiveBuilding(null);
    applyResult(featureCtxRef.current, result);
  }, { feature: "building.joinSect" }), [captureUndo]);

  const handleAuctionWin = useCallback((finalPrice) => applyResult(featureCtxRef.current, () => {
    captureUndo();
    applyResult(featureCtxRef.current, auctionWin(gameStore.getState(), finalPrice));
  }, { feature: "building.auctionWin" }), [captureUndo]);

  return {
    handleBuyTangmenItem,
    handleBuildingInn,
    handleBuildingHeal,
    handleBuySkill,
    handleGamble,
    handleTravel,
    handleServiceOrder,
    handleCook,
    handlePray,
    handleReadBook,
    handleBuyBook,
    handleDeposit,
    handleWithdraw,
    handlePledge,
    handleRedeem,
    handleAcceptEscort,
    handleAcceptBounty,
    handleClaimBounty,
    handleGambleSettle,
    handleForgeCommission,
    handleJadeCraft,
    handleListenRumor,
    handleJoinSect,
    handleAuctionWin,
  };
}
