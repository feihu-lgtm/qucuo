import { snowLeopardNote } from "../../domain/rules/quests/snowLeopardQuest.js";
import { collectPromptLines } from "../../domain/rules/quests/collect.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getCurrentStage, isQuestGateOpen, canBypassExclusive } from "../../domain/rules/quests/questEngine.js";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { hasInnerMap, getDistrictAnchor } from "../../domain/rules/map/innerMap.js";
import { getPresentNpcs } from "../../domain/rules/prompt/promptRefs.js";
import { activeCompanion, COMPANION_LORE } from "../../domain/rules/companion/companion.js";
import { getAllResidentNpcLore } from "../../domain/data/npc/residentNpcs.js";
import { matchNpcLore, buildNpcLoreBlock } from "../../domain/rules/prompt/worldbook.js";
import { detectReunions, buildReunionBlock, REUNION_GAP_THRESHOLD } from "../../domain/rules/npc/npcAwareness.js";

const atStagePlace = (stage, room, innerRoomName) => {
  const rl = stage?.requireLocation;
  if (!rl) return true;
  if (rl.district && room?.name !== rl.district) return false;
  if (rl.inner && innerRoomName !== rl.inner) return false;
  return true;
};
const placeLabel = (stage) => {
  const rl = stage?.requireLocation || {};
  return rl.inner ? `${rl.district}/${rl.inner}` : (rl.district || "指定地点");
};

// 多阶段任务链（虎胆三重门等）：告诉AI当前哪些任务阶段可以推进/开启，
// 以及对应要在 delta.flags_add 里吐出的 flag 字符串——AI 只管在叙事到位
// 时触发这个 flag，阶段推进/互斥锁定/结局判定全部由系统状态机接管
// （见 quests/questEngine.js、quests/endingResolver.js），不需要 AI 自己
// 记住"现在第几阶段""这条线是否已经被另一条线锁死"。
// 末尾并接说服型任务分支的成功判定注入：玩家选了"周旋/说服"进对话，
// AI 要把这当成一场真交锋来演：只有玩家的话在理、把对方驳倒/说动时，
// 才在 flags_add 吐出成功 flag 推进；玩家词不达意、被反驳、气势输了，
// 就让对方继续刁难，不给过。
export function buildQuestStageNote({ questProgress, flags, varTree, char, room, inv, pendingQuestBranch, visibleNpcs, convo, settleNpc, cmd, innerRoomName, questTriggerMode }) {
  const describeFlag = (f) => Array.isArray(f) ? f.map(x => `"${x}"`).join("/或") + "（按玩家实际选择的分支，只加其中一个）" : `"${f}"`;
  const noteLines = [];
  for (const quest of QUCUO_QUESTS) {
    if (!quest.stages?.length || quest.localOnly || quest.id === "snow_leopard_quest") continue;
    const prog = questProgress[quest.id];
    if (prog?.status === "locked_by_exclusive" || prog?.status === "completed") continue;
    if (!isQuestGateOpen(quest, questProgress, flags, varTree)) continue;
    if (quest.id === "hidden_all_collect_line" && !canBypassExclusive({ char, flags })) continue;
    if (prog?.status === "active") {
      const stage = getCurrentStage(quest, prog);
      if (stage && !atStagePlace(stage, room, innerRoomName)) {
        // 地点门：玩家没到这一步指定的地点/房内，不给 AI 这一步的 flag——
        // 否则在别处置问 NPC 都可能让叙事白捡完成（questFlagRule 只看 flag）。
        noteLines.push(`《${quest.title}》下一步要在${placeLabel(stage)}完成——当前不在其地，不要在 flags_add 加这一阶段的 flag`);
      }
      if (stage && atStagePlace(stage, room, innerRoomName)) {
        // 有 choices 的阶段，flag 由系统发（玩家在任务面板点选/打赢/说服），
        // AI 代吐会绕过真实战斗或分支——只给场景，明确别吐 flag。
        // 例外：questTriggerMode=script 时抉择本来就走叙事（点选只是发一句对白，
        // 推进完全靠 AI 吐 flag），这条提示仍是唯一的推进路径，照旧给。
        if (stage.choices?.length && questTriggerMode !== "script") {
          noteLines.push(`《${quest.title}》当前阶段：${stage.description}——这一步的推进由玩家在任务面板抉择（${stage.choices.map(c => c.label).join("／")}），叙事最多写到撞见此景，不要替玩家抉择，也不要在 flags_add 里加这一阶段的 flag`);
        } else if (stage.choices?.length) {
          noteLines.push(`《${quest.title}》当前阶段：${stage.description}——玩家抉择后，在 flags_add 加入${describeFlag(stage.completionFlag)}`);
        } else {
          noteLines.push(`《${quest.title}》当前阶段：${stage.description}——叙事推进到此处后，在 flags_add 加入${describeFlag(stage.completionFlag)}`);
        }
      }
    } else {
      // 未开始的任务：只在第一阶段真正可达的地方提示——stage.giver===null 的
      // 阶段靠 requireLocation 落地（李若由的任务在天都镇镇口对质，不在小栈），
      // 其余照旧要 giver 在场。
      const first = quest.stages[0];
      const needsGiver = first.giver !== null && quest.giver;
      const anchored = !!first.requireLocation;
      const flagWorthy = (Array.isArray(first.completionFlag) ? first.completionFlag.length : !!first.completionFlag) || first.choices?.length;
      // 无地点锚点又无 giver 的全局任务不在此提示（旧口径：giver 在场才提示）
      const giverHere = !needsGiver || room.npcs.some(n => n.name === quest.giver);
      if (flagWorthy && (anchored || needsGiver) && atStagePlace(first, room, innerRoomName) && giverHere) {
        if (first.choices?.length && questTriggerMode !== "script") {
          noteLines.push(`《${quest.title}》在此可开启——这一步的推进由玩家在任务面板抉择，叙事最多写到撞见此景，不要在 flags_add 加这一阶段的 flag`);
        } else {
          noteLines.push(needsGiver
            ? `${quest.giver}可引出《${quest.title}》——若玩家与其互动触及此事，在 flags_add 加入${describeFlag(first.completionFlag)}`
            : `《${quest.title}》在此地可开启——玩家触及此事时，在 flags_add 加入${describeFlag(first.completionFlag)}`);
        }
      }
    }
  }
  let note = noteLines.length ? `\n[任务阶段] ${noteLines.join("；")}。` : "";
  // 本据点地上有哪些采集物在等着采（系统已注入到 room.items），提示 AI 心里有数：
  // 玩家若想采，直接顺势叙述（真正的入袋/推进由系统裁决，不劳 AI 动 items_add）。
  const cLines = collectPromptLines(room.name, { questProgress, quests: QUCUO_QUESTS, getCurrentStage, inv, innerRoomName });
  if (cLines.length) note += `\n[可采集] ${cLines.join("；")}。玩家表达采集意图时顺势叙述采集过程即可，系统自动结算入袋，不要写"采不到"。`;
  if (pendingQuestBranch?.mode === "talk" && pendingQuestBranch.goal) {
    note += `\n[说服判定] 玩家正试图通过言辞达成：${pendingQuestBranch.goal}。这是真正的言语交锋，不是走过场——评估这句话是否切中要害、有理有据、气势压得住对方。确实说动/驳倒对方时，在 flags_add 加入「${pendingQuestBranch.flag}」并让对方让步；玩家只是空喊、被驳倒或理亏，让对方继续刁难，不吐这个 flag，玩家可再想说辞。`;
  }
  return note + snowLeopardNote({ questProgress, flags, room: { ...room, npcs: visibleNpcs ?? room.npcs }, convo, settleNpc, cmd, innerRoomName });
}

