import { withAI } from "../prompt/withAI.js";
import { applyWrite } from "../state/applyWrite.js";
import { WHISPER_AFFECTION_RULES } from "../state/fields.js";
import { SOFT_RULES } from "./softRules.js";
import { UNKNOWN_CHOICE } from "./judge.js";

// ── 结算层入口 ──
// runSoftSettle 跑一次软判断：出选择题 → 判选项 → 照规则表把数值钉死。
// 产出的 deltas 走与今天 <mvu> 完全同一条校验路（applyWrite：白名单、幅度、
// 日上限、区间裁剪），只是指令由系统按选项生成、不再由叙事模型手写。

function emptyResult(kind) {
  return { kind, target: null, choice: UNKNOWN_CHOICE, probs: {}, deltas: [], rejected: [], note: "" };
}

// 校验一条 delta：varTree 路径按 mvu 规则裁（与今天提取层落账同一条路）；
// narrator.affection 不是变量树字段，走普通字段校验并先按私语尺度裁幅。
function vetDelta(state, delta, ctx) {
  const command = { ...delta };
  const isNarrator = command.path === "narrator.affection";
  if (isNarrator && command.op === "add") {
    command.value = Math.max(
      WHISPER_AFFECTION_RULES.min,
      Math.min(WHISPER_AFFECTION_RULES.max, command.value),
    );
  }
  const result = applyWrite(state, command, {
    source: isNarrator ? "settle" : "mvu",
    charm: ctx.charm,
    time: ctx.time,
    giftRange: ctx.giftRange,
  });
  if (result.reason) return { rejected: { ...command, reason: result.reason }, state };
  const applied = {
    ...command,
    finalValue: result.finalValue,
    ...(result.actualDelta == null ? {} : { actualDelta: result.actualDelta }),
  };
  return { applied, state: result.state, logs: result.logs };
}

export async function runSoftSettle({ ai, apiCfg, kind, ctx = {} } = {}) {
  const rule = SOFT_RULES[kind];
  if (!rule) return emptyResult(kind);
  const target = rule.target(ctx) || null;

  // 「无法判断」永远占一个选项；规则表里写的具体选项放前面。
  const options = [...new Set([...(rule.options(ctx) || []), UNKNOWN_CHOICE])];
  const res = await withAI(
    "settle.judge",
    { ...ctx, kind, kindLabel: rule.label, question: rule.question(ctx), options },
    { ai, apiCfg, throwOnError: false },
  );

  const data = res?.data || {};
  const choice = options.includes(data.choice) ? data.choice : UNKNOWN_CHOICE;
  const probs = data.probs || {};

  const result = { kind, target, choice, probs, deltas: [], rejected: [], note: "" };
  let state = { varTree: ctx.varTree || {}, narrator: ctx.narrator || {} };
  for (const delta of rule.deltas(choice, ctx) || []) {
    const vetted = vetDelta(state, delta, ctx);
    state = vetted.state;
    if (vetted.applied) result.deltas.push(vetted.applied);
    if (vetted.rejected) result.rejected.push(vetted.rejected);
  }
  result.note = choice === UNKNOWN_CHOICE && !result.deltas.length
    ? `${target || rule.label}这轮判不了，按没有变化处理`
    : rule.note(choice, ctx, result.deltas);
  return result;
}

// 给叙事层的一句话结算说明：主模型只照这个结果写散文，不许再编数值。
export function formatSettleNote(result) {
  if (!result || !result.note) return "";
  return `\n[系统结算] ${result.note}。以上数值是系统裁决，请照此叙事，不得更改或补写其他状态变化。`;
}
