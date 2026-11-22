// 跑马大会·玩法动作。全部返回 {changes, logs, settle?} 由 applyResult 落盘。
// 比武与子夜打斗不走这里——走任务 pendingQuestBranch + buildQuestFoe 的切磋链路，
// 打赢后 settleNpcDuel 自动推进任务发奖，与现有分支战一致。
import { add, applyWrite } from "../../domain/rules/state/applyWrite.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { forceAdvanceQuest } from "../quest/logic.js";
import {
  contestFlag,
  companionFlag,
  nightDoneFlag,
  FESTIVAL_CONTESTS,
  FESTIVAL_COMPANIONS,
  FESTIVAL_COMPANION_FAVOR,
  MIDNIGHT_FLAG,
  MIDNIGHT_EVENTS,
} from "../../domain/data/festival/festivalData.js";
import {
  contestResult,
  isContestOpen,
  resolveBet,
  isNightTalkHour,
  isMidnightHour,
  pickMidnightEvent,
} from "../../domain/rules/festival/rules.js";
import { NIGHT_SCENES } from "../../domain/data/festival/nightScenes.js";

const noOp = () => ({ logs: [] });
const err = (text) => ({ logs: [{ t: "err", text: `  ${text}` }] });

// forceAdvanceQuest 的 changes 全是函数式更新；与本特性自己的 changes 逐键合并。
function mergeChange(changes, key, update) {
  const prev = changes[key];
  changes[key] = prev === undefined
    ? update
    : (value) => (typeof update === "function" ? update(typeof prev === "function" ? prev(value) : prev) : update);
}

function mergeChanges(changes, more) {
  for (const [key, update] of Object.entries(more || {})) mergeChange(changes, key, update);
}

// 好感度变更：走 applyWrite 拿 0-100 截断与最终值，写进 varTree 更新函数。
function favorChange(state, changes, name, delta) {
  const patched = applyWrite({ ...state, varTree: state.varTree }, add(["角色", name, "好感度"], delta));
  const finalValue = patched.finalValue;
  mergeChange(changes, "varTree", (prev) =>
    applyWrite({ ...state, varTree: prev }, add(["角色", name, "好感度"], delta)).state.varTree);
  return finalValue;
}

const dayOf = (state, dayIdx) => (dayIdx ?? Math.floor((state.time || 0) / 24));
const hourOf = (state) => (state.time || 0) % 24;

// —— 赛事参赛（跑马/射箭，比分线制；比武走 combat 不在这） ——
export function enterContest(state, contestId, dayIdx) {
  const contest = FESTIVAL_CONTESTS[contestId];
  if (!contest || !contest.statLine) return noOp();
  const day = dayOf(state, dayIdx);
  const flag = contestFlag(contestId, "enter", day);
  const flags = state.flags || [];
  if (flags.includes(flag)) return err(`今日${contest.title}已比过，明日再来。`);
  if (!isContestOpen(contest, hourOf(state))) return err(`${contest.title}未开场，候着时辰再来。`);

  const { score, win } = contestResult(state.char, contest);
  // 时辰由结算段统一 +1（settleInBackground），这里不再重复推时间。
  const changes = { flags: [...flags, flag] };
  const logs = [{
    t: "sys",
    text: `  【跑马大会·${contest.title}】你拿了 ${score} 分，魁首${contest.champion.name} ${contest.champion.score} 分${win ? "——夺魁！" : "。"}`,
  }];
  if (!win) return { changes, logs, settle: contest.loseSettle };

  const quest = QUCUO_QUESTS.find((q) => q.id === `paoma_${contestId}`);
  if (quest) mergeChanges(changes, forceAdvanceQuest(state, quest, contest.questFlag, Date.now()).changes);
  return { changes, logs, settle: contest.winSettle };
}