// 本步已定情节（原任务专属 harness 并入主叙事，取代单独一次 AI 调用）：
// 感叹号任务节点点击时，系统已用 forceAdvanceQuest 结算好这一步该产生的
// 效果（好感/道具/flag），这里只把"这件已确定发生的事"作为一段末尾强指令
// 追加进主叙事 prompt（酒馆 @Depth 0 位置，约束力最强），让主叙事把它自然
// 写进正文。把原 harness 的收窄约束一并搬来：只写这一件、别引入别的情节/
// 新角色、结果不可改写；且【奖励已由系统结算，AI 不要在 delta/items_add/
// flags_add 里重复结算任何奖励或状态】，避免双重发奖。
export function buildForcedEventNote(forcedEvent, forcedEventNpc, targetWordCount) {
  if (!forcedEvent) return "";
  return `\n[本步已定情节] 这一回合确定发生了下面这件事，请把它自然演绎进 output 正文（剧情/任务节点，篇幅给足，约 ${targetWordCount} 字，允许±15%浮动，有场景、有对话、有起伏，不要草草带过）：${forcedEvent}${forcedEventNpc ? `（关键人物：${forcedEventNpc}）` : ""}。严格要求：只写这一件事，不引入别的情节、不让其他角色突然登场、不铺垫别的伏笔；结果已定，不可改写、不可让它"没发生"或变成别的事。奖励与状态变化已由系统结算，【不要】在 delta / items_add / flags_add 里重复结算任何奖励或状态，只管写成生动正文。`;
}

