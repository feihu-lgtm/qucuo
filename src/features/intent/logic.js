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
// 三态寻址（抽核 blocker 修）：id 命中且名匹配→按 id；id 不存在→按名；
// id 命中但名不符→mismatch 绝不 fallback（否则字符串按名仍会动错物）。
export function findInvItem(state, name, id) {
  if (id) {
    const byId = (state.inv || []).find((entry) => typeof entry === "object" && entry?.id === id);
    if (byId) return { item: itemNameOf(byId) === name ? byId : null, mismatch: itemNameOf(byId) !== name };
  }
  return { item: (state.inv || []).find((entry) => itemNameOf(entry) === name) || null, mismatch: false };
}

function findGroundItem(state, name, id) {
  if (id) {
    const byId = getGroundItems(state).find((entry) => typeof entry === "object" && entry?.id === id);
    if (byId) return { item: itemNameOf(byId) === name ? byId : null, mismatch: itemNameOf(byId) !== name };
  }
  return { item: getGroundItems(state).find((entry) => itemNameOf(entry) === name) || null, mismatch: false };
}

// 立即结算类步骤（送礼/学艺/用物品/偷窃/邀同行/平息/拾取/装备）；切磋、购买、移动需要交互或走路，由调用方在叙事后接上原有入口。
export function stepEffect(state, step) {
  const npc = findStepNpc(state, step);
  switch (step.kind) {
    case ACTION_KINDS.GIFT:
      return step.item === SILVER ? giftSilver(state, npc, step.amount) : giftNpc(state, npc, findInvItem(state, step.item).item);
    case ACTION_KINDS.LEARN: return learnNpcSkill(state, npc);
    case ACTION_KINDS.USE_ITEM: {
      const found = findInvItem(state, step.item, step.itemId);
      if (found.mismatch) return { logs: [{ t: "err", text: `  找不到「${step.item}」（名/号矛盾，未动他物）。` }] };
      return consumeItem(state, found.item);
    }
    case ACTION_KINDS.STEAL: return stealFromNpc(state, npc);
    case ACTION_KINDS.INVITE: return inviteCompanion(state, npc);
    case ACTION_KINDS.APPEASE: {
      const result = appeaseAngryNpc(state, npc, { kind: "apologize", detail: step.text || "" });
      // 玩家原话随 settleOptions 传进裁决段，软结算判断「说得够不够诚意」才有据可依。
      if (step.text) result.settleOptions = { ...result.settleOptions, attempt: step.text };
      return result;
    }
    case ACTION_KINDS.PICKUP: {
      const found = findGroundItem(state, step.item, step.itemId);
      if (found.mismatch) return { logs: [{ t: "err", text: `  找不到「${step.item}」（名/号矛盾，未动他物）。` }] };
      return pickGroundItem(state, found.item || step.item);
    }
    case ACTION_KINDS.EQUIP: {
      const found = findInvItem(state, step.item, step.itemId);
      const item = found.mismatch ? null : found.item;
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
