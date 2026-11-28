// 地宫内层地图 run 状态机（13×13 大平面迷雾 + 7 天周期 + 1 入口 6 出口 + 多势力遭遇）。
// 纯函数无 IO：每次调用吃上一份 runState、吐出新的不可变快照；
// 同 seed + 同操作序列 → 逐字节一致（不调全局 random）。

import { DUNGEON_DISTRICTS_ALL } from "../../data/dungeon/districts.js";
import { genDungeonMap } from "./genMap.js";
import { ENV_TAG_HANDLERS } from "./envTags.js";
import { rollDungeonDiveSquad, getAdventurerById } from "./dungeonPool.js";
import { seededRand } from "../../../utils/seededRandom.js";
import { clamp, normalizeHp, mergeLoot, buildCombatNpc } from "./internal.js";

const emptyLoot = () => ({ money: 0, exp: 0, pot: 0, items: [] });

export const DUNGEON_ID_TO_DISTRICT = Object.freeze({
  white_pagoda_crypt: "白塔地宫",
  sanxing_bronze_abyss: "三星堆大墓",
  tangmen_poison_vault: "蜀南唐堡千机楼",
  wuxian_centipede_den: "雾隐寨五仙秘洞",
  tianlong_serpent_crypt: "天龙营八部浮屠",
  jingguan_iron_dungeon: "成都蜀王府地宫",
  gongcuo_submerged_vault: "雪山茫野",
  heifeng_wolf_cavern: "雅江悬棺裂谷",
  dacaodian_duanan_post: "大草甸子虚幻境",
  yajiang_chensha_dock: "雅江悬棺裂谷",
  jingguan_ghost_market: "成都蜀王府地宫",
  tusi_inner_vault: "鱼定土司内府禁库",
});

function settleLoot(loot, ratio) {
  return {
    money: Math.floor((loot?.money || 0) * ratio),
    exp: Math.floor((loot?.exp || 0) * ratio),
    pot: Math.floor((loot?.pot || 0) * ratio),
    items: [...(loot?.items || [])],
  };
}

export function getGameDayFromTime(time = 0) {
  return Math.floor((Number(time) || 0) / 24) + 1;
}

/**
 * 规范化 state.dungeonRun 存档包装：兼容老格式裸 runState 与新版 { active, worlds }。
 */
export function normalizeDungeonStore(raw) {
  if (!raw || typeof raw !== "object") return { active: null, worlds: {} };
  if ("worlds" in raw || "active" in raw) {
    return {
      active: raw.active ? deserializeMapRun(raw.active) : null,
      worlds: raw.worlds && typeof raw.worlds === "object" ? raw.worlds : {},
    };
  }
  return {
    active: raw.map?.rooms ? deserializeMapRun(raw) : null,
    worlds: {},
  };
}

/**
 * 7 天周期持久化世界：未到期复用同图、同出口与同下本冒险者；
 * 到期（或 forceReset）则按新 epoch/day 重生成 13×13 地宫与 ~8 名冒险者。
 */
export function ensureDungeonWorld(districtKey, prevWorld, {
  time = 0,
  excludedNames = [],
  forceReset = false,
} = {}) {
  const config = DUNGEON_DISTRICTS_ALL[districtKey];
  if (!config) throw new Error(`未知地宫：${districtKey}`);
  const day = getGameDayFromTime(time);
  if (prevWorld && !forceReset && prevWorld.map?.rooms && day < (prevWorld.expiresAtDay ?? 0)) {
    return prevWorld;
  }
  const epoch = (prevWorld?.epoch || 0) + 1;
  const seed = `${districtKey}|e${epoch}|d${day}`;
  const map = genDungeonMap(seed, config);
  const adventurers = config.gridSize
    ? rollDungeonDiveSquad(districtKey, seed, {
        targetCount: config.targetAdventurers || 8,
        excludedNames,
        mapRooms: map.rooms,
        anchor: map.anchor,
        bossRoom: map.bossRoom,
      })
    : [];
  return {
    districtKey,
    epoch,
    seed,
    createdAtDay: day,
    lastExitDay: day,
    expiresAtDay: day + 7,
    bossClearedDay: null,
    bossDefeated: false,
    unlockedExits: [],
    unlockedEntries: [map.anchor],
    revealedExits: [],
    openedChests: [],
    solvedPuzzles: [],
    clearedRooms: [],
    marketBought: {},
    visitedEver: [map.anchor],
    adventurers,
    map,
  };
}

