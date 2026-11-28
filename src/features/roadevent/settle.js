// WO-25O：路遇可行之事结算——玩家点击按钮或照抄输入后，挂起的路遇在这里
// 确定性了结。产出 applyResult 形状（changes/logs），由 resolveIntent 经
// applyLocal 单一边界落账；materializeFacts 的 patches 按根切片折叠成
// 函数式更新器塞进 changes，不新增任何直写。天机券编译（warrant 具名）
// 归 WO-25Q，本通道传空券表——warrant 事实按 materializeFacts 既有兜底处理。
import { resolveRoadEvent, roadEventWrites, buildRoadEventWritesResult } from "../../domain/rules/livingWorld/roadEvents.js";
import { materializeFacts } from "../../domain/rules/effects/materializeFacts.js";
import { applyPatches } from "../../domain/rules/state/applyPatches.js";
import { statePath } from "../../domain/rules/state/paths.js";

// 输入匹配：按钮照抄 label 直发，手敲允许包含关系（双向）或序号 1/2/3。
// 标签多为通用短词（「离开」「帮忙」），靠「仅下一句有效」的挂起账期兜底防误吞。
export function matchRoadEventChoice(roll, cmd) {
  if (!roll?.options?.length || !cmd) return null;
  const text = String(cmd).trim();
  if (!text) return null;
  const index = { 1: 0, 2: 1, 3: 2 }[text];
  if (index != null && roll.options[index]) return roll.options[index].key;
  for (const option of roll.options) {
    const label = String(option.label || "").trim();
    if (!label) continue;
    if (text === label) return option.key;
    if (label.length >= 2 && text.includes(label)) return option.key;
    if (text.length >= 2 && label.includes(text)) return option.key;
  }
  return null;
}

function composeVarTreeUpdaters(...updaters) {
  const list = updaters.filter((u) => typeof u === "function");
  if (!list.length) return null;
  return (prev) => list.reduce((tree, fn) => fn(tree), prev);
}

// patches → changes：按根切片分组，每根折成一个函数式更新器（与 commitPatches
// 同语义，但产物走 applyResult 的 changes 通道而不是直调 setter）。
function patchesToChanges(patches) {
  const groups = new Map();
  for (const patch of patches || []) {
    const root = statePath(patch?.path)?.[0];
    if (!root) continue;
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(patch);
  }
  const changes = {};
  for (const [root, list] of groups) {
    changes[root] = (prev) => applyPatches({ [root]: prev }, list).state[root];
  }
  return changes;
}

// 天机券暂定名（WO-25Q 的 AI 尾章填名上线前的兜底）：warrant 事实只有
// category/quality/school 没有名字，materializeFacts 缺名即拒授——买货变
// 「扣了银两没交货」。这里按品阶+品类确定性起名，事实不再落空；名字是
// 通用档（「精铸兵刃」），Q 的两段式叙事会用 AI 具名顶替本通道。
const QUALITY_PREFIX = { 白: "粗制", 绿: "青钢", 蓝: "精铸", 紫: "名贵", 橙: "稀世", 红: "传世" };
const CATEGORY_NOUN = { weapon: "兵刃", armor: "护甲", accessory: "饰物", misc: "什物" };
export function nameWarrantFacts(facts) {
  return (facts || []).map((fact) => {
    if (fact?.op === "GRANT_ITEM" && fact.warrant && !fact.itemName) {
      const prefix = QUALITY_PREFIX[fact.quality] || "粗制";
      const noun = CATEGORY_NOUN[fact.category] || "什物";
      return { ...fact, itemName: `${prefix}${noun}` };
    }
    if (fact?.op === "BESTOW_SKILL" && fact.warrant && !fact.skillName) {
      const school = fact.school && fact.school !== "散人" ? `${fact.school}流` : "佚名";
      return { ...fact, skillName: `${school}${fact.quality || "白"}品武学` };
    }
    return fact;
  });
}

export function settleRoadEventChoice({ roll, optionKey, state, rng = Math.random, luck }) {
  const outcome = resolveRoadEvent(roll, optionKey, state, { rng, luck });
  const facts = nameWarrantFacts(outcome.facts);
  const matResult = facts?.length ? materializeFacts(state, facts, {}) : null;
  const writesResult = buildRoadEventWritesResult(roadEventWrites(roll, outcome), state);

  const patchChanges = patchesToChanges(matResult?.patches);
  const changes = { ...(matResult?.changes || {}), ...(writesResult?.changes || {}) };
  // writesResult 的 flags 是按结算前快照拼好的整数组——落成函数式更新器，
  // 防跨回合 clobber，也好与 patches 折出的同根更新器复合。
  if (Array.isArray(changes.flags)) {
    const addFlags = changes.flags.filter((f) => !(state?.flags || []).includes(f));
    changes.flags = (prev) => [...new Set([...(Array.isArray(prev) ? prev : []), ...addFlags])];
  }
  for (const [root, updater] of Object.entries(patchChanges)) {
    changes[root] = typeof changes[root] === "function"
      ? composeVarTreeUpdaters(updater, changes[root])
      : updater;
  }

  const option = roll.options?.find((o) => o.key === optionKey);
  const verdict = outcome.success == null
    ? `你就此别过「${option?.label || "离开"}」，这段路遇翻篇了。`
    : outcome.success
      ? `路遇结算：${option?.label || ""}——检定成功。`
      : `路遇结算：${option?.label || ""}——检定失败。`;
  const logs = [{ t: "sys", text: `  ${verdict}` }, ...(matResult?.logs || []).map((l) => (l?.text ? l : { t: "sys", text: String(l) }))];
  if (matResult?.receipts?.length) {
    logs[logs.length - 1] = { ...logs[logs.length - 1], receipts: matResult.receipts };
  }
  return { changes, logs, outcome };
}
