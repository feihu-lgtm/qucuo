// 条件步骤：识别「要是/如果/若/万一 …就/便」从句，把前提挂到紧跟的动作上作 condition。
// on 是封闭集合：遇敌=encounter、到达=arrive、被拒=refused；
// 判成「其他」或从句缺尾巴 → 该段不走识别，按原文回落到自由行动路径。
// 与其他识别问题同一风格：一次只问一件事，选项固定，模型只回 choice + probs。
export const CONDITION_ON = Object.freeze({ ENCOUNTER: "encounter", ARRIVE: "arrive", REFUSED: "refused" });

// 问模型的选项（固定顺序）；「其他」表示前提不在封闭集合里。
const CONDITION_OPTIONS = Object.freeze(["遇敌", "到达", "被拒", "其他"]);

const OPTION_ON = Object.freeze({
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
  return { detail, actionText };
}

// 判定前提属于哪类触发；返回 { on, detail }，「其他」/解析失败 → null（该段回落自由行动）。
export async function resolveCondition(detail, classifier, onStage, timed) {
  const result = await timed(onStage, "识别·条件", () => classifier.decide("cond", { text: detail }, [...CONDITION_OPTIONS]));
  const on = OPTION_ON[result.choice] || null;
  return { on, probs: result.probs, confidence: result.probs[result.choice] ?? 0 };
}
