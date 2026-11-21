// 置信度闸门：≥0.9 直接执行；中间档先问玩家一句确认；低于下限回落到原有自由行动路径（完全不变）。
import { ACTION_KINDS, NONE, SILVER, UNEQUIP_RE } from "./actionKinds.js";

const THRESHOLDS = Object.freeze({ execute: 0.9, confirm: 0.6 });

export const ROUTES = Object.freeze({ EXECUTE: "execute", CONFIRM: "confirm", FALLBACK: "fallback" });

// 交谈/其他本来就是自由行动的地盘，识别出来也交回原路径。
const FREE_KINDS = new Set([ACTION_KINDS.TALK, ACTION_KINDS.OTHER]);

export function planConfidence(recognition) {
  const actions = (recognition?.actions || []).filter((action) => !action.free);
  return actions.length ? Math.min(...actions.map((action) => action.confidence ?? 0)) : 0;
}

export function gateRecognition(recognition, thresholds = THRESHOLDS) {
  const actions = recognition?.actions || [];
  const confidence = planConfidence(recognition);
  // 带 condition 的交谈/其他是挂起的触发步，不算自由行动；free 标记的条件段只回落它自己那一句。
  if (!actions.length || actions.some((action) => !action.free && !action.condition && FREE_KINDS.has(action.kind))) {
    return { route: ROUTES.FALLBACK, confidence, reason: "非结构化行动" };
  }
  if (confidence >= thresholds.execute) return { route: ROUTES.EXECUTE, confidence };
  if (confidence >= thresholds.confirm) return { route: ROUTES.CONFIRM, confidence };
  return { route: ROUTES.FALLBACK, confidence, reason: "置信度过低" };
}

const who = (action) => (action.target && action.target !== NONE ? action.target : "对方");

export function describeAction(action) {
  if (action?.condition) return `等${action.condition.detail || "那时候"}再${describePlain(action)}`;
  return describePlain(action);
}

function describePlain(action) {
  switch (action.kind) {
    case ACTION_KINDS.GIFT: {
      const thing = action.item === SILVER ? action.amount ? `${action.amount}两` : "银子" : action.item && action.item !== NONE ? action.item : "东西";
      return `把${thing}给${who(action)}`;
    }
    case ACTION_KINDS.BUY: return `向${who(action)}买东西`;
    case ACTION_KINDS.DUEL: return `和${who(action)}切磋`;
    case ACTION_KINDS.LEARN: return `向${who(action)}拜师学艺`;
    case ACTION_KINDS.INVITE: return `邀${who(action)}同行`;
    case ACTION_KINDS.STEAL: return `偷${who(action)}的东西`;
    case ACTION_KINDS.APPEASE: return `向${who(action)}赔罪`;
    case ACTION_KINDS.PICKUP: return `捡起${action.item && action.item !== NONE ? action.item : "东西"}`;
    case ACTION_KINDS.EQUIP: return `${UNEQUIP_RE.test(action.text || "") ? "卸下" : "穿戴"}${action.item && action.item !== NONE ? action.item : "装备"}`;
    case ACTION_KINDS.MOVE: return `往${action.direction && action.direction !== NONE ? action.direction : "前"}走`;
    case ACTION_KINDS.USE_ITEM: return `用掉${action.item && action.item !== NONE ? action.item : "东西"}`;
    case ACTION_KINDS.TALK: return `和${who(action)}说话`;
    default: return action.text || "这么做";
  }
}

// 「你是要把100两给才旦吗？」
export function confirmLine(actions) {
  return `你是要${(actions || []).map(describeAction).join("，再")}吗？`;
}
