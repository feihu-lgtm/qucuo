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

export function useBuildingHandlers({ activeBuilding, setActiveBuilding, featureCtxRef, roomMapRef }) {
  const handleBuildingInn = useCallback((cost, roomType) => {
    const result = restAtInn(gameStore.getState(), {
      cost,
      roomType,
      buildingName: activeBuilding?.name,
    });
    applyResult(featureCtxRef.current, result);
  }, [activeBuilding]);

  const handleBuildingHeal = useCallback((cost, healAmt) => {
    applyResult(featureCtxRef.current, healAtHospital(gameStore.getState(), {
      cost,
      healAmt,
      buildingName: activeBuilding?.name,
    }));
  }, [activeBuilding]);

  const handleBuySkill = useCallback((catalogItem) => {
    applyResult(featureCtxRef.current, buySkillFeature(gameStore.getState(), catalogItem));
  }, []);

  const handleGamble = useCallback(({ mode, bet, luck, dayIdx }) => {
    applyResult(featureCtxRef.current, gambleFeature(gameStore.getState(), {
      mode,
      bet,
      luck,
      dayIdx,
      maxBet: activeBuilding?.maxBet,
    }));
  }, [activeBuilding]);

  const handleTravel = useCallback((dest, price) => {
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
  }, []);

  const handleServiceOrder = useCallback((item, karmaChange = 0) => {
    applyResult(featureCtxRef.current, orderService(gameStore.getState(), item, karmaChange));
  }, []);

  const handleCook = useCallback(({ materials, technique, cookware, freestyle, dish }) => {
    applyResult(featureCtxRef.current, cookMeal(gameStore.getState(), {
      materials,
      technique,
      cookware,
      freestyle,
      dish,
      buildingName: activeBuilding?.name,
    }));
  }, [activeBuilding]);

  const handlePray = useCallback(() => {
    applyResult(featureCtxRef.current, prayFeature(
      gameStore.getState(),
      activeBuilding?.karmaPerPray || 10,
    ));
  }, [activeBuilding]);

  const handleReadBook = useCallback((book) => {
    applyResult(featureCtxRef.current, readBookFeature(gameStore.getState(), book));
  }, []);

  const handleBuyBook = useCallback((book) => {
    applyResult(featureCtxRef.current, buyBookFeature(gameStore.getState(), book));
  }, []);

  const handleDeposit = useCallback((amount) => {
    applyResult(featureCtxRef.current, depositFeature(gameStore.getState(), amount));
  }, []);

  const handleWithdraw = useCallback(() => {
    applyResult(featureCtxRef.current, withdrawFeature(gameStore.getState()));
  }, []);

  const handlePledge = useCallback((item, pledgeValue) => {
    applyResult(featureCtxRef.current, pledgeFeature(gameStore.getState(), item.id, pledgeValue));
  }, []);

  const handleRedeem = useCallback((index, redeemCost) => {
    applyResult(featureCtxRef.current, redeemFeature(gameStore.getState(), index, redeemCost));
  }, []);

  const handleAcceptEscort = useCallback((quest) => {
    applyResult(featureCtxRef.current, acceptEscort(gameStore.getState(), quest));
  }, []);

  const handleAcceptBounty = useCallback((quest) => {
    applyResult(featureCtxRef.current, acceptBounty(gameStore.getState(), quest));
  }, []);

  const handleClaimBounty = useCallback((quest) => {
    applyResult(featureCtxRef.current, claimBounty(gameStore.getState(), quest));
  }, []);

  const handleGambleSettle = useCallback((res) => {
    const result = settleGambleStone(gameStore.getState(), res);
    applyResult(featureCtxRef.current, result);
    if (res.type !== "buy" && result.changes) setActiveBuilding(null);
  }, []);

  const handleForgeCommission = useCallback((chosen, luck, currentTime, cost, threeFields) => {
    applyResult(featureCtxRef.current, commissionForge(gameStore.getState(), {
      chosen, luck, currentTime, cost, threeFields,
    }));
  }, []);

  const handleJadeCraft = useCallback((chosen, jadeItemId, currentTime, threeFields) => {
    applyResult(featureCtxRef.current, craftJade(gameStore.getState(), {
      chosen, jadeItemId, currentTime, threeFields,
    }));
  }, []);

  const handleListenRumor = useCallback((rumor, cost) => {
    applyResult(featureCtxRef.current, listenToRumor(gameStore.getState(), rumor, cost));
  }, []);

  const handleJoinSect = useCallback(() => {
    const result = joinSect(gameStore.getState());
    if (result.changes) setActiveBuilding(null);
    applyResult(featureCtxRef.current, result);
  }, []);

  const handleAuctionWin = useCallback((finalPrice) => {
    applyResult(featureCtxRef.current, auctionWin(gameStore.getState(), finalPrice));
  }, []);

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
