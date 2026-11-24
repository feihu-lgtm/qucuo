// 地宫内层地图 run 状态机（docs/设计_地宫内层地图.md §A-5）。
// 与旧节点流 engine.js 并存：那是「按步数抽节点」的老玩法，
// 本文件是「真·房间图行走」的新玩法——genDungeonMap 出的图就是棋盘，
// startMapRun 开局、moveRoom 走格、retreatRun/runEnd 收尾。
// 纯函数无 IO：每次调用吃上一份 runState、吐出新的不可变快照；
// 同 seed + 同操作序列 → 逐字节一致（移动用 seed 派生的 rng，不调全局 random）。

import { DUNGEON_DISTRICTS_ALL } from "../../data/dungeon/districts.js";
import { genDungeonMap } from "./genMap.js";
import { ENV_TAG_HANDLERS } from "./envTags.js";
import { seededRand } from "../../../utils/seededRandom.js";
import { normalizeHp } from "./internal.js";

const emptyLoot = () => ({ money: 0, exp: 0, pot: 0, items: [] });

// 旧节点流 dungeonId（建筑 type:dungeon 的 dungeonId）→ 内层地图 districtKey。
// 十区中「大草甸子虚幻境」（误食毒蘑菇幻觉）与「欢喜教秘坛」（欢喜堂秘坛）
// 无对应旧地宫建筑，走别的方式进入，本表不列。
export const DUNGEON_ID_TO_DISTRICT = Object.freeze({
  white_pagoda_crypt: "白塔地宫",
  sanxing_bronze_abyss: "三星堆大墓",
  tangmen_poison_vault: "蜀南唐堡千机楼",
  wuxian_centipede_den: "雾隐寨五仙秘洞",
  tianlong_serpent_crypt: "天龙营八部浮屠",
  jingguan_iron_dungeon: "成都蜀王府地宫",
  gongcuo_submerged_vault: "雪山茫野",
  heifeng_wolf_cavern: "雅江悬棺裂谷",
});

// computeSettledLoot 语义照抄：撤退/通关全带走，战败丢一半金钱经验，物品全留。
function settleLoot(loot, ratio) {
  return {
    money: Math.floor((loot?.money || 0) * ratio),
    exp: Math.floor((loot?.exp || 0) * ratio),
    pot: Math.floor((loot?.pot || 0) * ratio),
    items: [...(loot?.items || [])],
  };
}

/**
 * 开局：按 seed 生成本宫地图，人物落在锚点。
 * @returns {object} runState —— 全量快照（visited 以数组存，存档可序列化）
 */
export function startMapRun(districtKey, seed, { char } = {}) {
  const config = DUNGEON_DISTRICTS_ALL[districtKey];
  if (!config) throw new Error(`未知地宫：${districtKey}`);
  const map = genDungeonMap(seed, config);
  const hp = normalizeHp(char?.hp);
  return {
    districtKey,
    seed,
    map,
    current: map.anchor,
    visited: [map.anchor],
    envTags: {},
    envState: {},
    hp,
    entryHp: hp[0],
    loot: emptyLoot(),
    status: "exploring",
    step: 0,
    checkpoint: null,
    log: [`踏入${districtKey}，落脚${map.anchor}。`],
  };
}

// 首访房间按 envTag 所属宫的 eventSeeds 挂房间事件标记：
//   死路宝箱房 → 必取 loot 种子；空房 → 留白（null）；其余 → seed 派生抽取；
//   抽到 checkpoint 种子 → 房间升为存档点（envTag 机制认 isCheckpoint）。
function seedRoomEvent(runState, roomName, room) {
  if (room.isAnchor || room.isBoss || room.empty) return null;
  const seeds = DUNGEON_DISTRICTS_ALL[runState.districtKey]?.eventSeeds || [];
  if (!seeds.length) return null;
  const rng = seededRand(0, `mapRoomEvent|${runState.seed}|${roomName}`);
  if (room.isTreasure) {
    const loot = seeds.find((s) => s.kind === "loot");
    if (loot) return { ...loot, resolved: false };
  }
  // 穿堂房不抽死路专属的 loot 种子（宝箱房已在上面的早退分支优先取到）
  const pool = seeds.filter((s) => room.isTreasure || s.kind !== "loot");
  if (!pool.length) return null;
  const pick = pool[Math.floor(rng() * pool.length) % pool.length];
  return pick ? { ...pick, resolved: false } : null;
}

/**
 * 走一格：读 current 房的 exits[dir]，换房 → 首访挂事件 → onEnter 环境结算
 * → 检查点落地存档标记。
 * @returns {{ runState: object, log: string[]|null }} log 是这一步新增的旁白
 */
