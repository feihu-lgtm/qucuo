import { definePrompt } from "../prompt/registry.js";

// ── 结算·软判断 ──
// 一阶段的「选择题仲裁」：系统规则能算的都算完了，只剩一件系统算不了的事
// （对方消没消气、收没收礼、答没答应）交给模型做一道选择题。
// 与行动识别（domain/intent）同一思路：选项 + 每个选项一个概率，永远带
// 「无法判断」这一兜底项；解析失败 / AI 不在线一律落到「无法判断」，绝不抛错。

export const UNKNOWN_CHOICE = "无法判断";

const SYS = "你是游戏结算仲裁，只回答一道选择题。不写剧情、不解释，严格只输出一行JSON。";

function userText(ctx) {
  const options = (ctx.options || []).map((option) => `「${option}」`).join("、");
  const context = ctx.context ? `${ctx.context}\n` : "";
  return `${context}问题：${ctx.question}
选项：${options}
输出JSON：{"choice":"选项原文之一","probs":{"选项":概率,...}}，probs覆盖全部选项、总和为1。`;
}

// 提取文本里的第一个 JSON 对象；找不到或解析不了返回 null。
function extractJson(text) {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

function argmax(probs) {
  let best = null;
  for (const [option, p] of Object.entries(probs || {})) {
    if (best === null || p > probs[best]) best = option;
  }
  return best;
}

// 解析选择题回复：保留选项内的概率并归一化；choice 不在选项里时取概率最大者；
// 什么都读不出来时落「无法判断」。永不抛错。
export function parseJudgeAnswer(text, options = []) {
  const unknown = options.includes(UNKNOWN_CHOICE) ? UNKNOWN_CHOICE : options[options.length - 1];
  const json = extractJson(text);
  const stated = {};
  for (const [key, value] of Object.entries(json?.probs || {})) {
    const option = options.find((candidate) => candidate === String(key).replace(/[「」]/g, ""));
    const p = Number(value);
    if (option && Number.isFinite(p) && p >= 0) stated[option] = p;
  }
  const total = options.reduce((sum, option) => sum + (stated[option] || 0), 0);
  const choice = options.includes(json?.choice) ? json.choice : null;
  if (!(total > 0) && !choice) return { choice: unknown, probs: {}, parseFailed: true };
  const mass = total > 0 ? stated : { [choice]: 1 };
  const probs = Object.fromEntries(options.map((option) => [option, (mass[option] || 0) / (total > 0 ? total : 1)]));
  return { choice: argmax(probs) ?? choice ?? unknown, probs, parseFailed: false };
}

export function registerSettleCalls() {
  definePrompt("block", "settle.judge.sys", {
    label: "结算仲裁系统指令",
    slot: "sys",
    text: () => SYS,
  });

  definePrompt("block", "settle.judge.user", {
    label: "结算选择题",
    slot: "user",
    text: userText,
  });

  definePrompt("call", "settle.judge", {
    label: (ctx) => `结算仲裁（${ctx.kindLabel || ctx.kind || "?"}）`,
    tokenLimitKey: "extraction",
    defaultMaxTokens: 512,
    join: "",
    blocks: ["settle.judge.sys", "settle.judge.user"],
    // 解析不通过不视为调用失败：直接落「无法判断」，由调用方按"系统判不了"处理。
    vet: (text, ctx) => ({ ok: true, value: parseJudgeAnswer(text, ctx.options || []) }),
    offline: (ctx) => ({
      choice: UNKNOWN_CHOICE,
      probs: {},
      parseFailed: true,
      reason: "offline",
    }),
  });
}

registerSettleCalls();
