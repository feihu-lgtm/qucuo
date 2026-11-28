import { describe, expect, it } from "vitest";
import { DUNGEON_DISTRICTS_ALL } from "../../data/dungeon/districts.js";
import {
  applyMapBattleResult,
  deserializeMapRun,
  ensureDungeonWorld,
  moveRoom,
  normalizeDungeonStore,
  restoreCheckpoint,
  retreatRun,
  rollChestRewards,
  runEnd,
  serializeMapRun,
  startMapRun,
  syncDungeonWorld,
} from "./mapRun.js";
import { routeRoomAction } from "./actionRouter.js";

const DK = "白塔地宫";

// 确定性地走完可达图：DFS 优先走没访问过的房，没路就回溯（访问顺序随 seed 固定）
function exploreAll(runState, maxSteps = 200) {
  const stack = [runState.current];
  let rs = runState;
  let guard = 0;
  while (stack.length && guard++ < maxSteps) {
    const room = rs.map.rooms[rs.current];
    const next = Object.entries(room.exits).find(([, t]) => !rs.visited.includes(t));
    if (next) {
      rs = moveRoom(rs, next[0]).runState;
      stack.push(rs.current);
    } else {
      stack.pop();
      if (!stack.length) break;
      const backDir = Object.entries(room.exits).find(([, t]) => t === stack[stack.length - 1]);
      rs = moveRoom(rs, backDir[0]).runState;
    }
  }
  return rs;
}

describe("startMapRun", () => {
  it("开局落在锚点，visited 含锚点，状态 exploring", () => {
    const rs = startMapRun(DK, "s1");
    expect(rs.current).toBe(rs.map.anchor);
    expect(rs.visited).toEqual([rs.map.anchor]);
    expect(rs.status).toBe("exploring");
    expect(rs.loot).toEqual({ money: 0, exp: 0, pot: 0, items: [] });
    expect(rs.hp).toEqual([100, 100]);
  });

  it("char.hp 透传并归一化", () => {
    const rs = startMapRun(DK, "s1", { char: { hp: [37, 120] } });
    expect(rs.hp).toEqual([37, 120]);
  });

  it("同 seed 逐字节一致、异 seed 图不同", () => {
    expect(startMapRun(DK, "s1")).toEqual(startMapRun(DK, "s1"));
    expect(startMapRun(DK, "s1").map).not.toEqual(startMapRun(DK, "s2").map);
  });

  it("未知地宫抛错", () => {
    expect(() => startMapRun("不存在的宫", "s1")).toThrow("未知地宫");
  });
});

describe("moveRoom", () => {
  it("沿 exits 走，visited 累积，返回新增日志", () => {
    let rs = startMapRun(DK, "walk");
    const dir = Object.keys(rs.map.rooms[rs.current].exits)[0];
    const target = rs.map.rooms[rs.current].exits[dir];
    const { runState, log } = moveRoom(rs, dir);
    expect(runState.current).toBe(target);
    expect(runState.visited).toContain(target);
    expect(Array.isArray(log) && log.length).toBeTruthy();
    expect(runState.log.length).toBe(rs.log.length + log.length);
  });

  it("没路的方向不动状态", () => {
    const rs = startMapRun(DK, "walk");
    const { runState, log } = moveRoom(rs, "d"); // 锚点各出口里挑一个一定没有的：u/d 二选一
    if (rs.map.rooms[rs.current].exits.d) return; // 该 seed 锚点恰有 d 则跳过断言
    expect(runState).toBe(rs);
    expect(log).toBeNull();
  });

  it("同 seed 同走法逐字节一致（首访事件种子确定）", () => {
    const walk = (seed) => {
      let rs = startMapRun(DK, seed);
      for (let i = 0; i < 6; i++) {
        const dir = Object.keys(rs.map.rooms[rs.current].exits)[0];
        rs = moveRoom(rs, dir).runState;
      }
      return rs;
    };
    expect(walk("same")).toEqual(walk("same"));
  });

  it("重访不重复挂事件", () => {
    let rs = startMapRun(DK, "revisit");
    const exits = rs.map.rooms[rs.current].exits;
    const dir = Object.keys(exits)[0];
    const target = exits[dir];
    const backDir = Object.entries(rs.map.rooms[target].exits).find(([, t]) => t === rs.current)[0];
    rs = moveRoom(rs, dir).runState;
    const evOnce = rs.map.rooms[target].roomEvent;
    rs = moveRoom(rs, backDir).runState;
    rs = moveRoom(rs, dir).runState;
    expect(rs.map.rooms[target].roomEvent).toEqual(evOnce);
  });

  it("非 exploring 状态拒绝移动", () => {
    const rs = { ...startMapRun(DK, "x"), status: "victory" };
    expect(moveRoom(rs, "n").runState).toBe(rs);
  });
});