/**
 * 出宫/结算时把 runState 变更写回 7 天持久化世界，并顺延未通关周期至出宫后 7 天。
 */
export function syncDungeonWorld(world, runState, { time = 0 } = {}) {
  if (!world || !runState) return world;
  const day = getGameDayFromTime(time);
  const uniq = (a = [], b = []) => [...new Set([...a, ...b])];
  const bossDefeated = Boolean(world.bossDefeated || runState.bossDefeated);
  const bossClearedDay = world.bossClearedDay || (runState.bossDefeated ? day : null);
  const expiresAtDay = bossDefeated ? (bossClearedDay + 7) : (day + 7);
  return {
    ...world,
    lastExitDay: day,
    expiresAtDay,
    bossClearedDay,
    bossDefeated,
    unlockedExits: uniq(world.unlockedExits, runState.unlockedExits),
    unlockedEntries: uniq(world.unlockedEntries, runState.unlockedEntries),
    revealedExits: uniq(world.revealedExits, runState.revealedExits),
    openedChests: uniq(world.openedChests, runState.openedChests),
    solvedPuzzles: uniq(world.solvedPuzzles, runState.solvedPuzzles),
    clearedRooms: uniq(world.clearedRooms, runState.clearedRooms),
    marketBought: { ...(world.marketBought || {}), ...(runState.marketBought || {}) },
    visitedEver: uniq(world.visitedEver, runState.visited),
    adventurers: Array.isArray(runState.adventurers) ? runState.adventurers : world.adventurers,
  };
}

/**
 * 统一奖励箱抽取：产出银两、经验、潜能、装备、武学、队友引荐、色色卡、神兵双轨唯一校验。
 */
export function rollChestRewards(chestTier, config, {
  seed = "chest",
  roomName = "chest",
  playerFlags = [],
  playerSkills = [],
  playerInv = [],
  unlockedCards = [],
  learnedSkills = [],
  lootItems = [],
} = {}) {
  const pool = config?.chestPools?.[chestTier] || config?.chestPools?.wood;
  if (!pool) return { money: 25, exp: 5, pot: 5, items: [] };
  const rng = seededRand(0, `chest|${seed}|${roomName}|${chestTier}`);
  const randInt = ([lo, hi]) => lo + Math.floor(rng() * (hi - lo + 1));

  const out = {
    money: randInt(pool.moneyRange || [20, 40]),
    exp: randInt(pool.expRange || [4, 8]),
    pot: randInt(pool.potRange || [4, 10]),
    items: [],
    learnedSkill: null,
    cardUnlocked: null,
    divineDrop: null,
    notes: [],
  };

  if (pool.items?.length) {
    const picked = pool.items[Math.floor(rng() * pool.items.length) % pool.items.length];
    out.items.push({ ...picked });
  }

  // 武学槽：已学会自动折算潜能
  if (pool.skills?.length && (chestTier === "boss" ? rng() < (pool.skillChance || 0.35) : rng() < (pool.skillChance || 0.15))) {
    const sk = pool.skills[Math.floor(rng() * pool.skills.length) % pool.skills.length];
    const ownedNames = new Set([
      ...(playerSkills || []).map((s) => s?.name || s?.id),
      ...(learnedSkills || []).map((s) => s?.name || s?.id),
    ]);
    if (ownedNames.has(sk.name) || ownedNames.has(sk.id)) {
      const bonus = sk.dupPot || 25;
      out.pot += bonus;
      out.notes.push(`已习得《${sk.name}》，融会心得转化为潜能 +${bonus}`);
    } else {
      out.learnedSkill = { ...sk };
      out.notes.push(`领悟武学《${sk.name}》（${sk.quality}）`);
    }
  }

  // 色色卡槽：已拥有自动折算银两与潜能
  if (pool.cards?.length && rng() < (pool.cardChance || 0.2)) {
    const flag = pool.cards[Math.floor(rng() * pool.cards.length) % pool.cards.length];
    const cardMeta = (config.cards || []).find((c) => c.flag === flag) || { flag, title: "秘藏画卷" };
    if ((playerFlags || []).includes(flag) || (unlockedCards || []).includes(flag)) {
      out.money += 40;
      out.pot += 10;
      out.notes.push(`已有珍藏「${cardMeta.title}」，改折银 40 两与潜能 10`);
    } else {
      out.cardUnlocked = cardMeta;
      out.notes.push(`解锁珍藏画卷「${cardMeta.title}」`);
    }
  }

  // 神兵双轨唯一校验（仅 boss 档触发）
  if (chestTier === "boss" && config?.divineArm) {
    const da = config.divineArm;
    const hasWeapon = [
      ...(playerInv || []).map((i) => i?.name || i),
      ...(lootItems || []).map((i) => i?.name || i),
    ].includes(da.itemName);
    const obtained = (playerFlags || []).includes(da.flag) || hasWeapon;
    if (obtained) {
      out.money += 100;
      out.pot += 50;
      out.notes.push(`神兵「${da.itemName}」早已归你，石匣补赠 100 两与潜能 50`);
    } else {
      const clueReady = (playerFlags || []).includes(da.clueFlag)
        || (playerInv || []).some((i) => (i?.name || i) === da.clueItem)
        || (playerFlags || []).includes(config.clearFlag);
      if (clueReady) {
        out.divineDrop = { itemName: da.itemName, flag: da.flag };
        out.items.push({ name: da.itemName, category: da.category || "weapon", quality: da.quality || "红" });
        out.notes.push(`★ 镇宫神兵「${da.itemName}」认主出鞘！`);
      } else {
        out.items.push({ name: da.clueItem, category: "misc", quality: "蓝" });
        out.notes.push(`暗匣留有线索信物「${da.clueItem}」，循此可问神兵旧案`);
      }
    }
  }

  return out;
}

