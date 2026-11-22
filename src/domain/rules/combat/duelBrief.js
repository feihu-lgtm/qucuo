// 切磋战报 · 简报形态（系统一行事实 + AI 一两句描写，结局一句）
//
// 系统那一行只写算死的事实：招式名、伤害、状态，不写任何描写，所以不会出现
// 「打的是拳、写成双刀」这种出戏。描写交给 AI 在后台补写：系统行先落日志、
// 玩家立刻可以继续行动（刷级不用等），AI 写完再按 duelKey 原位插到对应的
// 系统行下面；AI 没配、失败、或期间玩家回滚，就只留系统行。

const sideName = (round, tag) => round?.result?.[`name${tag}`] || (tag === "A" ? "你" : "对手");
const moveName = (round, tag) => (tag === "A" ? round?.playerMove?.name : round?.npcMove?.name)
  || round?.result?.[`moveName${tag}`] || "";
const num = (value) => Number(value) || 0;

// 一回合的事实行：「第1回合 野球拳对回气，老孙−92」
export function duelFactLine(round) {
  const n = round?.round ?? "?";
  if (Array.isArray(round?.teamLines)) {
    const worse = [...new Set(round.teamLines.map((entry) => entry.result?.worseName).filter((name) => name && name !== "平手"))];
    return `第${n}回合 团战交锋${worse.length ? `，${worse.join("、")}吃亏` : ""}`;
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

export function duelFactLogs(rounds, key, outcomeText) {
  const list = Array.isArray(rounds) ? rounds : [];
  return [
    ...list.map((round, index) => ({ t: "sys", text: `  ${duelFactLine(round)}`, duelKey: key, duelRound: index })),
    { t: "sys", text: `  结局 ${outcomeText || "切磋作罢"}`, duelKey: key, duelEnd: true },
  ];
}

// 给 AI 的数据：只列事实，要求每回合一两句、结局一句，输出 JSON
export function buildDuelNarrationPrompt(rounds, { outcomeText = "", place = "" } = {}) {
  const list = Array.isArray(rounds) ? rounds : [];
  const sys = `你是曲措乡的说书人。下面是一场切磋已经由系统算好的逐回合结果。
你的任务是给每回合各写一到两句描写（每回合不超过四十字），再给整场写一句结局（不超过三十字）。
铁律：招式名、谁伤了谁、伤多少、谁中了什么状态，一律照抄给定事实，不改判、不补造回合、不写数字以外的新战果；
兵器和招式的样子要贴着招式名写，拳法就写拳，不要换成刀剑；白话古文的说书人口吻，句子完整，不用冒号破折号。
只输出一个 JSON 对象，不要任何前后缀：{"rounds":["第1回合的描写", …共${list.length}条],"ending":"结局一句"}`;
  const user = [
    place ? `地点：${place}` : "",
    ...list.map((round) => duelFactLine(round)),
    `结局：${outcomeText || "未分胜负"}`,
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
  return { rounds: rounds.slice(0, Math.max(0, Number(roundCount) || 0)), ending };
}

// 把描写原位插到对应系统行下面；找不到这场（已回滚）就原样返回
export function insertDuelNarration(log, key, narration) {
  if (!Array.isArray(log) || !narration || !log.some((entry) => entry?.duelKey === key)) return log;
  const next = [];
  for (const entry of log) {
    next.push(entry);
    if (entry?.duelKey !== key) continue;
    const line = entry.duelEnd ? narration.ending : narration.rounds?.[entry.duelRound];
    if (line) next.push({ t: "desc", text: `  ${line}`, duelKey: key, duelProse: true });
  }
  return next;
}
