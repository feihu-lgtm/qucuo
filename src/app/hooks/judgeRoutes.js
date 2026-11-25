// WO-16F-F2a 装备/用物/拾取最小确定性路由（app 层执行器）。
// 架构红线：engine 不得反向 import features 写状态——runTurn 只调注入的
// executeJudgeRoutes 函数句柄，本模块在 app 层复用 stepEffect/applyResult
// 现有确定性实现（与点按钮同一套账），所有写账走 applyResult 统一边界。
import { gameStore } from "../../store/gameStore.js";
import { featureCtx } from "../runtime/gameRuntime.js";
import { applyResult } from "../../features/run.js";
import { stepEffect } from "../../features/intent/logic.js";
import { ACTION_KINDS, UNEQUIP_RE } from "../../domain/rules/intent/actionKinds.js";

// intake 12 字段 kind（英文枚举）→ stepEffect 的 ACTION_KINDS（中文封闭集）
const ROUTE_KIND = {
  equip: ACTION_KINDS.EQUIP,
  use_item: ACTION_KINDS.USE_ITEM,
  take: ACTION_KINDS.PICKUP,
};

export const JUDGE_ROUTE_KINDS = new Set(Object.keys(ROUTE_KIND));

// 单条路由结算：复用 stepEffect 对应分支，不造第二套账。
// 成功判定统一为「result.changes 非空」——consumeItem/pickGroundItem/equip 三路的
// 失败形状都是只有 logs 没有 changes（pickup 找不到物件甚至返回 {}）。
// 返回 receipt 供主叙事注入：成功照系统日志原句，失败绝不静默签成功。
function runOne(action) {
  const kind = ROUTE_KIND[action?.kind];
  const itemLabel = action?.item && action.item !== "无" ? action.item : "";
  if (!kind || !itemLabel) {
    return { kind: action?.kind, ok: false, text: `「${itemLabel || "未名之物"}」未能如愿：行动缺少明确的物件，系统未结算。` };
  }
  const state = gameStore.getState();
  const step = { kind, item: itemLabel, target: action.target, text: action.text || "" };
  const result = stepEffect(state, step);
  const ok = !!(result && result.changes && Object.keys(result.changes).length > 0);
  if (result && (result.changes || result.logs?.length)) {
    applyResult(featureCtx(), result, { feature: `judgeRoute.${action.kind}` });
  }
  if (ok) {
    if (action.kind === "equip") {
      const off = UNEQUIP_RE.test(action.text || "");
      return { kind: action.kind, ok, text: `你已${off ? "卸下" : "装备"}「${itemLabel}」——系统已结算，叙事须照此写。` };
    }
    const logLine = (result.logs || []).map((l) => l.text?.trim()).filter(Boolean)[0];
    return { kind: action.kind, ok, text: `${logLine || `「${itemLabel}」已结算`}——系统已结算，叙事须照此写。` };
  }
  const errLine = (result?.logs || []).map((l) => l.text?.trim()).filter(Boolean)[0];
  return {
    kind: action.kind, ok: false,
    text: `「${itemLabel}」未能如愿（${errLine || "找不到对应物件"}）——系统未结算，叙事不得写成成功。`,
  };
}

// 路由执行入口（注入 runTurn）：按 intake 顺序逐条确定性结算，返回回执摘要。
// 全部同步——zustand 写读同 tick，后续 stepEffect 读到的是前一步结算后的最新状态。
export function executeJudgeRoutes(routes) {
  const receipts = [];
  for (const action of routes || []) {
    try {
      receipts.push(runOne(action));
    } catch (error) {
      receipts.push({ kind: action?.kind, ok: false, text: `「${action?.item || "未名之物"}」结算异常（${error?.message || error}）——系统未结算，叙事不得写成成功。` });
    }
  }
  return { receipts };
}
