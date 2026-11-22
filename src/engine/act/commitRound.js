import { step as traceStep } from "../../infra/actionTrace.js";
import { applyMvuCommands } from "../../domain/rules/prompt/mvu.js";
import { formatAngerResolutionLog, resolveAngerSignals } from "../../domain/rules/combat/stealSystem.js";
import { QUCUO_MAP, getMapNode } from "../../domain/data/map/qucuoMap.js";
import { isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { detectNewFaces, markAsSeen, updateLastSeen, markNpcAsKnown } from "../../domain/rules/npc/npcAwareness.js";
import { recordRumoredNpcs, clearRumor } from "../../domain/rules/npc/npcEmergence.js";
import { mapDescriptionToGenParams } from "../../domain/data/npc/npcDescriptionMapping.js";
import { ensureNpcCombatData } from "../../domain/rules/npc/npcGeneration.js";
// 在场名单的唯一写入口（见 roomNpcs.js 顶部注释）
import { patchCombatData, materializeNpc } from "../../domain/rules/npc/roomNpcs.js";
import { getAllResidentNpcNames } from "../../domain/data/npc/residentNpcs.js";
import { getImportedResidentNames } from "../../domain/rules/cards/importedRegistry.js";
import { COMPANION_SLOTS } from "../../domain/rules/companion/companionSlots.js";

import { embeddingReady } from "../../domain/rules/memory/embeddingService.js";
import { writeNote, NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";
import { applyKnowledgeTreeDiff, registerFact } from "../../domain/rules/prompt/knowledge.js";
import { settleNegotiation as gambleSettleNegotiation } from "../../domain/rules/economy/gambleStone.js";
import { commitProposalWrites } from "./commitProposalWrites.js";
import { DIR_DXY } from "../../utils/mudHelpers.js";
import { filterGhostCommands, findScriptOverride } from "./commitHelpers.js";
import { interleaveDuelReport } from "../../domain/rules/combat/duelReport.js";

// 两阶段 pipeline 的提交段：把本轮解析结果（d.p / d.mvuCommands / d.dealResult）
// 写回世界状态；提交失败由 playTurn 还原事务快照。
export function commitRound(d) {
  if (d.knowledgeTree) {
    if (d.knowledgeTreeBase) {
      d.setVarTree((latest) => applyKnowledgeTreeDiff(d.knowledgeTreeBase, d.knowledgeTree, latest));
    } else {
      d.setVarTree(d.knowledgeTree);
    }
  }

  // ── 系统采纳的在场名单（提前算，供好感度过滤 + 新面孔检测共用）──
  // 判据同下方新面孔检测：移动到缓存目的地取 cached.npcs，否则取当前 d.room.npcs，
  // 涌现登场的人(emergedNpcName)算合法新增。AI 凭空报的名字不在此列。
  const _movingToCached = d.lockedDestName ? d.roomMapRef.current[d.lockedDestName]
    : (d.p.room?.name && d.p.room.name !== d.room.name ? d.roomMapRef.current[d.p.room.name] : null);
  const _systemBaseNpcs = _movingToCached?.npcs || d.room.npcs || [];
  const systemAcceptedNames = new Set(_systemBaseNpcs.map(n => n.name));
  if (d.p.emergedNpcName) systemAcceptedNames.add(d.p.emergedNpcName);
  // 已在 varTree.角色 里有记录的人（历史交互过的、驻场登记的）也算数——他们是
  // 系统认可的真实角色，即便此刻 AI 没把他们列进本轮在场名单，对他们的好感度
  // 变化仍是合法的（比如飞鸽传书、隔空事件）。只拦"系统从来不认识"的纯幽灵。
  const _knownChars = new Set(Object.keys(d.varTreeRef.current.角色 || {}));

  d.mvuCommands = filterGhostCommands(d.mvuCommands, systemAcceptedNames, _knownChars);
  if (d.softSettle?.target) {
    const npc = d.softSettle.target;
    const systemSettled = d.mvuCommands.filter(({ path }) =>
      path?.startsWith(`角色.${npc}.生气解除`)
      || path?.startsWith(`角色.${npc}.生气状态`)
      || path === `角色.${npc}.好感度`);
    if (systemSettled.length) {
      d.mvuCommands = d.mvuCommands.filter((command) => !systemSettled.includes(command));
      traceStep(d._trace, "MVU裁决", "block",
        `已由系统结算：${systemSettled.map(({ op, path }) => `${op}(${path})`).join("；")}`);
    }
  }
  if (d.giftSettlement) {
    const { npc } = d.giftSettlement;
    const command = d.mvuCommands.find(({ op, path, value }) =>
      op === "add" && path === `角色.${npc}.好感度` && Number.isFinite(value));
    d.mvuCommands = command ? [command] : [];
  }
  if (d.mvuCommands.length) {
    d.setVarTree(prev => {
      const { tree, applied, rejected, logs } = applyMvuCommands(prev, d.mvuCommands, {
        charm: d.effectiveSpecialNow?.魅力 ?? 5,
        time: d.time,
        giftRange: d.giftSettlement?.range,
      });
      // 被裁决拒绝的指令要能在「🧭全流程日志」里看见。此前只 console.warn，
      // 排查"好感怎么没变/剧情怎么没推"时翻不到证据——那正是最需要它的时候。
      if (rejected.length) {
        console.warn("MVU 指令被系统裁决拒绝：", rejected);
        traceStep(d._trace, "MVU裁决", "block",
          rejected.map(c => `${c.op}(${c.path}) ← ${c.reason}`).join("；"));
      }
      if (applied.length) {
        traceStep(d._trace, "MVU裁决", "pass",
          applied.map(c => `${c.path}${c.actualDelta != null ? `${c.actualDelta > 0 ? "+" : ""}${c.actualDelta}` : ""}→${c.finalValue}`).join("；"));
      }
      if (logs.length) d.addLog(logs);

      // "生气解除" 是一个信号字段，不是真正要存的数据——AI通过它告诉系统
      // "这次嘴辩说服成功了"，系统裁决层据此清空该角色真正的生气状态对象，
      // 并删掉这个临时信号字段本身，避免它留在 varTree 里污染数据。
      const resolvedNames = applied
        .filter(c => c.path.endsWith(".生气解除") && c.finalValue === true)
        .map(c => c.path.split(".")[1]);
      const finalTree = resolveAngerSignals(tree, resolvedNames);
      if (resolvedNames.length) {
        d.addLog(resolvedNames.map(formatAngerResolutionLog));
      }
      return finalTree;
    });
  }

  // ── 赌石谈价结算（轻量勾连）──
  // 若这轮在谈价语境、且 AI 回了 <deal> 标签：系统 clamp 倍率 + 校验赠物，
  // 把调整后报价写进 gambleNegotiation[stoneId][bidderName]，赌桌读它更新报价、按新价结算。
  // 数值全由系统裁决（settleNegotiation clamp[0.8,1.5]），AI 越权无效。
  if (d.dealResult && d.gambleTalkCtx.current) {
    const ctx = d.gambleTalkCtx.current;
    const baseOffer = ctx.baseOffer || 0;
    const settled = gambleSettleNegotiation(
      { offer: baseOffer, cash: ctx.cash || Infinity },
      d.dealResult,
      ctx.carry || []
    );
    if (ctx.stoneId && ctx.bidderName && settled.finalOffer !== baseOffer) {
      d.setGambleNegotiation(prev => ({
        ...prev,
        [ctx.stoneId]: { ...(prev[ctx.stoneId] || {}), [ctx.bidderName]: settled.finalOffer },
      }));
      const diff = settled.finalOffer - baseOffer;
      d.addLog([{ t: "affection", text: `  🤝 谈妥了：${ctx.bidderName} 的出价 ${diff > 0 ? "抬到" : "变为"} ${settled.finalOffer} 两${settled.addItem ? `，另搭「${settled.addItem.name || settled.addItem}」` : ""}。回赌桌可按此价结算。` }]);
    }
  }
  // 谈价这轮处理完就清标记（下一句普通对话不再当谈价）
  if (d.gambleTalkCtx.current) d.gambleTalkCtx.current = null;

  // AI 依然承担"判断玩家这轮行为是否达成了某个任务节点"这件事（通过
  // 一如既往地在 delta.flags_add 里吐出对应的 completionFlag），但一旦
  // 判定命中的这个节点在 questScripts.js 里登记了固定台本，这一轮
  // 展示给玩家的文字就不再用AI自己写的 d.p.output，而是原样展示设计
  // 文档里的完整原文——AI 这一轮的"生成"实际上只被当作触发判定用，
  // 生成的正文本身被完全丢弃不展示。只要命中，就整体替换（不跟AI的
  // output 拼接），避免AI现场编的文字和固定台本的文风混在一起显得突兀。
  // 一次AI返回可能同时命中好几个stage的flag（理论上少见，但为免遗漏，
  // 按 QUCUO_QUESTS 顺序找到第一个命中的即可，不叠加展示多段台本）。
  const scriptOverride = findScriptOverride(d.p.delta?.flags_add || [], d.questProgress);
  if (d.duelReport?.rounds) {
    const narrative = Array.isArray(d.p.output) && d.p.output.length ? d.p.output : d.narrativeText || d.rawFull || "";
    d.addLog(interleaveDuelReport(d.duelReport.rounds, narrative));
  } else if (scriptOverride) {
    d.addLog(scriptOverride.split("\n").filter(line => line.length).map(t => ({ t: "desc", text: "  " + t })));
  } else if (d.p.output) {
    d.addLog(d.p.output.map(t => ({ t: "desc", text: "  " + t })));
  }
  if (d.p._truncated) d.addLog([{ t: "sys", text: "  ⚠ 本轮回复被接口中途截断，以上仅为已收到的完整部分（多为中转站/模型输出上限所致，可换接口或调低目标字数；详见 📋 Pipeline 的停止原因）" }]);

  // NPC涌现·第一阶段：AI如果在这一轮显式声明"提到了新的具名人物"
  // （通过顶层JSON的 mentionedNewNpcs 字段），记为"传闻中的人物"，
  // 不立即生成技能/属性——不用正则猜人名，中文人名边界靠字符规则
  // 猜测误判率太高，改为让AI自己判断这是语义理解的强项。
  if (d.p.mentionedNewNpcs && d.p.mentionedNewNpcs.length) {
    // 用统一的 d.narrativeText 而不是 d.p.output——双调用模式下叙事在 d.rawFull 里，
    // 读 d.p.output 会拿到空串，传闻人物就成了没有上下文的光杆名字。
    d.setVarTree(prev => recordRumoredNpcs(prev, d.p.mentionedNewNpcs, d.narrativeText));
  }

  // 系统裁决：AI每次返回的NPC列表里，凡是还没有 moveset/carriedItems 的
  // （通常是新出现的NPC），本地补全一份固定的技能位和随身物品，供切磋/偷窃使用。
  // 关键：AI 每轮返回的都是全新的 {name,id,brief} 裸对象，直接喂给
  // ensureNpcCombatData 会导致同一个 NPC 每轮重新随机一套随身物品——
  // "出生即固定"彻底失效，战利品变成四次元口袋。所以先按名字和场上已有
  // NPC 合并，老面孔继承出生时固化的全部数据，只有真正的新面孔才走生成
  // （新面孔如果带 carry 字段，随身物品就按 carry 所见即所得地固化）。
  //
  // 生成顺序（硬规则）：人眼看见的描述 -> 角色出现 -> 才据此设置人设/装备/行囊，
  // 不能反过来。之前只有"传闻人物涌现"这条特殊分支会把描述喂给
  // mapDescriptionToGenParams 换算人设强度，常规新面孔（刷新出的/新地点遇到的）
  // 完全绕开了这一步，直接吃 luck 兜底——猎户和商贩长出同一副筋骨。
  // 现在统一用 brief + 本轮叙事文本作为"看见的描述"，新面孔都走同一套映射。
  const luck = d.char.special?.气运 ?? 5;
  // d.narrativeText 已在上面按模式各自赋好（单调用=d.p.output 拼接，双调用=d.rawFull 散文），
  // 不要在这里重新从 d.p.output 取——那样双调用会拿到空串，新面孔全部退化成吃 luck 兜底。
  if (d.p.room && Array.isArray(d.p.room.npcs)) {
    // 幽灵NPC过滤：AI叙事里提到背景人物（"远处狼嚎"）或队友（雪豹跟在身边），
    // 提取层会把这些名字塞进 room.npcs。驻场NPC有固定归属据点，不该在别处被
    // AI凭空刷出来（刷出来还吃 mapDescriptionToGenParams 退化成绿袍）；队友
    // 走 companionState 独立管理，更不该变成 room.npcs 里的一个路人。
    // 入册的驻场角色同样有固定归属，一并纳入幽灵过滤——否则玩家在鱼定村
    // 入册的人，AI 可能在锦官城凭空刷出来一个同名的。
    const _residentNames = new Set([...getAllResidentNpcNames(), ...getImportedResidentNames()]);
    const _companionNames = new Set(COMPANION_SLOTS.map(s => s.label));
    const _currentNames = new Set((d.room.npcs || []).map(n => n.name));
    d.p.room.npcs = d.p.room.npcs.filter(n => {
      if (!n?.name) return false;
      if (_companionNames.has(n.name) || n.name.includes("雪豹")) return false;
      if (_residentNames.has(n.name) && !_currentNames.has(n.name)) return false;
      return true;
    });
    d.p.room.npcs = d.p.room.npcs.map(n => {
      const existing = d.room.npcs.find(o => o.name === n.name);
      if (existing?.carriedItems) {
        return { ...existing, brief: n.brief || existing.brief };
      }
      const { levelCap, personalityProfile } = mapDescriptionToGenParams(`${n.brief || ""} ${d.narrativeText}`);
      return ensureNpcCombatData({ ...n, personalityProfile }, { luck, levelCap });
    });
    // 把这一轮新固化出来的战斗数据按名字存一份，供下面"原地互动"分支回填。
    // 【为什么需要这一步】上面这段固化写在 d.p.room.npcs 这个临时对象上；而原地互动
    // （切磋/对话/查看，即没触发移动的绝大多数回合）走的分支是
    // `setRoom(r => ({ ...r, ...d.p.room, npcs: r.npcs }))`——npcs 取旧的 r.npcs，
    // 于是刚固化的 carriedItems/moveset/combatStats **整个被丢掉**。
    // 后果：AI 生成的路人永远没有 carriedItems，切磋赢了掉落池恒为空、一件都不掉。
    // 只有 residentNpcs 里带显式 carry 的驻场走另一条注入路径，所以玩家的体感是
    // "只有村里那个老猎户爆过东西"。
    // 不能改成信 AI 返回的名单——那是另一个已修 bug 的根因（AI 每轮重新发明在场
    // 人物，"此地的人一会好几个一会都走光"）。所以只回填数据、不动名单。
    d.freshNpcData = new Map(d.p.room.npcs.filter(n => n?.name).map(n => [n.name, n]));

    // 复用 MVU 块之前算好的系统采纳名单（systemAcceptedNames），判据一致：
    // 只认系统真正会放进场的人 + 涌现登场者，AI 凭空多报的幽灵一律不计入。
    // 再叠一层内层房间过滤（isNpcVisibleInInnerRoom）：与左栏「此地之人」、任务栏
    // giver 判定用同一套——否则会出现"老猎户明明绑在猎户小屋，却因为在整个 d.room.npcs
    // 里就在村口被判成『新人物出现』"的割裂。三处必须同一份可见性判据。
    const acceptedNpcs = d.p.room.npcs
      .filter(n => systemAcceptedNames.has(n.name))
      .filter(n => isNpcVisibleInInnerRoom(d.room.name, d.innerRoomName, n));

    // "新人物出现"检测：只对系统真正采纳、且从未见过的面孔插入这条日志。
    const newFaces = detectNewFaces(d.varTreeRef.current, acceptedNpcs);
    if (newFaces.length) {
      d.addLog(newFaces.map(n => ({ t: "sys", text: `  ※ 新人物出现：${n.name}（点击可细看其人）` })));
      d.setVarTree(prev => markAsSeen(prev, newFaces.map(n => n.name)));
    }
    // 久别重逢·记忆断层：同样只记系统采纳的在场人物。
    d.setVarTree(prev => updateLastSeen(prev, acceptedNpcs.map(n => n.name), d.time));
  }

  // NPC涌现·第二阶段：如果这次AI返回里，有一个"传闻中的人物"被真正实体化
  // 进了 d.room.npcs（通过下面注入的涌现指令引导AI这么做），系统读取AI给出的
  // emergedNpcDescription（身份/性格定性描述），本地映射成数值，清除传闻标记。
  if (d.p.emergedNpcDescription && d.p.emergedNpcName) {
    const { levelCap, personalityProfile } = mapDescriptionToGenParams(d.p.emergedNpcDescription);
    d.setVarTree(prev => clearRumor(prev, d.p.emergedNpcName));
    d.setRoom(r => ({
      ...r,
      npcs: materializeNpc(r.npcs, d.p.emergedNpcName,
        ensureNpcCombatData({ ...(r.npcs.find(n => n.name === d.p.emergedNpcName) || {}), personalityProfile }, { luck, levelCap })),
    }));
  }

  if (!d.isTalk) {
    if (d.lockedDestName) {
      // 系统裁决：目的地、出口列表强制来自固定地图，不信任 AI 返回的 d.room.name/exits，
      // 只采用 AI 给出的 desc（场景描述文本）——这是本轮改造的核心："AI 只负责怎么形容，
      // 不负责去哪里"。
      const destNode = getMapNode(d.lockedDestName);
      const cached = d.roomMapRef.current[d.lockedDestName];
      const finalDesc = (d.p.room && d.p.room.desc) ? d.p.room.desc : destNode.desc;
      d.setRoom({
        name: d.lockedDestName,
        desc: finalDesc,
        exits: Object.keys(destNode.exits),
        npcs: (cached && cached.npcs) || (d.p.room && d.p.room.npcs) || [],
        items: (cached && cached.items) || (d.p.room && d.p.room.items) || [],
      });
      d.addLog([{ t: "d.room", text: "" }, { t: "d.room", text: `    ${d.lockedDestName}` }, { t: "d.room", text: "" }]);
      traceStep(d._trace, "状态写回", "pass", `d.room.name → ${d.lockedDestName}（移动完成）${d.outerDepartRef.current?.fromInner ? `，内层落点自动归为新据点锚点` : ""}`);
      d.outerDepartRef.current = null;
      if (!d.mapData[d.lockedDestName]) {
        d.setMapData(m => ({ ...m, [d.lockedDestName]: { x: destNode.x, y: destNode.y } }));
      }
    } else if (d.p.room && QUCUO_MAP[d.room.name]) {
      // 当前在固定地图范围内，且这次没有触发移动（比如原地互动/战斗），
      // 只允许 AI 更新 desc/items，name/exits/npcs 依然锁定为系统已有状态。
      // npcs 不能信任 AI 这次返回的名单——AI 每个回合都会重新交一份"它认为
      // 在场的人"的完整列表，如果直接铺盖过去，等于每次非移动动作都让AI
      // 重新发明一次在场人物，这正是"此地的人一会好几个一会都走光"的乱动
      // 根因。在场人物只应通过明确渠道变化：每日游走人口刷新（见下方
      // useEffect）、人物涌现（emergedNpcName，就发生在这行之前）、或玩家
      // 自己的动作——不该被这句话顺手覆盖。
      const node = QUCUO_MAP[d.room.name];
      // npcs 仍以系统既有名单 r.npcs 为准（不信 AI 这轮报的在场名单），但要把上面
      // 刚固化出来的战斗数据回填给名单里对应的人——名单不动、数据补齐。
      // 少了这一步，切磋掉落池恒为空（见上方 freshNpcData 处的注释）。
      d.setRoom(r => ({
        ...r, ...d.p.room, name: d.room.name, exits: Object.keys(node.exits),
        npcs: patchCombatData(r.npcs, d.freshNpcData),
      }));
    } else if (d.p.room) {
      // 兜底：房间不在固定地图里（理论上不应该出现，只有 AI 未遵守系统裁决时才会
      // 落入这条路径）。这次修复已经从源头堵住了主要诱因——之前"向北走"这类带
      // 前缀词的移动指令会被 parseDir 误判为"非移动"，导致本该走上面 d.lockedDestName
      // 强锁分支的请求错误地流落到这里，AI 因此有机会自由发挥编出不在地图里的
      // 过渡地名（比如"熊曲山谷"）。parseDir 修好之后，只要玩家的移动意图能被正确
      // 识别，就不会再落入这条分支；这里维持原有的兜底自由生成逻辑，不额外强行拉回
      // 固定地图，避免打断正在进行的、AI已经开始编排的野生场景剧情。
      const moved = d.p.room.name && d.p.room.name !== d.room.name;
      if (moved) {
        const cached = d.roomMapRef.current[d.p.room.name];
        if (cached) d.setRoom(r => ({ ...r, ...d.p.room, items: cached.items, npcs: cached.npcs }));
        else d.setRoom(r => ({ ...r, ...d.p.room }));
        d.addLog([{ t: "d.room", text: "" }, { t: "d.room", text: `    ${d.p.room.name}` }, { t: "d.room", text: "" }]);
        if (d.pendDirRef.current && !d.mapData[d.p.room.name]) {
          const dirKey = d.pendDirRef.current, [dx, dy] = DIR_DXY[dirKey] || [0, 0];
          const cur = d.mapData[d.room.name] || { x: 0, y: 0 };
          d.setMapData(m => ({ ...m, [d.p.room.name]: { x: cur.x + dx, y: cur.y + dy } }));
        }
      } else {
        d.setRoom(r => ({ ...r, ...d.p.room }));
      }
    }
    d.pendDirRef.current = null;
  }
  commitProposalWrites(d, (...args) => traceStep(d._trace, ...args));
  // 选项在叙事之后、隔一拍再浮现——不要跟叙事同一帧糊在一起。让玩家先把这段
  // 剧情读进去，行动选项再"卡一下"缓缓出来，读感上先有戏、后给抉择。
  if (d.p.choices?.length) {
    const choiceLog = [{ t: "sys", text: "" }, { t: "choice", text: "  你可以：" }, ...d.p.choices.map((c, i) => ({ t: "choice", text: `  [${String.fromCharCode(65 + i)}] ${c}`, action: c }))];
    setTimeout(() => d.addLog(choiceLog), 650);
  }
  if (!d.isTalk) d.setTime(t => t + 1);

  // ── 小纸条·向量写入（提交段·异步副作用）──
  // AI 若吐了 memory 字段（≤50字纯事实），本轮成功结算后写进统一小纸条库供日后召回。
  // fire-and-forget：不 await，不阻塞 UI，失败静默；只在成功路径执行，故回滚路径不会误写。
  // owner 三态：行动模式=公共见闻（owner 空，谁都能语义捞）；对话模式=私有给对话对象
  // （只在该 NPC 在场/对话时浮现，外人捞不到内容）——这正是「私聊你俩私有」的落点。
  if (embeddingReady(d.apiCfg) && d.p.memory) {
    const roomNpcs = (d.p.room && Array.isArray(d.p.room.npcs) ? d.p.room.npcs : d.room.npcs) || [];
    const knownNames = Array.from(new Set([
      ...roomNpcs.map(n => n.name),
      ...Object.keys(d.varTreeRef.current.角色 || {}),
      ...Object.keys(QUCUO_MAP),
    ]));
    const noteOwner = (d.activeTarget || (d.isTalk && d.talkTarget)) ? [{ name: d.activeTarget || d.talkTarget, via: VIA.FIRSTHAND }] : [];
    const noteSource = d.isTalk ? NOTE_SOURCE.TALK : NOTE_SOURCE.NARRATIVE;
    writeNote({ cfg: d.apiCfg, text: d.p.memory, turn: d.time, knownNames, owner: noteOwner, source: noteSource, place: d.room.name })
      .catch(err => console.warn("小纸条写入失败（不影响本轮）：", err));
  }

  // ── 信息领域·把 memory 同时登记为可传播事实 ──
  // 与上面的向量小纸条并行的第二条路：注册进 knowledge.js 事实账本，供 NPC 自然提起、
  // 按同框传播扩散。不依赖 embeddingReady（纯文本记账）。
  // 隔离：对话模式下这段是「你俩私下说的」，只让对话对象一人当场"亲历"入账，
  // 不把内容摊给同屋其他 NPC（外人不该凭空知道你私下答应了谁什么）；
  // 行动模式才是当众见闻，在场者共同"目击"。
  if (d.p.memory) {
    d.dayMaterialRef.current.push({ turn: d.time, text: d.p.memory }); // 主叙事/对话的事实也进当日原料（日总结用）
    const roomNpcs = (d.p.room && Array.isArray(d.p.room.npcs) ? d.p.room.npcs : d.room.npcs) || [];
    const witnesses = (d.activeTarget || (d.isTalk && d.talkTarget))
      ? [{ name: d.activeTarget || d.talkTarget, 途径: "亲历" }]
      : roomNpcs.map(n => ({ name: n.name, 途径: "目击" }));
    if (witnesses.length) {
      const factId = `turn_${d.time}_${witnesses[0].name}`;
      d.setVarTree(prev => registerFact(prev, { id: factId, 摘要: d.p.memory, 标签: d.isTalk ? "私语" : "见闻", 知晓者: witnesses }, d.time));
    }
  }

  // 对话即认识（本轮统一）：只要这次是对话模式(d.isTalk)、且明确选定了对话对象
  // (d.talkTarget)、并真正走完了对话结算(到这里说明没被拦截/回滚)，就把对方标记为
  // 已认识。此前只有"点NPC名字→互动菜单→对话"(handleNpcTalk)会标记，而"底部💬对话"
  // "侧栏选人对话"这两个入口漏了，导致跟人从底部聊了半天头上还挂"尚未认识"。
  // 判定放在这里(而非各UI入口)的好处：捕捉的是"真的选人+真的说了话"这个动作本身，
  // 所有对话入口自动一致，不用每个入口分别补，也不会"一点聚焦就算认识"。
  if (d.isTalk) {
    const toKnow = new Set();
    if (d.talkTarget) toKnow.add(d.talkTarget); // 选定了对象：直接算认识
    // 没选人(或即便选了人)时，AI 回包的 respondedNpcs 报出本轮真正开口回应玩家的
    // NPC——用它精准标记，不靠解析正文猜"谁说话了"(那样极易误判被提及/路过的人)。
    // 只认在场名单里的名字，AI 若报了不在场的名字(幻觉)一律丢弃。
    if (Array.isArray(d.p.respondedNpcs)) {
      const presentNames = new Set((d.room.npcs || []).map(n => n.name));
      d.p.respondedNpcs.forEach(name => { if (typeof name === "string" && presentNames.has(name)) toKnow.add(name); });
    }
    if (toKnow.size) {
      d.setVarTree(prev => Array.from(toKnow).reduce((tree, name) => markNpcAsKnown(tree, name), prev));
    }
  }

  // 顺手把这一轮的 memory 与回合数存进 convo 条目：历史窗口的「前情」层用它替代
  // 原始 JSON（见 memory/histWindow.js）。我们每轮本来就生成了 p.memory，
  // 此前只喂给向量小纸条和事实账本，历史窗口却仍在铺 500 字原始——同一件事
  // 存了两份、用了贵的那份。老存档的条目没有这两个字段，histWindow 会回退截断。
  d.setConvo([...d.newConvo, {
    role: "assistant",
    content: d.rawFull.slice(0, 500),
    memory: (d.p?.memory && String(d.p.memory).trim()) || "",
    turn: d.time,
  }]);

  // 回合完成登记：驱动"每 N 回合自动存档"。出错回滚的轮次不计数——
  // 状态没变，存了也是重复盘。
  d.roundsSinceLastSaveRef.current += 1;
  d.playedThisSessionRef.current = true;
}