// 入场叙事：跨据点抵达新地点时，让本轮叙事先给一段"立此存照"的场景开场——
// 交代此地的地貌气候、建筑、在场之人、地上显眼之物，再承接玩家这一步的后续。
export function buildArrivalNote({ isTalk, movingDir, lockedDestName, outerDepart }) {
  if (isTalk || !movingDir || !lockedDestName) return "";
  const bld = getBuildingsForLocation(lockedDestName).map(b => b.name).join("、");
  const destAnchor = hasInnerMap(lockedDestName) ? getDistrictAnchor(lockedDestName) : null;
  const dep = outerDepart;
  // 若玩家是从本据点某个非锚点内层房间出发走的外层，描述要先交代"自内层某处
  // 归至本区门户（锚点），再离开本据点"，最后落到目标据点的锚点房间——不要让
  // 人物凭空从塔顶瞬移到别的据点。
  const transitNote = (dep && dep.fromInner)
    ? `玩家此前身处「${dep.fromDistrict}·${dep.fromInner}」，出发时先自内层行至本地门户「${dep.fromAnchor}」方才离境。开头用一两句自然交代这段折返归位（不必冗长），再承接下面的抵达。`
    : "";
  return `\n[入场叙事] 玩家刚抵达「${lockedDestName}」${destAnchor ? `，落脚在此地门户「${destAnchor}」` : ""}。${transitNote}请在 output 开头先给一段落地的场景速写：此地地貌气候、${bld ? `可见的建筑（如${bld}等）、` : ""}此刻在场的人物、地上有无显眼之物，让玩家一眼看清"到了什么地方、有谁、有什么"，再自然承接玩家这一步的动作。用说书人白话古文一段道来，不要罗列清单。`;
}

// 在场名单（纯计算 + trace）：喂给 AI 的 NPC 名单必须按当前内层房间过滤——
// 否则 AI 会拿到整个据点 room.npcs（含在别的内层房间的人，如老猎户在猎户小屋、
// 行脚僧在别处），照着写进正文，造成"这个房间明明没人，描述里却冒出一堆人"。
// 移动那一轮（lockedDestName）目的地内层尚未确定、且 room.npcs 马上会被目的地
// 数据覆盖，故移动轮不过滤、用原名单，入场描述另由 arrivalNote 负责；只有非移动
// （原地互动/look）才按内层房间可见性过滤。
// 雪豹随行（与作者确认：跟随不设留守，形影不离，内层箱庭也跟进去，不需要单独
// 追踪位置——它的"坐标"恒等于玩家当前坐标）。雪豹不进 room.npcs、不出现在
// "此地之人"UI列表（右栏有独立的队伍栏专门展示它），但必须让叙事能"看见"它
// 在场——所以只在这里、喂给AI的 visibleNpcsForAI 里追加它，其余下游
// （matchNpcLore 在场判定、NPC 认知隔离等）复用同一份列表，天然把雪豹当成
// 一个真实在场的角色对待，不用另开一条"伙伴专属"的叙事通道。
export function buildPresence({ isTalk, lockedDestName, room, innerRoomName, companionState }) {
  const { npcs } = room;
  const visibleNpcs = (!isTalk && lockedDestName)
    ? npcs
    : getPresentNpcs({ room, innerRoomName });
  // 随行队友并入喂给AI的在场名单（不影响「此地之人」的UI列表——那是本地人口）。
  // 【改成读通用出战位】此前这里写死只认雪豹，明日香入队后 AI 压根不知道她跟着，
  // 叙事里她就凭空消失了。现在读 activeCompanion（单槽互斥，同时只有一个）。
  const comp = activeCompanion(companionState);
  const visibleNpcsForAI = comp?.data ? [...visibleNpcs, comp.data] : visibleNpcs;
  return { visibleNpcs, visibleNpcsForAI };
}

