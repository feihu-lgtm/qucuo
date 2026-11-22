import { snowLeopardRule } from "../../features/quest/snowLeopard.js";
import { useEffect, useRef, useState } from "react";
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
import * as importedRegistry from "../../domain/rules/cards/importedRegistry.js";
import { gameActions, gameStore, subscribeGameReplaced } from "../../store/gameStore.js";

export function useWorldRulesRunner({
  featureCtxRef, seaReturnRef, setForcedDuelNpc, schedulerRef, roomMapRef, dispatchCommand = (_id, fn) => fn(),
}) {
  const replacedRef = useRef(false);
  const [replacedTick, setReplacedTick] = useState(0);
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
        dispatchCommand("worldRules", () => {
          applyResult(featureCtxRef.current, result);
          if (returnInnerRoomName !== undefined) {
            setTimeout(() => dispatchCommand("worldRules", () => gameActions.setInnerRoomName(returnInnerRoomName)), 0);
          }
        });
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
        snowLeopardRule,
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
          roomMapRef,
          get companionState() {
            return gameStore.getState().companionState;
          },
          getSeaReturn: () => seaReturnRef.current,
          cancelTokyoReturn,
          scheduleTokyoReturn,
          getNow: () => Date.now(),
        },
        applyResult: (result) => {
          dispatchCommand("worldRules", () => {
            if (result.roomMap) roomMapRef.current = result.roomMap;
            applyResult(featureCtxRef.current, result);
            if (result.forcedDuelNpc) setForcedDuelNpc(result.forcedDuelNpc);
          });
        },
      });
    }
    const scheduler = createCoalescedCheck(() => {
      if (!replacedRef.current) worldRulesRunnerRef.current.check();
    });
    const unsubscribeStore = gameStore.subscribe(scheduler.schedule);
    const unsubscribeImported = importedRegistry.subscribeImported(scheduler.schedule);
    const unsubscribeReplaced = subscribeGameReplaced(() => {
      worldRulesRunnerRef.current.reset();
      replacedRef.current = true;
      setReplacedTick((tick) => tick + 1);
    });
    scheduler.schedule();
    return () => {
      unsubscribeStore();
      unsubscribeReplaced();
      unsubscribeImported();
      scheduler.dispose();
      cancelTokyoReturn();
    };
  }, []);

  // 整体换局后的首跑等 React 提交完再做：featureCtxRef 已换成新局的闭包（act 不会带旧局对话），
  // 且在 runSilently 里跑，首跑写入不算游玩、不会触发自动存档覆盖旧档。
  useEffect(() => {
    if (!replacedRef.current) return;
    replacedRef.current = false;
    const check = () => worldRulesRunnerRef.current.check();
    const autosave = schedulerRef?.current;
    if (autosave) autosave.runSilently(check);
    else check();
  }, [replacedTick, schedulerRef]);
}
