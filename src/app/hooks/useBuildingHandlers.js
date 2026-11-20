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

export function useBuildingHandlers({ activeBuilding, setActiveBuilding, featureCtxRef, roomMapRef, captureUndo }) {
  const handleBuildingInn = useCallback((cost, roomType) => {
    captureUndo();
    const result = restAtInn(gameStore.getState(), {
      cost,
      roomType,
      buildingName: activeBuilding?.name,
    });
    applyResult(featureCtxRef.current, result);
  }, [activeBuilding, captureUndo]);

  const handleBuildingHeal = useCallback((cost, healAmt) => {
    captureUndo();
    applyResult(featureCtxRef.current, healAtHospital(gameStore.getState(), {
      cost,
      healAmt,
      buildingName: activeBuilding?.name,
    }));
  }, [activeBuilding, captureUndo]);

  const handleBuySkill = useCallback((catalogItem) => {
    captureUndo();
    applyResult(featureCtxRef.current, buySkillFeature(gameStore.getState(), catalogItem));
  }, [captureUndo]);

  const handleGamble = useCallback(({ mode, bet, luck, dayIdx }) => {
    captureUndo();
    applyResult(featureCtxRef.current, gambleFeature(gameStore.getState(), {
      mode,
      bet,
      luck,
      dayIdx,
      maxBet: activeBuilding?.maxBet,
    }));
  }, [activeBuilding, captureUndo]);

  const handleTravel = useCallback((dest, price) => {
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
  }, [captureUndo]);

  const handleServiceOrder = useCallback((item, karmaChange = 0) => {
    captureUndo();
    applyResult(featureCtxRef.current, orderService(gameStore.getState(), item, karmaChange));
  }, [captureUndo]);

  const handleCook = useCallback(({ materials, technique, cookware, freestyle, dish }) => {
    captureUndo();
    applyResult(featureCtxRef.current, cookMeal(gameStore.getState(), {
      materials,
      technique,
      cookware,
      freestyle,
      dish,
      buildingName: activeBuilding?.name,
    }));
  }, [activeBuilding, captureUndo]);

  const handlePray = useCallback(() => {
    captureUndo();
    applyResult(featureCtxRef.current, prayFeature(
      gameStore.getState(),
      activeBuilding?.karmaPerPray || 10,
    ));
  }, [activeBuilding, captureUndo]);

  const handleReadBook = useCallback((book) => {
    captureUndo();
    applyResult(featureCtxRef.current, readBookFeature(gameStore.getState(), book));
  }, [captureUndo]);

  const handleBuyBook = useCallback((book) => {
    captureUndo();
    applyResult(featureCtxRef.current, buyBookFeature(gameStore.getState(), book));
  }, [captureUndo]);

  const handleDeposit = useCallback((amount) => {
    captureUndo();
    applyResult(featureCtxRef.current, depositFeature(gameStore.getState(), amount));
  }, [captureUndo]);

  const handleWithdraw = useCallback(() => {
    captureUndo();
    applyResult(featureCtxRef.current, withdrawFeature(gameStore.getState()));
  }, [captureUndo]);

  const handlePledge = useCallback((item, pledgeValue) => {
    captureUndo();
    applyResult(featureCtxRef.current, pledgeFeature(gameStore.getState(), item.id, pledgeValue));
  }, [captureUndo]);

  const handleRedeem = useCallback((index, redeemCost) => {
    captureUndo();
    applyResult(featureCtxRef.current, redeemFeature(gameStore.getState(), index, redeemCost));
  }, [captureUndo]);

  const handleAcceptEscort = useCallback((quest) => {
    captureUndo();
    applyResult(featureCtxRef.current, acceptEscort(gameStore.getState(), quest));
  }, [captureUndo]);

  const handleAcceptBounty = useCallback((quest) => {
    captureUndo();
    applyResult(featureCtxRef.current, acceptBounty(gameStore.getState(), quest));
  }, [captureUndo]);

  const handleClaimBounty = useCallback((quest) => {
    captureUndo();
    applyResult(featureCtxRef.current, claimBounty(gameStore.getState(), quest));
  }, [captureUndo]);

  const handleGambleSettle = useCallback((res) => {
    captureUndo();
    const result = settleGambleStone(gameStore.getState(), res);
    applyResult(featureCtxRef.current, result);
    if (res.type !== "buy" && result.changes) setActiveBuilding(null);
  }, [captureUndo]);

  const handleForgeCommission = useCallback((chosen, luck, currentTime, cost, threeFields) => {
    captureUndo();
    applyResult(featureCtxRef.current, commissionForge(gameStore.getState(), {
      chosen, luck, currentTime, cost, threeFields,
    }));
  }, [captureUndo]);

  const handleJadeCraft = useCallback((chosen, jadeItemId, currentTime, threeFields) => {
    captureUndo();
    applyResult(featureCtxRef.current, craftJade(gameStore.getState(), {
      chosen, jadeItemId, currentTime, threeFields,
    }));
  }, [captureUndo]);

  const handleListenRumor = useCallback((rumor, cost) => {
    captureUndo();
    applyResult(featureCtxRef.current, listenToRumor(gameStore.getState(), rumor, cost));
  }, [captureUndo]);

  const handleJoinSect = useCallback(() => {
    captureUndo();
    const result = joinSect(gameStore.getState());
    if (result.changes) setActiveBuilding(null);
    applyResult(featureCtxRef.current, result);
  }, [captureUndo]);

  const handleAuctionWin = useCallback((finalPrice) => {
    captureUndo();
    applyResult(featureCtxRef.current, auctionWin(gameStore.getState(), finalPrice));
  }, [captureUndo]);

  return {
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
