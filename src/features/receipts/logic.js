// 天机落账卡结构化动作裁决：把 EffectReceiptCard 派发的
// { type:"effectReceipt", op, kind, factId, itemId/skillId, name }
// 翻成 applyResult 标准 result（changes/logs），全程按 id 精确寻址——
// 同名两件并存时只动 receipt 指向的那一件。
// 不读 intentRecognitionEnabled、不经任何 AI 识别：确定性系统边界操作。
import { consumeItem } from "../items/logic.js";

function findById(list, id) {
  if (!Array.isArray(list) || id == null) return null;
  return list.find((entry) => typeof entry === "object" && entry?.id === id) || null;
}

// state: gameStore 快照（inv/skills/char/time/flags…）
// 返回 applyResult 标准 result；action 残缺或寻址落空返回 null（调用方不应用任何写）。
export function receiptActionResult(state, action) {
  if (!action || typeof action !== "object" || action.type !== "effectReceipt") return null;
  const { op } = action;

  if (op === "equip") {
    const item = findById(state.inv, action.itemId);
    if (!item) return null;
    // 幂等 explicit-on：按钮语义是单向「佩挂」，不是 toggle——重复派发（重渲染/
    // 读档/翻日志后按钮可再点）不得把已佩挂的装备解下来。已装备时 no-op。
    if (item.equipped) {
      return { logs: [{ t: "sys", text: `  「${item.name}」已在身上佩着。` }] };
    }
    return {
      changes: { inv: (v) => (v || []).map((entry) => (
        typeof entry === "object" && entry?.id === item.id ? { ...entry, equipped: true } : entry
      )) },
      logs: [{ t: "sys", text: `  佩挂上「${item.name}」。` }],
    };
  }

  if (op === "consume") {
    const item = findById(state.inv, action.itemId);
    if (!item) return null;
    // consumeItem 内部按 id 精确移除（同名不连坐），其余回血/增益照旧。
    return consumeItem(state, item);
  }

  if (op === "activate") {
    const skills = Array.isArray(state.skills) ? state.skills : [];
    const target = findById(skills, action.skillId);
    if (!target) return null;
    // 幂等 explicit-on：「设为主招」单向语义，重复派发不得把已上阵的武学收掉。
    if (target.active) {
      return { logs: [{ t: "sys", text: `  「${target.name}」已在阵上。` }] };
    }
    return {
      changes: {
        skills: (list) => (list || []).map((s) => {
          if (s?.id === target.id) return { ...s, active: true };
          // 同类只运一门：上阵目标时卸下同 moveType 的其他武学（与右栏运功同规则）
          if (target.moveType && s?.moveType === target.moveType && s?.active) {
            return { ...s, active: false };
          }
          return s;
        }),
      },
      logs: [{ t: "sys", text: `  运起「${target.name}」，上阵待用。` }],
    };
  }

  // viewPact 无结构化面板入口，属有意例外：调用方回退文本指令（PR 说明）
  return null;
}
