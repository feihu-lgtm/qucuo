// 地宫内层地图 · 房间动作路由层（docs/设计_地宫内层地图.md A 节消费口）。
// 把「点按钮/输文本」翻译成对 runState 的确定性推进：
//   routeRoomAction 处理结构化动作（拾取/存档/触发房间事件/选分支项）；
//   routeRoomText   处理自由文本（挂着 activePuzzle 时先走 parseIntent→applyAction，
//                   否则原样退回 needsAI，让上层 AI 意图识别接管）。
// 纯函数无 IO：吃 runState 快照、吐新快照，与 mapRun 同一套不可变语义。

import { resolveRoomEvent } from "./events.js";
import { mergeLoot, calcDungeonCheckRate } from "./internal.js";
import { random } from "../../../utils/rng.js";

const PICK_LABEL = /拾取|捡起|捡起来|拿走/;
const SAVE_LABEL = /记录存档|存档|歇脚|休整/;

// ---- 快照工具 ----
const withRoom = (runState, room) => ({
  ...runState,
  map: { ...runState.map, rooms: { ...runState.map.rooms, [runState.current]: room } },
});
const roomOf = (runState) => runState.map?.rooms?.[runState.current] || null;

const markEvent = (runState, patch) => {
  const room = roomOf(runState);
  if (!room?.roomEvent) return runState;
  return withRoom(runState, { ...room, roomEvent: { ...room.roomEvent, ...patch } });
};

const takeCheckpoint = (runState) => ({
  room: runState.current,
  hp: [...runState.hp],
  loot: { ...runState.loot, items: [...runState.loot.items] },
  step: runState.step,
});

// 把 resolveRoomEvent 的 effects/lootDelta 落回 runState：hp 扣血、loot 落袋、
// supplies 折算成 pot（药补给）、checkpoint 效果落存档快照。
function applyEffects(runState, res) {
  const next = { ...runState, hp: [...runState.hp], log: [...runState.log] };
  for (const e of res.effects || []) {
    if (e.type === "hp_loss") next.hp[0] = Math.max(0, next.hp[0] - (e.amount || 0));
    if (e.type === "checkpoint") next.checkpoint = takeCheckpoint(next);
  }
  const d = res.lootDelta || {};
  const delta = { ...d };
  if (d.supplies) { delta.pot = (delta.pot || 0) + d.supplies; delete delta.supplies; }
  if (delta.money || delta.exp || delta.pot || delta.items?.length) {
    next.loot = mergeLoot(next.loot, delta);
  }
  next.log.push(res.log);
  return next;
}

// 分支选项落点：option.effect.type 决定归宿；检定类选项按 check/dc 再判一次。
function chooseOption(runState, option, { attrs, rng }) {
  const eff = option.effect || {};
  if (eff.type === "leave") {
    // 离开不判 resolved——事件仍在，回来还能再触发
    const next = markEvent(runState, { options: undefined });
    next.log = [...next.log, `${option.label}，就此作罢。`];
    return { runState: next, log: next.log[next.log.length - 1] };
  }
  let success = true;
  let rate = null;
  if (option.check) {
    rate = calcDungeonCheckRate(Number(attrs?.[option.check]) || 5, option.dc ?? 5);
    success = rng() * 100 < rate;
  }
  const outcome = eff.outcome || "";
  const log = success
    ? `${option.label}——${outcome || "成了。"}`
    : `${option.label}——火候差了一线，${outcome || "没能如愿。"}`;
  const next = markEvent(runState, { resolved: true, options: undefined });
  next.log = [...next.log, log];
  return {
    runState: next,
    log,
    branchEffect: { type: eff.type, check: option.check || null, dc: option.dc ?? 0, rate, success },
  };
}

/**
 * 房间动作入口。
 * @param {object} runState mapRun 系快照
 * @param {string} label   按钮/动作标签（拾取、记录存档、触发事件、或分支选项文本）
 * @param {{attrs?:object, rng?:()=>number}} ctx
 * @returns {{runState:object, log:string|null, combatNpc?:object, nsfwBranch?:object,
 *            puzzleInstance?:object, branchEffect?:object, needsAI?:boolean, text?:string}}
 */
