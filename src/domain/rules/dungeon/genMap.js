// 地宫随机内层地图生成器（docs/设计_地宫内层地图.md §A-1）
// 产出的 rooms 与 innerMap.js 的 district.rooms 完全同构：
//   rooms[房名] = { desc, exits:{n/s/e/w/u/d:目标房名}, residentNpcName?, unlockCondition? }
// 另打地宫自有标记：isAnchor / isBoss / isTreasure / empty / envTag / roomEvent（预留位）。
// 纯函数无 IO，同 seed 输出逐字节一致。

import { seededRand } from "../../../utils/seededRandom.js";

const OPPOSITE = { n: "s", s: "n", e: "w", w: "e", u: "d", d: "u" };
const DIRS = Object.keys(OPPOSITE);
const GRID_DIRS = [
  { dir: "n", dx: 0, dy: -1 },
  { dir: "s", dx: 0, dy: 1 },
  { dir: "e", dx: 1, dy: 0 },
  { dir: "w", dx: -1, dy: 0 },
];

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
  if (config?.gridSize) {
    return genGridDungeonMap(seed, config);
  }
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

function shuffleWith(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function countCarvedNeighbors(cells, x, y, size) {
  let n = 0;
  for (const { dx, dy } of GRID_DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < size && ny >= 0 && ny < size && cells.has(`${nx},${ny}`)) n += 1;
  }
  return n;
}

/**
 * 单层 N×N 大平面迷宫生成（默认 13×13）：
 * 中心 (cx,cy) 固定为 BOSS 总出口；初始 1 入口落于外圈边界；
 * 分层挑选 6 处战术出口；铺齐宝箱/陷阱箱/商人/交易/补给/解密/敌人/中立等房型。
 */