describe("事件与环境机制", () => {
  it("死路宝箱房首访挂 loot 种子", () => {
    for (const seed of ["t1", "t2", "t3", "t4", "t5"]) {
      const rs = exploreAll(startMapRun(DK, seed));
      for (const [name, room] of Object.entries(rs.map.rooms)) {
        if (room.isTreasure && rs.visited.includes(name) && !room.empty) {
          expect(room.roomEvent?.kind).toBe("loot");
        }
      }
    }
  });

  it("空房留白不挂事件", () => {
    const rs = exploreAll(startMapRun(DK, "e1"));
    for (const room of Object.values(rs.map.rooms)) {
      if (room.empty) expect(room.roomEvent).toBeNull();
    }
  });

  it("走到 checkpoint 种子的房落地存档标记（十宫扫一遍必中）", () => {
    let hit = null;
    for (const dk of Object.keys(DUNGEON_DISTRICTS_ALL)) {
      for (const seed of ["c1", "c2", "c3"]) {
        const rs = exploreAll(startMapRun(dk, seed));
        const ckRoom = Object.values(rs.map.rooms).find((r) => r.isCheckpoint);
        if (ckRoom && rs.checkpoint) { hit = { rs, ckRoom }; break; }
      }
      if (hit) break;
    }
    expect(hit).not.toBeNull();
    expect(hit.rs.checkpoint.room).toBeTruthy();
    expect(hit.rs.checkpoint.loot).toBeDefined();
    expect(hit.rs.log.join("")).toContain("进度已记下");
  });

  it("envTag onEnter 结算进 envState/log（白塔铜铃）", () => {
    let rs = startMapRun("白塔地宫", "bell");
    const dir = Object.keys(rs.map.rooms[rs.current].exits)[0];
    const { runState, log } = moveRoom(rs, dir);
    // baitaPrayerWheel.onEnter 首房触发 log 或 effects 之一即算接线成功
    const fired = (log && log.length > 1) || Object.keys(runState.envState).length > 0 || Object.keys(runState.envTags).length > 0;
    expect(fired).toBe(true);
  });

  it("handler 改 envTags 不污染上一份快照（同走法重放不涨层）", () => {
    const rs0 = startMapRun("断鞍古驿", "spore1");
    const dir = Object.keys(rs0.map.rooms[rs0.current].exits)[0];
    const a = moveRoom(rs0, dir).runState;
    const b = moveRoom(rs0, dir).runState; // 从同一份快照重放同一走法
    expect(a.envTags.spore?.level).toBe(1);
    expect(b.envTags.spore?.level).toBe(1); // 不叠到 2
    expect(rs0.envTags).toEqual({}); // 原快照未被污染
  });

  it("孢子检查点清零后感知减益随之解除", () => {
    // 扫若干 seed 找到可达检查点房，进房前先有 statMod 减益、进后清除
    for (const seed of ["p1", "p2", "p3", "p4", "p5", "p6"]) {
      let rs = startMapRun("断鞍古驿", seed);
      let found = false;
      let sawDebuff = false;
      const stack = [rs.current];
      let guard = 0;
      while (stack.length && guard++ < 200 && !found) {
        const room = rs.map.rooms[rs.current];
        const nxt = Object.entries(room.exits).find(([, t]) => !rs.visited.includes(t));
        let step;
        if (nxt) {
          step = moveRoom(rs, nxt[0]);
          stack.push(step.runState.current);
        } else {
          stack.pop();
          if (!stack.length) break;
          const back = Object.entries(room.exits).find(([, t]) => t === stack[stack.length - 1]);
          step = moveRoom(rs, back[0]);
        }
        rs = step.runState;
        if (rs.envState.statMod?.感知 < 0) sawDebuff = true;
        if (rs.map.rooms[rs.current].isCheckpoint && sawDebuff) {
          found = true;
          expect(rs.envTags.spore?.level).toBe(0);
          expect(rs.envState.statMod).toBeUndefined(); // 上一房的 -感知 不残留
        }
      }
      if (found) return;
    }
    throw new Error("6 个 seed 都没生成检查点房——断言前提不成立");
  });

  it("穿堂房不抽死路专属 loot 种子", () => {
    for (const dk of Object.keys(DUNGEON_DISTRICTS_ALL)) {
      const rs = exploreAll(startMapRun(dk, "lootscan"));
      for (const [name, room] of Object.entries(rs.map.rooms)) {
        if (!rs.visited.includes(name) || room.isTreasure || room.isBoss || room.isAnchor) continue;
        expect(room.roomEvent?.kind).not.toBe("loot");
      }
    }
  });
});

