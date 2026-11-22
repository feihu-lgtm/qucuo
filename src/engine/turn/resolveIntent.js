// 回合流水线第一段：意图识别与前置裁决。
// 输入 cmd + env（state/refs/io/opts），输出两种结局之一：
//   { proceed:false, summary? } —— 本地已处理（短路或早退），本轮到此为止
//   { proceed:true,  plan   } —— 放行进入 settleTurn → narrateTurn → finalizeTurn
// 本段只裁决「该不该进 AI 回合、以什么形态进」；移动目的地、采集、路遇都按
// 「AI 提议、系统裁决」在系统层定死，AI 调用留给 narrateTurn。
// whisper（私聊旁白）是标注的例外路径：不进四段，留在 hook 里直接转 talkToNarrator。
// 分层注记：app/store/infra 的依赖一律经 env.io/env.refs 注入，本文件不反向 import。

import { classifyIntent, INTENT } from "../../domain/rules/prompt/inputIntent.js";
import { findTargetedRumor } from "../../domain/rules/npc/npcEmergence.js";
import { parseDir } from "../../utils/mudHelpers.js";
import { QUCUO_MAP, buildDirectionJudgeRequest, parseDirectionJudgeResponse } from "../../domain/data/map/qucuoMap.js";
import { buildExtractionCfg } from "../../domain/rules/prompt/extractionEngine.js";
import { serializeSquares } from "../../domain/rules/map/mapSquares.js";
import { parseLocalCommand } from "../localCommands.js";
import { resolveOuterLock } from "../act/outerMove.js";
import { judgeCollect } from "../act/roundNotes.js";
import {
  innerMove as innerMoveLogic,
  outerArrival as outerArrivalLogic,
} from "../../features/map/logic.js";
import { rollMovementEvents } from "../../features/map/encounter.js";
import { turnMonitor, withTurnContext } from "../ports/turnMonitor.js";

