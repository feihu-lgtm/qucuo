// 地宫楼层节点生成：战斗/首领/机关/奇遇/秘宝/休整/冒险者 七类节点的构建与抽选。

import { DUNGEON_NODE_TYPE } from "../../data/dungeon/catalog.js";
import { pickRandom, floorInfo } from "./internal.js";
import { buildAdventurerNode } from "./adventurers.js";

export function buildEnemyForFloor(cfg, tier, nodeKey) {
  const pool = cfg.enemies.filter((e) => (e.levelCap ?? 1) <= tier);
  const template = pickRandom(pool.length ? pool : cfg.enemies);
  return {
    type: DUNGEON_NODE_TYPE.COMBAT,
    nodeId: `${nodeKey}_combat`,
    title: `拦路：${template.name}`,
    desc: template.desc,
    enemyTemplate: template,
    reward: template.reward || { money: 20, exp: 3, pot: 2 },
  };
}

export function buildBossNode(cfg) {
  const b = cfg.boss;
  return {
    type: DUNGEON_NODE_TYPE.BOSS,
    nodeId: `boss_${b.id}`,
    title: `镇宫首领：${b.name}`,
    desc: b.desc,
    enemyTemplate: b,
    reward: b.reward || { money: 60, exp: 8, pot: 5 },
  };
}

export function buildPoolNode(cfg, type, keyPrefix) {
  if (type === DUNGEON_NODE_TYPE.TRAP) {
    const t = pickRandom(cfg.traps);
    return { type, nodeId: `${keyPrefix}_${t.id}`, title: `机关 · ${t.title}`, desc: t.desc, choices: t.choices };
  }
  if (type === DUNGEON_NODE_TYPE.EVENT) {
    const e = pickRandom(cfg.events);
    return { type, nodeId: `${keyPrefix}_${e.id}`, title: `奇遇 · ${e.title}`, desc: e.desc, choices: e.choices };
  }
  if (type === DUNGEON_NODE_TYPE.TREASURE) {
    const tr = pickRandom(cfg.treasures);
    return { type, nodeId: `${keyPrefix}_${tr.id}`, title: `秘宝 · ${tr.title}`, desc: tr.desc, choices: tr.choices };
  }
  const r = pickRandom(cfg.rests);
  return { type: DUNGEON_NODE_TYPE.REST, nodeId: `${keyPrefix}_${r.id}`, title: `休整 · ${r.title}`, desc: r.desc, choices: r.choices };
}

export function generateChoices(cfg, floorNum, step, metAdventurers = [], lootMoney = 0) {
  const info = floorInfo(cfg, floorNum);
  const isFinalStep = floorNum >= cfg.floors.length && step >= info.stepsPerFloor;
  if (isFinalStep) return [buildBossNode(cfg)];

  const prefix = `f${floorNum}_s${step}`;
  const typesA = [DUNGEON_NODE_TYPE.COMBAT, DUNGEON_NODE_TYPE.TRAP, DUNGEON_NODE_TYPE.EVENT];
  const typesB = [
    DUNGEON_NODE_TYPE.ADVENTURER,
    DUNGEON_NODE_TYPE.TREASURE,
    DUNGEON_NODE_TYPE.REST,
    DUNGEON_NODE_TYPE.EVENT,
    DUNGEON_NODE_TYPE.TRAP,
  ];

  const firstType = pickRandom(typesA);
  const secondPool = typesB.filter((t) => t !== firstType);
  const secondType = pickRandom(secondPool.length ? secondPool : typesB);

  const makeOne = (t, suffix) => {
    if (t === DUNGEON_NODE_TYPE.COMBAT) return buildEnemyForFloor(cfg, info.tier, `${prefix}_${suffix}`);
    if (t === DUNGEON_NODE_TYPE.ADVENTURER) return buildAdventurerNode(`${prefix}_${suffix}`, metAdventurers, lootMoney);
    return buildPoolNode(cfg, t, `${prefix}_${suffix}`);
  };

  return [makeOne(firstType, "a"), makeOne(secondType, "b")];
}
