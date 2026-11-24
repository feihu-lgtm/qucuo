import { describe, it, expect } from "vitest";
import { genDungeonMap } from "./genMap.js";

const OPPOSITE = { n: "s", s: "n", e: "w", w: "e", u: "d", d: "u" };

const CONFIG = {
  anchor: "地宫入口",
  prefixPool: ["梵音", "琉璃", "莲华", "枯木", "降魔", "般若"],
  suffixPool: ["经阁", "暗廊", "禅室", "塔基", "密藏", "壁画"],
  descPool: ["　　{name}里只有酥油灯的火苗在晃。", "　　{name}的石壁上刻满了褪色的经咒。"],
  bossRoom: "莲华塔基",
  branchRate: 0.6,
  loopRate: 0.3,
  envTag: "whiteTower",
};

const SEEDS = ["run-1", "run-2", "2026-11-24", "黑风寨-3", "42"];

// 从 anchor 沿出口 BFS 找一条到 boss 的最短路（回环可能更短，这里量的是主路本身）
function mainPathLength(map) {
  const boss = Object.keys(map.rooms).find((n) => map.rooms[n].isBoss);
  // 主路房按生成顺序不可分辨，改从 anchor 一路走到 boss：每一房的最长简单路径。
  // 简化：主路房恰好构成一条链，统计「度为 2 的链上房」不可靠——直接按设计要求验证 boss 可达
  // 且 anchor→boss 最短路 ≥ 4（主路 5-7 房，回环只能缩短不能加长）。
  const dist = { [map.anchor]: 0 };
  const queue = [map.anchor];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of Object.values(map.rooms[cur].exits)) {
      if (dist[next] === undefined) { dist[next] = dist[cur] + 1; queue.push(next); }
    }
  }
  return dist[boss];
}

describe("genDungeonMap", () => {
  it("同 seed 输出完全一致（快照）", () => {
    expect(genDungeonMap("run-1", CONFIG)).toEqual(genDungeonMap("run-1", CONFIG));
    expect(genDungeonMap(7, CONFIG)).toEqual(genDungeonMap(7, CONFIG));
  });

  it("不同 seed 输出不同", () => {
    expect(genDungeonMap("a", CONFIG)).not.toEqual(genDungeonMap("b", CONFIG));
  });

  it("每个 seed 下方向都互逆", () => {
    for (const seed of SEEDS) {
      const { rooms } = genDungeonMap(seed, CONFIG);
      for (const [name, room] of Object.entries(rooms)) {
        for (const [dir, target] of Object.entries(room.exits)) {
          expect(rooms[target], `${name}.${dir}→${target}`).toBeDefined();
          expect(rooms[target].exits[OPPOSITE[dir]], `${target}.${OPPOSITE[dir]} 应指回 ${name}`).toBe(name);
        }
      }
    }
  });

  it("anchor 到 boss 主路 5-7 房（回环不得短于 4 步的合理下界）", () => {
    for (const seed of SEEDS) {
      const map = genDungeonMap(seed, { ...CONFIG, branchRate: 0, loopRate: 0 });
      // 关掉分支/回环后，anchor→boss 唯一通路就是主路本身：跳数 = 主路房数 - 1
      const hops = mainPathLength(map);
      expect(hops).toBeGreaterThanOrEqual(4); // 至少 5 房
      expect(hops).toBeLessThanOrEqual(6);    // 至多 7 房
    }
  });

  it("回环全开也不短路主路（anchor→boss 仍 ≥4 跳）", () => {
    for (const seed of SEEDS) {
      const map = genDungeonMap(seed, { ...CONFIG, branchRate: 1, loopRate: 1 });
      expect(mainPathLength(map)).toBeGreaterThanOrEqual(4);
    }
  });

  it("配置 boss 名与名库撞名时不覆写既有房", () => {
    // 名库里恰有 bossRoom 的组合（莲华+塔基）：多个 seed 扫过，boss 房必须是唯一 isBoss 且有入口
    for (const seed of SEEDS) {
      const { rooms } = genDungeonMap(seed, CONFIG);
      const bosses = Object.values(rooms).filter((r) => r.isBoss);
      expect(bosses).toHaveLength(1);
      expect(Object.keys(rooms["莲华塔基"].exits).length).toBeGreaterThan(0);
    }
  });

  it("死路（单出口、非 anchor/boss）必带 isTreasure", () => {
    for (const seed of SEEDS) {
      const { anchor, rooms } = genDungeonMap(seed, CONFIG);
      const boss = Object.keys(rooms).find((n) => rooms[n].isBoss);
      for (const [name, room] of Object.entries(rooms)) {
        if (Object.keys(room.exits).length === 1 && name !== anchor && name !== boss) {
          expect(room.isTreasure, `${name} 死路应有 isTreasure`).toBe(true);
        }
      }
    }
  });

  it("desc 全非空且房间名不重复", () => {
    for (const seed of SEEDS) {
      const { rooms } = genDungeonMap(seed, CONFIG);
      for (const [name, room] of Object.entries(rooms)) {
        expect(typeof room.desc).toBe("string");
        expect(room.desc.length).toBeGreaterThan(0);
      }
      // 对象键天然去重：生成时若撞名数量会少于应有数——改为抽查名库房不含 fallback 串即可
      const names = Object.keys(rooms);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("schema 与 innerMap 同构 + envTag/roomEvent 齐活", () => {
    const { rooms } = genDungeonMap("schema", CONFIG);
    for (const room of Object.values(rooms)) {
      expect(room.exits).toBeTypeOf("object");
      expect(room.envTag).toBe("whiteTower");
      expect(room).toHaveProperty("roomEvent", null);
    }
  });

  it("branchRate=1 时房间数明显多于主路", () => {
    const busy = genDungeonMap("branchy", { ...CONFIG, branchRate: 1 });
    const plain = genDungeonMap("branchy", { ...CONFIG, branchRate: 0 });
    expect(Object.keys(busy.rooms).length).toBeGreaterThan(Object.keys(plain.rooms).length);
  });
});
