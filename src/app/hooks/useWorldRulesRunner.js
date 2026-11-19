import { useEffect, useRef } from "react";
import { createCoalescedCheck, createWorldRules } from "../../engine/worldRules.js";
import { timeAdvanceRule } from "../../features/time/rules.js";
import { residentNpcRule } from "../../features/npc/rules.js";
import {
  alreadySatisfiedCollectRule,
  collectGroundItemsRule,
  estateAnnouncementRule,
  estateProgressRule,
  estateStartRule,
  escortArrivalRule,
  questFlagRule,
} from "../../features/quest/rules.js";
import { innerGroundItemsRule } from "../../features/map/rules.js";
import { derivedMovesetRule } from "../../features/skills/rules.js";
import {
  finishTokyoReturn,
  portalOpenedRule,
  scheduleTokyoReturnRule,
  villaArrivalRule,
  xuannuTriggerRule,
} from "../../features/narrator/rules.js";
import { applyResult } from "../../features/run.js";
import * as importedRegistry from "../../domain/cards/importedRegistry.js";
import { gameActions, gameStore } from "../../store/gameStore.js";

export function useWorldRulesRunner({ featureCtxRef, seaReturnRef, setForcedDuelNpc }) {
  const worldRulesRunnerRef = useRef(null);
  const tokyoReturnTimerRef = useRef(null);

  useEffect(() => {
    const cancelTokyoReturn = () => {
      if (tokyoReturnTimerRef.current) clearTimeout(tokyoReturnTimerRef.current);
      tokyoReturnTimerRef.current = null;
    };
    const scheduleTokyoReturn = ({ back, label }) => {
      cancelTokyoReturn();
      tokyoReturnTimerRef.current = setTimeout(() => {
        tokyoReturnTimerRef.current = null;
        if (gameStore.getState().room?.name !== "第三新东京市") return;
        const { result, innerRoomName: returnInnerRoomName } = finishTokyoReturn(back, label);
        applyResult(featureCtxRef.current, result);
        if (returnInnerRoomName !== undefined) {
          setTimeout(() => gameActions.setInnerRoomName(returnInnerRoomName), 0);
        }
      }, 3500);
    };
    if (!worldRulesRunnerRef.current) {
      worldRulesRunnerRef.current = createWorldRules([
        timeAdvanceRule,
        residentNpcRule,
        collectGroundItemsRule,
        innerGroundItemsRule,
        derivedMovesetRule,
        alreadySatisfiedCollectRule,
        escortArrivalRule,
        questFlagRule,
        estateStartRule,
        estateAnnouncementRule,
        estateProgressRule,
        xuannuTriggerRule,
        villaArrivalRule,
        portalOpenedRule,
        scheduleTokyoReturnRule,
      ], {
        getState: () => ({
          ...gameStore.getState(),
          importedVer: importedRegistry.getImportedRevision(),
        }),
        ctx: {
          importedRegistry,
          get companionState() {
            return gameStore.getState().companionState;
          },
          getSeaReturn: () => seaReturnRef.current,
          cancelTokyoReturn,
          scheduleTokyoReturn,
          getNow: () => Date.now(),
        },
        applyResult: (result) => {
          applyResult(featureCtxRef.current, result);
          if (result.forcedDuelNpc) setForcedDuelNpc(result.forcedDuelNpc);
        },
      });
    }
    const scheduler = createCoalescedCheck(() => worldRulesRunnerRef.current.check());
    const unsubscribeStore = gameStore.subscribe(scheduler.schedule);
    const unsubscribeImported = importedRegistry.subscribeImported(scheduler.schedule);
    scheduler.schedule();
    return () => {
      unsubscribeStore();
      unsubscribeImported();
      scheduler.dispose();
      cancelTokyoReturn();
    };
  }, []);
}
