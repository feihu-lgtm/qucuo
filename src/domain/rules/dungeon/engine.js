// 地宫探险 · 纯前端状态机与规则裁决（零 React / infra / store 依赖）。
// 输入当前 run 状态与玩家行动，返回下一个不可变 run 快照。
// 拆分后本文件留主件：run 生命周期（建/选/战/撤/结算）+ 公共口中转；
// 节点生成在 nodes.js、冒险者交互在 adventurers.js、节点裁决在 resolve.js、内部件在 internal.js。

import { DUNGEON_NODE_TYPE, getDungeonConfig } from "../../data/dungeon/catalog.js";
import { clamp, normalizeHp, floorInfo, mergeLoot, buildCombatNpc } from "./internal.js";
import { generateChoices } from "./nodes.js";
import { advanceExploring } from "./resolve.js";

export { calcDungeonCheckRate } from "./internal.js";
export { resolveDungeonChoice } from "./resolve.js";
export { makePuzzle, PUZZLE_FACTORIES } from "./puzzles.js";
export { pickDungeonAdventurers, genAdventurerEncounter } from "./dungeonPool.js";
export { summonFollower, followerEffectInCombat, followerLeaveChance, dismissFollower } from "../follower/followers.js";
export { resolveRoomEvent, ROOM_EVENT_KINDS } from "./events.js";
export { startMapRun, moveRoom, retreatRun, runEnd, restoreCheckpoint, serializeMapRun, deserializeMapRun, DUNGEON_ID_TO_DISTRICT } from "./mapRun.js";
export { routeRoomAction, routeRoomText } from "./actionRouter.js";

export function createDungeonRun(dungeonId, { char } = {}) {
  const cfg = getDungeonConfig(dungeonId);
  const hp = normalizeHp(char?.hp);
  const firstFloor = floorInfo(cfg, 1);
  return {
    dungeonId: cfg.id,
    dungeonName: cfg.name,
    clearFlag: cfg.clearFlag,
    status: "exploring",
    floor: 1,
    floorName: firstFloor.name,
    maxFloors: cfg.floors.length,
    step: 0,
    stepsPerFloor: firstFloor.stepsPerFloor,
    hp,
    choices: generateChoices(cfg, 1, 0),
    activeNode: null,
    activeEnemy: null,
    loot: { money: 0, exp: 0, pot: 0, items: [] },
    usedItems: [],
    metAdventurers: [],
    log: [`踏入${cfg.name}，${firstFloor.name}。${firstFloor.desc}`],
    clearedNodes: 0,
    bossDefeated: false,
  };
}

export function selectDungeonNode(run, nodeId) {
  if (run.status !== "exploring") return run;
  const node = run.choices.find((c) => c.nodeId === nodeId);
  if (!node) return run;

  if (node.type === DUNGEON_NODE_TYPE.COMBAT || node.type === DUNGEON_NODE_TYPE.BOSS) {
    const tpl = node.enemyTemplate;
    const npc = buildCombatNpc(tpl, node.nodeId);
    return {
      ...run,
      status: "combat",
      activeNode: node,
      activeEnemy: npc,
      log: [...run.log, `遭遇「${tpl.name}」：${tpl.desc}`],
    };
  }

  const met = node.adventurer?.id && !(run.metAdventurers || []).includes(node.adventurer.id)
    ? [...(run.metAdventurers || []), node.adventurer.id]
    : (run.metAdventurers || []);

  return {
    ...run,
    status: "node",
    activeNode: node,
    activeEnemy: null,
    metAdventurers: met,
  };
}

function extractBattleLoot(loot, dodgeStolenItems) {
  const items = [];
  let money = 0;
  if (Array.isArray(loot)) {
    for (const x of loot) {
      const name = typeof x === "string" ? x : x?.name;
      if (name) items.push(name);
    }
  } else if (loot && typeof loot === "object") {
    if (typeof loot.droppedMoney === "number") money += loot.droppedMoney;
    const candidates = [loot.droppedItem, ...(loot.guaranteedLoot || [])];
    for (const x of candidates) {
      const name = typeof x === "string" ? x : x?.name;
      if (name) items.push(name);
    }
  }
  for (const x of dodgeStolenItems || []) {
    const name = typeof x === "string" ? x : x?.name;
    if (name) items.push(name);
  }
  return { money, items };
}

