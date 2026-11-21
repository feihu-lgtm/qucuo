import { withAI } from "../prompt/withAI.js";
import { applyWrite } from "../state/applyWrite.js";
import { WHISPER_AFFECTION_RULES, giftRange } from "../state/fields.js";
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
function vetDelta(state, delta, ctx, extra = {}) {
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
    ...extra,
  });
  if (result.reason) return { rejected: { ...command, reason: result.reason }, state };
  const applied = {
    ...command,
    finalValue: result.finalValue,
    ...(result.actualDelta == null ? {} : { actualDelta: result.actualDelta }),
  };
  return { applied, state: result.state, logs: result.logs };
}

// 旁白好感与 NPC 好感同吃"日上限"账本（世界.好感日增["旁白"]，usePrivateTalk 现状）。
// 结算层照抄这条：正向增量按当日剩余额度裁，并把账本一起写进 deltas。
function narratorDailyDelta(state, value, ctx) {
  if (value <= 0) return { value, ledger: null };
  const dayStamp = Math.floor((Number(ctx.time) || 0) / 24);
  const last = state.varTree?.世界?.好感日增;
  const gained = last?.dayStamp === dayStamp ? { ...(last.gained || {}) } : {};
  const already = Number(gained["旁白"]) || 0;
  const value2 = Math.min(value, Math.max(0, WHISPER_AFFECTION_RULES.daily - already));
  if (value2 <= 0) return { value: 0, ledger: null };
  gained["旁白"] = already + value2;
  return { value: value2, ledger: { dayStamp, gained } };
}

export async function runSoftSettle({ ai, apiCfg, kind, ctx = {} } = {}) {
  const rule = SOFT_RULES[kind];
  if (!rule) return { ...emptyResult(kind), varTree: ctx.varTree || {} };
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
    // 送礼的好感区间跟今天一样喂给 applyWrite（commitRound.js:60 的 giftRange），
    // 魅力加成不能把它顶出区间；旁白好感先过日上限账本。
    const extra = {};
    if (kind === "gift") {
      const info = ctx.giftInfo || {};
      // 调用方显式给的区间优先，其次分量档、info.range、品阶档
      extra.giftRange = ctx.giftRange ?? info.weight?.range ?? info.range
        ?? (info.quality ? giftRange(info.quality) : undefined);
    }
    let command = delta;
    if (delta.path === "narrator.affection" && delta.op === "add") {
      const daily = narratorDailyDelta(state, delta.value, ctx);
      if (daily.value <= 0 && delta.value > 0) continue; // 今日额度已满，不加也不写账
      command = { ...delta, value: daily.value };
      if (daily.ledger) {
        // 账本写入是系统记账不是 AI 提议，不走 mvu 白名单
        const ledgerWrite = vetDelta(state, { path: "世界.好感日增", op: "set", value: daily.ledger }, ctx, { source: "settle" });
        state = ledgerWrite.state;
        if (ledgerWrite.applied) result.deltas.push(ledgerWrite.applied);
        if (ledgerWrite.rejected) result.rejected.push(ledgerWrite.rejected);
      }
    }
    const previousDailyLedger = state.varTree?.世界?.好感日增;
    const vetted = vetDelta(state, command, ctx, extra);
    state = vetted.state;
    if (vetted.applied) result.deltas.push(vetted.applied);
    const nextDailyLedger = state.varTree?.世界?.好感日增;
    if (vetted.applied && command.op === "add"
      && command.path.startsWith("角色.") && command.path.endsWith(".好感度")
      && nextDailyLedger !== previousDailyLedger) {
      result.deltas.push({
        path: "世界.好感日增", op: "set", value: nextDailyLedger, finalValue: nextDailyLedger,
      });
    }
    if (vetted.rejected) result.rejected.push(vetted.rejected);
  }
  result.note = choice === UNKNOWN_CHOICE && !result.deltas.length
    ? `${target || rule.label}这轮判不了，按没有变化处理`
    : rule.note(choice, ctx, result.deltas);
  return { ...result, varTree: state.varTree };
}

function writeSettledPath(tree, [key, ...rest], value) {
  const current = tree && typeof tree === "object" ? tree : {};
  return {
    ...current,
    [key]: rest.length ? writeSettledPath(current[key], rest, value) : value,
  };
}

export function applySettledDeltas(varTree, deltas = []) {
  return (deltas || []).reduce((tree, delta) => {
    if (typeof delta?.path !== "string" || !delta.path || !Object.hasOwn(delta, "finalValue")) return tree;
    return writeSettledPath(tree, delta.path.split("."), delta.finalValue);
  }, varTree || {});
}

// 给叙事层的一句话结算说明：主模型只照这个结果写散文，不许再编数值。
export function formatSettleNote(result) {
  if (!result || !result.note) return "";
  return `\n【系统结算】${result.note}。以上数值是系统裁决，请照此叙事，不得更改或补写其他状态变化。`;
}