// 场景 NPC 世界书 + 在场任务状态 + 久别重逢，三块纯注入文本的汇总（无副作用）：
//
// 世界书——触发三源：当前 room.npcs（在场）+ 玩家本轮输入 + 上轮引擎回复。命中谁才注入谁的人设。
// 合并两处人设来源：preset.npcLore（旧的6个已建档角色+老猎户/行脚僧）
// + residentNpcs.js的24人固定驻场NPC（getAllResidentNpcLore转换成
// 兼容格式）——之前这24人写了fullBio却没接进这套注入机制，是死数据，
// 现在统一走同一条matchNpcLore判断逻辑，不用改matchNpcLore本身。
// 只有真正的对话场景才需要"上一轮回复提到谁"这个信号（NPC刚说"我那侄子
// 阿福在磨坊"，玩家紧接着追问阿福是谁）。查看/端详间隙的行动/移动/战斗/
// 结算/调查这些跟对话无关的动作，不该被上一轮叙事（尤其是篇幅长、人名多
// 的战斗战报）的用词殃及——否则会出现"上一轮切磋战报提过的人，这一轮
// 随便做点什么不相干的事都被拽出来插一脚"的串场穿帮。isTalk 已经区分了
// 对话/非对话两条路，这里直接复用。
//
// 在场NPC任务状态——之前questProgress只是个纯数值state，从未被拼进对话prompt——
// AI跟NPC对话时完全不知道玩家的任务进度，表现得好像"你刚接了他的任务，
// 回头跟他说话，他跟没事人一样"。这里反查当前在场每个NPC，看
// QUCUO_QUESTS里giver是他的任务，玩家目前是什么状态，拼成简短文字
// 注入prompt，AI才能据此调整台词（比如"任务进行中"该催问进度，
// "已完成"该表达感谢，而不是从头再问一遍）。
// 兼容两套历史遗留的状态字段命名：一部分任务用status:"active"/
// "completed"，另一部分（护镖/悬赏类）用active:true/false，两者
// 都要覆盖到，不能只认一种，否则会漏掉一半任务类型的进度信息。
//
// 久别重逢·记忆断层——本轮在场者里，凡已认识、且距上次同框超过阈值的，
// 提示 AI 补写这段时间的合理变化，免得人物像时间静止。纯本地时间戳判定。
export function buildNpcContext({ convo, preset, visibleNpcs, room, cmd, isTalk, questProgress, varTree, time, companionState, nsfwOn, importedNpcLore = [], companionForms = {} }) {
  const lastAiText = [...convo].reverse().find(m => m.role === "assistant")?.content || "";
  // 三个来源合并：剧本预设手写的、据点驻场表的、玩家从角色卡入册的。
  // 入册的排最后——matchNpcLore 按数组顺序收集命中项，同名时两段人设都会注入，
  // 不会互相顶掉（一个是预设里的设定、一个是玩家自己导的，都算有效信息）。
  const combinedNpcLore = [
    ...(preset.npcLore || []),
    ...getAllResidentNpcLore(),
    ...importedNpcLore,
  ];
  const npcLoreBlock = buildNpcLoreBlock(
    matchNpcLore(combinedNpcLore, {
      roomNpcNames: visibleNpcs.map(n => n.name),
      userInput: cmd,
      lastReply: lastAiText,
      includeLastReply: isTalk,
    })
  );
  // 随行伙伴（雪豹/珍珠…灵兽类）的二形态人设：伙伴不在 visibleNpcs（走 visibleNpcsForAI
  // 单独随行），worldbook 的 matchNpcLore 匹配不到它，人设从不注入 prompt——这里单独补。
  // 用哪套描述（兽形/人形）由玩家在外貌选择器里挑（getCompanionDescForm，入队后默认人形），选中的那套
  // 连同身份底色一起注入；■模式且选了人形、且该伙伴有私密性情条目，才追加那段。
  // 明日香这类本就是在场人物的伙伴不登记 COMPANION_LORE，走常规 NPC 人设，此处跳过。
  let companionLore = "";
  const activeComp = activeCompanion(companionState);
  if (activeComp && COMPANION_LORE[activeComp.key]) {
    const lore = COMPANION_LORE[activeComp.key];
    const form = companionForms[activeComp.key] || "human";
    companionLore = `\n\n【${activeComp.label}·随行伙伴在场设定】${lore.base}`;
    companionLore += form === "human" ? lore.human : lore.beast;
    if (form === "human" && nsfwOn && lore.nsfw) companionLore += lore.nsfw;
  }
  const roomNpcNamesForQuest = room.npcs.map(n => n.name);
  const questStatusLines = [];
  for (const quest of QUCUO_QUESTS) {
    if (!quest.giver || !roomNpcNamesForQuest.includes(quest.giver)) continue;
    const prog = questProgress[quest.id];
    if (!prog) continue; // 玩家还没接触过这个任务，没有状态可说
    const isDone = prog.status === "completed";
    const isActive = prog.status === "active" || prog.active === true;
    if (isDone) {
      questStatusLines.push(`${quest.giver}交代的「${quest.title}」玩家已经完成过`);
    } else if (isActive) {
      questStatusLines.push(`${quest.giver}交代的「${quest.title}」玩家正在进行中，尚未交付`);
    }
  }
  const questStatusBlock = questStatusLines.length
    ? `\n\n【在场人物与玩家的任务关系】（据此调整台词语气：完成的表达感谢/推进后续，进行中的关心进度而非从头重复交代）\n${questStatusLines.join("\n")}`
    : "";
  const reunionBlock = buildReunionBlock(
    detectReunions(varTree, room.npcs, time, REUNION_GAP_THRESHOLD)
  );
  return { lastAiText, npcLoreBlockWithQuest: npcLoreBlock + companionLore + questStatusBlock, reunionBlock };
}
