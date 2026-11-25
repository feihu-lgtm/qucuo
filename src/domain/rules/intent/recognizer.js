// 第一段·行动识别：整句只问模型一次。
// classifier 端口：{ recognize(vars) -> { actions: [{ text, kind, target, item, direction, condition, condition_text, confidence }] } }，
// 任何实现（现有 AI 端口、规则 mock）都可替换。
// 提示词一次列全候选（在场人物/物品/方向/类别/前提类别，同源 slotOptions），模型回得再漂亮也不直接信：
// 每个字段都在本地对照候选核一遍，对不上的行动降级成「其他」，交回自由行动路径。
import { ACTION_KINDS, KIND_LIST, SLOT_SPECS, NONE, SILVER, slotOptions, parseSilverAmount, recognitionOptions } from "./actionKinds.js";
import { CONDITION_LABELS, CONDITION_OTHER, splitConditionClause } from "./conditions.js";

const STAGE_LABEL = "识别·整句";
// 本地复合提示：只是提醒模型「可能不止一个行动」，不再单独发一次调用去判。
const COMPOUND_HINT = /然后|再|接着|随后|之后|并且|顺便|同时|[，,、；;]|又/;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

async function timed(onStage, label, fn) {
  const startedAt = now();
  const result = await fn();
  onStage?.(label, result, Math.round(now() - startedAt));
  return result;
}

function localHints(input) {
  const hints = [];
  const clause = splitConditionClause(input);
  if (clause) hints.push(`本地提示：含条件从句，前提「${clause.detail}」，动作「${clause.actionText}」。`);
  if (COMPOUND_HINT.test(input)) hints.push("本地提示：原话可能含多个要依次执行的行动，请按顺序拆开。");
  return hints.join("\n");
}

// 模型自评置信度：容忍百分数写法（95 → 0.95），非数字按 0 处理，最终夹在 [0,1]。
export function clampConfidence(value) {
  const number = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number > 1 && number <= 100 ? number / 100 : number));
}

const clean = (value) => String(value ?? "").replace(/[「」]/g, "").trim();

// 校验一个模型给出的行动；原文片段对不上整句时返回 null（整次识别作废，不敢执行半截计划）。
function validateAction(state, input, raw) {
  const text = clean(raw?.text);
  if (!text || !input.includes(text)) return null;
  const confidence = clampConfidence(raw?.confidence);
  const kind = KIND_LIST.includes(clean(raw?.kind)) ? clean(raw.kind) : ACTION_KINDS.OTHER;
  const label = clean(raw?.condition);
  const free = (extra = {}) => ({ kind: ACTION_KINDS.OTHER, target: null, item: null, text, confidence, ...extra });

  // 前提落在封闭集合之外：只回落这一句，其余步骤照常过闸。
  if (label === CONDITION_OTHER) return free({ free: true });
  let condition = null;
  if (label in CONDITION_LABELS) {
    const stated = clean(raw?.condition_text);
    condition = { on: CONDITION_LABELS[label], detail: stated && input.includes(stated) ? stated : splitConditionClause(input)?.detail || text };
  }
  const withCondition = (action) => (condition ? { ...action, condition } : action);

  const action = { kind, target: null, item: null, text, confidence };
  for (const slot of SLOT_SPECS[kind] || []) {
    const options = slotOptions(state, kind, slot);
    const value = clean(raw?.[slot]) || NONE;
    // 候选里没有的人/物/方向：模型编的，整个行动降级为「其他」，交给自由行动路径。
    if (value !== NONE && !options.includes(value)) {
      return withCondition(free({ demoted: `${slot}「${value}」不在候选里` }));
    }
    action[slot] = value;
  }
  // 带前提的赠送，模型可能把前提整句也放进 text（「要是他先给我一百两，我就送他二十两」）：
  // 银两数只从行动那半句里取，不能把前提里的数额当成要送出去的钱。
  if (kind === ACTION_KINDS.GIFT && action.item === SILVER) {
    const actionText = condition ? splitConditionClause(text)?.actionText || text.replace(condition.detail, "") : text;
    action.amount = parseSilverAmount(actionText);
  }
  return withCondition(action);
}

export function validateRecognition(state, input, raw) {
  const rawActions = Array.isArray(raw?.actions) ? raw.actions : [];
  const actions = [];
  for (const entry of rawActions) {
    const action = validateAction(state, input, entry);
    if (!action) return [];
    actions.push(action);
  }
  return actions;
}

export async function recognizeIntent(state, text, { classifier, onStage } = {}) {
  const input = String(text || "").trim();
  if (!classifier || !input) return { compound: 0, actions: [] };
  const options = recognitionOptions(state);
  const raw = await timed(onStage, STAGE_LABEL, () => classifier.recognize({
    text: input,
    hints: localHints(input),
    kinds: options.kinds,
    targets: options.targets,
    directions: options.directions,
    giftItems: options.items[ACTION_KINDS.GIFT],
    useItems: options.items[ACTION_KINDS.USE_ITEM],
    pickupItems: options.items[ACTION_KINDS.PICKUP],
    equipItems: options.items[ACTION_KINDS.EQUIP],
  }));
  const actions = validateRecognition(state, input, raw);
  return { compound: actions.length > 1 ? 1 : 0, actions };
}
