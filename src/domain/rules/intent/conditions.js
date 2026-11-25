// 条件步骤：识别「要是/如果/若/万一 …就/便」从句，把前提挂到紧跟的动作上作 condition。
// on 是封闭集合：遇敌=encounter、到达=arrive、被拒=refused；
// 前提在集合之外（天气、心情等）→ 该段不走识别，按原文回落到自由行动路径。
// 前提类别由整句识别那一次调用一并给出（见 recognizer.js），这里只放封闭集合与本地从句拆分。
export const CONDITION_ON = Object.freeze({ ENCOUNTER: "encounter", ARRIVE: "arrive", REFUSED: "refused" });

// 模型可选的前提类别（固定顺序）；「其他」表示前提不在封闭集合里，没有前提时模型填「无」。
export const CONDITION_OTHER = "其他";
export const CONDITION_LABELS = Object.freeze({
  遇敌: CONDITION_ON.ENCOUNTER,
  到达: CONDITION_ON.ARRIVE,
  被拒: CONDITION_ON.REFUSED,
});

// 「路上要是碰到山贼就打」→ 前提「路上碰到山贼」+ 动作「打」。
// 从句必须带「就/便」收尾，否则只是普通句子（如「如果你不想打，那就算了」）。
const CLAUSE = /(要是|如果|若|万一)(.+?)[，,]?\s*(?:就|便)(.*)/;

export function splitConditionClause(text) {
  const match = String(text || "").match(CLAUSE);
  if (!match) return null;
  const prefix = String(text).slice(0, match.index).replace(/[，,。；;、\s]+$/, "");
  const detail = `${prefix}${match[2].trim()}`;
  const actionText = match[3].trim();
  if (!detail || !actionText) return null;
  return { detail, actionText, prefix };
}
