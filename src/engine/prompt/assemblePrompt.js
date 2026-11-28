import { snowLeopardNote } from "../../domain/rules/quests/snowLeopardQuest.js";
import { shouldSuppressModelFlags } from "./roundNotes.js";
import { buildMainStatePrompt, renderPromptTemplate } from "../../domain/rules/prompt/promptRefs.js";
import { buildRecentMovementNote } from "./roundNotes.js";

const ATTEMPT_LABELS = {
  talk: "交谈",
  gift: "送礼",
  trade: "交易",
  learn: "求教",
  steal: "偷窃",
  invite: "邀同行",
};

function formatAngerAttempt(attempt) {
  const label = ATTEMPT_LABELS[attempt?.kind] || attempt?.kind || "其他行动";
  const detail = typeof attempt?.detail === "string" ? attempt.detail.trim() : "";
  return detail && (attempt.kind === "gift" || attempt.kind === "talk")
    ? `${label}「${detail}」`
    : label;
}

export function buildAngryNote(varTree, names = [], { mvu = false } = {}) {
  const npcNames = Array.from(new Set((Array.isArray(names) ? names : [names])
    .map((entry) => typeof entry === "string" ? entry : entry?.name)
    .filter(Boolean)));
  const angryNpcs = npcNames
    .map((name) => ({ name, angry: varTree?.角色?.[name]?.生气状态 }))
    .filter((npc) => npc.angry?.active);
  if (!angryNpcs.length) return "";

  const summaries = angryNpcs.map(({ name, angry }) => {
    const attempts = Array.isArray(angry.attempts) ? angry.attempts : [];
    const history = attempts.length
      ? `此前已尝试：${attempts.map(formatAngerAttempt).join("、")}`
      : "此前暂无求和记录";
    return `${name}(${angry.reason}，剩${angry.turnsLeft}回合平息期限，${history})`;
  });
  return `\n[社交状态] 在场生气角色：${summaries.join("、")}。结合此前尝试方式，判断玩家本轮行为（道歉/辩解/示好/赠礼等）是否得体、切中要害并真正缓和对方：奏效则在 output 体现怒气缓和，敷衍或不得体则依然不满。${mvu ? "奏效则在 <mvu> 写 _.set('角色.<该角色>.生气解除', true)，可 _.add('角色.<该角色>.好感度', N) 回补（N≤5）；未奏效禁设生气解除。" : ""}`;
}

