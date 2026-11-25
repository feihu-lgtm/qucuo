// 行动识别通过系统闸门后，每个原子步骤落到现有功能逻辑上（与点按钮走同一套实现）。
// 单步行动保留原功能的结算叙事；复合行动去掉逐步结算，由一次合并叙事统一描写。
import { ACTION_KINDS, SILVER, UNEQUIP_RE, itemNameOf, visibleNpcs } from "../../domain/rules/intent/actionKinds.js";
import { giftNpc, giftSilver, learnNpcSkill, stealFromNpc } from "../npc/logic.js";
import { appeaseAngryNpc } from "../npc/anger.js";
import { inviteCompanion } from "../npc/inviteCompanion.js";
import { consumeItem, pickGroundItem } from "../items/logic.js";
import { getGroundItems } from "../../domain/rules/map/groundScope.js";

export function findStepNpc(state, step) {
  return visibleNpcs(state).find((npc) => npc.name === step.target) || null;
}

// id 优先寻址（WO-16F-F2a Review 修）：同名两件并存时，带 itemId 的步骤必须命中
// 编号指定的那个副本，按名第一件会错杀/错穿/错捡。无 id 的老调用退回按名第一件。
function findInvItem(state, name, id) {
  if (id) {
    const byId = (state.inv || []).find((entry) => typeof entry === "object" && entry?.id === id);
    if (byId) return byId;
  }
  return (state.inv || []).find((entry) => itemNameOf(entry) === name) || null;
}

function findGroundItem(state, name, id) {
  if (id) {
    const byId = getGroundItems(state).find((entry) => typeof entry === "object" && entry?.id === id);
    if (byId) return byId;
  }
  return getGroundItems(state).find((entry) => itemNameOf(entry) === name) || null;
}

// 立即结算类步骤（送礼/学艺/用物品/偷窃/邀同行/平息/拾取/装备）；切磋、购买、移动需要交互或走路，由调用方在叙事后接上原有入口。
export function stepEffect(state, step) {
  const npc = findStepNpc(state, step);
  switch (step.kind) {
    case ACTION_KINDS.GIFT:
      return step.item === SILVER ? giftSilver(state, npc, step.amount) : giftNpc(state, npc, findInvItem(state, step.item));
    case ACTION_KINDS.LEARN: return learnNpcSkill(state, npc);
    case ACTION_KINDS.USE_ITEM: return consumeItem(state, findInvItem(state, step.item, step.itemId));
    case ACTION_KINDS.STEAL: return stealFromNpc(state, npc);
    case ACTION_KINDS.INVITE: return inviteCompanion(state, npc);
    case ACTION_KINDS.APPEASE: {
      const result = appeaseAngryNpc(state, npc, { kind: "apologize", detail: step.text || "" });
      // 玩家原话随 settleOptions 传进裁决段，软结算判断「说得够不够诚意」才有据可依。
      if (step.text) result.settleOptions = { ...result.settleOptions, attempt: step.text };
      return result;
    }
    case ACTION_KINDS.PICKUP: return pickGroundItem(state, findGroundItem(state, step.item, step.itemId) || (step.itemId ? { id: step.itemId, name: step.item } : step.item));
    case ACTION_KINDS.EQUIP: {
      const item = findInvItem(state, step.item, step.itemId);
      if (!item?.id) return { logs: [{ t: "err", text: `  背包里没有${step.item || "这件装备"}。` }] };
      // 按原话定方向，不做盲目取反：「穿上已穿好的」不该反而脱下。
      const wantsOff = UNEQUIP_RE.test(step.text || "");
      return { changes: { inv: (inv) => inv.map((it) => (it?.id === item.id ? { ...it, equipped: !wantsOff } : it)) } };
    }
    default: return null;
  }
}

export const DEFERRED_KINDS = new Set([ACTION_KINDS.DUEL, ACTION_KINDS.BUY, ACTION_KINDS.MOVE]);

export function withoutSettle(result) {
  if (!result) return result;
  const { settle: _settle, settleOptions: _settleOptions, ...rest } = result;
  return rest;
}