// —— 围观下注：每场每天一注，当场开奖 ——
export function placeBet(state, contestId, bettorName, bet, dayIdx) {
  const contest = FESTIVAL_CONTESTS[contestId];
  if (!contest) return noOp();
  if (!Number.isFinite(bet) || bet <= 0) return err("注额无效。");
  if (bet > 50) return err("庄家怕惹事，一注至多五十两。");
  if (!isContestOpen(contest, hourOf(state))) return err(`${contest.title}未开场，庄家还没支摊。`);
  const day = dayOf(state, dayIdx);
  const flag = contestFlag(contestId, "bet", day);
  const flags = state.flags || [];
  if (flags.includes(flag)) return err(`今日${contest.title}的注已下过。`);
  if (!(contest.bettors || []).some((b) => b.name === bettorName)) return noOp();
  if ((state.char?.money || 0) < bet) return err("银子不够下注。");

  const { winner, win, payout } = resolveBet(contest, bettorName, bet);
  const changes = {
    flags: [...flags, flag],
    char: { ...state.char, money: (state.char.money || 0) - bet + payout },
  };
  const logs = [{
    t: "sys",
    text: `  【下注】押「${bettorName}」${bet} 两——${winner}夺魁，${win ? `你赢了 ${payout} 两` : "注金打了水漂"}。`,
  }];
  return {
    changes, logs,
    settle: `${contest.title}散场，${winner}夺了魁${win ? "，你押对了人" : "，你押的人没能跑赢"}`,
  };
}

// —— 女伴同游：好感 ≥60，一天一人 ——
export function inviteCompanion(state, name, dayIdx) {
  const companion = FESTIVAL_COMPANIONS.find((c) => c.name === name);
  if (!companion) return noOp();
  const day = dayOf(state, dayIdx);
  const flags = state.flags || [];
  if (flags.includes(companionFlag(name, day))) return err("今日已经邀过她了。");
  if (flags.some((f) => f.startsWith(`festival_companion_${day}_`))) return err("今日已有人伴游，不能贪多。");
  const favor = Number(state.varTree?.角色?.[name]?.好感度) || 0;
  if (favor < FESTIVAL_COMPANION_FAVOR) return err(`${name}与你交情尚浅（好感 ${favor}），未必肯同游。`);

  const changes = {
    flags: [...flags, companionFlag(name, day)],
    time: (state.time || 0) + 1,
  };
  const finalValue = favorChange(state, changes, name, 5);
  const maskedNote = companion.masked ? "（她以巾纱遮面，混在人堆里）" : "";
  return {
    changes,
    logs: [
      { t: "sys", text: `  【同游】${name}应了你的邀约${maskedNote}，随你逛集市。（好感 +5 → ${finalValue}）` },
      { t: "narrator", text: `  ${name}应了你的邀约${maskedNote}。集市人挤人，她走在你半步之后，看灯、看摊、也看你。` },
    ],
  };
}


// —— 夜晚剧情：固定文本，戌亥之交（19–22时），须当日晚间已同游 ——
export function nightTogether(state, name, dayIdx) {
  const text = NIGHT_SCENES[name];
  if (!text) return noOp();
  const day = dayOf(state, dayIdx);
  const flags = state.flags || [];
  if (!isNightTalkHour(hourOf(state))) return err("夜话要等戌亥之交（十九至二十二时）。");
  if (!flags.includes(companionFlag(name, day))) return err("白日里没同游，夜里不便相寻。");
  if (flags.includes(nightDoneFlag(name, day))) return err("今夜已叙过，且让她安歇。");

  const changes = {
    flags: [...flags, nightDoneFlag(name, day)],
    time: (state.time || 0) + 1,
  };
  const finalValue = favorChange(state, changes, name, 10);
  return {
    changes,
    logs: [
      { t: "narrator", text: `  ${text}` },
      { t: "affection", text: `  💗 ${name} 好感度 +10（→ ${finalValue}）` },
    ],
  };
}

// —— 子夜之变：子时（23时）随机一事，一生只来一回 ——
export function pendingMidnightEvent(state) {
  const flags = state.flags || [];
  if (flags.includes(MIDNIGHT_FLAG)) return null;
  if (state.questProgress?.paoma_ziye?.status === "completed") return null;
  if (!isMidnightHour(hourOf(state))) return null;
  return pickMidnightEvent();
}

// 袖手旁观（避让）：直接推进 paoma_ziye 的 yield 分支。
export function resolveMidnightYield(state) {
  const flags = state.flags || [];
  const quest = QUCUO_QUESTS.find((q) => q.id === "paoma_ziye");
  if (!quest || flags.includes(MIDNIGHT_FLAG)) return noOp();
  const changes = { flags: [...flags, MIDNIGHT_FLAG] };
  mergeChanges(changes, forceAdvanceQuest(state, quest, "paoma_ziye_yield", Date.now()).changes);
  return {
    changes,
    logs: [{ t: "sys", text: "  【子夜之变】你没有出手。变故平息后，看热闹的人还在谈论谁没有露面。" }],
    settle: "子夜变故当头，你袖手旁观，写清人群散去后主角心里那点什么滋味",
  };
}

export { MIDNIGHT_EVENTS };