export function routeRoomAction(runState, label, { attrs = {}, rng = random } = {}) {
  if (!runState || runState.status !== "exploring") {
    return { runState, log: null };
  }
  const room = roomOf(runState);
  const text = String(label || "").trim();

  // ① 地上之物：拾取入袋
  if (PICK_LABEL.test(text) && (room?.groundLoot || []).length) {
    const picked = room.groundLoot.map((g) => (typeof g === "string" ? g : g?.name)).filter(Boolean);
    const next = withRoom(runState, { ...room, groundLoot: [] });
    next.loot = mergeLoot(next.loot, { items: picked });
    const log = `拾取了${picked.join("、")}。`;
    next.log = [...next.log, log];
    return { runState: next, log };
  }

  // ② 存档点：手动记录（mapRun 只自动记首个检查点，这里允许刷新）
  if (SAVE_LABEL.test(text) && room?.isCheckpoint) {
    const next = { ...runState, checkpoint: takeCheckpoint(runState) };
    const log = "在此歇脚避风，进度重新记下。";
    next.log = [...next.log, log];
    return { runState: next, log };
  }

  const ev = room?.roomEvent;

  // ③ 已挂分支选项：按 label 选一项
  if (ev?.options?.length) {
    const option = ev.options.find((o) => o.label === text);
    if (option) return chooseOption(runState, option, { attrs, rng });
  }

  // ④ 未决房间事件：触发 resolver
  if (ev && !ev.resolved) {
    const res = resolveRoomEvent(ev.kind, ev, { attrs, loot: runState.loot, rng });
    let next = applyEffects(runState, res);
    if (res.combatNpc) {
      next = markEvent(next, { resolved: true });
      return { runState: next, log: res.log, combatNpc: res.combatNpc };
    }
    if (res.puzzleInstance || res.effects?.some((e) => e.type === "puzzle")) {
      const inst = res.puzzleInstance || res.effects.find((e) => e.type === "puzzle").instance;
      next.activePuzzle = { instance: inst, state: inst.state, room: runState.current };
      return { runState: next, log: res.log, puzzleInstance: inst };
    }
    if (res.nsfwBranch) {
      next = markEvent(next, { options: res.nsfwBranch.options });
      return { runState: next, log: res.log, nsfwBranch: res.nsfwBranch };
    }
    if (res.branch) {
      next = markEvent(next, { options: res.branch.options });
      return { runState: next, log: res.log, branch: res.branch };
    }
    next = markEvent(next, { resolved: true });
    return { runState: next, log: res.log };
  }

  // ⑤ 挂着谜题时，结构化按钮也当文本喂给 parseIntent
  if (runState.activePuzzle) {
    return routeRoomText(runState, text, { attrs });
  }

  return { runState, log: null, needsAI: true, text };
}

/**
 * 自由文本入口：有 activePuzzle → parseIntent→applyAction 推进回合；
 * 无 → 原样退回 needsAI 交上层 AI 意图识别。
 * @returns {{runState:object, log:string|null, done?:boolean, fail?:boolean,
 *            needsAI?:boolean, text?:string}}
 */
export function routeRoomText(runState, text, { attrs = {} } = {}) {
  const ap = runState?.activePuzzle;
  if (!ap?.instance) return { runState, log: null, needsAI: true, text };
  const input = ap.instance.parseIntent?.(text);
  if (!input) return { runState, log: null, needsAI: true, text };

  const r = ap.instance.applyAction(input, ap.state, attrs);
  const next = { ...runState, log: [...runState.log, r.log] };
  if (r.done) {
    // 谜题解开：摘除 activePuzzle、对应房间事件标记已决
    delete next.activePuzzle;
    const doneNext = markEvent(next, { resolved: true });
    return { runState: doneNext, log: r.log, done: true, fail: !!r.fail };
  }
  next.activePuzzle = { ...ap, state: r.state };
  return { runState: next, log: r.log, done: false, fail: !!r.fail };
}