export async function resolveIntent(cmd, env) {
  const { opts, extraReplies, interactMode, apiCfg, gm, _trace } = env;
  const { room, char, inv, convo, questProgress, flags, innerRoomName, mapData, time } = env.state;
  const {
    pendDirRef, outerDepartRef, varTreeRef, roomMapRef,
    pickupJudgmentRef, collectGrantedRef, intentRouterRef,
  } = env.refs;
  const {
    addLog, setInput, setCmdHistory, setHistIdx, setLoading, setWaitSecs, waitTimerRef,
    setInv, setRoom, noteAction, getGameState, applyLocal, stopAutoTravel,
    showOuterNoExitNotice, resolveInnerBlockedSummary, prerunSquares,
    traceStep, callModel,
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
      { t: "sys", text: "  ▸ 方向 n/s/e/w 移动 · look 查看 · 输入框上方可切换「◈行动 / ◎对话 / ◆私聊旁白」三种模式" },
      { t: "sys", text: "  ▸ 对话模式：只跟房间里的人说话，不移动、不消耗回合；私聊旁白：直接找旁白聊天，同样不消耗回合" },
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

  // 方向判定：先走正则（parseDir），命中不了再用小模型兜底（本轮新增）——
  // 正则永远列不全所有口语化的移动表达（"我想去后山逛逛""沿河边往喇嘛庙那边走"
  // 这类），与其不断加正则分支，不如正则失手时，拿当前房间实际的出口列表问一次
  // 小模型"这句话对应哪个方向，还是压根不是移动"。这次调用的输出空间严格封闭在
  // 方向代码集合内（parseDirectionJudgeResponse 会校验），不涉及"去了哪个具体
  // 据点"——目的地依然是下面 resolveExit 查表决定，AI 只是被问了个"更聪明的正则"
  // 式的封闭问题，不违背"AI提议系统裁决"的原则。只有 !isTalk 且当前房间在固定
  // 地图里才会问（对话模式、房间不在地图里的情况不需要判断移动）。
  // 失败/超时静默降级为 null，不能因为这次小调用挂了就导致移动完全瘫痪。
  let movingDir = isTalk ? null : parseDir(cmd);
  // 【已闲置】AI 方向兜底：移动已改为点按钮/点地图节点/自动寻路（纯查表，不走大模型），
  // 这条"打字口语移动+正则失手时问小模型判方向"的兜底不再需要，故用 `false &&` 关掉。
  // 整段逻辑保留未删，日后若想恢复"打字也能口语移动"，去掉下面的 `false &&` 即可。
  if (false && !isTalk && !movingDir && QUCUO_MAP[room.name]) {
    try {
      const node = QUCUO_MAP[room.name];
      const judgeReq = buildDirectionJudgeRequest(cmd, room.name, node.exits);
      const judgeCfg = buildExtractionCfg("DIRECTION_JUDGE", apiCfg);
      const judgeResult = await callModel(judgeCfg, judgeReq.system, judgeReq.messages, { maxTokens: apiCfg.callTokenLimits?.direction ?? judgeReq.maxTokens, callLabel: "方向判定(已闲置)" });
      const aiDir = parseDirectionJudgeResponse(judgeResult.text);
      // 双重校验：AI 说的方向必须真的是当前房间已登记的出口之一，否则视为无效。
      // 这一步保证即便小模型偶尔"创造"了一个不存在的方向代码，也不会被采信。
      if (aiDir && node.exits[aiDir]) movingDir = aiDir;
    } catch (_) { /* 判定失败就当没判断出方向，走原有的"非移动"分支，不阻断游戏 */ }
  }
  pendDirRef.current = movingDir;

  // ── 内层箱庭移动：优先于外层大地图判定（判定在 act/innerMove.js，副作用在此执行）──
  const forceLayer = opts.forceLayer || null;
  const innerResult = !isTalk && movingDir
    ? innerMoveLogic(getGameState(), {
      _trace,
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
    const summary = resolveInnerBlockedSummary(innerResult, movingDir, room.name, innerRoomName, { questProgress, flags, inv, char });
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
  if (outerLock.blocked) { movingDir = null; pendDirRef.current = null; }
  if (outerLock.outerDepart) outerDepartRef.current = outerLock.outerDepart;

  const arrivalResult = !isTalk && lockedDestName
    ? outerArrivalLogic(
      {
        ...getGameState(),
        char,
        convo,
        mapData,
        time,
        questProgress,
        flags,
        varTree: varTreeRef.current,
      },
      {
        direction: movingDir,
        destName: lockedDestName,
        roomMap: roomMapRef.current,
        squares: serializeSquares(),
        command: cmd,
      },
    )
    : null;
  if (arrivalResult?.cached) {
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
    outerDepartRef.current = null; pendDirRef.current = null; pickupJudgmentRef.current = null;
    prerunSquares(); // 自愈：补齐未跑成的格子（全跑过则空转即返）
    return { proceed: false, summary: `到达 ${lockedDestName}（格子·纯前端）` };
  }
  if (arrivalResult) applyLocal(arrivalResult, "格子移动");

  const targetedRumor = findTargetedRumor(varTreeRef.current, cmd);

  const { pickupJudgment, encounterToDescribe } = rollMovementEvents({
    isTalk,
    movingDir,
    lockedDestName,
    targetedRumor,
    luck: char.special?.气运 ?? 5,
  });
  pickupJudgmentRef.current = pickupJudgment;
  if (encounterToDescribe) stopAutoTravel(encounterToDescribe);
  else if (lockedDestName) intentRouterRef?.current?.fireEvent?.("arrive", { dest: lockedDestName, travelDone: !env.refs.autoTravelRef.current });

  // ── 采集裁决（系统层）──（判定在 act/roundNotes.js，副作用在此执行）
  // 玩家表达采集意图、且所采之物此刻真在地上时，由系统直接把物搬入背包、
  // 从地上抹去——「采没采到」不交给 AI 决定。推进则由背包变化触发的
  // alreadySatisfiedCollectRule 接管（采齐才推进）。
  let collectNote = "";
  collectGrantedRef.current = [];
  const collectHit = judgeCollect({ isTalk, cmd, room, questProgress, inv });
  if (collectHit) {
    withTurnContext(_trace, () => {
      setInv(v => [...v, collectHit.gained]);
      setRoom(r => ({ ...r, items: (r.items || []).filter(i => (typeof i === "string" ? i : i.name) !== collectHit.item) }));
    });
    collectGrantedRef.current = [collectHit.item];
    addLog([{ t: "item", text: `  ✓ 你采得「${collectHit.item}」，收入背包。` }]);
    collectNote = collectHit.note;
  }

  // LOOK 轮只写"看见什么"：有人正在动手或场上有进行中的事时，模型爱把
  // 查看当成新的一回合续写打斗/事件。这里钉死：本轮只描述被看对象的现状，
  // 谁都不再出手、不推进任何进行中的事。
  if (!isTalk && intent.code === "LOOK") {
    collectNote += `\n[系统裁决：本轮仅是查看/端详，只描述被看对象此刻的所见现状（场景则写眼前所见，目标则写其容貌装束、气色伤势、当下举止）。任何人都不出手、不推进或续写进行中的打斗与事件，除认出在场人物外无其他状态变化。]`;
  }

  const activeGroundItemForTurn = env.state.activeGroundItem
    && collectHit?.item !== env.state.activeGroundItem
    && (room.items || []).some(item => (typeof item === "string" ? item : item?.name) === env.state.activeGroundItem)
    ? env.state.activeGroundItem
    : null;

  return {
    proceed: true,
    plan: {
      intent, isTalk, isSettle, movingDir, lockedDestName, destinationLock,
      collectNote: collectNote + (opts.intentPlanNote || ""),
      encounterToDescribe, activeGroundItemForTurn,
    },
  };
}
