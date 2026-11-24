import { describe, expect, it } from "vitest";
import { DUNGEON_DISTRICTS_ALL } from "../../data/dungeon/districts.js";
import { moveRoom, retreatRun, runEnd, startMapRun } from "./mapRun.js";

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
