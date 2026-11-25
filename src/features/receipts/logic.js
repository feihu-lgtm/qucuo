// 天机落账卡结构化动作裁决：把 EffectReceiptCard 派发的
// { type:"effectReceipt", op, kind, factId, itemId/skillId, name }
// 翻成 applyResult 标准 result（changes/logs），全程按 id 精确寻址——
// 同名两件并存时只动 receipt 指向的那一件。
// 不读 intentRecognitionEnabled、不经任何 AI 识别：确定性系统边界操作。
import { toggleEquip } from "../../domain/rules/economy/equipment.js";
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
    return {
      changes: { inv: (v) => toggleEquip(v, item.id) },
      logs: [{ t: "sys", text: `  ${item.equipped ? `解下「${item.name}」。` : `佩挂上「${item.name}」。`}` }],
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
    const turningOn = !target.active;
    return {
      changes: {
        skills: (list) => (list || []).map((s) => {
          if (s?.id === target.id) return { ...s, active: turningOn };
          // 同类只运一门：上阵目标时卸下同 moveType 的其他武学（与右栏运功同规则）
          if (turningOn && target.moveType && s?.moveType === target.moveType && s?.active) {
            return { ...s, active: false };
          }
          return s;
        }),
      },
      logs: [{ t: "sys", text: `  ${turningOn ? `运起「${target.name}」，上阵待用。` : `收住「${target.name}」的劲。`}` }],
    };
  }

  // viewPact 无结构化面板入口，属有意例外：调用方回退文本指令（PR 说明）
  return null;
}
