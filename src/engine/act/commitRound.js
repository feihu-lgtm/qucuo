import { step as traceStep } from "../../infra/actionTrace.js";
import { applyMvuCommands } from "../../domain/rules/prompt/mvu.js";
import { formatAngerResolutionLog, resolveAngerSignals } from "../../domain/rules/combat/stealSystem.js";
import { applyKnowledgeTreeDiff } from "../../domain/rules/prompt/knowledge.js";
import { commitProposalWrites } from "./commitProposalWrites.js";
import { commitModelFlags } from "./commitFlags.js";
import { companionNames, filterGhostCommands } from "./commitHelpers.js";
import { OC_BY_NAME } from "../../domain/rules/npc/npcCarry.js";
import { settleDeal } from "./postCommit/dealSettle.js";
import { emitNarrative } from "./postCommit/narrative.js";
import { recordRumors } from "./postCommit/rumors.js";
import { fixateNpcs } from "./postCommit/npcFixation.js";
import { materializeEmergence } from "./postCommit/emergence.js";
import { emitRoomHeader, writeRoom } from "./postCommit/roomWrite.js";
import { emitChoices } from "./postCommit/choices.js";
import { writeMemoryNote } from "./postCommit/memoryNote.js";
import { registerMemoryFact, normalizeMemoryText } from "./postCommit/memoryFact.js";
import { markTalkAcquaintance } from "./postCommit/talkKnow.js";
import { burnIntimateTicket } from "./postCommit/intimateTicket.js";
import { appendConvo } from "./postCommit/convoAppend.js";
import { noteRoundCompleted } from "../../features/autosaveScheduler.js";
import { applyPostResult } from "./postCommit/applyPostResult.js";
import { commitPatches } from "../../domain/rules/state/applyPatches.js";

