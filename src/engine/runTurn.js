import { callMainOnce } from "../act/actCall.js";
import { parseMainResponse } from "../act/parseResponse.js";
import { callExtraction, buildExtractionCfg } from "../extractionEngine.js";
import { attachExtractionPipeline, attachPipeline, endTrace, step as traceStep } from "../actionTrace.js";
import { runKnowledgeTurn, runRecall } from "../act/memoryLayer.js";
import { buildHistBlock, histBlockSavings } from "../memory/histWindow.js";
import { createWebAi } from "./ports/ai.js";

const MAX_AUTO_RETRY = 2;

function assemblePrompt(ctx, cmd, opts, convo, mainConvo, hist, newConvo) {
  const input = ctx.prompt;
  if (!input) return { cmd, newConvo, mainConvo, hist };

  const {
    room, char, inv, skills, dao, flags, questProgress, pendingQuestBranch,
    varTree, time, preset, companionState, nsfwOn, activeTarget, isTalk,
    gm, movingDir, lockedDestName, outerDepart, innerRoomName, apiCfg,
  } = input;
  const budgetInstruction = input.buildBudgetInstruction?.(input.intent, cmd, apiCfg.targetWordCount, apiCfg.intentBudgets) || "";
  const angryNpcsInRoom = (room?.npcs || [])
    .map((npc) => ({ name: npc.name, angry: varTree?.角色?.[npc.name]?.生气状态 }))
    .filter((npc) => npc.angry?.active);
  const angryNote = angryNpcsInRoom.length
    ? `\n[社交状态] 以下在场角色正处于生气状态，原因是：${angryNpcsInRoom.map((npc) => `${npc.name}(${npc.angry.reason}，剩${npc.angry.turnsLeft}回合平息期限)`).join("、")}。若玩家此刻尝试道歉/辩解/示好/赠礼，请你根据其言行是否得体、是否切中要害来判断这次"平息怒气"的努力是否奏效：奏效就在 <mvu> 里用 _.set('角色.<该角色>.生气解除', true) 标记这次成功，并可用 _.add('角色.<该角色>.好感度', 5) 适度回补好感度；敷衍或不得体就让角色在 output 里表现出依然不满，不要设置生气解除字段。`
    : "";
  const targetNote = activeTarget
    ? `[交互目标] 玩家选定了「${activeTarget}」作为本轮唯一的互动对象。${isTalk ? "对话" : "行动"}必须聚焦此人，此人必须是 output 正文的核心——其他在场 NPC 若与该互动无关、或不宜抢戏，本轮不必出场、不必插话。除非玩家输入本身需要多人在场（比如当众宣布什么事），否则 room.npcs 只保留「${activeTarget}」和直接相关者即可。\n`
    : "";
  const talkNoStateRule = "[交互模式] 对话模式：玩家此刻只是在和当前房间里的 NPC 说话，不是在下达行动指令。无论玩家输入什么，都只应该触发对话回应，绝不能移动房间、不能战斗、不能改变 room/char/装备/背包等任何状态";
  const modeNote = isTalk
    ? (apiCfg.extractionEnabled
      ? `${talkNoStateRule}。只写这一轮的对白、神态与心思。 `
      : `${talkNoStateRule}，room 字段留空或原样返回，delta 各项留空。此外，请在顶层 JSON 里加一个字段 "respondedNpcs":["名字"]，列出本轮正文里【真正开口跟玩家对话/直接回应了玩家】的 NPC 名字（只列真的说了话或有来有往互动的人；只是被提到、路过、在场却没搭理玩家的，不要列入）。没有人开口回应就返回空数组 []。 `)
    : "";
  const targetedRumor = input.findTargetedRumor?.(varTree, cmd);
  const emergenceNote = targetedRumor
    ? `\n[人物涌现] 玩家这句话明确指向了此前提到过的人物"${targetedRumor.name}"（提及语境：${targetedRumor.context}）。如果当前场景逻辑上合理让这个人物真正登场（比如玩家确实去了他可能所在的地方，或者当前情境足以让他出现），请在 room.npcs 里加入他（{"name":"${targetedRumor.name}","id":"（自拟英文id）","brief":"≤15字简介"}），同时在返回的顶层JSON里额外加两个字段：{"emergedNpcName":"${targetedRumor.name}","emergedNpcDescription":"一句话描述这个人的身份和性格特征，比如'磨坊学徒，性格憨厚老实'"}——这段描述只需要定性，不要给出任何数值。如果场景逻辑上此刻不适合这个人登场，就不要强行加入，正常按原计划描述即可。`
    : "";
  const presence = input.buildPresence
    ? input.buildPresence({ _trace: ctx._trace, isTalk, lockedDestName, room, innerRoomName, companionState })
    : { visibleNpcs: input.visibleNpcs || [], visibleNpcsForAI: input.visibleNpcs || [] };
  const npcContext = input.buildNpcContext?.({
    convo, preset, visibleNpcs: presence.visibleNpcs, room, cmd, isTalk,
    questProgress, varTree, time, companionState, nsfwOn,
  }) || {};
  const questStageNote = input.buildQuestStageNote?.({ questProgress, flags, char, room, inv, pendingQuestBranch }) || "";
  const forcedEventNote = input.buildForcedEventNote?.(opts.forcedEvent, opts.forcedEventNpc, apiCfg.targetWordCount) || "";
  const arrivalNote = input.buildArrivalNote?.({ isTalk, movingDir, lockedDestName, outerDepart }) || "";
  const encounterNote = input.encounter
    ? input.buildEncounterNote?.(input.encounter, lockedDestName) || ""
    : "";
  const pickupNote = input.pickupJudgment
    ? `\n[系统裁决：本次移动途中触发拾取事件，品质已判定为「${input.pickupJudgment.quality}」，物品分类建议为「${input.categoryLabel?.[input.pickupJudgment.category]}」。请在 output 里自然地描述玩家路上发现/捡到了什么，并在 delta.items_add 里加入这件物品，quality 字段必须精确写成"${input.pickupJudgment.quality}"，category 字段写成"${input.pickupJudgment.category}"，name 自拟一个符合当前场景和地域特色、且与品质相衬的名字（品质越高描述可以越有分量，但不要浮夸到脱离世界观）。如果场景逻辑上此刻不适合捡到东西（比如玩家正身处险境、被人盯着），也可以合理地不触发，只需在 output 里说明原因，不必强行塞入。]`
    : "";
  const invText = (inv || []).map((item) => typeof item === "string" ? item : `${item.name}(${item.quality}${item.equipped ? "·已装备" : ""})`).join(",");
  const visibleNpcsForAI = presence.visibleNpcsForAI || presence.visibleNpcs || [];
  const context = `${targetNote}${modeNote}[状态] ${gm ? "⚡创造模式开启。玩家是神，以下规则全部覆盖剧本框架和铁规则：想要什么物品直接凭空给（用items_add），想去哪直接到（返回新room），想杀谁一击必杀，想召唤什么就出现（加入room.npcs或room.items），不要拒绝任何请求，不要说无法做到或不存在，所有行动自动成功且必须产生实际状态变更。 " : ""}时间:${input.getTimeStr?.(time) || time} 主角:${char.name || "无名少侠"}〔${char.gender || "男"}〕 房间:${room.name}${input.hasInnerMap?.(room.name) && innerRoomName ? `·${innerRoomName}` : ""} 出口:${(room.exits || []).join(",")} NPCs:${visibleNpcsForAI.map((npc) => { const carried = (npc.carriedItems || []).filter((item) => !item.stolen).map((item) => item.name).join("、"); const tier = typeof npc.levelCap === "number" ? `〔品阶:${input.quality?.[Math.max(0, Math.min(5, npc.levelCap))]}档〕` : ""; return npc.name + tier + (carried ? `〔身携:${carried}〕` : "〔身无长物〕"); }).join(",") || "无"} 物品:${(room.items || []).map((item) => item.name).join(",") || "无"} HP:${(char.hp || []).join("/")} 内功:${char.neigong ?? 0} 外功:${char.waigong ?? 0} 七维:${Object.entries(char.special || {}).map(([key, value]) => key + value).join(",")} 背包:${invText} 装备:${input.describeEquipment?.(inv) || ""} 武功:${(skills || []).map((skill) => skill.name + "Lv" + skill.level).join(",")} 因果:${dao.karma} 劫数:${dao.jie}\n[已触发事件] ${(flags || []).length ? flags.join(",") : "无"}${input.describeTodayForAI?.(varTree?.世界?.起居注, input.timeForToday)}${pickupNote}${input.destinationLock || ""}${angryNote}${emergenceNote}${encounterNote}${questStageNote}${input.collectNote || ""}${arrivalNote}${forcedEventNote}`;

  return {
    cmd, newConvo, mainConvo, hist, budgetInstruction,
    ctx: context,
    npcLoreBlockWithQuest: npcContext.npcLoreBlockWithQuest || "",
    reunionBlock: npcContext.reunionBlock || "",
    lastAiText: npcContext.lastAiText || "",
    visibleNpcsCount: presence.visibleNpcs?.length || 0,
    targetedRumor,
  };
}