/**
 * 13×13 房间交互水合器：按 roomKind 挂载稳定按钮与事件数据。
 */
export function hydrateGridRoomEvent(runState, roomName, room, config) {
  if (!room?.roomKind) return null;
  if (room.isAnchor || room.empty) return null;
  const rng = seededRand(0, `gridRoom|${runState.seed}|${roomName}`);
  const cleared = (runState.clearedRooms || []).includes(roomName);
  const opened = (runState.openedChests || []).includes(roomName);
  const solved = (runState.solvedPuzzles || []).includes(roomName);
  const unlocked = (runState.unlockedExits || []).includes(roomName) || room.exitUnlocked;

  if (room.roomKind === "boss") {
    if (runState.bossDefeated) return null;
    const b = config.boss;
    return {
      kind: "boss",
      desc: b.desc,
      resolved: false,
      options: [{ label: `迎战镇宫首领·${b.name}`, isBossAction: true }],
    };
  }

  if (room.roomKind === "exit") {
    if (unlocked) return null;
    return {
      kind: "exit",
      desc: room.desc,
      resolved: false,
      options: [
        { label: room.exitUnlock?.label || "打通此出口", isExitUnlock: true },
        { label: "暂不动手" },
      ],
    };
  }

  if (room.roomKind === "chest") {
    if (opened) return null;
    const guard = (runState.adventurers || []).find((a) => a.alive && !a.met && a.currentRoom === roomName && a.identity === "treasureGuard");
    if (guard) {
      return {
        kind: "loot",
        chestTier: room.chestTier || "wood",
        desc: `${guard.name}横刀守在宝匣前，冷冷打量着你。`,
        advId: guard.advId,
        resolved: false,
        options: [
          { label: `夺匣：与${guard.name}切磋`, advAction: "battle", advId: guard.advId },
          { label: "退让离去", advAction: "leave" },
        ],
      };
    }
    return {
      kind: "loot",
      chestTier: room.chestTier || "wood",
      desc: config.texts?.chestDesc || "死路角落静静卧着一只封蜡宝匣。",
      check: "智谋",
      dc: room.tier === 3 ? 6 : 4,
      outcome: "秘藏宝匣",
      resolved: false,
      options: [
        { label: "开启奖励箱", chestAction: "open" },
        { label: "细查周边", chestAction: "inspect" },
      ],
    };
  }

  if (room.roomKind === "trap_chest") {
    if (opened) return null;
    const tc = (config.trapChests || [])[Math.floor(rng() * (config.trapChests?.length || 1))]
      || { title: "暗簧铁匣", desc: "铁匣锁孔隐约泛着乌光。", stat: "智谋", dc: 6, hpLoss: 15, successMoney: 35 };
    return {
      kind: "trap_chest",
      trapConfig: tc,
      desc: `${tc.title}：${tc.desc}`,
      resolved: false,
      options: [
        { label: `细察拆解（${tc.stat} DC${tc.dc}）`, trapAction: "disarm" },
        { label: "强行撬开", trapAction: "force" },
        { label: "留心绕开", trapAction: "skip" },
      ],
    };
  }

  if (room.roomKind === "merchant") {
    const m = config.merchant;
    if (!m) return null;
    const opts = m.goods.map((g) => ({
      label: `买${g.name}（${g.price}两）`,
      merchantBuy: g.id,
    }));
    opts.push({ label: "典售随身战利品换银两", merchantSell: true });
    return {
      kind: "merchant",
      desc: `${m.name}：${m.desc}`,
      resolved: false,
      options: opts,
    };
  }

  if (room.roomKind === "trade") {
    if (cleared) return null;
    const trades = config.trades || [];
    const tr = trades[(room.tradeIndex ?? Math.floor(rng() * trades.length)) % Math.max(1, trades.length)];
    if (!tr) return null;
    return {
      kind: "trade",
      tradeConfig: tr,
      desc: tr.desc,
      resolved: false,
      options: [
        { label: `银两成交（${tr.cost}两）`, tradeAction: "buy" },
        { label: "摇头谢绝", tradeAction: "decline" },
      ],
    };
  }

  if (room.roomKind === "supply") {
    const ckDesc = config.texts?.supplyCheckpointDesc || "一处避风干燥的隐蔽石室，可供歇脚存下进度。";
    const normDesc = config.texts?.supplyNormalDesc || "一处僻静安全的落脚点，备有清水干粮，适合暂歇回气。";
    const ckLabel = config.texts?.supplyHealLabel || "歇脚包扎（回血35%并稳环境）";
    const normLabel = config.texts?.supplyNormalLabel || "饮水歇息回气";
    return {
      kind: "supply_station",
      desc: room.isCheckpoint ? ckDesc : normDesc,
      resolved: cleared,
      options: room.isCheckpoint
        ? [
            { label: ckLabel, supplyAction: "heal" },
            { label: "记录存档", supplyAction: "save" },
          ]
        : [{ label: normLabel, supplyAction: "heal" }],
    };
  }

  if (room.roomKind === "puzzle") {
    if (solved) return null;
    const puzzles = config.puzzles || (config.puzzle ? [config.puzzle] : []);
    const p = puzzles[(room.puzzleIndex ?? 0) % Math.max(1, puzzles.length)];
    if (!p) return null;
    return {
      kind: "puzzle",
      desc: p.desc || p.config?.prompt || "此处藏着一道古旧机括。",
      check: p.config?.stat || "悟性",
      dc: p.config?.dc || 6,
      outcome: "暗门开启",
      puzzleType: p.type,
      puzzleConfig: p.config,
      resolved: false,
      options: [{ label: "上前破解机关" }],
    };
  }

  if (room.roomKind === "combat") {
    if (cleared) return null;
    const tierPool = (config.enemies || []).filter((e) => (e.tier || 1) <= (room.tier || 2));
    const pool = tierPool.length ? tierPool : (config.enemies || []);
    const enemy = pool[Math.floor(rng() * pool.length) % pool.length];
    if (!enemy) return null;
    return {
      kind: "fight",
      desc: `[${enemy.camp || "江湖"}] ${enemy.name}挡在前方：${enemy.desc}`,
      check: "combat",
      dc: (enemy.levelCap || 2) + 4,
      outcome: "胜者拾利",
      enemy,
      resolved: false,
      options: [{ label: `亮刃迎战·${enemy.name}` }],
    };
  }

  if (room.roomKind === "neutral") {
    if (cleared) return null;
    const neutralSeeds = (config.eventSeeds || []).filter((s) => ["watch", "meet", "appraise", "nsfw"].includes(s.kind));
    if (!neutralSeeds.length) return null;
    const seedPick = neutralSeeds[Math.floor(rng() * neutralSeeds.length) % neutralSeeds.length];
    return { ...seedPick, resolved: false };
  }

  return null;
}

