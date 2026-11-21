// 材料库：AI 调用的上下文材料
// -----------------------------------------------------------------------------
// 每种材料是一个纯函数：吃一份回合状态快照，吐一小段简体中文字符串；
// 没有可说的就返回空串。调用卡（calls/）声明自己要挂哪些材料 id，
// 由 pickMaterials 按声明顺序拼出最终的上下文块。
//
// 快照字段（与 runTurn.js 拼 deps / actCall.js 读 d.* 的同一份数据）：
//   varTree, room{name,desc,npcs,items}, innerRoomName(或 innerRoom), inv, char,
//   mainConvo(主对话 [{role,content}]), cmd, target(NPC 对象或名字), settleNpc,
//   infoDomainBlock, recallBlock, visibleNpcs(可选，已算好的在场名单)
//
// 注意：domain 层不引 engine；在场判定复用 state/fields.js 的 getPresentNpcs，
// 远景复用 memory/daySummary.js 的 buildDistantViewBlock。

import { CATEGORY_LABEL } from "../../economy/equipment.js";
import { QUALITY } from "../../economy/equipment.js";
import { hasInnerMap } from "../../map/innerMap.js";
import { getPresentNpcs } from "../../state/fields.js";
import { buildDistantViewBlock } from "../../memory/daySummary.js";
import { isNpcKnown } from "../../npc/npcAwareness.js";

const INNER = (snap) => snap.innerRoom ?? snap.innerRoomName ?? "";
const cut = (text, n) => {
  const t = String(text ?? "").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
};

// 解析"对方"：target 可能是 NPC 对象或名字；settleNpc 是结算目标名字兜底。
function resolveTarget(snap) {
  const t = snap.target;
  if (t && typeof t === "object") return t;
  const name = typeof t === "string" ? t : snap.settleNpc;
  if (!name) return null;
  return (snap.room?.npcs || []).find((n) => n.name === name) || { name };
}

// ── 玩家这句话 ──
export function playerLine(snap) {
  return snap.cmd ? `【玩家这句话】${snap.cmd}` : "";
}

// mainConvo を user→assistant の対に分ける。末尾に未回答の user が残れば、
// それは"今回のコマンド"なので対の末尾には含めない（前ターンの対と混ぜない）。
function pairTurns(convo) {
  const pairs = [];
  let pending = null;
  for (const m of convo || []) {
    if (m.role === "user") {
      if (pending) pairs.push(pending);
      pending = { user: m.content, assistant: "" };
    } else if (m.role === "assistant" && pending) {
      pending.assistant = (pending.assistant ? pending.assistant + "\n" : "") + m.content;
    }
  }
  if (pending) pairs.push(pending);
  return pairs;
}

// 取 mainConvo 里最近一轮已完成 玩家→引擎 对（引擎回复がない末尾の user は今回の命令）。
function lastPair(snap) {
  const pairs = pairTurns(snap.mainConvo);
  const done = pairs.filter((p) => p.assistant);
  return done.length ? done[done.length - 1] : null;
}

// ── 上一轮（玩家句 + 引擎回复，截短） ──
export function lastTurn(snap) {
  const pair = lastPair(snap);
  if (!pair) return "";
  const lines = [`玩家：${cut(pair.user, 80)}`];
  if (pair.assistant) lines.push(`引擎：${cut(pair.assistant, 80)}`);
  return `【上一轮】\n${lines.join("\n")}`;
}

// ── 最近 n 轮（默认 3 轮）──
export function recentTurns(n = 3) {
  return (snap) => {
    const turns = pairTurns(snap.mainConvo).slice(-n);
    if (!turns.length) return "";
    const body = turns
      .map((t) => `玩家：${cut(t.user, 80)}${t.assistant ? `\n引擎：${cut(t.assistant, 80)}` : ""}`)
      .join("\n");
    return `【最近${turns.length}轮】\n${body}`;
  };
}

// ── 在场人名：只算当前内层房间真正可见的 NPC ──
export function presentNpcs(snap) {
  const npcs = snap.visibleNpcs ?? getPresentNpcs({ room: snap.room, innerRoomName: INNER(snap) });
  const names = (npcs || []).map((n) => n.name).filter(Boolean);
  return names.length ? `【在场】${names.join("、")}` : "";
}