function genGridDungeonMap(seed, config) {
  const rng = seededRand(0, `dungeonGrid|${seed}`);
  const size = Math.max(9, Number(config.gridSize) || 13);
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const targetCount = Math.min(54, Math.max(46, Math.floor(size * size * 0.295)));
  const keyOf = (x, y) => `${x},${y}`;
  const inGrid = (x, y) => x >= 0 && x < size && y >= 0 && y < size;
  const distCenter = (x, y) => Math.abs(x - cx) + Math.abs(y - cy);

  const cells = new Map();
  const edges = []; // [{ aKey, bKey, dir }]
  const linkCells = (aKey, bKey, dir) => {
    const a = cells.get(aKey);
    const b = cells.get(bKey);
    if (!a || !b || a.exits[dir] || b.exits[OPPOSITE[dir]]) return false;
    a.exits[dir] = bKey;
    b.exits[OPPOSITE[dir]] = aKey;
    edges.push([aKey, bKey, dir]);
    return true;
  };
  const addCell = (x, y) => {
    const k = keyOf(x, y);
    if (!cells.has(k)) cells.set(k, { x, y, key: k, exits: {} });
    return k;
  };

  addCell(cx, cy);

  // 先朝四个象限各延一条主脉并摸到外圈（保证全盘四向铺开且外圈有合法入口格）
  const quadrantTargets = [
    { qx: -1, qy: -1 },
    { qx: 1, qy: -1 },
    { qx: -1, qy: 1 },
    { qx: 1, qy: 1 },
  ];
  for (const { qx, qy } of shuffleWith(quadrantTargets, rng)) {
    let curX = cx;
    let curY = cy;
    const armSteps = 7 + Math.floor(rng() * 3);
    for (let s = 0; s < armSteps && cells.size < targetCount; s++) {
      const candidates = GRID_DIRS
        .map((d) => ({ ...d, nx: curX + d.dx, ny: curY + d.dy }))
        .filter((d) => inGrid(d.nx, d.ny) && !cells.has(keyOf(d.nx, d.ny)));
      if (!candidates.length) break;
      candidates.sort((a, b) => {
        const sa = (a.dx * qx + a.dy * qy) + (countCarvedNeighbors(cells, a.nx, a.ny, size) <= 1 ? 1.2 : -1);
        const sb = (b.dx * qx + b.dy * qy) + (countCarvedNeighbors(cells, b.nx, b.ny, size) <= 1 ? 1.2 : -1);
        return (sb + (rng() - 0.5) * 1.4) - (sa + (rng() - 0.5) * 1.4);
      });
      const pickDir = candidates[0];
      const nextKey = addCell(pickDir.nx, pickDir.ny);
      linkCells(keyOf(curX, curY), nextKey, pickDir.dir);
      curX = pickDir.nx;
      curY = pickDir.ny;
    }
  }

  // Growing Tree 补足房间数与支路死胡同
  const frontier = [...cells.keys()];
  let guard = 0;
  while (cells.size < targetCount && frontier.length && guard++ < 600) {
    const idx = rng() < 0.65
      ? frontier.length - 1
      : Math.floor(rng() * frontier.length) % frontier.length;
    const curKey = frontier[idx];
    const cur = cells.get(curKey);
    const options = GRID_DIRS
      .map((d) => ({ ...d, nx: cur.x + d.dx, ny: cur.y + d.dy }))
      .filter((d) => inGrid(d.nx, d.ny) && !cells.has(keyOf(d.nx, d.ny)))
      .filter((d) => countCarvedNeighbors(cells, d.nx, d.ny, size) <= 1 || rng() < 0.12);
    if (!options.length) {
      frontier.splice(idx, 1);
      continue;
    }
    const chosen = options[Math.floor(rng() * options.length) % options.length];
    const nextKey = addCell(chosen.nx, chosen.ny);
    linkCells(curKey, nextKey, chosen.dir);
    frontier.push(nextKey);
  }

  // 少量回环：避免单调树状，但保留 ≥ 8 间单出口死路
  const deadEndCount = () => [...cells.values()].filter((c) => Object.keys(c.exits).length === 1).length;
  const maxLoops = Math.max(2, Math.round(cells.size * (config.loopRate ?? 0.15) * 0.4));
  let loops = 0;
  for (const cell of shuffleWith([...cells.values()], rng)) {
    if (loops >= maxLoops || deadEndCount() <= 9) break;
    if (cell.key === keyOf(cx, cy)) continue;
    for (const { dir, dx, dy } of shuffleWith(GRID_DIRS, rng)) {
      const nb = cells.get(keyOf(cell.x + dx, cell.y + dy));
      if (!nb || nb.key === keyOf(cx, cy) || cell.exits[dir]) continue;
      const degA = Object.keys(cell.exits).length;
      const degB = Object.keys(nb.exits).length;
      if (degA >= 2 && degB >= 2 && linkCells(cell.key, nb.key, dir)) {
        loops += 1;
        break;
      }
    }
  }

  const centerKey = keyOf(cx, cy);
  const allCells = [...cells.values()];

  // 选唯一初始入口：优先外圈边界且距中心 >= 8 的格
  const outerCandidates = allCells.filter((c) =>
    c.key !== centerKey && (c.x === 0 || c.x === size - 1 || c.y === 0 || c.y === size - 1) && distCenter(c.x, c.y) >= Math.max(6, cx + 2));
  const farFallback = allCells.filter((c) => c.key !== centerKey).sort((a, b) => distCenter(b.x, b.y) - distCenter(a.x, a.y));
  const entryPool = outerCandidates.length ? outerCandidates : farFallback.slice(0, 4);
  const entryCell = entryPool[Math.floor(rng() * entryPool.length) % entryPool.length];

  // 分浅/中/深三档选 6 个战术出口
  const exitCfgList = config.exitsPool || [];
  const candidatesForExit = shuffleWith(
    allCells.filter((c) => c.key !== centerKey && c.key !== entryCell.key),
    rng,
  );
  const pickExits = (predicate, count, pickedSet) => {
    const picked = [];
    for (const c of candidatesForExit) {
      if (picked.length >= count) break;
      if (!pickedSet.has(c.key) && predicate(c)) {
        picked.push(c);
        pickedSet.add(c.key);
      }
    }
    return picked;
  };
  const pickedExitSet = new Set();
  const exitCells = [
    ...pickExits((c) => distCenter(c.x, c.y) >= 6, 2, pickedExitSet),
    ...pickExits((c) => distCenter(c.x, c.y) >= 4 && distCenter(c.x, c.y) <= 5, 2, pickedExitSet),
    ...pickExits((c) => distCenter(c.x, c.y) >= 2 && distCenter(c.x, c.y) <= 3, 2, pickedExitSet),
  ];
  while (exitCells.length < 6) {
    const rest = pickExits(() => true, 6 - exitCells.length, pickedExitSet);
    if (!rest.length) break;
    exitCells.push(...rest);
  }

  // 命名所有节点：BOSS + 入口 + 6 出口占用专属名称，其余用 prefix+suffix 生成
  const bossName = config.bossRoom || "镇宫主殿";
  const usedNames = new Set([config.anchor, bossName]);
  const keyToName = new Map([
    [centerKey, bossName],
    [entryCell.key, config.anchor],
  ]);

  exitCells.forEach((cell, idx) => {
    const exitDef = exitCfgList[idx];
    let name = exitDef?.name && !usedNames.has(exitDef.name) ? exitDef.name : "";
    if (!name) name = makeRoomName(config, usedNames, rng);
    else usedNames.add(name);
    keyToName.set(cell.key, name);
  });

  for (const cell of allCells) {
    if (!keyToName.has(cell.key)) {
      keyToName.set(cell.key, makeRoomName(config, usedNames, rng));
    }
  }

  // 分配房间类型
  const specialSet = new Set([centerKey, entryCell.key, ...exitCells.map((c) => c.key)]);
  const deadEnds = shuffleWith(
    allCells.filter((c) => !specialSet.has(c.key) && Object.keys(c.exits).length === 1),
    rng,
  );
  const kindByKey = new Map([
    [centerKey, { roomKind: "boss", isBoss: true, isMainExit: true }],
    [entryCell.key, { roomKind: "entry", isAnchor: true }],
  ]);
  const exitRooms = [];
  exitCells.forEach((cell, idx) => {
    const exitDef = exitCfgList[idx] || { id: `exit_${idx + 1}`, name: keyToName.get(cell.key), desc: "一道通往地宫之外的偏僻暗口。", unlock: { stat: "身法", dc: 5 } };
    const roomName = keyToName.get(cell.key);
    exitRooms.push(roomName);
    kindByKey.set(cell.key, {
      roomKind: "exit",
      isExit: true,
      exitId: exitDef.id || `exit_${idx + 1}`,
      exitIndex: idx,
      exitUnlocked: false,
      exitUnlock: exitDef.unlock || { stat: "身法", dc: 5 },
      customDesc: exitDef.desc,
    });
  });

  // 死路优先分配奖励箱与陷阱箱
  const chestTarget = Math.max(4, Math.min(5, deadEnds.length - 2));
  let chestCount = 0;
  let trapCount = 0;
  for (const cell of deadEnds) {
    const dist = distCenter(cell.x, cell.y);
    const tier = dist <= 3 ? 3 : dist <= 6 ? 2 : 1;
    if (chestCount < chestTarget) {
      kindByKey.set(cell.key, {
        roomKind: "chest",
        isTreasure: true,
        chestTier: tier === 3 ? "stone" : tier === 2 ? "iron" : "wood",
      });
      chestCount += 1;
    } else if (trapCount < 2) {
      kindByKey.set(cell.key, { roomKind: "trap_chest" });
      trapCount += 1;
    }
  }

  const remaining = shuffleWith(allCells.filter((c) => !kindByKey.has(c.key)), rng);
  const assignQuota = (list, count, factory) => {
    let n = 0;
    while (n < count && list.length) {
      const cell = list.shift();
      kindByKey.set(cell.key, factory(cell, n));
      n += 1;
    }
  };

  // 保底配齐商人、交易、补给检查点、解密、陷阱箱、敌人与中立留白房
  assignQuota(remaining, 1, () => ({ roomKind: "merchant" }));
  assignQuota(remaining, 2, (_, i) => ({ roomKind: "trade", tradeIndex: i }));
  // 第一个检查点优先落在距入口 2 步处（前期稳妥歇脚点），第二个落在中深层
  const distEntry = (c) => Math.abs(c.x - entryCell.x) + Math.abs(c.y - entryCell.y);
  const cpIdx = remaining.findIndex((c) => distEntry(c) === 2 && Object.values(c.exits).some((k) => distEntry(cells.get(k)) === 1));
  if (cpIdx >= 0) {
    const [nearCp] = remaining.splice(cpIdx, 1);
    kindByKey.set(nearCp.key, { roomKind: "supply", isCheckpoint: true });
    assignQuota(remaining, 2, (_, i) => ({ roomKind: "supply", isCheckpoint: i === 0 }));
  } else {
    assignQuota(remaining, 3, (_, i) => ({ roomKind: "supply", isCheckpoint: i < 2 }));
  }
  const puzzleCount = Math.max(2, Math.min(3, (config.puzzles || []).length || 2));
  assignQuota(remaining, puzzleCount, (_, i) => ({ roomKind: "puzzle", puzzleIndex: i }));
  if (trapCount < 2) {
    assignQuota(remaining, 2 - trapCount, () => ({ roomKind: "trap_chest" }));
    trapCount = 2;
  }
  const combatQuota = Math.max(10, Math.floor(remaining.length * 0.56));
  assignQuota(remaining, combatQuota, () => ({ roomKind: "combat" }));
  assignQuota(remaining, remaining.length, (_, i) => ({
    roomKind: "neutral",
    empty: i % 3 === 0,
  }));

  // 组装与 innerMap 完全同构的 rooms 字典
  const rooms = {};
  for (const cell of allCells) {
    const name = keyToName.get(cell.key);
    const meta = kindByKey.get(cell.key) || { roomKind: "neutral", empty: true };
    const dist = distCenter(cell.x, cell.y);
    const tier = dist <= 3 ? 3 : dist <= 6 ? 2 : 1;
    const exits = {};
    for (const [dir, targetKey] of Object.entries(cell.exits)) {
      exits[dir] = keyToName.get(targetKey);
    }
    const { customDesc, ...cleanMeta } = meta;
    rooms[name] = {
      desc: customDesc || pick(config.descPool, rng).replaceAll("{name}", name),
      exits,
      envTag: config.envTag,
      roomEvent: null,
      x: cell.x,
      y: cell.y,
      tier,
      ...cleanMeta,
    };
  }

  return {
    anchor: config.anchor,
    bossRoom: bossName,
    gridSize: size,
    exitRooms,
    rooms,
  };
}