/**
 * 开局：按 seed 生成本宫地图，人物落在入口（可指定已解锁的战术入口）。
 */
export function startMapRun(districtKey, seed, opts = {}) {
  const { char, world, entryRoom, flags = [], skills = [], inv = [] } = opts;
  const config = DUNGEON_DISTRICTS_ALL[districtKey];
  if (!config) throw new Error(`未知地宫：${districtKey}`);

  const baseSeed = world?.seed || seed;
  const map = world?.map
    ? JSON.parse(JSON.stringify(world.map))
    : genDungeonMap(baseSeed, config);
  const hp = normalizeHp(char?.hp);
  const unlockedEntries = world?.unlockedEntries?.length ? [...world.unlockedEntries] : [map.anchor];
  const unlockedExits = world?.unlockedExits ? [...world.unlockedExits] : [];
  const startRoom = entryRoom && unlockedEntries.includes(entryRoom) ? entryRoom : map.anchor;

  // 把已解锁出口标回房间属性
  for (const exitRoomName of unlockedExits) {
    if (map.rooms[exitRoomName]) map.rooms[exitRoomName].exitUnlocked = true;
  }

  const visited = world?.visitedEver?.length
    ? [...new Set([...world.visitedEver, startRoom])]
    : [startRoom];

  const displayName = config.displayName || districtKey;
  const baseRun = {
    districtKey,
    displayName,
    seed: baseSeed,
    map,
    current: startRoom,
    visited,
    envTags: {},
    envState: {},
    hp,
    entryHp: hp[0],
    loot: emptyLoot(),
    status: "exploring",
    step: 0,
    checkpoint: null,
    log: [`踏入${displayName}，落脚${startRoom}。`],
  };

  if (!config.gridSize && !world) {
    return baseRun;
  }

  const adventurers = world?.adventurers
    ? JSON.parse(JSON.stringify(world.adventurers))
    : rollDungeonDiveSquad(districtKey, baseSeed, {
        targetCount: config.targetAdventurers || 8,
        mapRooms: map.rooms,
        anchor: map.anchor,
        bossRoom: map.bossRoom,
      });

  const hydratedRun = {
    ...baseRun,
    prevRoom: startRoom,
    clearFlag: config.clearFlag || null,
    bossDefeated: Boolean(world?.bossDefeated),
    unlockedExits,
    unlockedEntries,
    revealedExits: [...(world?.revealedExits || [])],
    openedChests: [...(world?.openedChests || [])],
    solvedPuzzles: [...(world?.solvedPuzzles || [])],
    clearedRooms: [...(world?.clearedRooms || [])],
    marketBought: { ...(world?.marketBought || {}) },
    adventurers,
    charMoney: Number(char?.money) || 0,
    spentMoney: 0,
    playerFlags: [...flags],
    playerSkills: [...skills],
    playerInv: [...inv],
    learnedSkills: [],
    unlockedCards: [],
    divineFlags: [],
    recruitedAdvIds: [],
    usedItems: [],
  };

  // 若入口正好是可交互的战术出口或普通格，确保事件状态对齐
  const entryObj = hydratedRun.map.rooms[startRoom];
  if (entryObj && !entryObj.isAnchor) {
    const ev = hydrateGridRoomEvent(hydratedRun, startRoom, entryObj, config);
    if (ev) hydratedRun.map.rooms[startRoom] = { ...entryObj, roomEvent: ev };
  }
  return hydratedRun;
}

