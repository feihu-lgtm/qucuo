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
import { consumeItem } from "../../features/items/logic.js";
import { findInvItem } from "../../features/intent/logic.js";
import { itemNameOf } from "../../domain/rules/intent/actionKinds.js";
import { CATALOG_INDEX } from "../../domain/data/items/catalog.js";

// S7 move 路由：intake.direction（n/s/e/w）直接消费，不从长文本重猜。
const VALID_DIRS = new Set(["n", "s", "e", "w"]);
const DIR_LABEL = { n: "北", s: "南", e: "东", w: "西" };

// A0/评审 blocker：判官路由只是「本 AI 回合内的前置结算」——commitRound 回合末
// 统一 setTime+1 并 append 主叙事 convo，因此一切 feature 自造的 time+1/convo
// 都不能提前落账：innerMove 如此，consumeItem 亦如此（自由打字用物曾双倍扣时辰）。
// 剥 time/convo 键（clone 不改原对象），其余确定性结果保留。
function stripTurnSpan(res) {
  if (!res?.changes) return res;
  const { time: _t, convo: _c, ...restChanges } = res.changes;
  return { ...res, changes: restChanges };
}

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
  // includeCommand:false——不造「e」式伪用户输入日志；文字用玩家原话。
  const result = innerMove(state, { direction: dir, command: action.text || dir, includeCommand: false });
  if (result?.changes?.innerRoomName) {
    applyResult(featureCtx(), stripTurnSpan(result), { feature: "judgeRoute.move" });
    return { kind: "move", ok: true, text: `你已进入${result.changes.innerRoomName}——系统已结算，叙事须照此写。` };
  }
  if (result?.logs?.length) {
    // 内层被挡（锁门/无去处）：日志照落（玩家要看见为什么走不通），但不构成位移
    applyResult(featureCtx(), stripTurnSpan(result), { feature: "judgeRoute.move" });
    const why = result.logs.map((l) => l.text?.trim()).filter((t) => t && !t.startsWith(">")).pop();
    return { kind: "move", ok: false, text: `向${DIR_LABEL[dir]}走不通（${why || "此方向没有去处"}）——系统未结算移动，叙事不得写成已移动。` };
  }
  // result 为 null：当前房间无内层箱庭，方向属外层大地图——本路由不支持（缺口），
  // 明确未结算，叙事不得编位移。
  return { kind: "move", ok: false, text: "该方向属外层赶路，判官链暂不接外层移动——系统未结算，叙事不得写成已移动，也不可编造抵达。" };
}

// D1 用物分流纯函数：耗材服用 / 兵刃衣饰演练端详 / 凭帖钥匙信物出示。
// consumable 口径与 consumeItem 完全一致：item.consumable 或未带 noCatalog 盾
// 且命中 CATALOG_INDEX 药效——判官条件券新铸物撞图鉴名也不吃图鉴药效。
// 返回 "consumable" | "wield" | "present"。
export function classifyUseItem(state, itemObjOrName) {
  const item = typeof itemObjOrName === "string"
    ? (state?.inv || []).find((entry) => itemNameOf(entry) === itemObjOrName) || null
    : itemObjOrName;
  if (!item || typeof item !== "object") return "present";
  const shielded = item.noCatalog;
  const consumable = item.consumable || (shielded ? null : CATALOG_INDEX[itemNameOf(item)]?.consumable);
  if (consumable) return "consumable";
  // Review 修：accessory 里混着凭帖信物（赌石邀帖/私印等纸面物）——它们不带任何
  // 数值加持（sixDim/effect/atk/def 皆无），不是拿来穿戴佩挂的装备，走出示而非演练。
  // 真饰品（旧护身符/虎乳牙/红线等带 sixDim 或 effect）仍为 wield。
  if (item.category === "weapon" || item.category === "armor") return "wield";
  if (item.category === "accessory") {
    const hasBonus = !!(item.sixDim && Object.keys(item.sixDim).length)
      || !!(item.effect && Object.keys(item.effect).length)
      || Number.isFinite(item.atk) || Number.isFinite(item.def)
      || !!(item.sixDimTemp && Object.keys(item.sixDimTemp).length);
    if (hasBonus) return "wield";
    // Review 二轮修：商店买的饰品实例常不携带图鉴加成字段（如镀金钗），不能仅凭
    // 无加成判凭帖——默认 accessory 是可佩挂装备（wield），只有名目明为凭帖/书信/
    // 印章/钥匙/令牌类纸面信物的才走出示。
    return /帖|牌|书信|信物|私印|印信|凭证|钥匙|令牌|路引|文书|残页/.test(itemNameOf(item)) ? "present" : "wield";
  }
  return "present";
}

// D1 用物分流路由：先按 id 优先/mismatch 拒动寻址背包目标物，再按物类分流。
// 演练/出示零状态改动——不消耗、不加 costPaid、不豁免 inv/vitals（影子口径同步）。
function runUseItem(action, itemLabel) {
  const state = gameStore.getState();
  const found = findInvItem(state, itemLabel, action?.itemId || "");
  const failText = (why) => ({ kind: action?.kind, ok: false, text: `「${itemLabel}」未能如愿（${why}）——系统未结算，叙事不得写成成功。` });
  if (found.mismatch) return failText("名/号矛盾，未动他物");
  if (!found.item) return failText("背包里没有对应物件");
  const itemName = itemNameOf(found.item);
  const cls = classifyUseItem(state, found.item);
  if (cls === "consumable") {
    const result = consumeItem(state, found.item);
    const hasChanges = !!(result && result.changes && Object.keys(result.changes).length > 0);
    if (result && (result.changes || result.logs?.length)) {
      applyResult(featureCtx(), stripTurnSpan(result), { feature: "judgeRoute.use_item" });
    }
    if (hasChanges) {
      const logLine = (result.logs || []).map((l) => l.text?.trim()).filter(Boolean)[0];
      return { kind: action.kind, ok: true, text: `「${itemName}」已服用生效（${logLine || "药力入喉"}），系统已结算，正文须照此描写药力或酒意，不得写物件仍在囊中。` };
    }
    const errLine = (result?.logs || []).map((l) => l.text?.trim()).filter(Boolean)[0];
    return failText(errLine || "服用未成");
  }
  if (cls === "wield") {
    return {
      kind: action.kind, ok: true,
      text: found.item.equipped
        ? `玩家正在端详或演练随身已佩的「${itemName}」，并非吞服消耗，物件不损耗、属性无增减，正文只写演练或端详之态。`
        : `玩家正在端详手中的「${itemName}」（当前尚未穿戴佩挂，可在叙事末顺带提一句随时可佩挂上身），并非吞服消耗，物件不损耗、属性无增减。`,
    };
  }
  return { kind: action.kind, ok: true, text: `玩家取出了「${itemName}」当场出示或查验，物件未消耗、未易主，判官未签发任何额外得失事实，正文只写出示查验与在场者反应。` };
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
  // D1：use_item 按物类分流（耗材服用/兵刃衣饰演练端详/凭帖钥匙信物出示），
  // 非耗材零状态改动——不进 stepEffect/consumeItem 老路。
  if (action?.kind === "use_item") return runUseItem(action, itemLabel);
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
    // A0：use_item/consumeItem 同样自造 time+1——applyResult 前统一剥回合账，
    // 否则自由打字用物一次扣 2 时辰（commitRound 还会再加）。
    applyResult(featureCtx(), stripTurnSpan(settled), { feature: `judgeRoute.${action.kind}` });
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