// ── 对方档案：名字、简介、品阶、关系/好感、生气状态 ──
export function targetProfile(snap) {
  const npc = resolveTarget(snap);
  if (!npc?.name) return "";
  const attrs = snap.varTree?.角色?.[npc.name] || {};
  const lines = [`名字：${npc.name}`];
  if (npc.brief) lines.push(`简介：${npc.brief}`);
  if (typeof npc.levelCap === "number") {
    lines.push(`品阶：${QUALITY[Math.max(0, Math.min(5, npc.levelCap))]}档`);
  }
  if (isNpcKnown(snap.varTree, npc.name)) {
    const affection = typeof attrs.好感度 === "number" ? `好感度${attrs.好感度}` : "尚无明显好恶";
    lines.push(`关系：${affection}${attrs.态度 ? `，${attrs.态度}` : ""}`);
  } else {
    lines.push("关系：尚不相识");
  }
  if (attrs.生气状态?.active) {
    lines.push(`状态：正在生气（${attrs.生气状态.reason || "缘由不明"}${typeof attrs.生气状态.turnsLeft === "number" ? `，还剩${attrs.生气状态.turnsLeft}回合` : ""}）`);
  }
  return `【对方档案】\n${lines.join("\n")}`;
}

// ── 双方物品：对方身上的 / 我的 / 地上的，三件一组 ──
// 每件只写四样：名字、归属、类别+品阶、一句外观——不写数值，不搬大目录。
function itemLine(item, owner) {
  const it = typeof item === "string" ? { name: item } : item || {};
  if (!it.name) return "";
  const catLabel = CATEGORY_LABEL[it.category] || (it.category ? String(it.category) : "杂物");
  const look = it.desc ? `，${cut(it.desc, 30)}` : "";
  return `· ${it.name}（${owner}，${catLabel}${it.quality ? `·${it.quality}档` : ""}${look}）`;
}

export function items(snap) {
  const groups = [];
  const npc = resolveTarget(snap);
  // stolen（窃取済み）も dropped（切磋で玩家に落としたもの）も相手の持ち物には出さない。
  const theirs = (npc?.carriedItems || []).filter((i) => !i?.stolen && !i?.dropped)
    .map((i) => itemLine(i, "对方")).filter(Boolean);
  if (theirs.length) groups.push(`对方身上：\n${theirs.join("\n")}`);
  const mine = (snap.inv || []).map((i) => itemLine(i, "我")).filter(Boolean);
  if (mine.length) groups.push(`我身上：\n${mine.join("\n")}`);
  const ground = (snap.room?.items || []).map((i) => itemLine(i, "地上")).filter(Boolean);
  if (ground.length) groups.push(`地上：\n${ground.join("\n")}`);
  return groups.length ? `【双方物品】\n${groups.join("\n")}` : "";
}

// ── 场地：地名（据点·内层）+ 房间描述原文 ──
export function venue(snap) {
  const room = snap.room;
  if (!room?.name) return "";
  const inner = INNER(snap);
  const place = hasInnerMap(room.name) && inner ? `${room.name}·${inner}` : room.name;
  return `【场地】${place}${room.desc ? `\n${room.desc}` : ""}`;
}

// ── 和对方的旧账：varTree.角色[名].旧账 { lines, updatedTurn }，防御性读取 ──
export function targetLedger(snap) {
  const npc = resolveTarget(snap);
  if (!npc?.name) return "";
  const ledger = snap.varTree?.角色?.[npc.name]?.旧账;
  const lines = Array.isArray(ledger?.lines) ? ledger.lines.filter(Boolean) : [];
  if (!lines.length) return "";
  return `【和对方的旧账】\n${lines.map((l) => `· ${l}`).join("\n")}`;
}

// ── 远景：日总结垫底（复用 buildDistantViewBlock） ──
export function distantView(snap) {
  return buildDistantViewBlock(snap.varTree || {}, 5);
}

// ── 信息域 / 召回：上游已算好的块，原样透传 ──
export function infoDomain(snap) {
  return snap.infoDomainBlock || "";
}

export function recall(snap) {
  return snap.recallBlock || "";
}

// 材料登记表：id 用英文，输出行文用中文标签。
export const MATERIALS = {
  playerLine,
  lastTurn,
  recentTurns: recentTurns(3),
  presentNpcs,
  targetProfile,
  items,
  venue,
  targetLedger,
  distantView,
  infoDomain,
  recall,
};

// 按声明顺序拼接材料；空块跳过。ids 可以是材料 id，也可以是 (snap)=>string 的函数
// （比如 recentTurns(5) 这种要自定义参数的）。
export function pickMaterials(ids, snap) {
  const blocks = (ids || []).map((entry) => {
    const fn = typeof entry === "function" ? entry : MATERIALS[entry];
    if (!fn) throw new Error(`Unknown material: ${entry}`);
    return fn(snap);
  }).filter((block) => typeof block === "string" && block.trim());
  return blocks.join("\n");
}
