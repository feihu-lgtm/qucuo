// 跑马大会·判定规则（纯函数，不写状态）。
import { random } from "../../../utils/rng.js";
import {
  FESTIVAL_CONTESTS,
  FESTIVAL_COMPANIONS,
  FESTIVAL_COMPANION_FAVOR,
  MIDNIGHT_EVENTS,
} from "../../data/festival/festivalData.js";

// 赛事窗口判定：contest.window = [起, 讫]（含起不含讫），unit = state.time（时）。
export function isContestOpen(contest, hour) {
  if (!contest || !Array.isArray(contest.window)) return false;
  return hour >= contest.window[0] && hour < contest.window[1];
}

// 参赛比分：七维加权和 + 运气浮动，满分约 100，对得上「门槛不超过 100」。
export function contestScore(char, contest) {
  const special = char?.special || {};
  let base = 0;
  for (const [key, weight] of Object.entries(contest.statLine || {})) {
    base += (Number(special[key]) || 0) * weight;
  }
  return Math.min(100, Math.round(base + random() * (contest.rollMax || 0)));
}

export function contestResult(char, contest) {
  const score = contestScore(char, contest);
  return { score, win: score > (contest.champion?.score ?? Infinity) };
}

// 下注开奖：按权重抽赢家，押中得 bet*odds。
export function pickBetWinner(contest) {
  const bettors = contest.bettors || [];
  const total = bettors.reduce((s, b) => s + b.weight, 0);
  let roll = random() * total;
  for (const b of bettors) {
    roll -= b.weight;
    if (roll <= 0) return b;
  }
  return bettors[bettors.length - 1];
}

export function resolveBet(contest, pickedName, bet) {
  const winner = pickBetWinner(contest);
  const win = winner.name === pickedName;
  const pick = (contest.bettors || []).find((b) => b.name === pickedName);
  return {
    winner: winner.name,
    win,
    payout: win ? Math.round(bet * (pick?.odds || 1)) : 0,
  };
}

// 女伴同游候选：好感 ≥ 60（好感度在 varTree.角色 下）；返回 { name, masked, note, favor, ok }。
export function companionCandidates(varTree) {
  const chars = varTree?.角色 || {};
  return FESTIVAL_COMPANIONS.map((c) => {
    const favor = Number(chars[c.name]?.["好感度"]) || 0;
    return { ...c, favor, ok: favor >= FESTIVAL_COMPANION_FAVOR };
  });
}

// 夜晚剧情窗口：戌亥之交，19–22 时。
export function isNightTalkHour(hour) {
  return hour >= 19 && hour <= 22;
}

// 子夜窗口：23 时。
export function isMidnightHour(hour) {
  return hour === 23;
}

// 子夜之变：三选一随机事件。
export function pickMidnightEvent() {
  const ids = Object.keys(MIDNIGHT_EVENTS);
  const id = ids[Math.floor(random() * ids.length)];
  return MIDNIGHT_EVENTS[id];
}
