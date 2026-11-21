import { useCallback, useMemo, useRef } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { parseLocalCommand } from "../../engine/localCommands.js";
import {
  innerMove as innerMoveLogic,
  outerArrival as outerArrivalLogic,
  shouldThrottleMovement,
} from "../../features/map/logic.js";
import { resolveOuterLock } from "../../engine/act/outerMove.js";
import { rollMovementEvents } from "../../features/map/encounter.js";
import { judgeCollect } from "../../engine/act/roundNotes.js";
import { CATEGORY_LABEL } from "../../domain/economy/equipment.js";
import { findTargetedRumor } from "../../domain/npc/npcEmergence.js";
import { classifyIntent, INTENT } from "../../domain/prompt/inputIntent.js";
import { consumeDuelRequest } from "./useDuel.js";
import { buildDirectionJudgeRequest, getMapNode, parseDirectionJudgeResponse, QUCUO_MAP } from "../../domain/map/qucuoMap.js";
import { buildExtractionCfg } from "../../domain/prompt/extractionEngine.js";
import { callModel, classifyError } from "../../infra/apiConfig.js";
import { step as traceStep } from "../../infra/actionTrace.js";
import { getTurnContext, PHASE, turnMonitor, withTurnContext } from "../../core/turnMonitor.js";
import { createPromptContext } from "../../engine/prompt/index.js";
import * as importedRegistry from "../../domain/cards/importedRegistry.js";
import { COMPANION_LORE } from "../../domain/companion/companion.js";
import { getCompanionDescForm } from "../../domain/companion/companionForms.js";
import { SEA_OF_MIND } from "../../domain/narrator/seaOfMind.js";
import { parseDir } from "../../utils/mudHelpers.js";
import { playTurn } from "../../engine/playTurn.js";
import { burnSquare, consumeArrival, serializeSquares } from "../../domain/map/mapSquares.js";
import { createTurnStaleCheck } from "./useUndo.js";
import { resolveInnerBlockedSummary, showOuterNoExitNotice } from "./blockedMovementNotice.js";
import { classifyActCommand } from "../../core/commands.js";

