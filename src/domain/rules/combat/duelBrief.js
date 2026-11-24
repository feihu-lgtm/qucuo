// 切磋战报 · 简报形态（系统一行事实 + AI 一两句描写，结局一句）
//
// 系统那一行只写算死的事实：招式名、伤害、状态，不写任何描写，所以不会出现
// 「打的是拳、写成双刀」这种出戏。描写交给 AI 在后台补写：系统行先落日志、
// 玩家立刻可以继续行动（刷级不用等），AI 写完再按 duelKey 原位插到对应的
// 系统行下面；AI 没配或失败时改用短语池拼句兜底；期间玩家回滚就只留系统行。插回走 log/backfill.js 公共件。

import { tagBackfill } from "../log/backfill.js";

const sideName = (round, tag) => round?.result?.[`name${tag}`] || (tag === "A" ? "你" : "对手");
const moveName = (round, tag) => (tag === "A" ? round?.playerMove?.name : round?.npcMove?.name)
  || round?.result?.[`moveName${tag}`] || "";
const num = (value) => Number(value) || 0;
const hpLeft = (hp) => {
  const value = Array.isArray(hp) ? hp[0] : hp;
  return value == null ? null : Math.max(0, Number(value) || 0);
};

// 一回合的事实行：「第1回合 野球拳对回气，老孙−92」
export function duelFactLine(round) {
  const n = round?.round ?? "?";
  if (Array.isArray(round?.teamLines)) {
    // 团战每一击的事实行（招式、谁受创多少）就在 teamText 里，原样给出；只写"某某吃亏"
    // 会让说书人既拿不到招式名，也不知道谁倒下，只好自己编，结局还对不上前面的回合。
    const texts = round.teamLines.map((entry) => String(entry.teamText || entry.text || "").trim()).filter(Boolean);
    const fallen = [...new Set(round.teamLines.flatMap((entry) => ["A", "B"]
      .filter((tag) => hpLeft(entry.result?.[`hpAfter${tag}`]) === 0)
      .map((tag) => entry.result?.[`name${tag}`])
      .filter(Boolean)))];
    if (!texts.length) return `第${n}回合 团战交锋${fallen.length ? `，${fallen.join("、")}倒下` : ""}`;
    return `第${n}回合 ${texts.join("")}${fallen.length ? `${fallen.join("、")}倒下。` : ""}`;
  }
  const result = round?.result || {};
  const moves = [moveName(round, "A"), moveName(round, "B")].filter(Boolean);
  const head = moves.length === 2 ? `${moves[0]}对${moves[1]}` : moves[0] || "过招";
  const facts = [];
  for (const tag of ["A", "B"]) {
    const hit = num(result[`damageTo${tag}`]) + num(result[`statusDamage${tag}`]);
    if (hit > 0) facts.push(`${sideName(round, tag)}−${hit}`);
    const heal = num(result[`hpRestore${tag}`]);
    if (heal > 0) facts.push(`${sideName(round, tag)}+${heal}`);
    const status = result[`statusAppliedTo${tag}`];
    const statusName = typeof status === "string" ? status : status?.name;
    if (statusName) facts.push(`${sideName(round, tag)}中「${statusName}」`);
  }
  return `第${n}回合 ${head}，${facts.length ? facts.join("，") : "未分高下"}`;
}

export const DUEL_END_SLOT = "end";

export function duelFactLogs(rounds, key, outcomeText) {
  const list = Array.isArray(rounds) ? rounds : [];
  return tagBackfill([
    ...list.map((round) => ({ t: "sys", text: `  ${duelFactLine(round)}` })),
    { t: "sys", text: `  结局 ${outcomeText || "切磋作罢"}`, fillSlot: DUEL_END_SLOT },
  ], key);
}

// 给 AI 的数据：只列事实，要求每回合一两句、结局一段（交代收势作结），输出 JSON
export function buildDuelNarrationPrompt(rounds, { outcomeText = "", place = "", aftermath = "", summary = false } = {}) {
  const list = Array.isArray(rounds) ? rounds : [];
  const sys = `你是曲措乡的说书人。下面是一场切磋已经由系统算好的逐回合结果。
你的任务是给每回合各写一到两句描写（每回合不超过四十字），再给整场写一段结局（不超过八十字），交代双方如何收势作结、场面落回日常。
铁律：招式名、谁伤了谁、伤多少、谁中了什么状态，一律照抄给定事实，不改判、不补造回合、不写数字以外的新战果；
兵器和招式的样子要贴着招式名写，拳法就写拳，不要换成刀剑；白话古文的说书人口吻，句子完整，不用冒号破折号。
${aftermath ? "末尾另附「收尾」梗概：结局段把它写成完整的收尾描写，交代这件事怎么作结、主角怎么回归，梗概里的事实照抄不另造。" : ""}
${summary ? "另给整场写一句客观概述（不超过三十字，白话古文，只陈述谁和谁切磋、胜负如何），记作 summary。\n" : ""}只输出一个 JSON 对象，不要任何前后缀：{"rounds":["第1回合的描写", …共${list.length}条],"ending":"结局一段"${summary ? ',"summary":"一句话概述"' : ""}}`;
  const user = [
    place ? `地点：${place}` : "",
    ...list.map((round) => duelFactLine(round)),
    `结局：${outcomeText || "未分胜负"}`,
    aftermath ? `收尾：${aftermath}` : "",
  ].filter(Boolean).join("\n");
  return { sys, user };
}

export function parseDuelNarration(text, roundCount) {
  if (typeof text !== "string" || !text.trim()) return null;
  const body = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data;
  try {
    data = JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
  const rounds = Array.isArray(data?.rounds) ? data.rounds.map((line) => String(line ?? "").trim()) : [];
  const ending = typeof data?.ending === "string" ? data.ending.trim() : "";
  if (!rounds.some(Boolean) && !ending) return null;
  const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
  return { rounds: rounds.slice(0, Math.max(0, Number(roundCount) || 0)), ending, summary };
}

// 无 API 或 AI 失败时的兜底描写：用短语池按招式拼好的句子（buildDuelReportRounds 的 text）
export function phraseNarration(rounds) {
  const lines = (Array.isArray(rounds) ? rounds : []).map((round) => String(round?.text ?? "").trim());
  return lines.some(Boolean) ? { rounds: lines, ending: "" } : null;
}

// 解析结果转成 backfill 的 slot → 描写：回合按下标，结局用 DUEL_END_SLOT
export function duelNarrationSlots(narration) {
  if (!narration) return null;
  return { ...(narration.rounds || []), [DUEL_END_SLOT]: narration.ending };
}