// 旧 10 区图事件落位（无 gridSize 时沿用原逻辑）
function seedLegacyRoomEvent(runState, roomName, room) {
  if (room.isAnchor || room.isBoss || room.empty) return null;
  const seeds = DUNGEON_DISTRICTS_ALL[runState.districtKey]?.eventSeeds || [];
  if (!seeds.length) return null;
  const rng = seededRand(0, `mapRoomEvent|${runState.seed}|${roomName}`);
  if (room.isTreasure) {
    const loot = seeds.find((s) => s.kind === "loot");
    if (loot) return { ...loot, resolved: false };
  }
  const pool = seeds.filter((s) => room.isTreasure || s.kind !== "loot");
  if (!pool.length) return null;
  const pick = pool[Math.floor(rng() * pool.length) % pool.length];
  return pick ? { ...pick, resolved: false } : null;
}

// 游荡冒险者每步按 30% 概率沿相邻通道挪一格，同房则挂载遭遇分支
function advanceAdventurersAndCheck(nextRun, targetRoom) {
  if (!Array.isArray(nextRun.adventurers) || !nextRun.adventurers.length) return [];
  const rng = seededRand(0, `advStep|${nextRun.seed}|${nextRun.step}`);
  const rooms = nextRun.map.rooms;
  const logs = [];
  let encountered = null;

  const updated = nextRun.adventurers.map((adv) => {
    if (!adv.alive || adv.recruited) return adv;
    let cur = adv.currentRoom;
    if (adv.identity === "roamer" && cur !== targetRoom && rng() < 0.3) {
      const exits = Object.values(rooms[cur]?.exits || {}).filter((n) => {
        const r = rooms[n];
        return r && !r.isAnchor && !r.isBoss && !r.isExit;
      });
      if (exits.length) {
        cur = exits[Math.floor(rng() * exits.length) % exits.length];
      }
    }
    const cooldownOk = (nextRun.step - (adv.cooldownStep || -10)) >= 2;
    if (!encountered && cur === targetRoom && !rooms[targetRoom]?.empty && !rooms[targetRoom]?.isAnchor && !rooms[targetRoom]?.isBoss && cooldownOk && !adv.met) {
      encountered = { ...adv, currentRoom: cur };
      return { ...adv, currentRoom: cur, cooldownStep: nextRun.step };
    }
    return { ...adv, currentRoom: cur };
  });

  nextRun.adventurers = updated;

  if (encountered && !rooms[targetRoom]?.roomEvent) {
    const advFull = getAdventurerById(encountered.advId);
    const titleStr = advFull ? `${advFull.name}（${advFull.title}）` : encountered.name;
    const isRecruitable = encountered.identity === "hiddenHireable";
    const options = isRecruitable
      ? [
          { label: `相邀结伴·${encountered.name}`, advAction: "recruit", advId: encountered.advId },
          { label: `切磋试招·${encountered.name}`, advAction: "battle", advId: encountered.advId },
          { label: "抱拳别过", advAction: "leave", advId: encountered.advId },
        ]
      : [
          { label: `拔刀抢宝·${encountered.name}`, advAction: "battle", advId: encountered.advId },
          { label: `以银两买消息（20两）`, advAction: "bribe", advId: encountered.advId },
          { label: "拱手让路", advAction: "leave", advId: encountered.advId },
        ];
    nextRun.map = {
      ...nextRun.map,
      rooms: {
        ...nextRun.map.rooms,
        [targetRoom]: {
          ...rooms[targetRoom],
          residentNpcName: encountered.name,
          roomEvent: {
            kind: "adv_encounter",
            advId: encountered.advId,
            desc: isRecruitable
              ? `${titleStr}正靠墙包扎外伤，抬眼向你打了个招呼。`
              : `${titleStr}提着兵刃从转角走来，眼神扫过你腰间行囊。`,
            resolved: false,
            options,
          },
        },
      },
    };
    logs.push(`转角遇见同行下本的江湖客「${encountered.name}」。`);
  }
  return logs;
}