export function useTurn({
  loading, convo, room, char, inv, skills, dao, exp, pot, flags, mapData, time, gm, preset,
  addLog, talkToNarrator, confessToNarrator, narrator, apiCfg, interactMode, activeTarget, activeGroundItem, setActiveTarget, setDuelPending,
  nsfwOn, varTree, pendingTalks, changePendingTalks, lastMoveRef, captureUndo,
  turnGenerationRef, talkBusyRef, setCmdHistory, setHistIdx, setFlags, setInput, setLoading,
  waitTimerRef, setWaitSecs, pendDirRef, featureCtxRef,
  noteAction, roomMapRef, questProgress, innerRoomName, setRoom, setInv, collectGrantedRef,
  autoTravelRef, clearRouteQueue, setCommandPhase, dispatchCommand,
  outerDepartRef, varTreeRef, pickupJudgmentRef, pickupExtractionFailedRef,
  prerunSquares, dayMaterialRef, roundsSinceLastSaveRef, playedThisSessionRef, gambleTalkCtx,
  timeRef, talkTarget, companionState, pendingQuestBranch, effectiveSpecialNow, setVarTree,
  setGambleNegotiation, setChar, setDao, setExp, setPot, setSkills, setMapData, setTime,
  setPendingQuestBranch, setConvo, jotNote, setLog, intentRouterRef,
}) {
  const actRef = useRef(null);
  const act = useCallback(async (rawCmd, extraReplies = [], opts = {}) => {
    if (!rawCmd.trim()) return;
    if (!opts.schedulerManaged) {
      const commandText = rawCmd.trim();
      const isTalkCommand = interactMode === "talk" && !opts.forceLayer;
      const localCommand = isTalkCommand ? null : parseLocalCommand(commandText, { ...gameStore.getState(), isTalk: isTalkCommand, convo }, { surface: "web" });
      const commandId = classifyActCommand({ rawCmd: commandText, opts, interactMode, localCommand, isMove: !!parseDir(commandText) });
      setInput("");
      return dispatchCommand(commandId, () => actRef.current(rawCmd, extraReplies, { ...opts, schedulerManaged: true }), { displayText: opts.displayCmd || commandText });
    }
    const cmd = rawCmd.trim(), isStale = createTurnStaleCheck(turnGenerationRef);
    const parent = getTurnContext() || opts.turn;
    const _trace = parent?.phase === PHASE.MACHINE && (!parent.background || parent.commandId === "actWhisper")
      ? parent
      : turnMonitor.start(opts.displayCmd || cmd, { raw: rawCmd, source: opts.forceLayer ? "button" : "command", parentId: parent?.id, passive: loading, commandId: "actRouter" });
    if (parent === _trace) _trace.awaitingSettlement = true;
    const applyLocal = (result, feature) => applyResult(featureCtxRef.current, result, { turn: _trace, feature });
    let summary, result;
    try {
    const stopAutoTravel = () => {
      if (!autoTravelRef.current) return void intentRouterRef?.current?.fireEvent?.("encounter", {}); // 手动走动路遇同样应验遇敌步
      const dropped = clearRouteQueue();
      autoTravelRef.current = false;
      const message = `  ⚠ 路上撞见生人，自动赶路就此打住（余下 ${dropped} 程未走）。要接着走，另点目的地即可。`;
      addLog([{ t: "sys", text: message, standalone: true }]);
      intentRouterRef?.current?.fireEvent?.("encounter", {}); intentRouterRef?.current?.expireTriggers?.(_trace); // 路遇应验遇敌步；行程中断，其余触发器过期
    };

    if (opts.forceLayer) {
      const now = Date.now();
      if (shouldThrottleMovement({
        forceLayer: opts.forceLayer,
        autoTravel: opts.autoTravel,
        elapsed: now - lastMoveRef.current,
      })) return;
      if (!opts.autoTravel) lastMoveRef.current = now;
    }

    if (interactMode === "whisper") {
      // 私聊串行：一条还在跑时不允许真的发出第二条——否则两条并发会读到同一份
      // 发送前的 convo（历史一样），且流式占位用的 logIdx.current 是共享 ref，两条
      // 回调互相踩踏，表现为"日志一下出两条/重复"。用 talkBusyRef（同步 ref，不等
      // re-render）挡住极快连点；输入框允许预打字，只拦实际发送。
      if (talkBusyRef.current || pendingTalks > 0) {
        addLog([{ t: "sys", text: "  旁白还在回话，稍候再说下一句。" }]);
        return;
      }
      talkBusyRef.current = true;
      setCmdHistory(p => [cmd, ...p].slice(0, 50));
      setHistIdx(-1);
      // 教程任务「四宅家产」触发点之三：跟旁白聊到溪边小屋（幂等）
      if (/溪边小屋/.test(cmd)) setFlags(f => f.includes("tutorial_estate_started") ? f : [...f, "tutorial_estate_started"]);
      await talkToNarrator(cmd, { isStale, turn: _trace });
      return;
    }
    if (!opts.keepUndo) captureUndo(_trace);

    const isTalk = interactMode === "talk" && !opts.forceLayer;

    // 结算轮的既定结果只由 AI 描述；创造模式保留完整能力。
    const isSettle = !!opts.settle && !gm;

    // 意图分类：本地正则判断这句输入的性质，决定这次调用该给多长的篇幅。
    // 对话模式（isTalk）下不分类——对话模式本来就是"跟NPC说话"这个单一意图，
    // 不需要再区分是元问题还是战斗；只有行动模式的自由输入才需要分类。
    const intent = isTalk ? INTENT.TALK_CASUAL : classifyIntent(cmd);

    traceStep(_trace, "意图分类", "pass", `模式=${isTalk ? "对话" : "行动"} · 意图=${intent?.label || intent || "未知"}`);

    const localCommand = !isTalk
      ? parseLocalCommand(cmd, { ...gameStore.getState(), isTalk, convo }, { surface: "web" })
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
          summary = "查看（纯前端）";
        }
      }
      return;
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
      return;
    }
    if (!isTalk && !isSettle && await intentRouterRef?.current?.(cmd, { _trace, opts })) return;

    // 指令显示：默认显示 `> ${cmd}`；但某些内部指令（如战斗结算发给AI写战报的
    if (!opts.silentCmd) {
      addLog([{ t: "cmd", text: `> ${opts.displayCmd || cmd}` }, ...extraReplies]);
    } else if (extraReplies.length) {
      addLog([...extraReplies]);
    }
    setInput("");
    setCmdHistory(p => [cmd, ...p].slice(0, 50));
    setHistIdx(-1);

    // loading 态 + 计时器启动已挪到下方"信息域·知识系统"之前——内层移动（上方 early return）
    // 是瞬时纯前端操作，不该进入 loading 态；此前设在这里会导致内层移动也转 spinner，
    // 且 setLoading(true)/false 同 tick 抵消仍可能闪"引擎运转中"。现在只有真正要调 AI
    // 的路径（外层移动/对话/行动）才启动 loading，且在第一个 await 之前，不破并发锁。
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
      ? innerMoveLogic(gameStore.getState(), {
        _trace,
        direction: movingDir,
        forceLayer,
        command: cmd,
        includeCommand: false,
      })
      : null;
    if (innerResult?.changes?.innerRoomName) {
      noteAction("innerMove");
      summary = `内层移动到 ${room.name}·${innerResult.changes.innerRoomName}`;
      setInput("");
      setCmdHistory(p => [cmd, ...p].slice(0, 50));
      setHistIdx(-1);
      applyLocal(innerResult, "内层移动");
      // 内层移动是瞬时纯前端操作，early return 前必须把 loading+计时器清掉，
      // 否则输入框锁死、spinner 空转、秒数狂涨。
      setLoading(false);
      if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
      setWaitSecs(0);
      return;
    }
    if (innerResult) {
      summary = resolveInnerBlockedSummary(innerResult, movingDir, room.name, innerRoomName, { questProgress, flags, inv, char });
      // 上锁的门要说清是缺哪把钥匙（lockedMsg），别跟"这个方向没路"混为一谈——
      // 玩家看见门却被告知"没有去处"会以为是 bug。
      applyLocal(innerResult, "内层移动");
      setInput(""); setCmdHistory(p => [cmd, ...p].slice(0, 50)); setHistIdx(-1);
      setLoading(false);
      if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
      setWaitSecs(0);
      return;
    }

    // 系统裁决层：固定拓扑地图决定移动的合法性和目的地，AI 不能自己决定去了哪里。
    // 判定在 act/outerMove.js：方向在 QUCUO_MAP 有登记出口就锁定目的地；没有就明确
    // 告诉 AI 这个方向走不通，不允许它凭空编一个新地方出来。
    const outerLock = resolveOuterLock({ _trace, isTalk, movingDir, roomName: room.name, questProgress, flags, innerRoomName }); showOuterNoExitNotice(outerLock, movingDir, room.name, { questProgress, flags });
    const destinationLock = outerLock.destinationLock;
    const lockedDestName = outerLock.lockedDestName;
    if (outerLock.blocked) { movingDir = null; pendDirRef.current = null; }
    if (outerLock.outerDepart) outerDepartRef.current = outerLock.outerDepart;

    const arrivalResult = !isTalk && lockedDestName
      ? outerArrivalLogic(
        {
          ...gameStore.getState(),
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
      if (traceInfo.encounter) stopAutoTravel(); else if (lockedDestName) intentRouterRef?.current?.fireEvent?.("arrive", { dest: lockedDestName, travelDone: !autoTravelRef.current });
      outerDepartRef.current = null; pendDirRef.current = null; pickupJudgmentRef.current = null;
      summary = `到达 ${lockedDestName}（格子·纯前端）`;
      prerunSquares(); // 自愈：补齐未跑成的格子（全跑过则空转即返）
      return;
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
    if (encounterToDescribe) stopAutoTravel(); else if (lockedDestName) intentRouterRef?.current?.fireEvent?.("arrive", { dest: lockedDestName, travelDone: !autoTravelRef.current });

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

    // loading 态 + 计时器：在第一个 await（下方 recall/knowledge）之前启动——
    // 内层移动已在上方 early return（不进 loading），这里之后才真正要调 AI。
    if (isTalk) changePendingTalks(1); else setLoading(true);
    setWaitSecs(0); if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    waitTimerRef.current = setInterval(() => setWaitSecs(s => s + 1), 1000);

    // 本回合开始时的 varTree，逻辑读取走 ref 以包含已发生的同步写入。
    const preActVarTree = varTreeRef.current;
    const activeGroundItemForTurn = activeGroundItem
      && collectHit?.item !== activeGroundItem
      && (room.items || []).some(item => (typeof item === "string" ? item : item?.name) === activeGroundItem)
      ? activeGroundItem
      : null;
    const callDeps = (memory = {}, prepared = {}) => ({
        varTree: memory.varTree ?? varTreeRef.current, gm, isSettle, isTalk, intent, apiCfg, narrator,
        scenario: preset.scenario, budgetInstruction: prepared.budgetInstruction,
        npcLoreBlockWithQuest: prepared.npcLoreBlockWithQuest || "",
        visibleNpcsCount: prepared.visibleNpcsCount || 0, charName: char.name, charBodyProfile: char.bodyProfile,
        pickupJudgment: pickupJudgmentRef.current, cmd: prepared.cmd || cmd, convo, nsfwOn,
        ctx: prepared.ctx, recallBlock: memory.recallBlock || "", reunionBlock: prepared.reunionBlock || "",
        infoDomainBlock: memory.infoDomainBlock || "", hist: prepared.hist, mainConvo: prepared.mainConvo,
        lockedDestName,
        gambleTalkCtx: gambleTalkCtx.current, recallInfo: memory.recallInfo,
        inSeaOfMind: room.name === SEA_OF_MIND.district,
        settleNpc: opts.settleNpc, settleKind: opts.settleKind, duelReport: opts.duelReport, giftInfo: opts.giftInfo, learnInfo: opts.learnInfo, settleBeast: !!opts.settleBeast,
        _trace, addLog, setLog, isStale, intentPlan: opts.intentPlan,
      });
    const turnCtx = {
      apiCfg,
      callDeps,
      convo,
      isTalk,
      isSettle,
      isStale,
      _trace,
      prompt: createPromptContext({
        room, char, inv, skills, dao, flags, questProgress, pendingQuestBranch,
        varTree: preActVarTree, time, preset, companionState, nsfwOn, activeTarget, activeGroundItem: activeGroundItemForTurn, isTalk,
        gm, movingDir, lockedDestName, outerDepart: outerDepartRef.current, innerRoomName, apiCfg,
        destinationLock, pickupJudgment: pickupJudgmentRef.current, categoryLabel: CATEGORY_LABEL,
        encounter: encounterToDescribe, collectNote: collectNote + (opts.intentPlanNote || ""), intent,
        timeForToday: timeRef.current,
      }, {
        importedNpcLore: importedRegistry.getImportedNpcLore(),
        companionForms: Object.fromEntries(Object.keys(COMPANION_LORE).map(key => [key, getCompanionDescForm(key)])),
      }),
      memory: {
        varTreeLatest: preActVarTree,
        roomNpcNames: room.npcs.map(n => n.name),
        time,
        apiCfg,
        flags,
        recall: { apiCfg, cmd, room, flags, activeTarget, activeGroundItem: activeGroundItemForTurn, isTalk, talkTarget },
      },
      state: { room, char, inv, dao },
      getMapNode,
      beforeRun: () => { pickupExtractionFailedRef.current = false; },
      setCommandPhase,
      refs: {
        varTreeRef, roomMapRef, gambleTalkCtx, outerDepartRef, pendDirRef,
        pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef, dayMaterialRef,
        roundsSinceLastSaveRef, playedThisSessionRef,
      },
      commitDeps: (turnResult) => {
        pickupExtractionFailedRef.current = turnResult.pickupExtractionFailed;
        return {
          p: turnResult.p, mvuCommands: turnResult.mvuCommands, dealResult: turnResult.dealResult,
          rawFull: turnResult.rawFull, narrativeText: turnResult.narrativeText,
          knowledgeTree: turnResult.knowledgeTree, knowledgeTreeBase: turnResult.knowledgeTreeBase,
          isTalk, gm, lockedDestName, room, innerRoomName, time, mapData,
          pendingQuestBranch, apiCfg, activeTarget, talkTarget, effectiveSpecialNow, newConvo: turnResult.newConvo,
          questProgress, char, preserveHp: opts.preserveHp,
          _trace, addLog,
          setVarTree, setRoom, setGambleNegotiation, setInv, setChar, setDao, setExp, setPot,
          setSkills, setFlags, setMapData, setTime, setPendingQuestBranch, setConvo,
          varTreeRef, roomMapRef, gambleTalkCtx, outerDepartRef, pendDirRef,
          pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef, dayMaterialRef,
          roundsSinceLastSaveRef, playedThisSessionRef,
        };
      },
    };
    result = await playTurn(turnCtx, cmd, opts);
    if (result.stale) return;
    if (!result.ok) {
      const e = result.error;
      const ec = classifyError(e);
      traceStep(_trace, "状态写回", "fail", `异常回滚：${ec.title}`);
      addLog([
        { t: "err", text: `  ${ec.icon} ${ec.title}` },
        { t: "err", text: `     ${ec.detail}` },
        { t: "sys", text: `     ▸ ${ec.hint}` },
        { t: "sys", text: `     （本轮状态已整体回滚，未留下半提交脏数据；可直接重试）` },
      ]);
    }
    consumeDuelRequest(result, { opts, isStale, isTalk, interactMode, setActiveTarget, setDuelPending, featureCtxRef, trace: _trace });
    noteAction(isSettle ? "settle" : isTalk ? "talk" : "action");
    if (isTalk) changePendingTalks(-1); else setLoading(false);
    if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
    setWaitSecs(0);
    } catch (error) {
      if (_trace.totalMs == null && !isStale()) turnMonitor.transition(_trace, PHASE.ERROR, String(error));
      throw error;
    } finally {
      if (opts.duelReportFallback && (!result?.ok || result.stale || isStale())) opts.duelReportFallback(); await Promise.resolve();
      if (isStale() && _trace.totalMs == null) turnMonitor.transition(_trace, PHASE.DISCARDED, "收到过期结果");
      else turnMonitor.finish(_trace, summary);
    }
  }, [loading, convo, room, char, inv, skills, dao, exp, pot, flags, mapData, time, gm, preset, addLog, talkToNarrator, confessToNarrator, narrator, apiCfg, interactMode, activeTarget, activeGroundItem, setActiveTarget, setDuelPending, nsfwOn, varTree, questProgress, pendingTalks, changePendingTalks, captureUndo, dispatchCommand, setCommandPhase, clearRouteQueue]);
  actRef.current = act;
  const featureCtx = useMemo(() => ({
    addLog,
    jotNote,
    setVarTree,
    act,
    applySquareOps: (ops) => {
      for (const { op, key, day } of ops) {
        if (op === "consume") consumeArrival(key, day);
        else if (op === "burn") burnSquare(key);
      }
    },
  }), [addLog, jotNote, setVarTree, act]);
  featureCtxRef.current = featureCtx;

  return { act };
}
