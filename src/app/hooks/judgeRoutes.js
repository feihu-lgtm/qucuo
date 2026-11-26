// WO-16F-F2a 装备/用物/拾取最小确定性路由（app 层执行器）。
// 架构红线：engine 不得反向 import features 写状态——runTurn 只调注入的
// executeJudgeRoutes 函数句柄，本模块在 app 层复用 stepEffect/applyResult
// 现有确定性实现（与点按钮同一套账），所有写账走 applyResult 统一边界。
import { gameStore } from "../../store/gameStore.js";
import { featureCtx } from "../runtime/gameRuntime.js";
import { applyResult } from "../../features/run.js";
import { stepEffect } from "../../features/intent/logic.js";
import { ACTION_KINDS, UNEQUIP_RE } from "../../domain/rules/intent/actionKinds.js";
import { innerMove, outerArrival } from "../../features/map/logic.js";
import { consumeItem } from "../../features/items/logic.js";
import { findInvItem } from "../../features/intent/logic.js";
import { itemNameOf } from "../../domain/rules/intent/actionKinds.js";
import { CATALOG_INDEX } from "../../domain/data/items/catalog.js";
import { consumableOfItem } from "../../domain/data/items/catalogOps.js";
import { QUCUO_MAP, resolveExit, isNodeUnlocked } from "../../domain/data/map/qucuoMap.js";
import { visibleInnerExits, getDistrictAnchor, hasInnerMap, resolveInnerExit } from "../../domain/rules/map/innerMap.js";
import { serializeSquares } from "../../domain/rules/map/mapSquares.js";

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

// D4：已完成任务集合（questProgress status === "completed"）——与 features/map 同口径。
function completedQuestIdSet(questProgress) {
  const out = new Set();
  for (const [id, q] of Object.entries(questProgress || {})) {
    if (q?.status === "completed") out.add(id);
  }
  return out;
}

// D4 目的地名解析纯函数：move 复用 target 填地名（不加 schema 键）。
// 返回{type} 分派：
//   inner       同据点内层相邻房间（含「回村/出去/去村口」命中内层出口）→ dir 走 innerMove
//   outer       相邻已解锁外层据点 → dir+dest 走 outerArrival
//   noexit      direction 有效但当前据点该方向无外层出口
//   unknown     名字不在 QUCUO_MAP 也不在本区 INNER_MAP（或根本说不出地名/方向）
//   unreachable 名字在 QUCUO_MAP 但不在当前相邻 exits——隔站单步不直通
//   locked      相邻但 !isNodeUnlocked——前路未开启
export function resolveMoveTarget(state, action) {
  const text = String(action?.text || "");
  const targetRaw = String(action?.target || "").trim();
  const target = targetRaw && targetRaw !== "无" ? targetRaw : "";
  const dir = String(action?.direction || "").trim().toLowerCase();
  const dirValid = VALID_DIRS.has(dir) ? dir : "";
  const roomName = state?.room?.name || "";
  const innerNow = state?.innerRoomName ?? null;
  const unlockCtx = { completedQuests: completedQuestIdSet(state?.questProgress), flags: state?.flags || [] };

  // 1. 内层：在据点内层房间时，target/口话命中同据点内层相邻房间 → 反查 visibleInnerExits
  if (innerNow && hasInnerMap(roomName)) {
    const visExits = visibleInnerExits(roomName, innerNow, {
      questProgress: state?.questProgress, flags: state?.flags || [],
      inv: state?.inv || [], char: state?.char || {}, varTree: state?.varTree || {},
    });
    if (/回村|出去|去村口/.test(text) || target) {
      for (const [d, destRoom] of Object.entries(visExits)) {
        if ((target && destRoom === target) || (/村口/.test(text) && /村口/.test(destRoom)) || (/出去|回村/.test(text) && !target && destRoom)) {
          // 「出去/回村」无具体名时取第一个可见出口（多为出门方向）
          if (target || /村口/.test(destRoom) || /出去|回村/.test(text)) return { type: "inner", dir: d };
        }
      }
    }
    // 方向型移动按内层【拓扑】判（resolveInnerExit 含锁房）——锁房不在可见出口里，
    // 但 innerMove 自己产锁因拦阻回执；拓扑没这个方向才落外层解析。
    if (dirValid && resolveInnerExit(roomName, innerNow, dirValid)) return { type: "inner", dir: dirValid };
  }

  // 2. 外层：direction 优先
  if (dirValid) {
    const dest = resolveExit(roomName, dirValid);
    if (!dest) return { type: "noexit", dir: dirValid };
    if (!isNodeUnlocked(dest, unlockCtx)) return { type: "locked", dir: dirValid, dest };
    return { type: "outer", dir: dirValid, dest };
  }

  // 3. direction=none：target 或从原文提取据点名；「回村」在鱼定周边映射鱼定村
  let destName = target;
  if (!destName) {
    for (const name of Object.keys(QUCUO_MAP)) {
      if (name !== roomName && text.includes(name)) { destName = name; break; }
    }
  }
  if (!destName && /回村/.test(text) && roomName !== "鱼定村") destName = "鱼定村";
  if (!destName) return { type: "unknown", target: target || "" };
  if (destName === roomName) return { type: "unknown", target: destName };
  if (!QUCUO_MAP[destName]) return { type: "unknown", target: destName };

  // 反查当前据点 exits 找直通方向
  const exits = QUCUO_MAP[roomName]?.exits || {};
  const hitDir = Object.entries(exits).find(([, d]) => d === destName)?.[0] || "";
  if (!hitDir) return { type: "unreachable", target: destName };
  if (!isNodeUnlocked(destName, unlockCtx)) return { type: "locked", dir: hitDir, dest: destName };
  return { type: "outer", dir: hitDir, dest: destName };
}

