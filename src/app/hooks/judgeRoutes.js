// WO-16F-F2a 装备/用物/拾取最小确定性路由（app 层执行器）。
// 架构红线：engine 不得反向 import features 写状态——runTurn 只调注入的
// executeJudgeRoutes 函数句柄，本模块在 app 层复用 stepEffect/applyResult
// 现有确定性实现（与点按钮同一套账），所有写账走 applyResult 统一边界。
import { gameStore } from "../../store/gameStore.js";
import { featureCtx } from "../runtime/gameRuntime.js";
import { applyResult } from "../../features/run.js";
import { stepEffect } from "../../features/intent/logic.js";
import { ACTION_KINDS, UNEQUIP_RE } from "../../domain/rules/intent/actionKinds.js";
import { innerMove } from "../../features/map/logic.js";

// S7 move 路由：intake.direction（n/s/e/w）直接消费，不从长文本重猜。
const VALID_DIRS = new Set(["n", "s", "e", "w"]);
const DIR_LABEL = { n: "北", s: "南", e: "东", w: "西" };

// 内层移动确定性路由：复用 features/map innerMove 同一套账（锁门/无出口/新人物/
// lastSeen 全在里头），写账仍走 applyResult 单边界。
// 外层大地图移动不支持——缺口与阻塞点见 PR 描述；回执明确「系统未结算」，
// 叙事不得写成已移动，但也绝不编「到了某处」。
function runMove(action) {
  const dir = String(action?.direction || "").trim().toLowerCase();
  if (!VALID_DIRS.has(dir)) {
    return { kind: "move", ok: false, text: "移动方向不明——系统未结算，叙事不得写成已移动。" };
  }
  const state = gameStore.getState();
  const result = innerMove(state, { direction: dir });
  if (result?.changes?.innerRoomName) {
    applyResult(featureCtx(), result, { feature: "judgeRoute.move" });
    return { kind: "move", ok: true, text: `你已进入${result.changes.innerRoomName}——系统已结算，叙事须照此写。` };
  }
  if (result?.logs?.length) {
    // 内层被挡（锁门/无去处）：日志照落（玩家要看见为什么走不通），但不构成位移
    applyResult(featureCtx(), result, { feature: "judgeRoute.move" });
    const why = result.logs.map((l) => l.text?.trim()).filter((t) => t && !t.startsWith(">")).pop();
    return { kind: "move", ok: false, text: `向${DIR_LABEL[dir]}走不通（${why || "此方向没有去处"}）——系统未结算移动，叙事不得写成已移动。` };
  }
  // result 为 null：当前房间无内层箱庭，方向属外层大地图——本路由不支持（缺口），
  // 明确未结算，叙事不得编位移。
  return { kind: "move", ok: false, text: "该方向属外层赶路，判官链暂不接外层移动——系统未结算，叙事不得写成已移动，也不可编造抵达。" };
}

// intake 12 字段 kind（英文枚举）→ stepEffect 的 ACTION_KINDS（中文封闭集）
const ROUTE_KIND = {
  equip: ACTION_KINDS.EQUIP,
  use_item: ACTION_KINDS.USE_ITEM,
  take: ACTION_KINDS.PICKUP,
  invite: ACTION_KINDS.INVITE,
};

// 单条路由结算：复用 stepEffect 对应分支，不造第二套账。
// 成功判定统一为「result.changes 非空」——consumeItem/pickGroundItem/equip 三路的
// 失败形状都是只有 logs 没有 changes（pickup 找不到物件甚至返回 {}）。
// 返回 receipt 供主叙事注入：成功照系统日志原句，失败绝不静默签成功。
function runOne(action) {
  if (action?.kind === "move") return runMove(action);
  const kind = ROUTE_KIND[action?.kind];
  // invite 按人寻址（target），其余按物寻址（item）
  const isInvite = action?.kind === "invite";
  const itemLabel = isInvite
    ? (action?.target && action.target !== "无" ? action.target : "")
    : (action?.item && action.item !== "无" ? action.item : "");
  if (!kind || !itemLabel) {
    return { kind: action?.kind, ok: false, text: `「${itemLabel || (isInvite ? "未名之人" : "未名之物")}」未能如愿：行动缺少明确的${isInvite ? "对象" : "物件"}，系统未结算。` };
  }
  const state = gameStore.getState();
  // itemId 随步骤传递——stepEffect 按 id 优先寻址，同名两件不错副本
  const step = { kind, item: isInvite ? "" : itemLabel, itemId: action.itemId || "", target: isInvite ? itemLabel : action.target, text: action.text || "" };
  const result = stepEffect(state, step);
  // 防递归 settle（返修 blocker）：inviteCompanion 成功结果自带 settle/settleOptions
  // （companion_invite 结算回合），生气 NPC 的 appeaseAngryNpc 岔路同样带 settle——
  // 按钮老路需要它们进交互，但判官路由只落地 deterministic changes/logs，
  // 绝不能在叙事前再派生新 settle 回合/额外叙事。clone 剥离，不改 features 本体。
  const inviteSettled = isInvite && result?.settleOptions?.settleKind === "companion_invite";
  const settled = result ? { ...result } : result;
  if (settled) { delete settled.settle; delete settled.settleOptions; }
  const hasChanges = !!(settled && settled.changes && Object.keys(settled.changes).length > 0);
  // invite 成功口径收窄：只有 companion_invite 结算形状且 changes 非空才算邀成；
  // 生气 appease 岔路即使有 changes（记录尝试）也按未邀成处理。
  const ok = isInvite ? (inviteSettled && hasChanges) : hasChanges;
  if (settled && (settled.changes || settled.logs?.length)) {
    applyResult(featureCtx(), settled, { feature: `judgeRoute.${action.kind}` });
  }
  if (ok) {
    if (action.kind === "equip") {
      const off = UNEQUIP_RE.test(action.text || "");
      return { kind: action.kind, ok, text: `你已${off ? "卸下" : "装备"}「${itemLabel}」——系统已结算，叙事须照此写。` };
    }
    if (isInvite) {
      return { kind: action.kind, ok, text: `${itemLabel}已应允同行——系统已结算，叙事须照此写。` };
    }
    const logLine = (settled.logs || []).map((l) => l.text?.trim()).filter(Boolean)[0];
    return { kind: action.kind, ok, text: `${logLine || `「${itemLabel}」已结算`}——系统已结算，叙事须照此写。` };
  }
  const errLine = (settled?.logs || []).map((l) => l.text?.trim()).filter(Boolean)[0];
  return {
    kind: action.kind, ok: false,
    text: `「${itemLabel}」未能如愿（${errLine || (isInvite ? "对方未应允" : "找不到对应物件")}）——系统未结算，叙事不得写成成功。`,
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
      receipts.push({ kind: action?.kind, ok: false, text: `「${action?.item || action?.target || (action?.kind === "invite" ? "未名之人" : "未名之物")}」结算异常（${error?.message || error}）——系统未结算，叙事不得写成成功。` });
    }
  }
  return { receipts };
}