/**
 * 走一格：读 current 房的 exits[dir]，换房 → 挂事件 → onEnter 环境结算 → 检查点落地。
 */
export function moveRoom(runState, dir) {
  if (runState.status !== "exploring") return { runState, log: null };
  const room = runState.map.rooms[runState.current];
  const target = room?.exits?.[dir];
  if (!target || !runState.map.rooms[target]) return { runState, log: null };

  const firstVisit = !runState.visited.includes(target);
  const config = DUNGEON_DISTRICTS_ALL[runState.districtKey];
  const next = {
    ...runState,
    prevRoom: runState.current,
    current: target,
    step: runState.step + 1,
    visited: firstVisit ? [...runState.visited, target] : runState.visited,
    map: runState.map,
    log: [...runState.log],
  };

  // 首访或新入大平面房（尚未挂 roomEvent）水合房间交互
  const existingTarget = next.map.rooms[target];
  if (existingTarget.roomKind) {
    if (!existingTarget.roomEvent) {
      const ev = hydrateGridRoomEvent(next, target, existingTarget, config);
      if (ev) {
        next.map = {
          ...next.map,
          rooms: { ...next.map.rooms, [target]: { ...existingTarget, roomEvent: ev } },
        };
      }
    }
  } else if (firstVisit) {
    const tRoom = { ...existingTarget };
    const ev = seedLegacyRoomEvent(next, target, tRoom);
    if (ev) {
      tRoom.roomEvent = ev;
      if (ev.kind === "checkpoint") tRoom.isCheckpoint = true;
      next.map = { ...next.map, rooms: { ...next.map.rooms, [target]: tRoom } };
    }
  }

  const tRoom = next.map.rooms[target];
  const logs = [tRoom.desc || `${target}。`];

  const advLogs = advanceAdventurersAndCheck(next, target);
  logs.push(...advLogs);

  const handler = ENV_TAG_HANDLERS[tRoom.envTag];
  if (handler?.onEnter) {
    next.envTags = Object.fromEntries(
      Object.entries(next.envTags || {}).map(([k, v]) => [k, { ...v }]),
    );
    const r = handler.onEnter(tRoom, next);
    if (r?.log) logs.push(r.log);
    next.envState = { ...(r?.effects || {}) };
  }

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
 * 结算地图内遭遇战/BOSS战/守卫战结果：赢则入袋并解锁/通关，逃则退回上房，败则走 1 血保底与检查点重来。
 */
export function applyMapBattleResult(runState, {
  outcome,
  loot = null,
  playerHp,
  usedItems = [],
  dodgeStolenItems = [],
} = {}) {
  if (!runState || runState.status !== "combat" || !runState.activeBattle) return runState;

  const maxHp = runState.hp?.[1] ?? 100;
  const rawHp = Array.isArray(playerHp) ? playerHp[0] : playerHp;
  const syncedHp = [clamp(typeof rawHp === "number" ? rawHp : runState.hp[0], 0, maxHp), maxHp];
  const allUsed = [...(runState.usedItems || []), ...usedItems];

  const items = [];
  let dropMoney = 0;
  if (Array.isArray(loot)) {
    for (const x of loot) {
      const name = typeof x === "string" ? x : x?.name;
      if (name) items.push(name);
    }
  } else if (loot && typeof loot === "object") {
    if (typeof loot.droppedMoney === "number") dropMoney += loot.droppedMoney;
    for (const x of [loot.droppedItem, ...(loot.guaranteedLoot || [])]) {
      const name = typeof x === "string" ? x : x?.name;
      if (name) items.push(name);
    }
  }
  for (const x of dodgeStolenItems || []) {
    const name = typeof x === "string" ? x : x?.name;
    if (name) items.push(name);
  }

  const battle = runState.activeBattle;
  const roomName = battle.roomName || runState.current;
  const config = DUNGEON_DISTRICTS_ALL[runState.districtKey];

  if (outcome === "win") {
    const reward = battle.reward || {};
    let nextLoot = mergeLoot(runState.loot, {
      money: (reward.money || 0) + dropMoney,
      exp: reward.exp || 0,
      pot: reward.pot || 0,
      items: [...(reward.items || []), ...items],
    });
    let next = {
      ...runState,
      status: "exploring",
      hp: syncedHp,
      loot: nextLoot,
      usedItems: allUsed,
      activeBattle: null,
      clearedRooms: [...new Set([...(runState.clearedRooms || []), roomName])],
      log: [...runState.log, `击退「${battle.npc?.name || "强敌"}」，拾得战利品。`],
    };

    const room = next.map.rooms[roomName];
    if (room) {
      const nextEvent = (room.roomKind === "chest" && battle.advId)
        ? {
            kind: "loot",
            chestTier: room.chestTier || "wood",
            desc: "守宝的江湖客已被击退，封蜡宝匣就在眼前。",
            resolved: false,
            options: [{ label: "开启奖励箱", chestAction: "open" }],
          }
        : (room.roomEvent ? { ...room.roomEvent, resolved: true, options: undefined } : null);
      const nextRoom = {
        ...room,
        residentNpcName: undefined,
        roomEvent: nextEvent,
      };
      if (battle.unlockExitRoom) {
        nextRoom.exitUnlocked = true;
        next.unlockedExits = [...new Set([...(next.unlockedExits || []), roomName])];
        next.unlockedEntries = [...new Set([...(next.unlockedEntries || []), roomName])];
        next.log = [...next.log, `★ 战术出口「${roomName}」已打通！`];
      }
      next.map = { ...next.map, rooms: { ...next.map.rooms, [roomName]: nextRoom } };
    }

    if (battle.advId && Array.isArray(next.adventurers)) {
      next.adventurers = next.adventurers.map((a) =>
        a.advId === battle.advId ? { ...a, alive: false, met: true } : a);
    }

    if (battle.isBoss) {
      const chest = rollChestRewards("boss", config, {
        seed: next.seed,
        roomName,
        playerFlags: next.playerFlags,
        playerSkills: next.playerSkills,
        playerInv: next.playerInv,
        unlockedCards: next.unlockedCards,
        learnedSkills: next.learnedSkills,
        lootItems: next.loot.items,
      });
      next.loot = mergeLoot(next.loot, { money: chest.money, exp: chest.exp, pot: chest.pot, items: chest.items });
      if (chest.learnedSkill) next.learnedSkills = [...(next.learnedSkills || []), chest.learnedSkill];
      if (chest.cardUnlocked) next.unlockedCards = [...new Set([...(next.unlockedCards || []), chest.cardUnlocked.flag])];
      if (chest.divineDrop) next.divineFlags = [...new Set([...(next.divineFlags || []), chest.divineDrop.flag])];
      if (chest.notes?.length) next.log = [...next.log, ...chest.notes];
      return runEnd(next, "victory").runState;
    }

    return next;
  }

  if (outcome === "flee" || outcome === "retreat") {
    const backRoom = runState.prevRoom && runState.map.rooms[runState.prevRoom]
      ? runState.prevRoom
      : runState.map.anchor;
    return {
      ...runState,
      status: "exploring",
      current: backRoom,
      hp: syncedHp,
      usedItems: allUsed,
      activeBattle: null,
      log: [...runState.log, `脱出战圈，退回「${backRoom}」。`],
    };
  }

  return runEnd({
    ...runState,
    hp: syncedHp,
    usedItems: allUsed,
    activeBattle: null,
  }, "defeated").runState;
}

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

export function serializeMapRun(runState) {
  if (!runState) return null;
  return JSON.parse(JSON.stringify(runState));
}

const OPTIONAL_RUN_KEYS = [
  "displayName", "prevRoom", "clearFlag", "unlockedExits", "unlockedEntries", "revealedExits",
  "openedChests", "solvedPuzzles", "clearedRooms", "marketBought", "adventurers",
  "charMoney", "spentMoney", "playerFlags", "playerSkills", "playerInv",
  "learnedSkills", "unlockedCards", "divineFlags", "recruitedAdvIds", "usedItems",
  "activeBattle", "bossDefeated",
];

export function deserializeMapRun(data) {
  if (!data || typeof data !== "object" || !data.map?.rooms) return null;
  const base = {
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
  };
  for (const key of OPTIONAL_RUN_KEYS) {
    if (data[key] !== undefined) base[key] = data[key];
  }
  return base;
}

export function retreatRun(runState) {
  if (runState.status !== "exploring") return { runState, settledLoot: null, log: null };
  const next = { ...runState, status: "retreated" };
  return {
    runState: next,
    settledLoot: settleLoot(next.loot, 1),
    log: "见好就收，顺着来路稳稳撤出了地宫。",
  };
}

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
  return {
    runState: next,
    settledLoot: settleLoot(next.loot, 0.5),
    canRestore: Boolean(next.checkpointSnapshot),
    log: "不敌倒地，负伤被逐出地宫，摸到的东西丢了大半……",
  };
}
