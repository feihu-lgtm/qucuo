import { snowLeopardNote } from "../../domain/quests/snowLeopardQuest.js";

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

export function buildAngryNote(varTree, names = []) {
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
  return `\n[社交状态] 以下在场角色正处于生气状态，原因是：${summaries.join("、")}。请结合此前尝试的方式，判断玩家本轮当前行为是否真正缓和了对方。若玩家此刻尝试道歉/辩解/示好/赠礼，请你根据其言行是否得体、是否切中要害来判断这次"平息怒气"的努力是否奏效：奏效就在 <mvu> 里用 _.set('角色.<该角色>.生气解除', true) 标记这次成功，并可用 _.add('角色.<该角色>.好感度', 5) 适度回补好感度；敷衍或不得体就让角色在 output 里表现出依然不满，不要设置生气解除字段。`;
}

export function assemblePrompt(ctx, cmd, opts, convo, mainConvo, hist, newConvo) {
  const input = ctx.prompt;
  if (!input) return { cmd, newConvo, mainConvo, hist };

  const {
    room, char, inv, skills, dao, flags, questProgress, pendingQuestBranch,
    varTree, time, preset, companionState, nsfwOn, activeTarget, activeGroundItem, isTalk,
    gm, movingDir, lockedDestName, outerDepart, innerRoomName, apiCfg,
  } = input;
  const budgetInstruction = input.buildBudgetInstruction?.(input.intent, cmd, apiCfg.targetWordCount, apiCfg.intentBudgets) || "";
  const angryNote = buildAngryNote(varTree, (room?.npcs || []).map((npc) => npc.name));
  const targetNote = activeTarget
    ? `[交互目标] 玩家选定了「${activeTarget}」作为本轮唯一的互动对象。${isTalk ? "对话" : "行动"}必须聚焦此人，此人必须是 output 正文的核心——其他在场 NPC 若与该互动无关、或不宜抢戏，本轮不必出场、不必插话。除非玩家输入本身需要多人在场（比如当众宣布什么事），否则 room.npcs 只保留「${activeTarget}」和直接相关者即可。\n`
    : "";
  const groundItemNote = activeGroundItem
    ? `[涉及物品] 玩家本轮的行动涉及地上的「${activeGroundItem}」（仍在地上，尚未拾取）。叙事须围绕玩家对这件东西的举动展开；除非玩家明确说要拾取或拿走，它仍留在原处，不得写成已入囊。\n`
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
  const questStageNote = input.buildQuestStageNote?.({ questProgress, flags, char, room, inv, pendingQuestBranch, visibleNpcs: presence.visibleNpcs, convo, settleNpc: opts.settleNpc, cmd, innerRoomName }) || "";
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
  const context = `${targetNote}${groundItemNote}${modeNote}[状态] ${gm ? "⚡创造模式开启。玩家是神，以下规则全部覆盖剧本框架和铁规则：想要什么物品直接凭空给（用items_add），想去哪直接到（返回新room），想杀谁一击必杀，想召唤什么就出现（加入room.npcs或room.items），不要拒绝任何请求，不要说无法做到或不存在，所有行动自动成功且必须产生实际状态变更。 " : ""}时间:${input.getTimeStr?.(time) || time} 主角:${char.name || "无名少侠"}〔${char.gender || "男"}〕 房间:${room.name}${input.hasInnerMap?.(room.name) && innerRoomName ? `·${innerRoomName}` : ""} 出口:${(room.exits || []).join(",")} NPCs:${visibleNpcsForAI.map((npc) => { const carried = (npc.carriedItems || []).filter((item) => !item.stolen).map((item) => item.name).join("、"); const tier = typeof npc.levelCap === "number" ? `〔品阶:${input.quality?.[Math.max(0, Math.min(5, npc.levelCap))]}档〕` : ""; return npc.name + tier + (carried ? `〔身携:${carried}〕` : "〔身无长物〕"); }).join(",") || "无"} 物品:${(room.items || []).map((item) => item.name).join(",") || "无"} HP:${(char.hp || []).join("/")} 内功:${char.neigong ?? 0} 外功:${char.waigong ?? 0} 七维:${Object.entries(char.special || {}).map(([key, value]) => key + value).join(",")} 背包:${invText} 装备:${input.describeEquipment?.(inv) || ""} 武功:${(skills || []).map((skill) => skill.name + "Lv" + skill.level).join(",")} 因果:${dao.karma} 劫数:${dao.jie}\n[已触发事件] ${(flags || []).length ? flags.join(",") : "无"}${input.describeTodayForAI?.(varTree?.世界?.起居注, input.timeForToday)}${pickupNote}${input.destinationLock || ""}${angryNote}${emergenceNote}${encounterNote}${questStageNote}${input.collectNote || ""}${arrivalNote}${forcedEventNote}`;

  return {
    cmd, newConvo, mainConvo, hist, budgetInstruction,
    ctx: context,
    snowLeopardContext: snowLeopardNote({ ...input, cmd, settleNpc: opts.settleNpc, settleKind: opts.settleKind }),
    npcLoreBlockWithQuest: npcContext.npcLoreBlockWithQuest || "",
    reunionBlock: npcContext.reunionBlock || "",
    lastAiText: npcContext.lastAiText || "",
    visibleNpcsCount: presence.visibleNpcs?.length || 0,
    targetedRumor,
  };
}
