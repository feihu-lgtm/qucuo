import { snowLeopardRule } from "../../features/quest/snowLeopard.js";
import { featureCtx } from "../runtime/gameRuntime.js";
import { factionAmbushRule, factionRoomAmbushRule } from "../../domain/rules/map/ambush.js";
import { useEffect, useRef, useState } from "react";
import { createCoalescedCheck, createWorldRules } from "../../engine/worldRules.js";
import { timeAdvanceRule } from "../../domain/rules/time/rules.js";
import { residentNpcRule } from "../../domain/rules/npc/rules.js";
import { npcRoamRule } from "../../domain/rules/npc/roam.js";
import { ocWanderRule } from "../../domain/rules/npc/ocWander.js";
import { stationedFavorDecayRule, followFavorDriftRule } from "../../domain/rules/npc/intimacy.js";
import { npcLetterRule } from "../../features/pigeon/inbound.js";
import { pactWatchRule } from "../../features/pigeon/pactWatch.js";
import { nemesisDailyRule } from "../../domain/rules/nemesis/nemesisDaily.js";
import { huntedNoticeRule } from "../../domain/rules/nemesis/huntedOrders.js";
import { fakeDeadReturnRule } from "../../domain/rules/nemesis/fakeDeadReturn.js";
import {
  alreadySatisfiedCollectRule,
  collectGroundItemsRule,
  estateAnnouncementRule,
  estateProgressRule,
  estateStartRule,
  escortArrivalRule,
  questFlagRule,
} from "../../domain/rules/quests/rules.js";
import { innerGroundItemsRule } from "../../domain/rules/map/rules.js";
import { derivedMovesetRule } from "../../domain/rules/skills/rules.js";
import {
  finishTokyoReturn,
  portalOpenedRule,
  scheduleTokyoReturnRule,
  villaArrivalRule,
  xuannuTriggerRule,
} from "../../domain/rules/narrator/rules.js";
import { applyResult } from "../../features/run.js";
import * as importedRegistry from "../../domain/rules/cards/importedRegistry.js";
import { gameActions, gameStore, subscribeGameReplaced } from "../../store/gameStore.js";
import { roamReactionBackfill } from "./roamReactionBackfill.js";
import { newBackfillKey } from "../../engine/ports/backfill.js";

export function useWorldRulesRunner({
  seaReturnRef, setForcedDuelNpc, schedulerRef, dispatchCommand = (_id, fn) => fn(),
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
          applyResult(featureCtx(), result);
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
        npcRoamRule,
        ocWanderRule,
        stationedFavorDecayRule,
        followFavorDriftRule,
        npcLetterRule,
        pactWatchRule,
        nemesisDailyRule,
        huntedNoticeRule,
        fakeDeadReturnRule,
        collectGroundItemsRule,
        innerGroundItemsRule,
        derivedMovesetRule,
        alreadySatisfiedCollectRule,
        escortArrivalRule,
        questFlagRule,
        snowLeopardRule,
        factionAmbushRule,
        factionRoomAmbushRule,
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
          get roomMap() { return gameStore.getState().roomCache || {}; },
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
            // WO-06：房间缓存写走 applyResult 统一写入口（changes.roomCache → setRoomCache）
            if (result.roomMap) result.changes = { ...result.changes, roomCache: result.roomMap };
            // W-ROAM 增量：本拍有玩家视野内进出动向时，末条占位行打 backfill 标记
            // （离线/无 Key 即保底），随后异步 roam.reaction 白描原位补到其下。
            let roamKey = null;
            let roamTrigger = null;
            if (result.roamMovements?.length && result.logs?.length) {
              roamKey = newBackfillKey("roamReact");
              const cur = gameStore.getState();
              roamTrigger = { roomName: cur.room?.name || "", innerRoomName: cur.innerRoomName ?? null };
              const logs = [...result.logs];
              logs[logs.length - 1] = { ...logs[logs.length - 1], fillKey: roamKey, fillSlot: 0 };
              result = { ...result, logs };
            }
            applyResult(featureCtx(), result);
            if (roamKey) {
              roamReactionBackfill(result.roamMovements, {
                key: roamKey,
                triggerRoomName: roamTrigger.roomName,
                triggerInnerRoomName: roamTrigger.innerRoomName,
              });
            }
            if (result.forcedDuelNpc) {
              // 伏击开战先掐断自动寻路，不然打完还会接着往下跑剩下的路段。
              schedulerRef?.current?.clearRouteQueue?.();
              setForcedDuelNpc(result.forcedDuelNpc);
            }
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
