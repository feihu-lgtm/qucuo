// #669 地宫消耗账本：房间事件以账本为唯一事实源，视图过期时按账本重新水合。
import { describe, expect, it } from "vitest";
import {
  deserializeMapRun,
  ensureDungeonWorld,
  isGridRoomConsumed,
  moveRoom,
  reconcileGridRoomEvents,
  restoreCheckpoint,
  retreatRun,
  serializeMapRun,
  startMapRun,
  syncDungeonWorld,
  applyMapBattleResult,
} from "./mapRun.js";
import { routeRoomAction } from "./actionRouter.js";

const DK = "断鞍古驿";
const CHAR = { hp: [9999, 9999], money: 500 };

// 广度优先求入口到目标房的方向序列（只看拓扑，不管迷雾）
function pathTo(map, from, to) {
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const [dir, nextRoom] of Object.entries(map.rooms[cur]?.exits || {})) {
      if (!(nextRoom in prev)) { prev[nextRoom] = [cur, dir]; queue.push(nextRoom); }
    }
  }
  const dirs = [];
  for (let cur = to; prev[cur]; cur = prev[cur][0]) dirs.unshift(prev[cur][1]);
  return dirs;
}

function goTo(runState, target) {
  let rs = runState;
  for (const dir of pathTo(rs.map, rs.current, target)) {
    rs = moveRoom(rs, dir).runState;
    if (rs.status !== "exploring") break;
  }
  return rs;
}

// 找一间挂着事件、且能安全走到的指定类型房
function findRoomWithEvent(world, kind) {
  const base = startMapRun(DK, "s", { char: CHAR, world });
  for (const [name, room] of Object.entries(base.map.rooms)) {
    if (room.roomKind !== kind) continue;
    const rs = goTo(base, name);
    const ev = rs.map.rooms[name].roomEvent;
    if (rs.current === name && rs.status === "exploring" && ev && !ev.resolved && (kind === "neutral" || ev.options?.length)) {
      return { name, rs };
    }
  }
  return null;
}

function resolveFully(rs, roomName) {
  let next = rs;
  for (let i = 0; i < 4; i++) {
    const ev = next.map.rooms[roomName].roomEvent;
    if (!ev || ev.resolved) break;
    // 无按钮的中立事件：任一动作文本即触发裁决；出了分支再挑一项非「离开」的
    const option = (ev.options || []).find((o) => !/离开|作罢|让路|别过/.test(o.label)) || ev.options?.[0];
    next = routeRoomAction(next, option?.label || "上前查看", { attrs: {}, rng: () => 0.01 }).runState;
  }
  return next;
}

describe("地宫消耗账本（#669）", () => {
  it("中立事件了结即记入 clearedRooms，撤出后从同一世界再进不再复现", () => {
    const world = ensureDungeonWorld(DK, null, { time: 0 });
    const found = findRoomWithEvent(world, "neutral");
    expect(found).toBeTruthy();
    const done = resolveFully(found.rs, found.name);
    expect(done.map.rooms[found.name].roomEvent.resolved).toBe(true);
    expect(done.clearedRooms).toContain(found.name);

    const out = retreatRun(goTo(done, done.map.anchor)).runState;
    const synced = syncDungeonWorld(world, out, { time: 1 });
    const again = goTo(startMapRun(DK, "s2", { char: CHAR, world: synced }), found.name);
    expect(again.map.rooms[found.name].roomEvent).toBeNull();
  });

  it("13×13 遭遇战开打不结清：脱出战圈后敌人仍在，可再迎战；得胜后才记账", () => {
    const world = ensureDungeonWorld(DK, null, { time: 0 });
    const found = findRoomWithEvent(world, "combat");
    expect(found).toBeTruthy();
    const label = found.rs.map.rooms[found.name].roomEvent.options[0].label;
    const fight = routeRoomAction(found.rs, label, { attrs: {} }).runState;
    expect(fight.status).toBe("combat");
    expect(fight.map.rooms[found.name].roomEvent.resolved).toBe(false);

    const fled = applyMapBattleResult(fight, { outcome: "flee", playerHp: 9999 });
    expect(fled.clearedRooms || []).not.toContain(found.name);
    const back = goTo(fled, found.name);
    expect(back.map.rooms[found.name].roomEvent.options[0].label).toBe(label);

    const refight = routeRoomAction(back, label, { attrs: {} }).runState;
    const won = applyMapBattleResult(refight, { outcome: "win", playerHp: 9999 });
    expect(won.clearedRooms).toContain(found.name);
    expect(won.map.rooms[found.name].roomEvent.resolved).toBe(true);
  });

  it("账本已记消耗、视图仍挂旧事件时：读档与进房都按账本校正", () => {
    const world = ensureDungeonWorld(DK, null, { time: 0 });
    const found = findRoomWithEvent(world, "chest");
    expect(found).toBeTruthy();
    // 人为造出「账本已开箱、视图未结清」的旧档
    const stale = { ...found.rs, openedChests: [...(found.rs.openedChests || []), found.name] };
    expect(isGridRoomConsumed(stale, found.name, stale.map.rooms[found.name])).toBe(true);

    const loaded = deserializeMapRun(serializeMapRun(stale));
    expect(loaded.map.rooms[found.name].roomEvent).toBeNull();

    const exits = Object.entries(stale.map.rooms[found.name].exits);
    const [outDir, neighbor] = exits[0];
    const backDir = Object.entries(stale.map.rooms[neighbor].exits).find(([, n]) => n === found.name)[0];
    const away = moveRoom(stale, outDir).runState;
    const reentered = moveRoom(away, backDir).runState;
    expect(outDir).toBeTruthy();
    expect(reentered.map.rooms[found.name].roomEvent).toBeNull();
  });

  it("检查点回档只回滚位置与收获，开过的箱子不能再开一次", () => {
    const world = ensureDungeonWorld(DK, null, { time: 0 });
    const found = findRoomWithEvent(world, "chest");
    expect(found).toBeTruthy();
    // 在开箱前留一份检查点快照（与 moveRoom 落检查点同形）
    const withCheckpoint = {
      ...found.rs,
      checkpointSnapshot: JSON.parse(JSON.stringify({
        seed: found.rs.seed, map: found.rs.map, current: found.rs.current, visited: found.rs.visited,
        envTags: {}, envState: {}, hp: found.rs.hp, loot: found.rs.loot, step: found.rs.step,
      })),
    };
    const opened = routeRoomAction(withCheckpoint, "开启奖励箱", { attrs: {} }).runState;
    expect(opened.openedChests).toContain(found.name);
    const restored = restoreCheckpoint(opened).runState;
    expect(restored.map.rooms[found.name].roomEvent).toBeNull();
  });

  it("旧 10 区图（无 roomKind）不受校正影响", () => {
    const legacy = {
      districtKey: DK, seed: "t", map: { anchor: "甲", rooms: { 甲: { exits: {}, roomEvent: { kind: "loot", resolved: false } } } },
      current: "甲", visited: ["甲"], hp: [10, 10], loot: { money: 0, exp: 0, pot: 0, items: [] }, status: "exploring", step: 0, log: [],
    };
    expect(reconcileGridRoomEvents(legacy)).toBe(legacy);
  });
});