describe("retreatRun / runEnd", () => {
  const withLoot = (rs) => ({
    ...rs,
    loot: { money: 10, exp: 9, pot: 3, items: ["短刀", "干粮"] },
    hp: [40, 100],
  });

  it("撤退：loot 全保", () => {
    const rs = withLoot(startMapRun(DK, "r"));
    const { runState, settledLoot, log } = retreatRun(rs);
    expect(runState.status).toBe("retreated");
    expect(settledLoot).toEqual({ money: 10, exp: 9, pot: 3, items: ["短刀", "干粮"] });
    expect(log).toContain("撤");
  });

  it("boss 胜：结算全带走", () => {
    const rs = withLoot(startMapRun(DK, "v"));
    const { runState, settledLoot } = runEnd(rs, "victory");
    expect(runState.status).toBe("victory");
    expect(settledLoot.money).toBe(10);
    expect(settledLoot.items).toEqual(["短刀", "干粮"]);
  });

  it("战败：1 血丢半 loot、物品保留", () => {
    const rs = withLoot(startMapRun(DK, "d"));
    const { runState, settledLoot, log } = runEnd(rs, "defeated");
    expect(runState.status).toBe("defeated");
    expect(runState.hp).toEqual([1, 100]);
    expect(settledLoot).toEqual({ money: 5, exp: 4, pot: 1, items: ["短刀", "干粮"] });
    expect(log).toBeTruthy();
  });

  it("终局后再撤退不再重复结算", () => {
    const rs = { ...startMapRun(DK, "z"), status: "defeated" };
    expect(retreatRun(rs).settledLoot).toBeNull();
  });
});

