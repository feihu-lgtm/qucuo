import { detectCollectPickup, allCollected, collectPromptLines } from "../quests/collect.js";
import { QUCUO_QUESTS } from "../quests/qucuoQuests.js";
import { getCurrentStage, isQuestGateOpen, canBypassExclusive } from "../quests/questEngine.js";
import { makeItemSmart } from "../items/catalog.js";
import { makeItem } from "../equipment.js";
import { getBuildingsForLocation } from "../buildings/qucuoBuildings.js";
import { hasInnerMap, getDistrictAnchor, isNpcVisibleInInnerRoom } from "../innerMap.js";
import { isSnowLeopardAvailable, activeCompanion } from "../companion.js";
import { step as traceStep } from "../actionTrace.js";
import { getAllResidentNpcLore } from "../residentNpcs.js";
import { matchNpcLore, buildNpcLoreBlock } from "../worldbook.js";
import { detectReunions, buildReunionBlock, REUNION_GAP_THRESHOLD } from "../npcAwareness.js";

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

// 采集裁决·判定段（纯判定，不写状态）：玩家表达采集意图、且所采之物此刻真在地上
// （系统先前已注入）时，给出裁决结果——「采没采到」不交给 AI 决定。
// 返回 null 或 { item, gained, note }：act 负责把 gained 入背包、从地上抹去、
// 写 collectGrantedRef 与日志，并把 note 拼进本轮 prompt。
export function judgeCollect({ isTalk, cmd, room, questProgress, inv }) {
  if (isTalk) return null;
  const hit = detectCollectPickup(cmd, room.name, room.items, {
    questProgress, quests: QUCUO_QUESTS, getCurrentStage, inv,
  });
  if (!hit) return null;
  const cEntry = (Array.isArray(hit.stage.collect) ? hit.stage.collect : [hit.stage.collect])
    .find(c => c.item === hit.item) || {};
  const gained = makeGameItem({ name: hit.item, category: "misc", quality: cEntry.quality || "白", desc: cEntry.hint || "" });
  // 是否采齐（用投影后的背包判断，避免读到旧 state）
  const done = allCollected(hit.stage, [...inv, gained]);
  const note = `\n[系统裁决：玩家已采得「${hit.item}」，系统已将其收入背包。请在 output 里自然叙述采集/挖取的过程与手感（贴合本地域），但**不要**在 delta.items_add 里再加这件物品（否则会重复），也不要写"没找到""采不到"。${done ? `此物一到手，《${hit.quest.title}》本阶段所需已齐。` : `本阶段还需其余材料，可点出还差什么。`}]`;
  return { item: hit.item, gained, note };
}

