// 第一段·行动识别。接口仿照 Jev / ShieldGemma 一类决策分类器：
// 一个问题只问一件事，选项来自实时状态，模型只回 choice + 每个选项的概率。
// classifier 端口：{ decide(question, vars, options) -> { choice, probs }, split(vars) -> string[] }，
// 任何实现（现有 AI 端口、Jev、规则 mock）都可替换。
import { ACTION_KINDS, KIND_LIST, SLOT_SPECS, NONE, SILVER, slotOptions, parseSilverAmount } from "./actionKinds.js";

const COMPOUND_HINT = /然后|再|接着|随后|之后|并且|顺便|同时|[，,、；;]|又/;
const YES = "是";
const NO = "否";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

async function timed(onStage, label, fn) {
  const startedAt = now();
  const result = await fn();
  onStage?.(label, result, Math.round(now() - startedAt));
  return result;
}

function sanitizeParts(parts, text) {
  const clean = (Array.isArray(parts) ? parts : [])
    .map((part) => String(part || "").trim())
    .filter((part) => part && text.includes(part));
  return clean.length >= 2 ? clean : [text];
}

async function recognizeAtomic(state, text, classifier, onStage) {
  const kindResult = await timed(onStage, "识别·类别", () => classifier.decide("kind", { text }, KIND_LIST));
  const kind = kindResult.choice;
  const action = { kind, kindProbs: kindResult.probs, target: null, targetProbs: null, text };
  let confidence = kindResult.probs[kind] ?? 0;
  for (const slot of SLOT_SPECS[kind] || []) {
    const options = slotOptions(state, kind, slot);
    if (options.length <= 1) {
      action[slot] = NONE;
      action[`${slot}Probs`] = { [NONE]: 1 };
      continue;
    }
    const result = await timed(onStage, `识别·${slot}`, () => classifier.decide(slot, { text, kind }, options));
    action[slot] = result.choice;
    action[`${slot}Probs`] = result.probs;
    confidence *= result.probs[result.choice] ?? 0;
  }
  if (kind === ACTION_KINDS.GIFT && action.item === SILVER) action.amount = parseSilverAmount(text);
  action.confidence = confidence;
  return action;
}

export async function recognizeIntent(state, text, { classifier, onStage } = {}) {
  const input = String(text || "").trim();
  if (!classifier || !input) return { compound: 0, actions: [] };
  let compound = 0;
  if (COMPOUND_HINT.test(input)) {
    const result = await timed(onStage, "识别·复合", () => classifier.decide("compound", { text: input }, [YES, NO]));
    compound = result.probs[YES] ?? 0;
  }
  const parts = compound >= 0.5
    ? sanitizeParts(await timed(onStage, "识别·拆分", () => classifier.split({ text: input })), input)
    : [input];
  const certainty = Math.max(compound, 1 - compound);
  const actions = [];
  for (const part of parts) {
    const action = await recognizeAtomic(state, part, classifier, onStage);
    action.confidence *= certainty;
    actions.push(action);
  }
  return { compound, actions };
}
