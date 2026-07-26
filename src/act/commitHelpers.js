import { QUCUO_QUESTS } from "../quests/qucuoQuests.js";
import { getQuestScript } from "../quests/questScripts.js";

// 好感度反幽灵过滤：AI 若对一个"既不在系统在场名单、也不在已知角色表"里的
// 名字开好感度（开局旁白顺口报的假村民就是这样），把这条 MVU 指令丢掉——
// 不建角色节点、不刷好感度、不打 💗 字幕。真实在场者与历史已知角色不受影响。
export function filterGhostCommands(mvuCommands, systemAcceptedNames, knownChars) {
  if (!mvuCommands.length) return mvuCommands;
  return mvuCommands.filter(cmd => {
    const m = /^角色\.([^.]+)\.好感度$/.exec(cmd.path || "");
    if (!m) return true; // 非好感度指令，放行
    const who = m[1];
    if (systemAcceptedNames.has(who) || knownChars.has(who)) return true;
    console.warn(`[反幽灵] 忽略对非在场/未知角色「${who}」的好感度指令`);
    return false;
  });
}

// 固定台本夺舍判定：AI 依然承担"判断玩家这轮行为是否达成了某个任务节点"这件事
// （通过一如既往地在 delta.flags_add 里吐出对应的 completionFlag），但一旦判定命中
// 的这个节点在 questScripts.js 里登记了固定台本，这一轮展示给玩家的文字就不再用
// AI自己写的 p.output，而是原样展示设计文档里的完整原文——AI 这一轮的"生成"实际
// 上只被当作触发判定用，生成的正文本身被完全丢弃不展示。只要命中，就整体替换
// （不跟AI的 output 拼接），避免AI现场编的文字和固定台本的文风混在一起显得突兀。
// 一次AI返回可能同时命中好几个stage的flag（理论上少见，但为免遗漏，
// 按 QUCUO_QUESTS 顺序找到第一个命中的即可，不叠加展示多段台本）。
export function findScriptOverride(thisTurnFlags, questProgress) {
  if (!thisTurnFlags.length) return null;
  outer: for (const quest of QUCUO_QUESTS) {
    if (!quest.stages?.length) continue;
    const prog = questProgress[quest.id];
    // 只在这个任务确实"活跃"（已经开始、还没完成/锁定）时才检查，
    // 避免玩家复述过去已经完成的flag文字时被误判重新触发一次台本
    if (prog && prog.status !== "active") continue;
    const stageIndex = prog?.currentStageIndex ?? 0;
    const stage = quest.stages[stageIndex];
    if (!stage) continue;
    const candidateFlags = Array.isArray(stage.completionFlag) ? stage.completionFlag : [stage.completionFlag];
    const hitFlags = candidateFlags.filter(f => thisTurnFlags.includes(f));
    if (!hitFlags.length) continue;
    const script = getQuestScript(quest.id, stage.id, hitFlags);
    if (script) return script;
  }
  return null;
}