// 多阶段任务链（虎胆三重门等）：告诉AI当前哪些任务阶段可以推进/开启，
// 以及对应要在 delta.flags_add 里吐出的 flag 字符串——AI 只管在叙事到位
// 时触发这个 flag，阶段推进/互斥锁定/结局判定全部由系统状态机接管
// （见 quests/questEngine.js、quests/endingResolver.js），不需要 AI 自己
// 记住"现在第几阶段""这条线是否已经被另一条线锁死"。
// 末尾并接说服型任务分支的成功判定注入：玩家选了"周旋/说服"进对话，
// AI 要把这当成一场真交锋来演：只有玩家的话在理、把对方驳倒/说动时，
// 才在 flags_add 吐出成功 flag 推进；玩家词不达意、被反驳、气势输了，
// 就让对方继续刁难，不给过。
export function buildQuestStageNote({ questProgress, flags, char, room, inv, pendingQuestBranch }) {
  const describeFlag = (f) => Array.isArray(f) ? f.map(x => `"${x}"`).join("/或") + "（按玩家实际选择的分支，只加其中一个）" : `"${f}"`;
  const noteLines = [];
  for (const quest of QUCUO_QUESTS) {
    if (!quest.stages?.length) continue;
    const prog = questProgress[quest.id];
    if (prog?.status === "locked_by_exclusive" || prog?.status === "completed") continue;
    if (!isQuestGateOpen(quest, questProgress, flags)) continue;
    if (quest.id === "hidden_all_collect_line" && !canBypassExclusive({ char, flags })) continue;
    if (prog?.status === "active") {
      const stage = getCurrentStage(quest, prog);
      if (stage) noteLines.push(`《${quest.title}》当前阶段：${stage.description}——叙事推进到此处后，在 flags_add 加入${describeFlag(stage.completionFlag)}`);
    } else if (quest.giver && room.npcs.some(n => n.name === quest.giver)) {
      noteLines.push(`${quest.giver}可引出《${quest.title}》——若玩家与其互动触及此事，在 flags_add 加入${describeFlag(quest.stages[0].completionFlag)}`);
    }
  }
  let note = noteLines.length ? `\n[任务阶段] ${noteLines.join("；")}。` : "";
  // 本据点地上有哪些采集物在等着采（系统已注入到 room.items），提示 AI 心里有数：
  // 玩家若想采，直接顺势叙述（真正的入袋/推进由系统裁决，不劳 AI 动 items_add）。
  const cLines = collectPromptLines(room.name, { questProgress, quests: QUCUO_QUESTS, getCurrentStage, inv });
  if (cLines.length) note += `\n[可采集] ${cLines.join("；")}。玩家表达采集意图时顺势叙述采集过程即可，系统会自动结算入袋，你不要写"采不到"。`;
  if (pendingQuestBranch?.mode === "talk" && pendingQuestBranch.goal) {
    note += `\n[说服判定] 玩家正试图通过言辞达成：${pendingQuestBranch.goal}。这是一场真正的言语交锋，不是走过场——评估玩家这句话是否切中要害、有理有据、气势压得住对方。若确实说动/驳倒了对方，在 flags_add 加入「${pendingQuestBranch.flag}」并让对方让步；若玩家只是空喊、被驳倒或理亏，让对方继续刁难，不要吐这个 flag，玩家可以再想说辞。`;
  }
  return note;
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
  return `\n[本步已定情节] 这一回合确定发生了下面这件事，请把它自然演绎进 output 正文（这是剧情/任务节点，篇幅给足，约 ${targetWordCount} 字，允许±15%浮动，有场景、有对话、有起伏，不要草草几句带过）：${forcedEvent}${forcedEventNpc ? `（关键人物：${forcedEventNpc}）` : ""}。严格要求：只写这一件事，不要引入这件事之外的情节、不要让其他角色突然登场、不要铺垫别的伏笔；结果已定，不可改写、不可让它"没发生"或变成别的事。这件事的奖励与状态变化已由系统结算完毕，你【不要】在 delta / items_add / flags_add 里重复结算任何奖励或状态，只管把它写成生动的正文。`;
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
    ? `玩家此前身处「${dep.fromDistrict}·${dep.fromInner}」，出发时先自内层一路行至本地门户「${dep.fromAnchor}」，方才离境。请在开头用一两句自然交代这段折返归位（不必冗长），再承接下面的抵达。`
    : "";
  return `\n[入场叙事] 玩家刚抵达「${lockedDestName}」${destAnchor ? `，落脚在此地门户「${destAnchor}」` : ""}。${transitNote}请在 output 开头先给一段落地的场景速写：此地的地貌气候、${bld ? `可见的建筑（如${bld}等）、` : ""}此刻在场的人物、地上有无显眼之物，让玩家一眼看清"到了什么地方、有谁、有什么"，再自然承接玩家这一步的动作。用说书人白话古文一段道来，不要罗列成清单。`;
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
export function buildPresence({ _trace, isTalk, lockedDestName, room, innerRoomName, companionState }) {
  const visibleNpcs = (!isTalk && lockedDestName)
    ? room.npcs
    : room.npcs.filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n));
  traceStep(_trace, "在场名单", "info", `喂给AI ${visibleNpcs.length} 人${visibleNpcs.length ? "：" + visibleNpcs.map(n => n.name).join("、") : "（无人）"}${room.npcs.length !== visibleNpcs.length ? `（据点共${room.npcs.length}人，按内层房间过滤掉${room.npcs.length - visibleNpcs.length}人）` : ""}`);
  // 随行队友并入喂给AI的在场名单（不影响「此地之人」的UI列表——那是本地人口）。
  // 【改成读通用出战位】此前这里写死只认雪豹，明日香入队后 AI 压根不知道她跟着，
  // 叙事里她就凭空消失了。现在读 activeCompanion（单槽互斥，同时只有一个）。
  const comp = activeCompanion(companionState);
  const visibleNpcsForAI = comp?.data ? [...visibleNpcs, comp.data] : visibleNpcs;
  if (comp?.data) {
    traceStep(_trace, "伙伴随行", "info", `${comp.data.name}随行在场，已并入喂给AI的在场名单（不影响此地之人UI列表）`);
  }
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
export function buildNpcContext({ convo, preset, visibleNpcs, room, cmd, isTalk, questProgress, varTree, time, companionState, nsfwOn }) {
  const lastAiText = [...convo].reverse().find(m => m.role === "assistant")?.content || "";
  const combinedNpcLore = [...(preset.npcLore || []), ...getAllResidentNpcLore()];
  const npcLoreBlock = buildNpcLoreBlock(
    matchNpcLore(combinedNpcLore, {
      roomNpcNames: visibleNpcs.map(n => n.name),
      userInput: cmd,
      lastReply: lastAiText,
      includeLastReply: isTalk,
    })
  );
  // 雪豹·命定灵兽的二形态人设（按好感 gating）：雪豹不在 visibleNpcs（它走
  // visibleNpcsForAI 单独随行），故 worldbook 的 matchNpcLore 匹配不到它，它的
  // 人设从不注入 prompt——这里单独补一段。兽形段始终注入（只要随行在场）；化形
  // 女子的形貌须好感≥60 才写（情意不够时它仍是兽，prompt 里一字不提化形，免得
  // AI 提前让它变人）；■模式开启且已化形，才追加私密性情癖好。
  let snowLeopardLore = "";
  if (isSnowLeopardAvailable(companionState)) {
    const aff = varTree?.角色?.雪豹?.好感度 ?? 0;
    snowLeopardLore = `\n\n【雪豹·命定灵兽在场设定】随行的这头通体雪白的雪豹并非嘎则或任何人的兽，它无主、命定只认玩家一人，是前世便结下羁绊的灵兽，对旁人戒备疏离，唯独在玩家身边安静温顺。它不通人言，情感全凭动作、眼神、姿态传达（以额抵掌、绕身而行、伏低臣服、尾梢轻缠手腕等），叙事时务必如此表现，不要让它开口说人话。`;
    if (aff >= 60) {
      snowLeopardLore += `它与玩家情深至此，已能化为人形女子相伴——及腰一头雪白银发，发间垂着松石蓝珠与金穗流苏，头顶生一对雪豹兽耳、白绒里缀墨斑，额心嵌一枚菱形松石额饰，一双眸子是雪线天光般的蓝灰、瞳仁竖如兽目，肤白胜雪，肩头腰腹隐约透出雪豹的墨色斑纹，如兽皮花纹长在肉里，身披半透的雪纹薄纱、内衬豹纹，腰系金链松石，身后拖着一条粗长的雪豹斑尾，手里常按一柄镶松石、垂金穗的长剑，神情清冷而骨子里压着一股未驯的野性。化形后它仍认玩家为主，黏人而忠贞，化形与否由它随心意切换，叙事中可视情境让它在兽形与人形间自然转换。`;
      if (nsfwOn) {
        snowLeopardLore += `\n【■模式·雪豹化形私密性情】化形后的雪豹保留着猫科兽性的本能与癖好：耳根与尾根最是敏感，被顺毛、被挠耳后会忍不住喉咙里发出呼噜般的低鸣、兽耳轻抖、长尾缠上玩家手腕；平日清冷寡言，床笫间反差极烈，认主后极黏人，喜欢被玩家从背后环抱、被咬颈侧，动情时瞳孔竖成一线、忍不住现出兽耳与长尾，情浓时会用牙轻啃玩家肩头留下月牙印痕，事后蜷在玩家怀里舔舐其指尖如猫科理毛。它偏好被掌控节奏、慢磨细品，嘴上不说一句、身体却诚实得很，会主动用尾勾人、用兽耳蹭人求欢。涉及亲密剧情时，按■模式写作规则直白铺陈其兽性反应与体位细节，不必替它遮掩。`;
      }
    }
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
    ? `\n\n【在场人物与玩家的任务关系】（据此调整台词语气，已完成的该表达感谢/推进后续，进行中的该关心进度而非从头重复交代）\n${questStatusLines.join("\n")}`
    : "";
  const reunionBlock = buildReunionBlock(
    detectReunions(varTree, room.npcs, time, REUNION_GAP_THRESHOLD)
  );
  return { lastAiText, npcLoreBlockWithQuest: npcLoreBlock + snowLeopardLore + questStatusBlock, reunionBlock };
}