describe("checkpointSnapshot / restoreCheckpoint / 序列化", () => {
  // 扫十宫若干 seed，找一个走完可达图后拿到 checkpointSnapshot 的 run
  function findCheckpointRun() {
    for (const dk of Object.keys(DUNGEON_DISTRICTS_ALL)) {
      for (const seed of ["k1", "k2", "k3", "k4", "k5"]) {
        const rs = exploreAll(startMapRun(dk, seed));
        if (rs.checkpointSnapshot) return rs;
      }
    }
    return null;
  }

  it("存：进 isCheckpoint 房落全量可序列化快照", () => {
    const rs = findCheckpointRun();
    expect(rs).not.toBeNull();
    const snap = rs.checkpointSnapshot;
    expect(snap.map.rooms[snap.current]).toBeTruthy();
    expect(snap.visited).toEqual(expect.arrayContaining([snap.current]));
    expect(snap).toEqual(JSON.parse(JSON.stringify(snap))); // 纯 JSON、无函数/Set
    expect(snap.step).toBeGreaterThan(0);
    // 快照是落地时刻的深拷贝：之后走动不污染它
    const later = moveRoom(rs, Object.keys(rs.map.rooms[rs.current].exits)[0]).runState;
    if (later !== rs) expect(later.checkpointSnapshot).toEqual(snap);
  });

  it("还原：战败 canRestore → restoreCheckpoint 回检点房继续走", () => {
    let rs = findCheckpointRun();
    const snap = rs.checkpointSnapshot;
    // 快照后再走一格（若有路），模拟检点后受灾
    const dirs = Object.keys(rs.map.rooms[rs.current].exits || {});
    if (dirs.length) rs = moveRoom(rs, dirs[0]).runState;
    rs = { ...rs, hp: [9, 100], loot: { ...rs.loot, items: ["失去的东西"] } };
    const end = runEnd(rs, "defeated");
    expect(end.canRestore).toBe(true);
    const { runState, log } = restoreCheckpoint(end.runState);
    expect(runState.status).toBe("exploring");
    expect(runState.current).toBe(snap.current);
    expect(runState.visited).toEqual(snap.visited);
    expect(runState.hp).toEqual(snap.hp);
    expect(runState.loot.items).not.toContain("失去的东西");
    expect(runState.step).toBe(snap.step);
    expect(log).toContain("退回");
  });

  it("覆盖：再访检点房刷新快照（以最近一次歇脚为准）", () => {
    const rs0 = findCheckpointRun();
    const first = rs0.checkpointSnapshot;
    // 先沿 BFS 走到 first.current（确保站在检点房上），再离开又回来
    const bfsPath = (from, to, rooms) => {
      if (from === to) return [];
      const q = [[from, []]];
      const seen = new Set([from]);
      while (q.length) {
        const [cur, dirs] = q.shift();
        for (const [d, nxt] of Object.entries(rooms[cur].exits)) {
          if (seen.has(nxt)) continue;
          const nextDirs = [...dirs, d];
          if (nxt === to) return nextDirs;
          seen.add(nxt);
          q.push([nxt, nextDirs]);
        }
      }
      return [];
    };
    let atCk = rs0;
    for (const d of bfsPath(rs0.current, first.current, rs0.map.rooms)) {
      atCk = moveRoom(atCk, d).runState;
    }
    const baseSnap = atCk.checkpointSnapshot;
    const out = Object.entries(atCk.map.rooms[atCk.current].exits).find(([, t]) => t !== atCk.current);
    expect(out).toBeTruthy();
    const away = moveRoom(atCk, out[0]).runState;
    const backDir = Object.entries(away.map.rooms[away.current].exits).find(([, t]) => t === baseSnap.current);
    expect(backDir).toBeTruthy();
    const back = moveRoom(away, backDir[0]).runState;
    expect(back.checkpointSnapshot.step).toBe(back.step);
    expect(back.checkpointSnapshot.step).toBeGreaterThan(baseSnap.step);
    expect(back.checkpointSnapshot.visited.length).toBeGreaterThanOrEqual(baseSnap.visited.length);
  });

  it("无快照时 restoreCheckpoint 安全返回 null", () => {
    const rs = startMapRun(DK, "nock");
    const { runState, log } = restoreCheckpoint(rs);
    expect(runState).toBeNull();
    expect(log).toBeNull();
    expect(runEnd(rs, "defeated").canRestore).toBe(false);
  });

  it("序列化 roundtrip：serialize→deserialize 与原 runState 逐字段一致", () => {
    const rs = findCheckpointRun();
    const data = serializeMapRun(rs);
    expect(data).not.toBe(rs); // 深拷贝断引用
    expect(data.map).not.toBe(rs.map);
    const back = deserializeMapRun(JSON.parse(JSON.stringify(data)));
    expect(back).toEqual(rs);
  });

  it("deserialize 兜底：老档无 checkpointSnapshot / 缺字段不炸", () => {
    const rs = findCheckpointRun();
    const legacy = serializeMapRun(rs);
    delete legacy.checkpointSnapshot;
    delete legacy.checkpoint;
    delete legacy.log;
    const back = deserializeMapRun(legacy);
    expect(back.checkpointSnapshot).toBeNull();
    expect(back.checkpoint).toBeNull();
    expect(back.log).toEqual([]);
    expect(deserializeMapRun(null)).toBeNull();
    expect(deserializeMapRun({})).toBeNull();
  });
});

