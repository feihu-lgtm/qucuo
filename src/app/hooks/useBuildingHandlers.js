import { useCallback } from "react";
import { featureCtx } from "../runtime/gameRuntime.js";
import { gameStore, gameActions } from "../../store/gameStore.js";
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
import { joinSect, leaveSect } from "../../features/sect/logic.js";
import { auctionWin } from "../../features/auction/logic.js";
import { buyFactionShopItem, sellFactionShopItem } from "../../features/buildings/factionShop.js";
import { doClinicService } from "../../features/buildings/factionClinic.js";
import { doChaojing } from "../../features/sect/chaojing.js";
import {
  enterContest as festivalEnterContest,
  placeBet as festivalPlaceBet,
  inviteCompanion as festivalInvite,
  nightTogether as festivalNight,
  resolveMidnightYield,
} from "../../features/festival/logic.js";
import { FESTIVAL_CONTESTS, MIDNIGHT_FLAG, contestFlag } from "../../domain/data/festival/festivalData.js";
import { isContestOpen } from "../../domain/rules/festival/rules.js";
import { buildQuestFoe } from "../../features/quest/combatChoice.js";

export function useBuildingHandlers({ activeBuilding, setActiveBuilding, captureUndo, setPendingQuestBranch, setDuelingNpc }) {
  const handleBuyTangmenItem = useCallback((name, shopKey = "唐门暗器") => applyResult(featureCtx(), () => {
    const result = buyFactionShopItem(gameStore.getState(), shopKey, name);
    if (result.changes) captureUndo();
    applyResult(featureCtx(), result);
  }, { feature: "building.buyTangmenItem" }), [captureUndo]);

  const handleSellFactionItem = useCallback((item, shopKey) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), sellFactionShopItem(gameStore.getState(), shopKey, item));
  }, { feature: "building.sellFactionItem" }), [captureUndo]);

  const handleBuildingInn = useCallback((cost, roomType) => applyResult(featureCtx(), () => {
    captureUndo();
    const result = restAtInn(gameStore.getState(), {
      cost,
      roomType,
      buildingName: activeBuilding?.name,
    });
    applyResult(featureCtx(), result);
  }, { feature: "building.restAtInn" }), [activeBuilding, captureUndo]);

  const handleBuildingHeal = useCallback((cost, healAmt) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), healAtHospital(gameStore.getState(), {
      cost,
      healAmt,
      buildingName: activeBuilding?.name,
      buildingId: activeBuilding?.id,
    }));
  }, { feature: "building.healAtHospital" }), [activeBuilding, captureUndo]);

  const handleClinicService = useCallback(() => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), doClinicService(gameStore.getState(), activeBuilding?.id));
  }, { feature: "building.clinicService" }), [activeBuilding, captureUndo]);

  const handleChaojing = useCallback(() => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), doChaojing(gameStore.getState()));
  }, { feature: "building.chaojing" }), [captureUndo]);

  const handleBuySkill = useCallback((catalogItem) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), buySkillFeature(gameStore.getState(), catalogItem));
  }, { feature: "building.buySkill" }), [captureUndo]);

  const handleGamble = useCallback(({ mode, bet, luck, dayIdx }) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), gambleFeature(gameStore.getState(), {
      mode,
      bet,
      luck,
      dayIdx,
      maxBet: activeBuilding?.maxBet,
    }));
  }, { feature: "building.gamble" }), [activeBuilding, captureUndo]);

  const handleTravel = useCallback((dest, price) => applyResult(featureCtx(), () => {
    captureUndo();
    const state = gameStore.getState();
    const roomMap = {
      ...(gameStore.getState().roomCache || {}),
      ...(state.room?.name ? {
        [state.room.name]: {
          items: [...(state.room.items || [])],
          npcs: [...(state.room.npcs || [])],
        },
      } : {}),
    };
    const result = travelByCarriage(state, dest, price, { roomMap });
    // WO-06：出发房缓存写走统一写入口
    if (result.changes?.room && state.room?.name) {
      result.changes.roomCache = (cache) => ({ ...(cache || {}), [state.room.name]: roomMap[state.room.name] });
    }
    applyResult(featureCtx(), result);
    if (result.changes) setActiveBuilding(null);
  }, { feature: "building.travel" }), [captureUndo]);

  const handleServiceOrder = useCallback((item, karmaChange = 0) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), orderService(gameStore.getState(), item, karmaChange));
  }, { feature: "building.serviceOrder" }), [captureUndo]);

  const handleCook = useCallback(({ materials, technique, cookware, freestyle, dish, share }) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), cookMeal(gameStore.getState(), {
      materials,
      technique,
      cookware,
      freestyle,
      dish,
      buildingName: activeBuilding?.name,
      buildingId: activeBuilding?.id,
      share,
    }));
  }, { feature: "building.cook" }), [activeBuilding, captureUndo]);

  const handlePray = useCallback(() => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), prayFeature(
      gameStore.getState(),
      activeBuilding?.karmaPerPray || 10,
    ));
  }, { feature: "building.pray" }), [activeBuilding, captureUndo]);

  const handleReadBook = useCallback((book) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), readBookFeature(gameStore.getState(), book));
  }, { feature: "building.readBook" }), [captureUndo]);

  const handleBuyBook = useCallback((book) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), buyBookFeature(gameStore.getState(), book));
  }, { feature: "building.buyBook" }), [captureUndo]);

  const handleDeposit = useCallback((amount) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), depositFeature(gameStore.getState(), amount));
  }, { feature: "building.deposit" }), [captureUndo]);

  const handleWithdraw = useCallback(() => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), withdrawFeature(gameStore.getState()));
  }, { feature: "building.withdraw" }), [captureUndo]);

  const handlePledge = useCallback((item, pledgeValue) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), pledgeFeature(gameStore.getState(), item.id, pledgeValue));
  }, { feature: "building.pledge" }), [captureUndo]);

  const handleRedeem = useCallback((index, redeemCost) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), redeemFeature(gameStore.getState(), index, redeemCost));
  }, { feature: "building.redeem" }), [captureUndo]);

  const handleAcceptEscort = useCallback((quest) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), acceptEscort(gameStore.getState(), quest));
  }, { feature: "building.acceptEscort" }), [captureUndo]);

  const handleAcceptBounty = useCallback((quest) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), acceptBounty(gameStore.getState(), quest));
  }, { feature: "building.acceptBounty" }), [captureUndo]);

  const handleClaimBounty = useCallback((quest) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), claimBounty(gameStore.getState(), quest));
  }, { feature: "building.claimBounty" }), [captureUndo]);

  const handleGambleSettle = useCallback((res) => applyResult(featureCtx(), () => {
    captureUndo();
    const result = settleGambleStone(gameStore.getState(), res);
    applyResult(featureCtx(), result);
    if (res.type !== "buy" && result.changes) setActiveBuilding(null);
  }, { feature: "building.gambleSettle" }), [captureUndo]);

  const handleForgeCommission = useCallback((chosen, luck, currentTime, cost, threeFields) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), commissionForge(gameStore.getState(), {
      chosen, luck, currentTime, cost, threeFields,
    }));
  }, { feature: "building.forgeCommission" }), [captureUndo]);

  const handleJadeCraft = useCallback((chosen, jadeItemId, currentTime, threeFields) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), craftJade(gameStore.getState(), {
      chosen, jadeItemId, currentTime, threeFields,
    }));
  }, { feature: "building.jadeCraft" }), [captureUndo]);

  const handleListenRumor = useCallback((rumor, cost) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), listenToRumor(gameStore.getState(), rumor, cost));
  }, { feature: "building.listenRumor" }), [captureUndo]);

  const handleJoinSect = useCallback(() => applyResult(featureCtx(), () => {
    captureUndo();
    const result = joinSect(gameStore.getState());
    if (result.changes) setActiveBuilding(null);
    applyResult(featureCtx(), result);
  }, { feature: "building.joinSect" }), [captureUndo]);

  const handleLeaveSect = useCallback((sectName) => applyResult(featureCtx(), () => {
    captureUndo();
    const result = leaveSect(gameStore.getState(), sectName);
    if (result.changes) setActiveBuilding(null);
    applyResult(featureCtx(), result);
  }, { feature: "building.leaveSect" }), [captureUndo]);

  const handleAuctionWin = useCallback((finalPrice) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), auctionWin(gameStore.getState(), finalPrice));
  }, { feature: "building.auctionWin" }), [captureUndo]);

  const handleFestivalEnter = useCallback((contestId) => applyResult(featureCtx(), () => {
    const result = festivalEnterContest(gameStore.getState(), contestId);
    if (result.changes) captureUndo();
    applyResult(featureCtx(), result);
  }, { feature: "festival.enter" }), [captureUndo]);

  const handleFestivalBet = useCallback((contestId, bettorName, bet) => applyResult(featureCtx(), () => {
    const result = festivalPlaceBet(gameStore.getState(), contestId, bettorName, bet);
    if (result.changes) captureUndo();
    applyResult(featureCtx(), result);
  }, { feature: "festival.bet" }), [captureUndo]);

  const handleFestivalInvite = useCallback((name) => applyResult(featureCtx(), () => {
    const result = festivalInvite(gameStore.getState(), name);
    if (result.changes) captureUndo();
    applyResult(featureCtx(), result);
  }, { feature: "festival.invite" }), [captureUndo]);

  const handleFestivalNight = useCallback((name) => applyResult(featureCtx(), () => {
    const result = festivalNight(gameStore.getState(), name);
    if (result.changes) captureUndo();
    applyResult(featureCtx(), result);
  }, { feature: "festival.night" }), [captureUndo]);

  // 比武擂台：走任务 pendingQuestBranch + 切磋链路，打赢 settleNpcDuel 自动发奖。
  const handleFestivalWubi = useCallback(() => applyResult(featureCtx(), () => {
    const state = gameStore.getState();
    const contest = FESTIVAL_CONTESTS.wubi;
    const day = Math.floor((state.time || 0) / 24);
    const flag = contestFlag("wubi", "enter", day);
    if (!isContestOpen(contest, (state.time || 0) % 24)) {
      applyResult(featureCtx(), { logs: [{ t: "err", text: "  比武未开场，傍黑（十七至二十时）再来。" }] });
      return;
    }
    if ((state.flags || []).includes(flag)) {
      applyResult(featureCtx(), { logs: [{ t: "err", text: "  今日已上过擂，明日再来。" }] });
      return;
    }
    captureUndo();
    applyResult(featureCtx(), {
      changes: { flags: [...(state.flags || []), flag] },
      logs: [{ t: "cmd", text: "> ❢ 跑马大会·擂台夺彩：上擂台" }, { t: "sys", text: "  【比武】你翻身上了擂台，骑技教头抱拳候着。" }],
    });
    setPendingQuestBranch({ questId: "paoma_wubi", flag: contest.questFlag, mode: "combat", title: "跑马大会·擂台夺彩", aftermath: contest.aftermath });
    setDuelingNpc(buildQuestFoe({ flag: contest.questFlag, combatNpc: contest.combatNpc }));
  }, { feature: "festival.wubi" }), [captureUndo, setPendingQuestBranch, setDuelingNpc]);

  // 子夜之变：避让直接结算 yield 分支；出手走战斗分支（旗子先落，输赢都只来一回）。
  const handleFestivalMidnight = useCallback((event, choice) => applyResult(featureCtx(), () => {
    const state = gameStore.getState();
    if ((state.flags || []).includes(MIDNIGHT_FLAG) || state.questProgress?.paoma_ziye?.status === "completed") {
      applyResult(featureCtx(), { logs: [{ t: "err", text: "  变故已经了过。" }] });
      return;
    }
    captureUndo();
    if (choice.kind === "yield") {
      applyResult(featureCtx(), resolveMidnightYield(state));
      return;
    }
    applyResult(featureCtx(), {
      changes: { flags: [...(state.flags || []), MIDNIGHT_FLAG] },
      logs: [{ t: "cmd", text: `> ❢ 跑马大会·${event.title}：${choice.label}` }],
    });
    setPendingQuestBranch({ questId: "paoma_ziye", flag: choice.flag, mode: "combat", title: `跑马大会·${event.title}`, aftermath: choice.aftermath });
    setDuelingNpc(buildQuestFoe({ flag: choice.flag, combatNpc: choice.combatNpc }));
  }, { feature: "festival.midnight" }), [captureUndo, setPendingQuestBranch, setDuelingNpc]);

  return {
    handleFestivalEnter,
    handleFestivalBet,
    handleFestivalInvite,
    handleFestivalNight,
    handleFestivalWubi,
    handleFestivalMidnight,
    handleBuyTangmenItem,
    handleSellFactionItem,
    handleBuildingInn,
    handleBuildingHeal,
    handleClinicService,
    handleChaojing,
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
    handleLeaveSect,
    handleAuctionWin,
  };
}