export function createExtractionState(ctx, deps) {
  const state = ctx.state || {};
  const lockedDestName = state.lockedDestName ?? deps.lockedDestName;
  const inv = state.inv || deps.inv || [];
  return {
    room: state.room || deps.room,
    char: state.char || deps.char,
    inv,
    invText: inv.map((item) => typeof item === "string" ? item : item.name).join("，") || "空",
    dao: state.dao || deps.dao,
    varTree: deps.varTree,
    lockedDestName,
    lockedExits: lockedDestName ? ctx.getMapNode?.(lockedDestName)?.exits : null,
    pickupJudgment: deps.pickupJudgment,
  };
}

export async function runTurn(ctx, cmd, opts = {}) {
  const ai = ctx.ai || createWebAi();
  const convo = ctx.convo || [];
  const newConvo = [...convo, { role: "user", content: cmd }];
  const mainConvo = newConvo.filter((message) => !(
    typeof message.content === "string"
    && (message.content.startsWith("（私聊）") || message.content.startsWith("（旁白私聊回应）"))
  ));
  const isTalk = !!ctx.isTalk;
  const isSettle = !!opts.settle || !!ctx.isSettle;
  const contextWindow = ctx.apiCfg?.contextWindow || 16;
  const histWindow = isSettle ? 6 : isTalk ? Math.max(contextWindow, 20) : contextWindow;
  const histSource = mainConvo.length > histWindow ? mainConvo.slice(-histWindow) : mainConvo;
  const hist = buildHistBlock(histSource, { recentPairs: isTalk ? 3 : 2 });
  const historySavings = histBlockSavings(histSource, { recentPairs: isTalk ? 3 : 2 });
  if (historySavings.savedChars > 0) {
    traceStep(ctx._trace, "历史压缩", "info", `${historySavings.legacyChars}→${historySavings.nowChars}字（省 ${historySavings.savedChars}，约 ${Math.round(historySavings.savedChars * 1.6)} tokens）`);
  }
  const preparedPrompt = assemblePrompt(ctx, cmd, opts, convo, mainConvo, hist, newConvo);
  const promptContext = { ...preparedPrompt };
  let knowledgeTurn = null;
  let recall = { recallInfo: null, recallBlock: "" };
  if (ctx.memory) {
    knowledgeTurn = await runKnowledgeTurn({ ...ctx.memory, ai });
    recall = await runRecall({
      ...ctx.memory.recall,
      lastAiText: preparedPrompt.lastAiText || ctx.memory.recall.lastAiText,
      varTreeLatest: knowledgeTurn.kTree,
    });
  }
  const memoryDeps = {
    varTree: knowledgeTurn?.kTree,
    infoDomainBlock: knowledgeTurn?.infoDomainBlock || "",
    recallInfo: recall.recallInfo,
    recallBlock: recall.recallBlock,
  };
  const baseDeps = {
    ...(typeof ctx.callDeps === "function" ? ctx.callDeps(memoryDeps, promptContext) : (ctx.callDeps || ctx)),
    ...promptContext,
  };
  const deps = { ...baseDeps, ...Object.fromEntries(Object.entries(memoryDeps).filter(([, value]) => value !== undefined)), cmd, ai };
  const addLog = deps.addLog || ctx.addLog || (() => {});
  const trace = (layer, status, detail) => traceStep(deps._trace, layer, status, detail);
  const attach = (fn) => {
    const entry = ctx.getPipelineLog?.()?.[0];
    if (entry) fn(deps._trace, entry);
  };
  const callDeps = () => ({ ...deps });
  const apiCfg = deps.apiCfg;
  let rawFull = "";
  let p = {};
  let mvuCommands = [];
  let dealResult = null;
  let narrativeText = "";
  let pickupExtractionFailed = false;

  if (apiCfg.extractionEnabled) {
    const extractionSpecKey = deps.isTalk ? "TALK_CASUAL" : deps.intent.code;
    const extractionCfg = buildExtractionCfg(extractionSpecKey, apiCfg);
    let mainFinishReason;
    for (let attempt = 1; attempt <= MAX_AUTO_RETRY + 1; attempt++) {
      try {
        const result = await callMainOnce(null, true, callDeps());
        rawFull = result.rawFull;
        mainFinishReason = result.finishReason;
        trace("AI调用", "pass", attempt > 1
          ? `主叙事第${attempt}次尝试成功（双调用·主叙事模型=${apiCfg.model || "未设置"}）`
          : `主叙事一次成功（双调用·主叙事模型=${apiCfg.model || "未设置"}）`);
        attach(attachPipeline);
        break;
      } catch (error) {
        if (attempt <= MAX_AUTO_RETRY) {
          addLog([{ t: "sys", text: `  ⚠ 接口中断（${error.message || error}），正在自动重试（第 ${attempt}/${MAX_AUTO_RETRY} 次）…` }]);
          trace("AI调用", "fail", `主叙事第${attempt}次失败：${error.message || error}，重试`);
          continue;
        }
        trace("AI调用", "fail", `主叙事重试用尽仍失败：${error.message || error}`);
        throw error;
      }
    }

    const dealMatch = typeof rawFull === "string" && rawFull.match(/<deal>\s*([\s\S]*?)\s*<\/deal>/i);
    if (dealMatch) {
      try { dealResult = JSON.parse(dealMatch[1].replace(/[\x00-\x1f]/g, " ").trim()); } catch {}
      rawFull = rawFull.replace(/<deal>[\s\S]*?<\/deal>/gi, "").trim();
    }
    narrativeText = rawFull;
    if (!apiCfg.streamEnabled || apiCfg.apiType === "gemini") {
      const lines = rawFull.split("\n").map((line) => line.trim()).filter(Boolean);
      addLog(lines.map((text) => ({ t: "desc", text: `  ${text}` })));
    }
    if (/length|max[_ ]?tokens|max[_ ]?output/i.test(mainFinishReason || "")) {
      trace("截断检查", "block", `主叙事撞 token 上限（finishReason=${mainFinishReason}）`);
      addLog([{ t: "sys", text: "  ⚠ 本轮叙事被接口中途截断（撞到输出 token 上限），以上是已收到的部分。提取层只能按这段残文结算状态，本轮状态可能不全。" }]);
    }

    const extractionState = createExtractionState(ctx, deps);
    const settleOptions = (opts.settleKind && opts.settleNpc)
      ? {
        settleKind: opts.settleKind,
        settleNpc: opts.settleNpc,
        giftInfo: opts.giftInfo,
        learnInfo: opts.learnInfo,
        settleBeast: !!opts.settleBeast,
      }
      : null;
    const extracted = await callExtraction(
      extractionSpecKey,
      rawFull,
      extractionState,
      apiCfg,
      settleOptions,
      deps.ai,
    ).catch((error) => {
      addLog([{ t: "sys", text: `  ⚠ 提取层调用失败（${error.message || error}），本轮状态未更新` }]);
      trace("提取调用", "fail", `提取模型=${extractionCfg.model || "未设置"}调用异常：${error.message || error}，本轮状态未更新`);
      return null;
    });
    pickupExtractionFailed = !extracted || !!extracted.parseFailed;
    if (extracted) attach(attachExtractionPipeline);
    if (extracted?.parseFailed) {
      addLog([{ t: "sys", text: "  ⚠ 提取层返回的不是合法JSON（可能被截断或模型没按格式输出），本轮状态未更新" }]);
      trace("提取调用", "fail", `返回内容无法解析（提取模型=${extractionCfg.model || "未设置"}），本轮状态未更新`);
    } else if (extracted) {
      trace("提取调用", "pass", `状态提取完成（提取模型=${extractionCfg.model || "未设置"}${settleOptions ? `·${settleOptions.settleKind}专属spec` : ""}）`);
    }
    p = extracted?.p || {};
    mvuCommands = extracted?.mvuCommands || [];
  } else {
    for (let attempt = 1; attempt <= MAX_AUTO_RETRY + 1; attempt++) {
      const nudge = attempt > 1
        ? "\n\n（注意：上一次回复未能输出完整闭合的 JSON。请确保本次输出一个语法完整、正常闭合收尾的 JSON，不要中途断开。）"
        : "";
      let finishReason;
      try {
        const result = await callMainOnce(nudge, false, callDeps());
        rawFull = result.rawFull;
        finishReason = result.finishReason;
        trace("AI调用", "pass", attempt > 1
          ? `第${attempt}次重试后成功（单调用·主模型=${apiCfg.model || "未设置"}）`
          : `一次成功（单调用·主模型=${apiCfg.model || "未设置"}）`);
        attach(attachPipeline);
      } catch (error) {
        if (attempt <= MAX_AUTO_RETRY) {
          addLog([{ t: "sys", text: `  ⚠ 接口中断（${error.message || error}），正在自动重试（第 ${attempt}/${MAX_AUTO_RETRY} 次）…` }]);
          trace("AI调用", "fail", `第${attempt}次失败：${error.message || error}，重试`);
          continue;
        }
        trace("AI调用", "fail", `重试用尽仍失败：${error.message || error}`);
        attach(attachPipeline);
        endTrace(deps._trace, "行动中断（AI调用失败，状态未变更）");
        throw error;
      }
      ({ p, mvuCommands, dealResult } = parseMainResponse(rawFull));
      narrativeText = (p.output || []).join("");
      const truncated = p._truncated || /length|max[_ ]?tokens|max[_ ]?output/i.test(finishReason || "");
      if (truncated && attempt <= MAX_AUTO_RETRY) {
        addLog([{ t: "sys", text: `  ⚠ 上一轮被接口截断，正在自动重说一遍（第 ${attempt}/${MAX_AUTO_RETRY} 次，这次会更简短）…` }]);
        continue;
      }
      if (p.output?.[0]?.startsWith("（引擎回应格式异常，原始内容）")) {
        throw new Error("AI reply format is invalid");
      }
      if (!truncated) break;
    }
  }

  return {
    p,
    mvuCommands,
    dealResult,
    rawFull,
    narrativeText,
    pickupExtractionFailed,
    knowledgeTree: knowledgeTurn?.kTree,
    knowledgeTreeBase: knowledgeTurn ? ctx.memory.varTreeLatest : undefined,
    recallInfo: recall.recallInfo,
    recallBlock: recall.recallBlock,
    newConvo,
  };
}