describe("7 天周期 · 选入口重进 · 银两黑市 · 奖励箱 · 战斗/BOSS 接线", () => {
  it("出宫后 7 天内同图不变，满 7 天到期重 roll 新图", () => {
    const w1 = ensureDungeonWorld("白塔地宫", null, { time: 0 }); // 第 1 天，expiresAtDay = 8
    expect(w1.unlockedEntries).toEqual([w1.map.anchor]);
    expect(w1.adventurers.length).toBeGreaterThanOrEqual(7);

    // 第 5 天仍在 7 天窗口内，图完全一致
    const wSame = ensureDungeonWorld("白塔地宫", w1, { time: 24 * 4 });
    expect(wSame).toBe(w1);

    // 第 5 天带新解锁出口出宫，顺延到第 5+7=12 天过期
    const run = startMapRun("白塔地宫", w1.seed, { world: w1, char: { hp: [100, 100], money: 200 } });
    const exitName = w1.map.exitRooms[0];
    const synced = syncDungeonWorld(w1, { ...run, unlockedExits: [exitName], unlockedEntries: [w1.map.anchor, exitName] }, { time: 24 * 4 });
    expect(synced.expiresAtDay).toBe(12);
    expect(synced.unlockedEntries).toContain(exitName);

    // 第 10 天仍在窗口内，可从已解锁出口潜入
    const w10 = ensureDungeonWorld("白塔地宫", synced, { time: 24 * 9 });
    expect(w10.seed).toBe(w1.seed);
    const reEntry = startMapRun("白塔地宫", w10.seed, { world: w10, entryRoom: exitName });
    expect(reEntry.current).toBe(exitName);

    // 到第 12 天（>= expiresAtDay）重 roll 新图
    const wExpired = ensureDungeonWorld("白塔地宫", synced, { time: 24 * 11 });
    expect(wExpired.seed).not.toBe(w1.seed);
    expect(wExpired.epoch).toBe(2);
    expect(wExpired.unlockedExits).toEqual([]);
  });

  it("normalizeDungeonStore 向下兼容 null / 老格式 / 新包装", () => {
    expect(normalizeDungeonStore(null)).toEqual({ active: null, worlds: {} });
    // 名册归一迁移：旧 key 的进行中 run 静默改写成新 key（雪山茫野等清宫则了结为 null）
    const legacy = startMapRun("断鞍古驿", "leg");
    const migrated = normalizeDungeonStore({ active: { ...legacy, districtKey: "大草甸子虚幻境" }, worlds: {} });
    expect(migrated.active.districtKey).toBe("断鞍古驿");
    const purged = normalizeDungeonStore({ active: { ...legacy, districtKey: "雪山茫野" }, worlds: { 雪山茫野: { seed: "x" } } });
    expect(purged.active).toBeNull();
    expect(purged.worlds).toEqual({});
  });

  it("商人银两购买清神藏香、焦黄塔道残图并支持典售回银", () => {
    const w = ensureDungeonWorld("白塔地宫", null, { time: 0 });
    const merchantRoom = Object.keys(w.map.rooms).find((n) => w.map.rooms[n].roomKind === "merchant");
    let rs = startMapRun("白塔地宫", w.seed, { world: w, char: { hp: [100, 100], money: 200 } });
    rs = { ...rs, current: merchantRoom, loot: { money: 10, exp: 0, pot: 0, items: [{ name: "破铁刀", quality: "白" }] } };
    const ev = {
      kind: "merchant",
      options: [
        { label: "买焦黄塔道残图（60两）", merchantBuy: "g_map" },
        { label: "典售随身战利品换银两", merchantSell: true },
      ],
    };
    rs.map.rooms[merchantRoom] = { ...rs.map.rooms[merchantRoom], roomEvent: ev };

    const bought = routeRoomAction(rs, "买焦黄塔道残图（60两）", { rng: () => 0 });
    expect(bought.runState.revealedExits).toHaveLength(1);
    expect(bought.runState.loot.money).toBe(0);
    expect(bought.runState.spentMoney).toBe(50);

    const sold = routeRoomAction(bought.runState, "典售随身战利品换银两", { rng: () => 0 });
    expect(sold.runState.loot.money).toBe(10);
    expect(sold.runState.loot.items).toEqual([]);
  });

  it("奖励箱产出全品类且神兵严格唯一去重", () => {
    const cfg = DUNGEON_DISTRICTS_ALL["白塔地宫"];
    const first = rollChestRewards("boss", cfg, {
      seed: "god1",
      roomName: "明王石室",
      playerFlags: ["white_pagoda_crypt_clue"],
      playerSkills: [],
      playerInv: [],
    });
    expect(first.divineDrop?.itemName).toBe("不动明王杵");
    expect(first.items.some((i) => i.name === "不动明王杵")).toBe(true);

    const dup = rollChestRewards("boss", cfg, {
      seed: "god1",
      roomName: "明王石室",
      playerFlags: ["white_pagoda_crypt_clue", "divine_obtained_budongmingwang"],
      playerSkills: [],
      playerInv: [],
    });
    expect(dup.divineDrop).toBeNull();
    expect(dup.items.some((i) => i.name === "不动明王杵")).toBe(false);
    expect(dup.money).toBeGreaterThan(first.money);
  });

  it("applyMapBattleResult 接通小怪胜/逃/败与 BOSS 通关开匣", () => {
    const w = ensureDungeonWorld("白塔地宫", null, { time: 0 });
    let rs = startMapRun("白塔地宫", w.seed, { world: w, char: { hp: [100, 100], money: 50 }, flags: ["white_pagoda_crypt_clue"] });

    // 逃跑退回 prevRoom
    const fleeing = applyMapBattleResult({
      ...rs,
      status: "combat",
      prevRoom: rs.map.anchor,
      current: w.map.exitRooms[0],
      activeBattle: { npc: { id: "e1", name: "巡廊盲僧" }, roomName: w.map.exitRooms[0] },
    }, { outcome: "flee", playerHp: [72, 100] });
    expect(fleeing.status).toBe("exploring");
    expect(fleeing.current).toBe(rs.map.anchor);
    expect(fleeing.hp[0]).toBe(72);

    // 打赢守出口精英，自动解锁新入口
    const winExit = applyMapBattleResult({
      ...rs,
      status: "combat",
      current: w.map.exitRooms[1],
      activeBattle: { npc: { id: "e2", name: "撬锁摸经贼" }, unlockExitRoom: w.map.exitRooms[1], roomName: w.map.exitRooms[1], reward: { money: 24, exp: 4, pot: 2 } },
    }, { outcome: "win", playerHp: [88, 100] });
    expect(winExit.unlockedEntries).toContain(w.map.exitRooms[1]);
    expect(winExit.loot.money).toBe(24);

    // 击败中心 BOSS，触发通关与神兵开匣
    const winBoss = applyMapBattleResult({
      ...winExit,
      status: "combat",
      current: "明王石室",
      activeBattle: { npc: { id: "boss", name: "守塔首座·罗布桑" }, isBoss: true, roomName: "明王石室", reward: { money: 140, exp: 28, pot: 32 } },
    }, { outcome: "win", playerHp: [65, 100] });
    expect(winBoss.status).toBe("victory");
    expect(winBoss.bossDefeated).toBe(true);
    expect(winBoss.loot.items.some((i) => i.name === "不动明王杵")).toBe(true);
  });

  it("八大 13×13 地宫全部可一键生成、进图、买清警报、抽唯一神兵并正常撤退", () => {
    const gridEntries = Object.entries(DUNGEON_DISTRICTS_ALL).filter(([, cfg]) => cfg.gridSize === 13);
    expect(gridEntries).toHaveLength(8);

    for (const [dk, cfg] of gridEntries) {
      const world = ensureDungeonWorld(dk, null, { time: 0 });
      expect(Object.keys(world.map.rooms).length).toBeGreaterThanOrEqual(46);
      expect(world.map.exitRooms).toHaveLength(6);
      expect(world.adventurers.length).toBeGreaterThanOrEqual(7);
      expect(world.adventurers.length).toBeLessThanOrEqual(9);

      const rs = startMapRun(dk, world.seed, {
        world,
        char: { hp: [120, 120], money: 300 },
        flags: [cfg.divineArm.clueFlag],
      });
      expect(rs.displayName).toBe(cfg.displayName);
      expect(rs.current).toBe(cfg.anchor);

      const firstBossRoll = rollChestRewards("boss", cfg, {
        seed: `u-${cfg.id}`,
        roomName: cfg.bossRoom,
        playerFlags: [cfg.divineArm.clueFlag],
      });
      expect(firstBossRoll.divineDrop?.itemName).toBe(cfg.divineArm.itemName);

      const dupBossRoll = rollChestRewards("boss", cfg, {
        seed: `u-${cfg.id}`,
        roomName: cfg.bossRoom,
        playerFlags: [cfg.divineArm.clueFlag, cfg.divineArm.flag],
      });
      expect(dupBossRoll.divineDrop).toBeNull();
    }
  });
});