export function applyDungeonBattleResult(run, {
  outcome, loot = null, playerHp, usedItems = [], dodgeStolenItems = [],
} = {}) {
  if (run.status !== "combat" || !run.activeNode) return run;

  const maxHp = run.hp[1];
  const rawHp = Array.isArray(playerHp) ? playerHp[0] : playerHp;
  const syncedHp = [clamp(typeof rawHp === "number" ? rawHp : run.hp[0], 0, maxHp), maxHp];
  const allUsed = [...run.usedItems, ...usedItems];
  const battleLoot = extractBattleLoot(loot, dodgeStolenItems);

  if (outcome === "win") {
    const reward = run.activeNode.reward || {};
    const recovered = run.activeNode.stolenFromPlayer || { money: 0, items: [] };
    const nextLoot = mergeLoot(run.loot, {
      ...reward,
      money: (reward.money || 0) + (recovered.money || 0) + battleLoot.money,
      items: [...(reward.items || []), ...(recovered.items || []), ...battleLoot.items],
    });
    const enemyName = run.activeEnemy?.name || "守卫";
    const isBoss = run.activeNode.type === DUNGEON_NODE_TYPE.BOSS;

    if (isBoss) {
      return {
        ...run,
        status: "victory",
        hp: syncedHp,
        loot: nextLoot,
        usedItems: allUsed,
        activeNode: null,
        activeEnemy: null,
        clearedNodes: run.clearedNodes + 1,
        bossDefeated: true,
        log: [...run.log, `击败镇宫首领「${enemyName}」，打通${run.dungeonName}！`],
      };
    }

    const winLine = (recovered.money || recovered.items?.length)
      ? `击败「${enemyName}」，全数夺回被抢财物并拾得战利品！`
      : `击退「${enemyName}」，拾得战利品。`;
    return advanceExploring({ ...run, usedItems: allUsed }, syncedHp, nextLoot, winLine);
  }

  if (outcome === "flee" || outcome === "retreat") {
    const partialLoot = mergeLoot(run.loot, { items: battleLoot.items });
    return {
      ...run,
      status: "retreated",
      hp: syncedHp,
      loot: partialLoot,
      usedItems: allUsed,
      activeNode: null,
      activeEnemy: null,
      log: [...run.log, "见势不妙，抽身退出了地宫。"],
    };
  }

  return {
    ...run,
    status: "defeated",
    hp: [Math.min(1, syncedHp[0]), maxHp],
    usedItems: allUsed,
    activeNode: null,
    activeEnemy: null,
    log: [...run.log, `不敌「${run.activeEnemy?.name || "守卫"}」，负伤被逐出地宫……`],
  };
}

export function retreatDungeonRun(run) {
  if (run.status === "victory" || run.status === "defeated" || run.status === "retreated") return run;
  return {
    ...run,
    status: "retreated",
    activeNode: null,
    activeEnemy: null,
    log: [...run.log, "见好就收，顺着来路稳稳撤出了地宫。"],
  };
}

export function computeSettledLoot(run) {
  const full = run.status === "victory" || run.status === "retreated";
  const ratio = full ? 1 : 0.5;
  return {
    money: Math.floor((run.loot?.money || 0) * ratio),
    exp: Math.floor((run.loot?.exp || 0) * ratio),
    pot: Math.floor((run.loot?.pot || 0) * ratio),
    items: [...(run.loot?.items || [])],
  };
}
export { DUNGEON_DISTRICTS_ALL } from "../../data/dungeon/districts.js";

// 亲密互动·好感门槛（docs/设计_亲密互动好感门槛.md）
export { intimacyGate, intimacyRefusal, intimacyPromptNote, ARCHETYPE_INTIMACY, stationedFavorDecayRule } from "../npc/intimacy.js";