export function moveRoom(runState, dir) {
  if (runState.status !== "exploring") return { runState, log: null };
  const room = runState.map.rooms[runState.current];
  const target = room?.exits?.[dir];
  if (!target || !runState.map.rooms[target]) return { runState, log: null };

  const firstVisit = !runState.visited.includes(target);
  const next = {
    ...runState,
    current: target,
    step: runState.step + 1,
    visited: firstVisit ? [...runState.visited, target] : runState.visited,
    map: runState.map,
    log: [...runState.log],
  };

  // 首访：确定性挂房间事件（写回不可变 rooms 副本）
  if (firstVisit) {
    const tRoom = { ...next.map.rooms[target] };
    const ev = seedRoomEvent(next, target, tRoom);
    if (ev) {
      tRoom.roomEvent = ev;
      if (ev.kind === "checkpoint") tRoom.isCheckpoint = true;
      next.map = { ...next.map, rooms: { ...next.map.rooms, [target]: tRoom } };
    }
  }

  const tRoom = next.map.rooms[target];
  const logs = [tRoom.desc || `${target}。`];

  // 环境机制 onEnter（白塔铜铃/孢子浓度/失温……各自读 rs.envTags 自建状态位）
  const handler = ENV_TAG_HANDLERS[tRoom.envTag];
  if (handler?.onEnter) {
    // 状态位不可变隔离：env() 会原地改 rs.envTags[tag]，先克隆免得污染上一份快照
    next.envTags = Object.fromEntries(
      Object.entries(next.envTags || {}).map(([k, v]) => [k, { ...v }]),
    );
    const r = handler.onEnter(tRoom, next);
    if (r?.log) logs.push(r.log);
    // envState = 本房当前生效的环境效果，整体替换——上一个房间的 statMod 等不残留
    // （例如孢子检查点 onEnter 清浓度并返回空 effects，感知减益随之解除）
    next.envState = { ...(r?.effects || {}) };
  }

  // 检查点：进 isCheckpoint 房即落地全量快照——小标记记 hp/loot/步数，
  // checkpointSnapshot 存完整可还原态（map/current/visited/envState/hp/loot/seed，
  // JSON 深拷贝保证可序列化）；再访覆盖，最近一次歇脚点为准。
  if (tRoom.isCheckpoint) {
    next.checkpoint = {
      room: target,
      hp: [...next.hp],
      loot: { ...next.loot, items: [...next.loot.items] },
      step: next.step,
    };
    next.checkpointSnapshot = JSON.parse(JSON.stringify({
      seed: next.seed,
      map: next.map,
      current: target,
      visited: next.visited,
      envTags: next.envTags || {},
      envState: next.envState || {},
      hp: next.hp,
      loot: next.loot,
      step: next.step,
    }));
    logs.push("此处能歇脚避风——进度已记下。");
  }

  next.log = [...next.log, ...logs];
  return { runState: next, log: logs };
}

/**
 * 从检查点重来：战败/撤退后用落地时的完整快照还原，回到 exploring 继续走。
 * @returns {{ runState: object|null, log: string|null }} 无快照则 runState 为 null
 */
export function restoreCheckpoint(runState) {
  const snap = runState?.checkpointSnapshot;
  if (!snap) return { runState: null, log: null };
  const restored = JSON.parse(JSON.stringify(snap));
  const next = {
    ...runState,
    map: restored.map,
    current: restored.current,
    visited: restored.visited,
    envTags: restored.envTags || {},
    envState: restored.envState || {},
    hp: restored.hp,
    loot: restored.loot,
    step: restored.step,
    status: "exploring",
  };
  const log = `退回${restored.current}，从头再来。`;
  next.log = [...(runState.log || []), log];
  return { runState: next, log };
}

/**
 * 存档序列化：runState 本就是纯 JSON 结构（visited 数组、无函数/Set），
 * 序列化=深拷贝断引用；反序列化做形状兜底（老档无 checkpointSnapshot 不炸）。
 */
export function serializeMapRun(runState) {
  if (!runState) return null;
  return JSON.parse(JSON.stringify(runState));
}

export function deserializeMapRun(data) {
  if (!data || typeof data !== "object" || !data.map?.rooms) return null;
  return {
    districtKey: data.districtKey,
    seed: data.seed,
    map: data.map,
    current: data.current || data.map.anchor,
    visited: Array.isArray(data.visited) ? data.visited : [data.map.anchor],
    envTags: data.envTags || {},
    envState: data.envState || {},
    hp: data.hp,
    entryHp: data.entryHp ?? data.hp?.[0],
    loot: data.loot || emptyLoot(),
    status: data.status || "exploring",
    step: data.step || 0,
    checkpoint: data.checkpoint || null,
    checkpointSnapshot: data.checkpointSnapshot || null,
    log: Array.isArray(data.log) ? data.log : [],
    // bossDefeated 只在 victory 快照里出现：按源数据有无键原样保留，保 roundtrip 精确
    ...(data.bossDefeated !== undefined ? { bossDefeated: data.bossDefeated } : {}),
  };
}

/**
 * 撤退：走到哪算哪，loot 全保住。
 * @returns {{ runState: object, settledLoot: object|null, log: string|null }}
 */
export function retreatRun(runState) {
  if (runState.status !== "exploring") return { runState, settledLoot: null, log: null };
  const next = { ...runState, status: "retreated" };
  return {
    runState: next,
    settledLoot: settleLoot(next.loot, 1),
    log: "见好就收，顺着来路稳稳撤出了地宫。",
  };
}

/**
 * 终局结算：boss 胜=victory 全带走；任意房战败=1 血丢半 loot。
 * @param {"victory"|"defeated"} outcome
 */
export function runEnd(runState, outcome) {
  if (outcome === "victory") {
    const next = { ...runState, status: "victory", bossDefeated: true };
    return {
      runState: next,
      settledLoot: settleLoot(next.loot, 1),
      log: "镇宫首领已倒，打通地宫，战利品尽数带回！",
    };
  }
  const next = {
    ...runState,
    status: "defeated",
    hp: [Math.min(1, runState.hp[0]), runState.hp[1]],
  };
  // 有检查点存档则给"从检查点重来"选项（消费方读 canRestore 出按钮 → restoreCheckpoint）
  return {
    runState: next,
    settledLoot: settleLoot(next.loot, 0.5),
    canRestore: Boolean(next.checkpointSnapshot),
    log: "不敌倒地，负伤被逐出地宫，摸到的东西丢了大半……",
  };
}