// 两阶段 pipeline 的提交段：把本轮解析结果（d.p / d.mvuCommands / d.dealResult）
// 写回世界状态；提交失败由 playTurn 还原事务快照。
// 结构：主函数只做「校验/裁决 + 统一落盘」这一个事务（knowledge 差分、
// 幽灵指令过滤、软结算/赠礼拦截、MVU 应用含消气消解、时间推进、回合登记）；
// 其余每类后置处理按原顺序委托给 postCommit/ 下的一文件一职责模块，
// 入参/时机/副作用与拆分前逐行等价。
export function commitRound(d) {
  // memory 归一须在 postCommit 链之前：writeMemoryNote/appendDayMaterial/
  // registerMemoryFact 都消费 d.p.memory，数组/对象形态必须在这里统一成字符串，
  // 不能只藏在 registerMemoryFact 内部（否则先跑的消费口仍拿到数组）。
  if (d.p?.memory && typeof d.p.memory !== "string") {
    d.p = { ...d.p, memory: normalizeMemoryText(d.p.memory) };
  }
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
  const _roomMap = d.getGameState?.()?.roomCache || {};
  const _movingToCached = d.lockedDestName ? _roomMap[d.lockedDestName]
    : (d.p.room?.name && d.p.room.name !== d.room.name ? _roomMap[d.p.room.name] : null);
  const _systemBaseNpcs = _movingToCached?.npcs || d.room.npcs || [];
  const systemAcceptedNames = new Set(_systemBaseNpcs.map(n => n.name));
  if (d.p.emergedNpcName) systemAcceptedNames.add(d.p.emergedNpcName);
  for (const name of companionNames(d.companionState)) systemAcceptedNames.add(name);
  // 已在 varTree.角色 里有记录的人（历史交互过的、驻场登记的）也算数——他们是
  // 系统认可的真实角色，即便此刻 AI 没把他们列进本轮在场名单，对他们的好感度
  // 变化仍是合法的（比如飞鸽传书、隔空事件）。只拦"系统从来不认识"的纯幽灵。
  const _knownChars = new Set(Object.keys(d.getGameState?.()?.varTree?.角色 || {}));

  d.mvuCommands = filterGhostCommands(d.mvuCommands, systemAcceptedNames, _knownChars);
  if (d.giftSettlement) {
    // WO-16B：送礼好感已由 feature deterministic 硬结算落账，模型写的任何
    // 好感 MVU 都是双计——不再放行那"唯一一条"，整批清空（其余状态也早已系统结清）。
    d.mvuCommands = [];
  }
  // 求教/邀同行同理：settleNpc 的好感是系统结算的既成事实，模型乱写一律拦截。
  if (!d.giftSettlement && (d.settleKind === "learn_skill" || d.settleKind === "companion_invite") && d.settleNpc) {
    const pin = `角色.${d.settleNpc}.好感度`;
    d.mvuCommands = d.mvuCommands.filter(({ path }) => path !== pin);
  }
  if (d.mvuCommands.length) {
    d.setVarTree(prev => {
      // 聊天语义好感：搭话回合的好感 mvu 收窄到 -5~+8，forbidden/兽类跳过；
      // 送礼/软结算那两条已各有限定（giftRange/系统结算剔除），不再叠加。
      const talkAffection = d.isTalk && !d.giftSettlement ? {
        talkRange: [-5, 8],
        affectionSkip: new Set([
          ..._systemBaseNpcs.filter((npc) => npc?.intimacy?.forbidden || npc?.beast).map((npc) => npc.name),
          ...Object.entries(OC_BY_NAME).filter(([, oc]) => oc?.intimacy?.forbidden).map(([name]) => name),
        ]),
      } : {};
      const { tree, applied, rejected, logs } = applyMvuCommands(prev, d.mvuCommands, {
        charm: d.effectiveSpecialNow?.魅力 ?? 5,
        time: d.time,
        giftRange: d.giftSettlement?.range,
        ...talkAffection,
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
          applied.map(c => `${c.path}${c.actualDelta != null ? `${c.actualDelta > 0 ? "+" : ""}${c.actualDelta}` : ""}→${c.finalValue}${c.note ? `（${c.note}）` : ""}`).join("；"));
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

  // ── postCommit 处理器链：与拆分前同序执行 ──
  // 纯函数化处理器（返回 { logs | delayedLogs, changes, refWrites }）统一经
  // applyPostResult 落盘；未改造的仍收整个 d。
  const postCtx = {
    systemAcceptedNames,
    luck: d.char.special?.气运 ?? 5,
  };
  applyPostResult(d, settleDeal({ dealResult: d.dealResult, gambleTalkCtx: d.getGambleSession?.() ?? null })); // 赌石谈价结算
  applyPostResult(d, emitRoomHeader({ // 移动落地的地名标题，排在正文之前
    isTalk: d.isTalk, lockedDestName: d.lockedDestName, p: d.p, room: d.room,
  }));
  applyPostResult(d, emitNarrative({ p: d.p, questProgress: d.questProgress })); // 台本覆盖/切磋战报/正文/截断提示
  applyPostResult(d, burnIntimateTicket({ intimateTicket: d.intimateTicket })); // 凭卡强开·焚卡
  applyPostResult(d, recordRumors({ p: d.p, narrativeText: d.narrativeText })); // 涌现·传闻登记
  applyPostResult(d, fixateNpcs({    // 在场名单幽灵过滤+战斗数据固化+新面孔/重逢
    p: d.p, room: d.room, innerRoomName: d.innerRoomName, narrativeText: d.narrativeText,
    varTree: d.getGameState?.()?.varTree, time: d.time,
    systemAcceptedNames: postCtx.systemAcceptedNames, luck: postCtx.luck, npcState: d.npcState,
  }));
  // 私聊回合不实体化：writeRoom 在 isTalk 整体跳过，upsert 却不能跟着跳——
  // 否则传闻人物会在密闭私聊里凭空进屋。跳过则传闻保留，留待非私聊回合再登场。
  if (!d.isTalk) applyPostResult(d, materializeEmergence({ p: d.p, luck: postCtx.luck, innerRoomName: d.innerRoomName, npcState: d.npcState })); // 涌现·实体化
  applyPostResult(d, writeRoom({    // 房间写回（锁定目的地/固定地图/兜底）
    isTalk: d.isTalk, lockedDestName: d.lockedDestName, p: d.p, room: d.room, innerRoomName: d.innerRoomName,
    roomMap: _roomMap, outerDepart: d.outerDepart,
    mapData: d.mapData, pendDir: d.pendDir, freshNpcData: d.freshNpcData,
  }, { traceStep: (...args) => traceStep(d._trace, ...args) }));
  applyPostResult(d, commitProposalWrites({ // AI 提议落盘：char/dao/物品/经验/潜能/技能
    p: d.p, isTalk: d.isTalk, giftAlreadySettled: d.giftAlreadySettled, deliveredItems: d.deliveredItems,
    preserveHp: d.preserveHp, gm: d.gm,
    pickupJudgment: d.pickupJudgment, collectGranted: d.collectGranted,
    pickupExtractionFailed: d.pickupExtractionFailed,
    judgePipelineActive: d.judgePipelineActive,
    innerRoomName: d.innerRoomName,
  }, { trace: (...args) => traceStep(d._trace, ...args) }));
  applyPostResult(d, commitModelFlags({  // flags_add 过滤落盘（原 commitProposalWrites 尾部内嵌）
    p: d.p, room: d.room, innerRoomName: d.innerRoomName,
    questProgress: d.questProgress,
  }));
  // WO-13 判官管线落账：materializeFacts 的 changes 直写状态切片，
  // patches 走标准 applyPatches 落到 varTree 等路径，logs 回吐事实短句。
  if (d.materialized) {
    // receipts（天机落账卡回执）挂在末条落账日志行上——LogEntry 按日志项
    // 携带的 receipts 数组渲染 EffectReceiptCard，不挂卡永远不会出现。
    const factLogs = (d.materialized.logs || []).map((l) => ({ t: l.t || "sys", text: l.text || String(l) }));
    if (factLogs.length && Array.isArray(d.materialized.receipts) && d.materialized.receipts.length) {
      factLogs[factLogs.length - 1] = { ...factLogs[factLogs.length - 1], receipts: d.materialized.receipts };
    } else if (!factLogs.length && Array.isArray(d.materialized.receipts) && d.materialized.receipts.length) {
      factLogs.push({ t: "sys", text: "  天机落账。", receipts: d.materialized.receipts });
    }
    applyPostResult(d, {
      changes: d.materialized.changes,
      logs: factLogs,
    });
    if ((d.materialized.patches || []).length) {
      commitPatches({
        setVarTree: d.setVarTree, setChar: d.setChar, setInv: d.setInv, setFlags: d.setFlags, setCompanionState: d.setCompanionState,
      }, d.materialized.patches);
    }
  }
  applyPostResult(d, emitChoices({ choices: d.p.choices })); // 选项延时浮现
  if (!d.isTalk) d.setTime(t => t + 1);
  applyPostResult(d, writeMemoryNote({ // 小纸条·向量写入
    p: d.p, apiCfg: d.apiCfg, room: d.room, activeTarget: d.activeTarget,
    isTalk: d.isTalk, talkTarget: d.talkTarget, time: d.time, varTree: d.getGameState?.()?.varTree,
  }));
  applyPostResult(d, registerMemoryFact({ // memory → 可传播事实账本
    p: d.p, room: d.room, activeTarget: d.activeTarget,
    isTalk: d.isTalk, talkTarget: d.talkTarget, time: d.time,
    appendDayMaterial: d.appendDayMaterial,
  }));
  applyPostResult(d, markTalkAcquaintance({ isTalk: d.isTalk, talkTarget: d.talkTarget, room: d.room, p: d.p, derivedRespondedNpcs: d.derivedRespondedNpcs })); // 对话即认识
  applyPostResult(d, appendConvo({ newConvo: d.newConvo, rawFull: d.rawFull, p: d.p, time: d.time })); // convo 条目追加 memory/turn

  // 回合完成登记：驱动"每 N 回合自动存档"。出错回滚的轮次不计数——
  // 状态没变，存了也是重复盘。计数收在 autosaveScheduler 模块状态（WO-06）。
  noteRoundCompleted();
}
