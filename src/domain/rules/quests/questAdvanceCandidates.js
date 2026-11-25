// B1 任务推进扩展律·自然推进候选生成器（纯函数）。
// 口径与 roundNotes 的任务阶段提示完全对齐：只有系统现场生成的候选才允许
// 进 intake 材料——小模型只能挑候选，绝不能自编 flag（judgeTurn 再白名单核验）。
//   active 阶段：须在其地（atStagePlace）+ deliver 收件人在场 + 交付物在包 + collect 齐件；
//   未开启任务：首阶段有地点锚点或 giver 在场且 gate open；
//   有 choices 的阶段默认不候选（任务面板/说服/决斗确定性通道接管），
//   除非 questTriggerMode==="script" 且非全战斗（旧 script 通道的系统内替代）；
//   localOnly / 雪豹排除——前者有专属 feature，后者 resolveSnowInteraction 确定性发旗。
import { QUCUO_QUESTS } from "../../data/quests/qucuoQuests.js";
import { getCurrentStage, isQuestGateOpen, canBypassExclusive } from "./questEngine.js";
import { isNpcVisibleInInnerRoom } from "../map/innerMap.js";

const atStagePlace = (stage, room, innerRoomName) => {
  const rl = stage?.requireLocation;
  if (!rl) return true;
  if (rl.district && room?.name !== rl.district) return false;
  if (rl.inner && innerRoomName !== rl.inner) return false;
  return true;
};

const allCombat = (stage) => stage.choices.every((choice) => choice.resolve === "combat" && choice.combatNpc);

const itemInHand = (inv, wanted) => (inv || []).some((entry) => {
  const n = typeof entry === "string" ? entry : entry?.name;
  return !!n && (n === wanted || n.includes(wanted) || wanted.includes(n));
});

function flagList(completionFlag) {
  if (Array.isArray(completionFlag)) return completionFlag.filter(Boolean);
  return completionFlag ? [completionFlag] : [];
}

function stageCandidates(quest, stage, { room, inv, innerRoomName, questTriggerMode }) {
  if (!stage) return [];
  // deliver 闸：收件人须此刻在场（过内层可见性），交付件须真在包里
  const deliver = stage.deliver;
  if (deliver) {
    const recipientHere = (room?.npcs || []).some(
      (n) => n.name === deliver.to && isNpcVisibleInInnerRoom(room?.name, innerRoomName, n),
    );
    if (!recipientHere || !itemInHand(inv, deliver.item)) return [];
  }
  // collect 闸：采集物齐件才候选
  const collectReqs = stage.collect ? (Array.isArray(stage.collect) ? stage.collect : [stage.collect]) : [];
  if (collectReqs.some((c) => c?.item && !itemInHand(inv, c.item))) return [];
  if (!atStagePlace(stage, room, innerRoomName)) return [];
  // choices 阶段：面板/说服/决斗确定性通道接管，不候选；
  // script 模式例外——非全战斗阶段保持旧「抉择走叙事」通道的系统内替代。
  if (stage.choices?.length && (questTriggerMode !== "script" || allCombat(stage))) return [];
  return flagList(stage.completionFlag).map((flag) => ({
    questId: quest.id,
    flag,
    title: quest.title,
    stageBrief: String(stage.description || "").slice(0, 40),
  }));
}

export function questAdvanceCandidates({
  questProgress = {}, flags = [], varTree = {}, char = {}, room = {}, inv = [],
  innerRoomName = null, questTriggerMode = "prompt", quests = QUCUO_QUESTS,
} = {}) {
  const out = [];
  for (const quest of quests) {
    if (!quest.stages?.length || quest.localOnly || quest.id === "snow_leopard_quest") continue;
    const prog = questProgress[quest.id];
    if (prog?.status === "locked_by_exclusive" || prog?.status === "completed") continue;
    if (!isQuestGateOpen(quest, questProgress, flags, varTree)) continue;
    if (quest.id === "hidden_all_collect_line" && !canBypassExclusive({ char, flags })) continue;
    const ctx = { room, inv, innerRoomName, questTriggerMode };
    if (prog?.status === "active") {
      out.push(...stageCandidates(quest, getCurrentStage(quest, prog), ctx));
    } else {
      // 未开启：首阶段须有地点锚点或 giver 在场（与 roundNotes 同口径）
      const first = quest.stages[0];
      const needsGiver = first.giver !== null && quest.giver;
      const anchored = !!first.requireLocation;
      const giverHere = !needsGiver || (room?.npcs || []).some((n) => n.name === quest.giver);
      if ((anchored || needsGiver) && giverHere && atStagePlace(first, room, innerRoomName)) {
        out.push(...stageCandidates(quest, first, ctx));
      }
    }
  }
  return out;
}