// 移动确定性路由：内层复用 features/map innerMove（锁门/无出口/新人物/lastSeen 同一套账），
// 外层复用 outerArrival（格子缓存/路遇/拾取同一套账）——写账都走 applyResult 单边界，
// 都 stripTurnSpan 剥 time/convo 防与 commitRound 双跑。系统移动回合由 judgePhase
// 上游滤掉 move（lockedDestName/movingDir 已锁），本路由绝不双跑。
function runMove(action) {
  const state = gameStore.getState();
  const res = resolveMoveTarget(state, action);

  if (res.type === "unknown") {
    return { kind: "move", ok: false, text: `去不了「${res.target || "彼处"}」（曲措乡并无此去处或方向不明），系统未移动，严禁编造新地名或写成已离开原地。` };
  }
  if (res.type === "unreachable") {
    return { kind: "move", ok: false, text: `去不了「${res.target}」（从「${state.room?.name}」没有直通「${res.target}」的道路，须先经相邻出口分段赶路），系统未移动，正文须写明路途遥远尚未动身或只看清方向，严禁写成已抵达。` };
  }
  if (res.type === "locked") {
    return { kind: "move", ok: false, text: `去不了「${res.dest}」（前路尚未开启，机缘或信物未足），系统未移动，正文须写明受阻折返，严禁写成已进入「${res.dest}」。` };
  }
  if (res.type === "noexit") {
    return { kind: "move", ok: false, text: `向${DIR_LABEL[res.dir]}走不通（此方向没有去处）——系统未结算移动，叙事不得写成已移动。` };
  }

  if (res.type === "outer") {
    const arrival = outerArrival(state, {
      direction: res.dir, destName: res.dest,
      // 必传真实格子（Review 修）：否则格子预埋拾取/路遇永不发放，
      // squareOps 却照消耗——重访玩家永远错失当批奖励。
      roomMap: state.roomCache || {}, squares: serializeSquares(),
      command: action.text || res.dest,
    });
    if (arrival?.cached && arrival.changes) {
      // innerRoomName 落到目标据点锚点（外层到达后站在锚点房）
      const anchor = getDistrictAnchor(res.dest);
      const changes = { ...arrival.changes };
      if (anchor) changes.innerRoomName = anchor;
      applyResult(featureCtx(), stripTurnSpan({ ...arrival, changes }), { feature: "judgeRoute.move" });
      return { kind: "move", ok: true, text: `你已沿${DIR_LABEL[res.dir]}路赶至「${res.dest}」${anchor ? `（落脚于${anchor}）` : ""}，系统已结算位置变更，正文须描写途中风物与初抵「${res.dest}」的景象。` };
    }
    // 格子未就绪（cached:false）或 null：目的地合法但无缓存——按未结算处理，不编位移
    return { kind: "move", ok: false, text: `去不了「${res.dest}」（路途格子尚未就绪），系统未移动，正文不得写成已抵达。` };
  }

  // inner：沿用原 innerMove 路径
  const result = innerMove(state, { direction: res.dir, command: action.text || res.dir, includeCommand: false });
  if (result?.changes?.innerRoomName) {
    applyResult(featureCtx(), stripTurnSpan(result), { feature: "judgeRoute.move" });
    return { kind: "move", ok: true, text: `你已进入${result.changes.innerRoomName}——系统已结算，叙事须照此写。` };
  }
  if (result?.logs?.length) {
    applyResult(featureCtx(), stripTurnSpan(result), { feature: "judgeRoute.move" });
    const why = result.logs.map((l) => l.text?.trim()).filter((t) => t && !t.startsWith(">")).pop();
    return { kind: "move", ok: false, text: `向${DIR_LABEL[res.dir]}走不通（${why || "此方向没有去处"}）——系统未结算移动，叙事不得写成已移动。` };
  }
  return { kind: "move", ok: false, text: "移动方向不明——系统未结算，叙事不得写成已移动。" };
}