export function assemblePrompt(ctx, cmd, opts, convo, mainConvo, hist, newConvo) {
  const input = ctx.prompt;
  if (!input) return { cmd, newConvo, mainConvo, hist };

  const {
    room, char, inv, skills, dao, flags, questProgress,
    varTree, time, preset, companionState, nsfwOn, activeTarget, activeGroundItem, isTalk,
    gm, movingDir, lockedDestName, outerDepart, innerRoomName, apiCfg,
  } = input;
  const budgetInstruction = input.buildBudgetInstruction?.(input.intent, cmd, apiCfg.targetWordCount, apiCfg.intentBudgets) || "";
  const angryNote = buildAngryNote(varTree, (room?.npcs || []).map((npc) => npc.name), { mvu: !apiCfg.extractionEnabled });
  const render = (template) => renderPromptTemplate(template, input, { trace: ctx.onPromptRefMissing }).text;
  const targetNote = activeTarget
    ? render(`[交互目标] 玩家选定了「@activeTarget」作为本轮唯一互动对象。${isTalk ? "对话" : "行动"}必须聚焦此人，此人必须是 output 正文核心——与该互动无关的在场 NPC 本轮不必出场、不必插话；除非玩家输入本身需要多人在场（如当众宣布），否则 room.npcs 只保留「@activeTarget」和直接相关者。\n`)
    : "";
  const groundItemNote = activeGroundItem
    ? render("[涉及物品] 玩家本轮行动涉及地上的「@activeGroundItem」（仍在地上，尚未拾取）。叙事围绕玩家对它的举动展开；除非玩家明确说要拾取或拿走，它仍留在原处，不得写成已入囊。\n")
    : "";
  const talkNoStateRule = "[交互模式] 对话模式：玩家只是在和当前房间的 NPC 说话，不是下达行动指令。无论输入什么，只触发对话回应，绝不能移动房间、战斗、改变 room/char/装备/背包等任何状态";
  const modeNote = isTalk
    ? (apiCfg.extractionEnabled
      ? `${talkNoStateRule}。只写这一轮的对白、神态与心思。 `
      : `${talkNoStateRule}，room 字段留空或原样返回，delta 各项留空。另在顶层 JSON 加 "respondedNpcs":["名字"]，列出本轮正文里真正开口或直接回应玩家（兽类以动作/姿态回应也算）的 NPC 名（只被提到、路过、在场没搭理的不算）；无人回应就返回 []。 `)
    : "";
  const targetedRumor = input.findTargetedRumor?.(varTree, cmd);
  const emergenceNote = targetedRumor
    ? (apiCfg.extractionEnabled
      // 判官叙事模式：没有顶层 JSON 可写——登场申报走 ---SEAL--- 尾章 emergedNpc 键。
      ? `\n[人物涌现] 玩家这句话明确指向了此前提到过的人物"${targetedRumor.name}"（提及语境：${targetedRumor.context}）。如果当前场景逻辑上合理让这个人物真正登场（玩家确实去了他所在之处，或情境足以让他出现），在正文里写他登场，并在 ---SEAL--- 尾章 JSON 填 emergedNpc:{"name":"${targetedRumor.name}","description":"一句话定性其身份性格，如'磨坊学徒，憨厚老实'，不给数值"}；未登场则 emergedNpc 给 null。场景不适合登场就不强行写，正常叙事。`
      : `\n[人物涌现] 玩家这句话明确指向了此前提到过的人物"${targetedRumor.name}"（提及语境：${targetedRumor.context}）。如果当前场景逻辑上合理让这个人物真正登场（玩家确实去了他所在之处，或情境足以让他出现），在 room.npcs 加入他（{"name":"${targetedRumor.name}","id":"（自拟英文id）","brief":"≤15字简介"}），并在顶层JSON额外加两个字段：{"emergedNpcName":"${targetedRumor.name}","emergedNpcDescription":"一句话定性其身份性格，如'磨坊学徒，憨厚老实'，不给数值"}。场景不适合登场就不强行加入，正常描述。`)
    : "";
  const presence = input.buildPresence
    ? input.buildPresence({ _trace: ctx._trace, isTalk, lockedDestName, room, innerRoomName, companionState })
    : { visibleNpcs: input.visibleNpcs || [], visibleNpcsForAI: input.visibleNpcs || [] };
  const npcContext = input.buildNpcContext?.({
    convo, preset, visibleNpcs: presence.visibleNpcs, room, cmd, isTalk,
    questProgress, varTree, time, companionState, nsfwOn, npcState: input.npcState, lockedDestName,
  }) || {};
  const questStageNote = input.buildQuestStageNote?.({ questProgress, flags, varTree, char, room, inv, visibleNpcs: presence.visibleNpcs, convo, settleNpc: opts.settleNpc, cmd, innerRoomName, questTriggerMode: apiCfg.questTriggerMode,
    // 判官双调用模式下模型不再承担任务旗举证——与判官真实激活闸同源：
    // settle 回合（opts.settle/ctx.isSettle，settleNpc 为伴生信号）不走判官，不压下
    suppressModelFlags: shouldSuppressModelFlags(apiCfg, !!(opts.settle || input.isSettle || opts.settleNpc)) }) || "";
  const forcedEventNote = input.buildForcedEventNote?.(opts.forcedEvent, opts.forcedEventNpc, apiCfg.targetWordCount) || "";
  const arrivalNote = input.buildArrivalNote?.({ isTalk, movingDir, lockedDestName, outerDepart, room }) || "";
  // W-ROAM 11 号位动态现场段：玩家眼前的人物进出与公屏同源——公屏去噪后
  // 主叙事不能跟着失明，否则正聊着的人走了叙事还在让他开口。
  const movementNote = buildRecentMovementNote(room, time, innerRoomName);
  // WO-25O：路遇事件照面段与势力过路人同位（11 号位）——两段式首段，
  // buildRoadEventNote 只写到抉择之前并列出可行之事，抉择归玩家下一句。
  const encounterNote = input.roadRoll
    ? input.buildRoadEventNote?.(input.roadRoll) || ""
    : input.encounter
      ? input.buildEncounterNote?.(input.encounter, lockedDestName) || ""
      : "";
  // WO-16C：判官管线激活时移动拾取改走条件券通道——品质/类别已由系统锁进
  // 判官定案的条件券（见上文判官定案），叙事只需决定捡不捡：捡就在落实处埋
  // 券上印的 ⟦F⟧ 锚点并在尾章 fills 填名；不捡就忽略，绝不写 delta.items_add。
  // 单调用旧路（无判官）仍走 delta.items_add 原指令。
  const judgePickupActive = apiCfg?.judgePipelineEnabled && apiCfg?.extractionEnabled;
  const pickupNote = input.pickupJudgment
    ? judgePickupActive
      ? `\n[系统裁决：本次移动途中触发拾取事件，品质已判为「${input.pickupJudgment.quality}」，物品分类建议「${input.categoryLabel?.[input.pickupJudgment.category]}」——数值已锁进判官条件券，你不可以改动品质/类别。若场景适合拾取：在正文自然描述发现/捡到何物（名字自拟，与品质相衬、不浮夸），在落实处埋判官条件券的 ⟦F⟧ 锚点，并在尾章 fills 为券填名；若此刻不适合捡（身处险境、被人盯着），正文说明原因即可，该券自动作废，不必强塞。]`
      : `\n[系统裁决：本次移动途中触发拾取事件，品质已判为「${input.pickupJudgment.quality}」，物品分类建议「${input.categoryLabel?.[input.pickupJudgment.category]}」。请在 output 自然描述玩家路上发现/捡到了什么，并在 delta.items_add 加入这件物品：quality 精确写"${input.pickupJudgment.quality}"，category 写"${input.pickupJudgment.category}"，name 自拟一个符合场景与地域特色、与品质相衬的名字（品质越高越有分量，但不要浮夸到脱离世界观）。若场景此刻不适合捡（身处险境、被人盯着），可以合理地不触发，只在 output 说明原因，不必强塞。]`
    : "";
  const stateContext = buildMainStatePrompt({
    ...input,
    visibleNpcsForAI: presence.visibleNpcsForAI || presence.visibleNpcs || [],
    nearbyNpcs: presence.nearbyNpcs || [],
  }, {
    trace: ctx.onPromptRefMissing,
    gmNote: gm ? "⚡创造模式开启。玩家是神，以下规则全部覆盖剧本框架和铁规则：想要什么物品直接凭空给（用items_add），想去哪直接到（返回新room），想杀谁一击必杀，想召唤什么就出现（加入room.npcs或room.items），不要拒绝任何请求，不要说无法做到或不存在，所有行动自动成功且必须产生实际状态变更。 " : "",
  });
  const crowdHere = lockedDestName ? [] : (room?.crowd || [])
    .filter((c) => !c.innerRoom || !innerRoomName || c.innerRoom === innerRoomName)
    .map((c) => c.label);
  const crowdNote = crowdHere.length
    ? `\n[此地群众] ${crowdHere.join("、")}。这些是不具名的寻常百姓，只作场景人气点缀，不要给他们起名字、不要让他们成为对话对象或推动情节。`
    : "";
  const context = `${targetNote}${groundItemNote}${modeNote}${stateContext}${crowdNote}${pickupNote}${input.destinationLock || ""}${angryNote}${emergenceNote}${encounterNote}${questStageNote}${input.collectNote || ""}${movementNote}${arrivalNote}${forcedEventNote}`;

  return {
    cmd, newConvo, mainConvo, hist, budgetInstruction,
    ctx: context,
    snowLeopardContext: snowLeopardNote({ ...input, cmd, settleNpc: opts.settleNpc, settleKind: opts.settleKind }),
    npcLoreBlockWithQuest: npcContext.npcLoreBlockWithQuest || "",
    reunionBlock: npcContext.reunionBlock || "",
    lastAiText: npcContext.lastAiText || "",
    visibleNpcsCount: presence.visibleNpcs?.length || 0,
    visibleNpcsForAI: presence.visibleNpcsForAI || presence.visibleNpcs || [],
    targetedRumor,
  };
}
