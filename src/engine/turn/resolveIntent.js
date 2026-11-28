// 回合流水线第一段：意图识别与前置裁决。
// 输入 cmd + env（state/refs/io/opts），输出两种结局之一：
//   { proceed:false, summary? } —— 本地已处理（短路或早退），本轮到此为止
//   { proceed:true,  plan   } —— 放行进入 narrateTurn → finalizeTurn
// 本段只裁决「该不该进 AI 回合、以什么形态进」；移动目的地、采集、路遇都按
// 「AI 提议、系统裁决」在系统层定死，AI 调用留给 narrateTurn。
// whisper（私聊旁白）是标注的例外路径：不进四段，留在 hook 里直接转 talkToNarrator。
// 分层注记：app/store/infra 的依赖一律经 env.io/env.refs 注入，本文件不反向 import。

import { classifyIntent, INTENT, isIntimateInput } from "../../domain/rules/prompt/inputIntent.js";
import { buildCompositeNote, findLookTargetsInText } from "../../domain/rules/input/compositeInput.js";
import { intimacyGate, intimacyRefusal, intimacyPromptNote, intimateTicketNote, resolveIntimateTarget } from "../../domain/rules/npc/intimacy.js";
import { isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { INTIMATE_TICKET_NAME } from "../../domain/rules/npc/goldenEgg.js";
import { add, set, applyWrite } from "../../domain/rules/state/applyWrite.js";
import { findTargetedRumor } from "../../domain/rules/npc/npcEmergence.js";
import { isPureDirectionCmd, parseDir } from "../../utils/mudHelpers.js";
import { QUCUO_MAP } from "../../domain/data/map/qucuoMap.js";
import { serializeSquares } from "../../domain/rules/map/mapSquares.js";
import { isRoomLookCommand, parseLocalCommand } from "../localCommands.js";
import { resolveOuterLock } from "../act/outerMove.js";
import { judgeCollect } from "../act/roundNotes.js";
import {
  innerMove as innerMoveLogic,
  outerArrival as outerArrivalLogic,
} from "../../features/map/logic.js";
import { rollMovementEvents } from "../../features/map/encounter.js";
import { getRoadEventPending, setRoadEventPending, clearRoadEventPending, isPendingFresh } from "../../features/roadevent/pending.js";
import { rollRoadEvent, ROAD_EVENT_SHARE } from "../../domain/rules/livingWorld/roadEvents.js";
import { matchRoadEventChoice, settleRoadEventChoice } from "../../features/roadevent/settle.js";
import { resolveSnowInteraction } from "../../features/quest/snowLeopard.js";
import { roadNameGuard } from "../../domain/rules/map/encounter.js";
import { turnMonitor, withTurnContext } from "../../infra/turnMonitor.js";
import { getGroundItems, removeGroundItems } from "../../domain/rules/map/groundScope.js";

export async function resolveIntent(cmd, env) {
  const { opts, extraReplies, interactMode, apiCfg, gm, _trace } = env;
  const { room, char, inv, convo, questProgress, flags, innerRoomName, mapData, time, nsfwOn, activeTarget, talkTarget } = env.state;
  const { intentRouterRef } = env.refs;
  // WO-06：pendDir/outerDepart/pickupJudgment/collectGranted 改为本段局部值、
  // 随 plan 只读直传 TurnEnvelope；varTree/roomCache 直读 store（getGameState 注入）。
  const vt = () => getGameState()?.varTree ?? {};
  let pendDir = null;
  let outerDepart = null;
  let collectGranted = [];
  const {
    addLog, setInput, setCmdHistory, setHistIdx, setLoading, setWaitSecs, waitTimerRef,
    setInv, setRoom, noteAction, getGameState, gameActions, applyLocal, stopAutoTravel,
    showOuterNoExitNotice, resolveInnerBlockedSummary, prerunSquares,
    traceStep, lookInBackground,
  } = env.io;
  const clearWait = () => {
    setLoading(false);
    if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
    setWaitSecs(0);
  };

  // 移动节流（forceLayer 连发限频）属调度职责，留在 hook 侧、先于 whisper 判定。
  const isTalk = interactMode === "talk" && !opts.forceLayer;

  // 结算轮的既定结果只由 AI 描述；创造模式保留完整能力。
  const isSettle = !!opts.settle && !gm;

  // 意图分类：本地正则判断这句输入的性质，决定这次调用该给多长的篇幅。
  // 对话模式（isTalk）下不分类——对话模式本来就是"跟NPC说话"这个单一意图，
  // 不需要再区分是元问题还是战斗；只有行动模式的自由输入才需要分类。
  const intent = isTalk ? INTENT.TALK_CASUAL : classifyIntent(cmd);

  traceStep(_trace, "意图分类", "pass", `模式=${isTalk ? "对话" : "行动"} · 意图=${intent?.label || intent || "未知"}`);

  // D8：亲密门禁已上移 judgePhase——判意来自 intake 布尔字段（本地合成/缺失时正则兜底），
  // 拦截/拒词/凭卡/已亲密落账全部在判官段执行，此处不再前置拦截（双轨会误判）。

  // WO-25O：挂起路遇的抉择拦截——上一回合照面之后，本句命中可行之事
  // （按钮照抄 label 直发，或手敲同义）就在这里确定性结算，不占 AI 回合；
  // 不命中则时过境迁，挂起作废，输入照常走原流程。全程同步无 await，
  // 不存在跨 await 读旧快照的 stale 窗口。
  const pendingRoad = getRoadEventPending();
  if (pendingRoad?.roll) {
    // epoch 护栏：挂起后若读档/回滚换过账（gameEpoch 递增），那次照面在新账里
    // 从未发生——挂起静默作废，绝不把旧账的奖惩落到新账上。
    const fresh = isPendingFresh(pendingRoad, env.proseEpoch);
    const choiceKey = fresh ? matchRoadEventChoice(pendingRoad.roll, cmd) : null;
    clearRoadEventPending();
    if (choiceKey) {
      turnMonitor.activate(_trace);
      const settled = settleRoadEventChoice({
        roll: pendingRoad.roll,
        optionKey: choiceKey,
        state: { ...getGameState() },
        luck: char.special?.气运 ?? 5,
      });
      setInput("");
      setCmdHistory(p => [cmd, ...p].slice(0, 50));
      setHistIdx(-1);
      applyLocal({
        feature: "roadEvent",
        changes: settled.changes,
        logs: [{ t: "cmd", text: `> ${cmd}` }, ...settled.logs],
      }, "roadEvent");
      traceStep(_trace, "路遇结算", "pass", `${pendingRoad.roll.eventId}·${choiceKey}`);
      return { proceed: false, summary: `路遇结算（${choiceKey}）` };
    }
  }

  const localCommand = !isTalk
    ? parseLocalCommand(cmd, { ...getGameState(), isTalk, convo }, { surface: "web" })
    : null;
  if (localCommand) {
    turnMonitor.activate(_trace);
    setInput("");
    if (localCommand.recordHistory !== false) {
      setCmdHistory(p => [cmd, ...p].slice(0, 50));
      setHistIdx(-1);
    }
    if (localCommand.kind === "lines") {
      applyLocal({
        logs: [{ t: "cmd", text: `> ${cmd}` }, ...localCommand.lines],
      }, localCommand.kind);
    } else {
      applyLocal(localCommand.result, localCommand.localKind);
      if (localCommand.localKind === "cachedLook") {
        traceStep(_trace, "查看", "pass", "格子预成文本，纯前端秒回");
        return { proceed: false, summary: "查看（纯前端）" };
      }
    }
    return { proceed: false };
  }

  // 无缓存的裸环顾：地名/出口/在场人物系统已知，先落事实行，房间描写后台补写，不占回合。
  if (!isTalk && !gm && lookInBackground && isRoomLookCommand(cmd)) {
    turnMonitor.activate(_trace);
    setInput("");
    setCmdHistory(p => [cmd, ...p].slice(0, 50));
    setHistIdx(-1);
    lookInBackground(cmd);
    traceStep(_trace, "查看", "pass", "无缓存：事实行先落，描写后台补写");
    return { proceed: false, summary: "查看（后台补写）" };
  }

  // 元问题（help/怎么玩/你是谁/卡住了等，regex 精确命中的那几种写法）本地直接
  // 兜底回答，不占旁白的一次生成——玩家问"这游戏怎么玩"要的是准确的操作说明，
  // 不是角色扮演式的拒答，之前全丢给LLM去演"旁白不该被问"，新玩家真按 help
  // 反而什么帮助都得不到。这里不排队、不消耗回合、不调API，秒回。
  // 没被 regex 精确命中的模糊写法（比如"找个人""刷新npc"）不受影响，
  // 依然走 UNKNOWN 交给 narrator.js 里那套"该不该打断"的判断去演绎。
  if (!isTalk && intent.code === "META_QUERY") {
    turnMonitor.activate(_trace);
    addLog([{ t: "cmd", text: `> ${cmd}` }]);
    setInput("");
    setCmdHistory(p => [cmd, ...p].slice(0, 50));
    setHistIdx(-1);
    addLog([
      { t: "sys", text: "  ▸ 方向 n/s/e/w 移动 · look 查看 · 单框直接输入即行动或搭话" },
      { t: "sys", text: "  ▸ 输入 @ 唤起选人或飞鸽，`//`、`(( ))` 前缀直发旁白私语，均不消耗回合" },
      { t: "sys", text: "  ▸ 完整玩法说明见右上角 ⚙ 设置 →「玩法说明」" },
    ]);
    return { proceed: false };
  }
  // 行动识别路由接管（多步计划/确认挂起）：命中即本轮结束。
  // 路由函数签名不收 pending；它内部对 intentPendingStore 的读写属跨界引用（见 PR 标注）。
  if (!isTalk && !isSettle && await intentRouterRef?.current?.(cmd, { _trace, opts })) {
    return { proceed: false };
  }

  // 指令显示：默认显示 `> ${cmd}`；但某些内部指令（如战斗结算发给AI写战报的
  if (!opts.silentCmd) {
    addLog([{ t: "cmd", text: `> ${opts.displayCmd || cmd}` }, ...extraReplies]);
  } else if (extraReplies.length) {
    addLog([...extraReplies]);
  }
  setInput("");
  setCmdHistory(p => [cmd, ...p].slice(0, 50));
  setHistIdx(-1);

  // W-FIX1：非纯方向短令不走 parseDir 秒结——长句/复合句置 movingDir=null 完整放行
  // 进 runTurn 交前哨拆句与 judgeRoutes 裁决（否则「往东走进铺子里，要是到了就把
  // 柜子翻开」后半截被 50ms 秒结吞掉，验收第 7/13 式）。按钮/罗盘 fromButton 直通。
  // 协调裁决（过渡性安排，随单调用清退删除）：闸门只在双调用判官链生效——单调用
  // 模式没有前哨/judgeRoutes 裁决链可接，完全维持旧行为（parseDir 裸调截胡照旧，
  // 吞句 bug 随单模式清退一起入土，不为将死之链投新码）。
  const dualCallEnabled = !!(apiCfg?.judgePipelineEnabled && apiCfg?.extractionEnabled);
  const directionGateOn = dualCallEnabled && !isPureDirectionCmd(cmd, { fromButton: !!opts.fromButton });
  let movingDir = isTalk || directionGateOn ? null : parseDir(cmd);
  pendDir = movingDir;

  // ── 内层箱庭移动：优先于外层大地图判定（判定在 act/innerMove.js，副作用在此执行）──
  const forceLayer = opts.forceLayer || null;
  const innerResult = !isTalk && movingDir
    ? innerMoveLogic(getGameState(), {
      _trace,
      traceStep,
      direction: movingDir,
      forceLayer,
      command: cmd,
      includeCommand: false,
    })
    : null;
  if (innerResult?.changes?.innerRoomName) {
    noteAction("innerMove");
    const summary = `内层移动到 ${room.name}·${innerResult.changes.innerRoomName}`;
    setInput("");
    setCmdHistory(p => [cmd, ...p].slice(0, 50));
    setHistIdx(-1);
    applyLocal(innerResult, "内层移动");
    // 内层移动是瞬时纯前端操作，early return 前必须把 loading+计时器清掉，
    // 否则输入框锁死、spinner 空转、秒数狂涨。
    clearWait();
    return { proceed: false, summary };
  }
  if (innerResult) {
    const summary = resolveInnerBlockedSummary(innerResult, movingDir, room.name, innerRoomName, { questProgress, flags, inv, char, varTree: vt() });
    // 上锁的门要说清是缺哪把钥匙（lockedMsg），别跟"这个方向没路"混为一谈——
    // 玩家看见门却被告知"没有去处"会以为是 bug。
    applyLocal(innerResult, "内层移动");
    setInput(""); setCmdHistory(p => [cmd, ...p].slice(0, 50)); setHistIdx(-1);
    clearWait();
    return { proceed: false, summary };
  }

  // 系统裁决层：固定拓扑地图决定移动的合法性和目的地，AI 不能自己决定去了哪里。
  // 判定在 act/outerMove.js：方向在 QUCUO_MAP 有登记出口就锁定目的地；没有就明确
  // 告诉 AI 这个方向走不通，不允许它凭空编一个新地方出来。
  const outerLock = resolveOuterLock({ _trace, isTalk, movingDir, roomName: room.name, questProgress, flags, innerRoomName });
  showOuterNoExitNotice(outerLock, movingDir, room.name, { questProgress, flags });
  const destinationLock = outerLock.destinationLock;
  const lockedDestName = outerLock.lockedDestName;
  if (outerLock.blocked) { movingDir = null; pendDir = null; }
  if (outerLock.outerDepart) outerDepart = outerLock.outerDepart;

  let arrivalResult = !isTalk && lockedDestName
    ? outerArrivalLogic(
      {
        ...getGameState(),
        char,
        convo,
        mapData,
        time,
        questProgress,
        flags,
        varTree: vt(),
      },
      {
        direction: movingDir,
        destName: lockedDestName,
        roomMap: getGameState().roomCache || {},
        squares: serializeSquares(),
        command: cmd,
      },
    )
    : null;
  // WO-25O：格子预埋遭遇与现掷遭遇同权分流——预埋 encounter 命中时按
  // ROAD_EVENT_SHARE 换路遇；换成就不能走纯前端捷径（照面要 AI 叙事），
  // 本拍 fall through 进正常回合，由下面统一注入同一份 roadRoll。
  let cachedForcedRoadRoll = null;
  if (arrivalResult?.cached && arrivalResult.traceInfo?.encounter && !isTalk) {
    const luckForRoad = char.special?.气运 ?? 5;
    if (Math.random() < ROAD_EVENT_SHARE) {
      cachedForcedRoadRoll = rollRoadEvent({ ...getGameState() }, lockedDestName, { rng: Math.random, luck: luckForRoad }) || null;
    }
  }
  if (arrivalResult?.cached && !cachedForcedRoadRoll) {
    const traceInfo = arrivalResult.traceInfo;
    traceStep(_trace, "格子移动", "pass", `${room.name}→${lockedDestName} 格子命中，纯前端${traceInfo.hasSquareDesc ? "" : "（格子未就绪，兜底文本）"}`);
    if (traceInfo.item) {
      traceStep(_trace, "拾取判定", "pass", `格子预埋：${traceInfo.item.name}（品质「${traceInfo.item.quality}」）前端发放`);
    }
    if (traceInfo.encounter) {
      traceStep(_trace, "路遇", "pass", `格子预埋路遇：${traceInfo.encounter.name}（${traceInfo.encounter.label}）`);
    }
    applyLocal(arrivalResult, "格子移动");
    if (traceInfo.encounter) stopAutoTravel(traceInfo.encounter);
    else if (lockedDestName) intentRouterRef?.current?.fireEvent?.("arrive", { dest: lockedDestName, travelDone: !env.refs.autoTravelRef.current });
    prerunSquares(); // 自愈：补齐未跑成的格子（全跑过则空转即返）
    return { proceed: false, summary: `到达 ${lockedDestName}（格子·纯前端）` };
  }
  if (arrivalResult && cachedForcedRoadRoll) {
    // 路遇顶替格子预埋遭遇：预埋 NPC 不进房、预埋台词不上屏（格子仍 consume，
    // 那位过路人叙事上化作了路遇的来人），其余移动/拾取/新面孔照常落账。
    const baked = arrivalResult.traceInfo?.encounter;
    if (baked && arrivalResult.changes?.room?.npcs) {
      arrivalResult = {
        ...arrivalResult,
        changes: {
          ...arrivalResult.changes,
          room: {
            ...arrivalResult.changes.room,
            npcs: arrivalResult.changes.room.npcs.filter((npc) => npc?.id !== baked.id && npc?.name !== baked.name),
          },
        },
        logs: (arrivalResult.logs || []).filter((l) => !(l?.t === "desc" && baked.line && String(l.text || "").includes(baked.line))),
      };
    }
    applyLocal(arrivalResult, "格子移动");
  } else if (arrivalResult) applyLocal(arrivalResult, "格子移动");

  const targetedRumor = findTargetedRumor(vt(), cmd);

  const rolled = rollMovementEvents({
    isTalk,
    movingDir,
    lockedDestName,
    targetedRumor,
    luck: char.special?.气运 ?? 5,
    isTaken: roadNameGuard({ varTree: vt(), time, extraNames: (room?.npcs || []).map((npc) => npc.name) }),
    state: { ...getGameState() },
  });
  let { pickupJudgment, encounterToDescribe, roadRoll } = rolled;
  if (cachedForcedRoadRoll) {
    // 格子预埋遭遇已在分流中换成路遇：现掷结果作废，统一走同一份 roadRoll
    roadRoll = cachedForcedRoadRoll;
    encounterToDescribe = null;
  }
  if (encounterToDescribe) stopAutoTravel(encounterToDescribe);
  if (roadRoll) {
    stopAutoTravel({ label: "路遇" });
    setRoadEventPending({ roll: roadRoll, epoch: env.proseEpoch ?? null });
  }
  else if (lockedDestName) intentRouterRef?.current?.fireEvent?.("arrive", { dest: lockedDestName, travelDone: !env.refs.autoTravelRef.current });

  // ── 采集裁决（系统层）──（判定在 act/roundNotes.js，副作用在此执行）
  // 玩家表达采集意图、且所采之物此刻真在地上时，由系统直接把物搬入背包、
  // 从地上抹去——「采没采到」不交给 AI 决定。推进则由背包变化触发的
  // alreadySatisfiedCollectRule 接管（采齐才推进）。
  let collectNote = "";
  const collectHit = judgeCollect({ isTalk, cmd, room, innerRoomName, questProgress, inv });
  if (collectHit) {
    withTurnContext(_trace, () => {
      setInv(v => [...v, collectHit.gained]);
      setRoom(r => ({ ...r, items: removeGroundItems(r.items, [collectHit.item], r.name, innerRoomName) }));
    });
    collectGranted = [collectHit.item];
    addLog([{ t: "item", text: `  ✓ 你采得「${collectHit.item}」，收入背包。` }]);
    collectNote = collectHit.note;
  }

  // LOOK 轮只写"看见什么"：有人正在动手或场上有进行中的事时，模型爱把
  // 查看当成新的一回合续写打斗/事件。这里钉死：本轮只描述被看对象的现状，
  // 谁都不再出手、不推进任何进行中的事。
  if (!isTalk && intent.code === "LOOK") {
    collectNote += `\n[系统裁决：本轮仅是查看/端详，只描述被看对象此刻的所见现状（场景则写眼前所见，目标则写其容貌装束、气色伤势、当下举止）。任何人都不出手、不推进或续写进行中的打斗与事件，除认出在场人物外无其他状态变化。]`;
  }

  // WO-16C-snow：自由文本「给雪豹挠痒/喂雪豹吃肉」确定性替代层——
  // 双调用判官链里旧提取断档，改由系统在叙事前经统一边界落定（否定/假设/
  // 询问不误触发、无肉不触发、flag 已有不重复），prompt 只接"已结算"说明。
  if (!isTalk && !isSettle) {
    const snowHit = resolveSnowInteraction({
      questProgress, flags, inv, room, innerRoomName, char,
    }, cmd);
    if (snowHit) {
      applyLocal({ changes: snowHit.changes, logs: snowHit.logs }, "snowInteraction");
      collectNote += snowHit.note;
    }
  }

  // 复合句（括号/多断句）：段标注透传给模型 + 硬行动配额一句一个；
  // 点到名的「看X」段在行动回合里照常插系统端详卡（由 useTurn 消费 lookNpcs）。
  if (!isTalk) collectNote += buildCompositeNote(cmd);
  const lookNpcs = isTalk ? [] : findLookTargetsInText(cmd, room?.npcs).slice(0, 3);

  const activeGroundItemForTurn = env.state.activeGroundItem
    && collectHit?.item !== env.state.activeGroundItem
    && getGroundItems({ room, innerRoomName }).some(item => (typeof item === "string" ? item : item?.name) === env.state.activeGroundItem)
    ? env.state.activeGroundItem
    : null;

  return {
    proceed: true,
    plan: {
      intent, isTalk, isSettle, movingDir, lockedDestName, destinationLock,
      collectNote: collectNote + (opts.intentPlanNote || ""),
      encounterToDescribe, roadRoll, activeGroundItemForTurn, lookNpcs,
      // WO-06：只读 plan 字段直传 TurnEnvelope（原跨层 ref 透传）
      pendDir, outerDepart, pickupJudgment, collectGranted,
    },
  };
}