// D1 用物分流纯函数：耗材服用 / 兵刃衣饰演练端详 / 凭帖钥匙信物出示。
// consumable 口径与 consumeItem 完全一致：item.consumable 或未带 noCatalog 盾
// 且命中 CATALOG_INDEX 药效——判官条件券新铸物撞图鉴名也不吃图鉴药效。
// 返回 "consumable" | "wield" | "present"。
// Review 修：use_item 同时承载「吃」与「出示」两种意图（intake 不细分）——
// 文本明示出示/亮出/展示且无吞服动词时，食物也不进 consumable 旁路。
const EAT_VERB_RE = /吃|喝|服|吞|嚼|饮|啃|咬|下肚|入喉|入口|下咽|咽|尝|品|干杯/;
const SHOW_VERB_RE = /出示|亮出|展示|举起|过目|验看|给.{0,4}看/;
export function classifyUseItem(state, itemObjOrName, actionText = "") {
  const item = typeof itemObjOrName === "string"
    ? (state?.inv || []).find((entry) => itemNameOf(entry) === itemObjOrName) || null
    : itemObjOrName;
  if (!item || typeof item !== "object") return "present";
  const shielded = item.noCatalog;
  const consumable = consumableOfItem(item);
  const text = String(actionText || "");
  const showOnly = SHOW_VERB_RE.test(text) && !EAT_VERB_RE.test(text);
  if (consumable && !showOnly) return "consumable";
  // Review 修：accessory 里混着凭帖信物（赌石邀帖/私印等纸面物）——它们不带任何
  // 数值加持（sixDim/effect/atk/def 皆无），不是拿来穿戴佩挂的装备，走出示而非演练。
  // 真饰品（旧护身符/虎乳牙/红线等带 sixDim 或 effect）仍为 wield。
  if (item.category === "weapon" || item.category === "armor") return "wield";
  if (item.category === "accessory") {
    // Review 四轮修：加成判定实例与图鉴双源——buildShopInventory 会丢实例加成
    // （离堆水则牌等），图鉴有词条即真饰品；无任何加成（含图鉴）的纸面名目
    // （帖/牌/书信/印/钥/令等）才是凭帖信物走出示。黑风寨木牌图鉴带 sixDim，
    // 是可佩挂装备（佩戴有魅力/气运），按 wield——出示意图属工单 escalate 的
    // 意图识别范畴，不由物类分流承担。
    const bonusOf = (x) => !!(x && typeof x === "object" && (
      (x.sixDim && Object.keys(x.sixDim).length)
      || (x.effect && Object.keys(x.effect).length)
      || Number.isFinite(x.atk) || Number.isFinite(x.def)
      || (x.sixDimTemp && Object.keys(x.sixDimTemp).length)
    ));
    const catEntry = shielded ? null : CATALOG_INDEX[itemNameOf(item)];
    if (bonusOf(item) || bonusOf(catEntry)) return "wield";
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
  const cls = classifyUseItem(state, found.item, action?.text || "");
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
