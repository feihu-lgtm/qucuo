// B1 任务推进扩展律·自然推进候选生成器（纯函数）。
// 口径与 roundNotes 的任务阶段提示完全对齐：只有系统现场生成的候选才允许
// 进 intake 材料——小模型只能挑候选，绝不能自编 flag（judgeTurn 再白名单核验）。
//   active 阶段：须在其地（atStagePlace）+ deliver 收件人在场 + 交付物在包 + collect 齐件；
//   未开启任务：首阶段有地点锚点或 giver 在场且 gate open；
//   有 choices 的阶段默认不候选（任务面板/说服/决斗确定性通道接管），
//   除非 questTriggerMode==="script" 且非全战斗（旧 script 通道的系统内替代）；
//   localOnly / 雪豹排除——前者有专属 feature，后者 resolveSnowInteraction 确定性发旗。
import { QUCUO_QUESTS } from "../../data/quests/qucuoQuests.js";
import { getCurrentStage, isChoiceOpen, isQuestGateOpen, canBypassExclusive } from "./questEngine.js";
import { isNpcVisibleInInnerRoom } from "../map/innerMap.js";
import { isAtQuestPlace } from "./questPlace.js";

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

function stageCandidates(quest, stage, { room, inv, innerRoomName, questTriggerMode, flags = [] }) {
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
  // 混合分支防线：combat 抉择的 flag 永不进候选——即便 script 模式混合阶段，
  // 战斗分支也必须真打（面板决斗通道），intake 选了也不能无战斗白捡战斗奖励。
  const combatFlags = new Set((stage.choices || [])
    .filter((choice) => choice.resolve === "combat" && choice.combatNpc)
    .map((choice) => choice.flag));
  // 分支前提门槛：choice 自带的前置条件（requiresFlags 等）未满足时该分支旗不进候选——
  // questEngine advanceQuestStages 本来就用 isChoiceOpen 拒收关门分支，候选不能先漏出去。
  const closedFlags = new Set((stage.choices || [])
    .filter((choice) => choice.flag && !isChoiceOpen(choice, flags))
    .map((choice) => choice.flag));
  return flagList(stage.completionFlag)
    .filter((flag) => !combatFlags.has(flag) && !closedFlags.has(flag))
    .map((flag) => ({
      questId: quest.id,
      flag,
      title: quest.title,
      // WO-16E 因果授信：末阶段推进=支线高潮（climax），供 budgetInput 核定额度
      isFinalStage: quest.stages[quest.stages.length - 1] === stage,
      stageBrief: String(stage.description || "").slice(0, 40),
      // deliver 元数据供判官去重：交付回合若 intake 同时报 give，
      // 赠礼转移必须与任务交付通道互斥，否则双扣件+虚假好感
      ...(stage.deliver ? { deliver: { to: stage.deliver.to, item: stage.deliver.item } } : {}),
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
    const ctx = { room, inv, innerRoomName, questTriggerMode, flags };
    if (prog?.status === "active") {
      out.push(...stageCandidates(quest, getCurrentStage(quest, prog), ctx));
    } else {
      // 未开启首阶段的「这里」判定与任务面板（useGameUi）同源：
      //   requireLocation 存在 → 只看地点不看 giver——giver 不在场玩家也要能撞上该撞的事；
      //   无锚点有 giver → giver 在场（过内层可见性）；
      //   无锚点无 giver → stage.at 地点判定。
      // roundNotes 旧 needsGiver/giverHere 口径（有 giver 就要 giver 在场）与面板矛盾，已同源修正。
      const first = quest.stages[0];
      const rl = first.requireLocation;
      // deliver 收件人在场也算「这里」（面板同口径）——不然 ❢/候选只在发布人身边出现，
      // 真正该交付的地方反而开不了（村2 糌粑→老孙饭馆在 script/自然触发下白跑）。
      const deliverHere = !!first.deliver?.to && (room?.npcs || []).some(
        (n) => n.name === first.deliver.to && isNpcVisibleInInnerRoom(room?.name, innerRoomName, n),
      );
      const here = rl
        ? atStagePlace(first, room, innerRoomName)
        : quest.giver
          ? (room?.npcs || []).some((n) => n.name === quest.giver && isNpcVisibleInInnerRoom(room?.name, innerRoomName, n)) || deliverHere
          : isAtQuestPlace(first.at, room?.name, innerRoomName) || deliverHere;
      if (here) {
        out.push(...stageCandidates(quest, first, ctx));
      }
    }
  }
  return out;
}
