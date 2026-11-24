// 地宫随机内层地图生成器（docs/设计_地宫内层地图.md §A-1）
// 产出的 rooms 与 innerMap.js 的 district.rooms 完全同构：
//   rooms[房名] = { desc, exits:{n/s/e/w/u/d:目标房名}, residentNpcName?, unlockCondition? }
// 另打地宫自有标记：isAnchor / isBoss / isTreasure / empty / envTag / roomEvent（预留位）。
// 纯函数无 IO，同 seed 输出逐字节一致。

import { seededRand } from "../../../utils/seededRandom.js";

const OPPOSITE = { n: "s", s: "n", e: "w", w: "e", u: "d", d: "u" };
const DIRS = Object.keys(OPPOSITE);

const pick = (pool, rng) => pool[Math.floor(rng() * pool.length) % pool.length];

function makeRoomName(config, used, rng) {
  for (let i = 0; i < 80; i++) {
    const name = pick(config.prefixPool, rng) + pick(config.suffixPool, rng);
    if (!used.has(name)) { used.add(name); return name; }
  }
  // 前后缀组合耗尽时的保底：加序号（仍唯一，保证生成不中断）
  let n = used.size;
  while (used.has(`第${n}号窟`)) n += 1;
  const name = `第${n}号窟`;
  used.add(name);
  return name;
}

function newRoom(config, rng, name) {
  return {
    desc: pick(config.descPool, rng).replaceAll("{name}", name),
    exits: {},
    envTag: config.envTag,
    roomEvent: null,
  };
}

const freeDirs = (room) => DIRS.filter((d) => !room.exits[d]);

// 在 a 找一条空闲方向、且 b 的对面也空闲的通道，双向写死；找不到返回 null
function linkRooms(rooms, a, b, rng) {
  const dirs = freeDirs(rooms[a]).filter((d) => !rooms[b].exits[OPPOSITE[d]]);
  if (!dirs.length) return null;
  const dir = pick(dirs, rng);
  rooms[a].exits[dir] = b;
  rooms[b].exits[OPPOSITE[dir]] = a;
  return dir;
}

/**
 * @param {string|number} seed 每次进宫的 seed（run state 存），同 seed 输出完全一致
 * @param {object} config
 *   anchor: 入口房名；prefixPool/suffixPool: 房间名前后缀库；descPool: 描述模板（可用 {name}）
 *   bossRoom?: 压轴房名（不给则从名库抽）；branchRate: 每房再开支路的概率；
 *   loopRate: 支路回接到既有房的概率；envTag: 透传给每房
 * @returns {{ anchor: string, rooms: Record<string, object> }}
 */
export function genDungeonMap(seed, config) {
  const rng = seededRand(0, `dungeon|${seed}`);
  const rooms = {};
  const used = new Set([config.anchor]);
  const branchRate = config.branchRate ?? 0.35;
  const loopRate = config.loopRate ?? 0.15;

  const addRoom = (name) => { rooms[name] = newRoom(config, rng, name); return name; };

  // ── DFS 主路：anchor → 中继房 → boss，主路总长 5-7 ──
  addRoom(config.anchor);
  rooms[config.anchor].isAnchor = true;
  // boss 名先进 used，免得中继房从名库摇出同名把它提前占位又覆写
  if (config.bossRoom) used.add(config.bossRoom);
  const mainLen = 5 + Math.floor(rng() * 3); // 5,6,7 含 anchor 与 boss
  const path = [config.anchor];
  for (let i = 1; i < mainLen - 1; i++) {
    const next = addRoom(makeRoomName(config, used, rng));
    linkRooms(rooms, path[path.length - 1], next, rng);
    path.push(next);
  }
  const bossName = config.bossRoom || makeRoomName(config, used, rng);
  addRoom(bossName);
  linkRooms(rooms, path[path.length - 1], bossName, rng);
  rooms[bossName].isBoss = true;
  path.push(bossName);

  // ── DFS 支路：主路每房按 branchRate 发芽，支路 1-2 房深，末段可按 loopRate 回环 ──
  const growBranch = (from, depth) => {
    if (depth <= 0 || rng() >= branchRate) return;
    let cur = from;
    const len = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < len; i++) {
      // 回环：只许支路房之间成环——主路房不当端点（短路主路），也不接既有邻居（假环真开门）
      if (rng() < loopRate && !path.includes(cur)) {
        const targets = Object.keys(rooms).filter((r) =>
          !path.includes(r) && r !== cur &&
          !Object.values(rooms[cur].exits).includes(r) &&
          freeDirs(rooms[r]).length);
        if (targets.length && linkRooms(rooms, cur, pick(targets, rng), rng)) return;
      }
      const next = addRoom(makeRoomName(config, used, rng));
      if (!linkRooms(rooms, cur, next, rng)) return;
      cur = next;
    }
    growBranch(cur, depth - 1);
  };
  for (const name of path.slice(0, -1)) growBranch(name, 2);

  // ── 收尾：死路必宝、约 30% 空房 ──
  for (const [name, room] of Object.entries(rooms)) {
    const exitCount = Object.keys(room.exits).length;
    if (exitCount === 1 && name !== config.anchor && name !== bossName) room.isTreasure = true;
    if (name !== config.anchor && name !== bossName && rng() < 0.3) room.empty = true;
  }

  return { anchor: config.anchor, rooms };
}
