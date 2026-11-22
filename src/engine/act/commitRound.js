import { step as traceStep } from "../ports/actionTrace.js";
import { applyMvuCommands } from "../../domain/rules/prompt/mvu.js";
import { formatAngerResolutionLog, resolveAngerSignals } from "../../domain/rules/combat/stealSystem.js";
import { applyKnowledgeTreeDiff } from "../../domain/rules/prompt/knowledge.js";
import { commitProposalWrites } from "./commitProposalWrites.js";
import { commitModelFlags } from "./commitFlags.js";
import { filterGhostCommands } from "./commitHelpers.js";
import { settleDeal } from "./postCommit/dealSettle.js";
import { emitNarrative } from "./postCommit/narrative.js";
import { recordRumors } from "./postCommit/rumors.js";
import { fixateNpcs } from "./postCommit/npcFixation.js";
import { materializeEmergence } from "./postCommit/emergence.js";
import { emitRoomHeader, writeRoom } from "./postCommit/roomWrite.js";
import { emitChoices } from "./postCommit/choices.js";
import { writeMemoryNote } from "./postCommit/memoryNote.js";
import { registerMemoryFact } from "./postCommit/memoryFact.js";
import { markTalkAcquaintance } from "./postCommit/talkKnow.js";
import { appendConvo } from "./postCommit/convoAppend.js";
import { applyPostResult } from "./postCommit/applyPostResult.js";

// 两阶段 pipeline 的提交段：把本轮解析结果（d.p / d.mvuCommands / d.dealResult）
// 写回世界状态；提交失败由 playTurn 还原事务快照。
// 结构：主函数只做「校验/裁决 + 统一落盘」这一个事务（knowledge 差分、
// 幽灵指令过滤、软结算/赠礼拦截、MVU 应用含消气消解、时间推进、回合登记）；
// 其余每类后置处理按原顺序委托给 postCommit/ 下的一文件一职责模块，
// 入参/时机/副作用与拆分前逐行等价。
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

  // ── postCommit 处理器链：与拆分前同序执行 ──
  // 纯函数化处理器（返回 { logs | delayedLogs, changes, refWrites }）统一经
  // applyPostResult 落盘；未改造的仍收整个 d。
  const postCtx = {
    systemAcceptedNames,
    luck: d.char.special?.气运 ?? 5,
  };
  applyPostResult(d, settleDeal({ dealResult: d.dealResult, gambleTalkCtx: d.gambleTalkCtx })); // 赌石谈价结算
  emitRoomHeader(d);                // 移动落地的地名标题，排在正文之前
  applyPostResult(d, emitNarrative({ p: d.p, questProgress: d.questProgress })); // 台本覆盖/切磋战报/正文/截断提示
  applyPostResult(d, recordRumors({ p: d.p, narrativeText: d.narrativeText })); // 涌现·传闻登记
  applyPostResult(d, fixateNpcs({    // 在场名单幽灵过滤+战斗数据固化+新面孔/重逢
    p: d.p, room: d.room, innerRoomName: d.innerRoomName, narrativeText: d.narrativeText,
    varTree: d.varTreeRef.current, time: d.time,
    systemAcceptedNames: postCtx.systemAcceptedNames, luck: postCtx.luck,
  }));
  applyPostResult(d, materializeEmergence({ p: d.p, luck: postCtx.luck })); // 涌现·实体化
  writeRoom(d, { traceStep });      // 房间写回（锁定目的地/固定地图/兜底）
  applyPostResult(d, commitProposalWrites({ // AI 提议落盘：char/dao/物品/经验/潜能/技能
    p: d.p, isTalk: d.isTalk, giftAlreadySettled: d.giftAlreadySettled,
    preserveHp: d.preserveHp, gm: d.gm,
    pickupJudgment: d.pickupJudgmentRef.current, collectGranted: d.collectGrantedRef.current,
    pickupExtractionFailed: d.pickupExtractionFailedRef.current,
  }, { trace: (...args) => traceStep(d._trace, ...args) }));
  applyPostResult(d, commitModelFlags({  // flags_add 过滤落盘（原 commitProposalWrites 尾部内嵌）
    p: d.p, room: d.room, innerRoomName: d.innerRoomName,
    questProgress: d.questProgress, pendingQuestBranch: d.pendingQuestBranch,
  }));
  applyPostResult(d, emitChoices({ choices: d.p.choices })); // 选项延时浮现
  if (!d.isTalk) d.setTime(t => t + 1);
  applyPostResult(d, writeMemoryNote({ // 小纸条·向量写入
    p: d.p, apiCfg: d.apiCfg, room: d.room, activeTarget: d.activeTarget,
    isTalk: d.isTalk, talkTarget: d.talkTarget, time: d.time, varTree: d.varTreeRef.current,
  }));
  applyPostResult(d, registerMemoryFact({ // memory → 可传播事实账本
    p: d.p, room: d.room, activeTarget: d.activeTarget,
    isTalk: d.isTalk, talkTarget: d.talkTarget, time: d.time,
  }));
  applyPostResult(d, markTalkAcquaintance({ isTalk: d.isTalk, talkTarget: d.talkTarget, room: d.room, p: d.p })); // 对话即认识
  applyPostResult(d, appendConvo({ newConvo: d.newConvo, rawFull: d.rawFull, p: d.p, time: d.time })); // convo 条目追加 memory/turn

  // 回合完成登记：驱动"每 N 回合自动存档"。出错回滚的轮次不计数——
  // 状态没变，存了也是重复盘。
  d.roundsSinceLastSaveRef.current += 1;
  d.playedThisSessionRef.current = true;
}
