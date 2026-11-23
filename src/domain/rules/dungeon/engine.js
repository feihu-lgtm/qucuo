// 地宫探险 · 纯前端状态机与规则裁决（零 React / infra / store 依赖）。
// 输入当前 run 状态与玩家行动，返回下一个不可变 run 快照。

import { DUNGEON_NODE_TYPE, getDungeonConfig } from "../../data/dungeon/catalog.js";
import { ensureNpcCombatData } from "../npc/npcGeneration.js";
import { random } from "../../../utils/rng.js";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pickRandom(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor(random() * list.length) % list.length];
}

function normalizeHp(hp) {
  const max = Math.max(1, Number(hp?.[1]) || 100);
  const cur = clamp(Number(hp?.[0] ?? max) || 1, 1, max);
  return [cur, max];
}

function floorInfo(cfg, floorNum) {
  return cfg.floors.find((f) => f.floor === floorNum) || cfg.floors[cfg.floors.length - 1];
}

function buildEnemyForFloor(cfg, tier, nodeKey) {
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

function buildBossNode(cfg) {
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

function buildPoolNode(cfg, type, keyPrefix) {
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

function generateChoices(cfg, floorNum, step) {
  const info = floorInfo(cfg, floorNum);
  const isFinalStep = floorNum >= cfg.floors.length && step >= info.stepsPerFloor;
  if (isFinalStep) return [buildBossNode(cfg)];

  const prefix = `f${floorNum}_s${step}`;
  const typesA = [DUNGEON_NODE_TYPE.COMBAT, DUNGEON_NODE_TYPE.TRAP, DUNGEON_NODE_TYPE.EVENT];
  const typesB = [DUNGEON_NODE_TYPE.TREASURE, DUNGEON_NODE_TYPE.REST, DUNGEON_NODE_TYPE.EVENT, DUNGEON_NODE_TYPE.TRAP];

  const firstType = pickRandom(typesA);
  const secondPool = typesB.filter((t) => t !== firstType);
  const secondType = pickRandom(secondPool.length ? secondPool : typesB);

  const makeOne = (t, suffix) => (
    t === DUNGEON_NODE_TYPE.COMBAT
      ? buildEnemyForFloor(cfg, info.tier, `${prefix}_${suffix}`)
      : buildPoolNode(cfg, t, `${prefix}_${suffix}`)
  );

  return [makeOne(firstType, "a"), makeOne(secondType, "b")];
}

function advanceProgress(cfg, run) {
  const curInfo = floorInfo(cfg, run.floor);
  let nextFloor = run.floor;
  let nextStep = run.step + 1;
  const maxFloors = cfg.floors.length;

  // 非最后一层走满 stepsPerFloor 后进下一层；最后一层走满 stepsPerFloor 时保留在 step === stepsPerFloor 等候 Boss
  if (nextFloor < maxFloors && nextStep >= curInfo.stepsPerFloor) {
    nextFloor += 1;
    nextStep = 0;
  }

  return {
    floor: nextFloor,
    step: nextStep,
    choices: generateChoices(cfg, nextFloor, nextStep),
  };
}

function mergeLoot(loot, delta = {}) {
  const items = [...loot.items];
  for (const item of delta.items || []) {
    const name = typeof item === "string" ? item : item?.name;
    if (name) items.push(name);
  }
  return {
    money: loot.money + (delta.money || 0),
    exp: loot.exp + (delta.exp || 0),
    pot: loot.pot + (delta.pot || 0),
    items,
  };
}

// 七维检定成功率公式（纯函数，同时供 UI 展示预估概率）。
export function calcDungeonCheckRate(statValue, dc = 5) {
  const val = Number(statValue) || 5;
  return clamp(Math.round(35 + (val - dc) * 12), 15, 95);
}

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
    const npc = ensureNpcCombatData({
      id: `${node.nodeId}_${tpl.id}`,
      name: tpl.name,
      role: tpl.role,
      region: tpl.region,
      levelCap: tpl.levelCap,
      desc: tpl.desc,
      carry: tpl.carry || [],
    }, { levelCap: tpl.levelCap });
    return {
      ...run,
      status: "combat",
      activeNode: node,
      activeEnemy: npc,
      log: [...run.log, `遭遇「${tpl.name}」：${tpl.desc}`],
    };
  }

  return {
    ...run,
    status: "node",
    activeNode: node,
    activeEnemy: null,
  };
}

export function resolveDungeonChoice(run, choiceId, effectiveSpecial = {}) {
  if (run.status !== "node" || !run.activeNode) return run;
  const choice = (run.activeNode.choices || []).find((c) => c.id === choiceId);
  if (!choice) return run;

  let passed = true;
  let rateText = "";
  if (choice.stat) {
    const statVal = effectiveSpecial?.[choice.stat] ?? 5;
    const rate = calcDungeonCheckRate(statVal, choice.dc ?? 5);
    passed = random() * 100 < rate;
    rateText = `（${choice.stat} ${statVal} · 胜算 ${rate}% → ${passed ? "得手" : "失手"}）`;
  }

  const outcome = passed ? choice.success : (choice.fail || choice.success);
  const [curHp, maxHp] = run.hp;
  const healAmt = (outcome.hpHeal || 0) + (outcome.hpHealRatio ? Math.round(maxHp * outcome.hpHealRatio) : 0);
  const lossAmt = outcome.hpLoss || 0;
  const nextHp = [clamp(curHp + healAmt - lossAmt, 0, maxHp), maxHp];
  const nextLoot = mergeLoot(run.loot, outcome);
  const logLine = `${run.activeNode.title}：${outcome.text}${rateText}`;

  if (nextHp[0] <= 0) {
    return {
      ...run,
      hp: nextHp,
      loot: nextLoot,
      activeNode: null,
      status: "defeated",
      log: [...run.log, logLine, "气血耗尽，只得勉力挣扎撤出地宫……"],
    };
  }

  const cfg = getDungeonConfig(run.dungeonId);
  const next = advanceProgress(cfg, run);
  const nextInfo = floorInfo(cfg, next.floor);
  const logs = [...run.log, logLine];
  if (next.floor !== run.floor) logs.push(`深入${nextInfo.name}。${nextInfo.desc}`);

  return {
    ...run,
    status: "exploring",
    floor: next.floor,
    floorName: nextInfo.name,
    step: next.step,
    stepsPerFloor: nextInfo.stepsPerFloor,
    hp: nextHp,
    choices: next.choices,
    activeNode: null,
    loot: nextLoot,
    clearedNodes: run.clearedNodes + 1,
    log: logs,
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
    const nextLoot = mergeLoot(run.loot, {
      ...reward,
      money: (reward.money || 0) + battleLoot.money,
      items: [...(reward.items || []), ...battleLoot.items],
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

    const cfg = getDungeonConfig(run.dungeonId);
    const next = advanceProgress(cfg, run);
    const nextInfo = floorInfo(cfg, next.floor);
    const logs = [...run.log, `击退「${enemyName}」，拾得战利品。`];
    if (next.floor !== run.floor) logs.push(`深入${nextInfo.name}。${nextInfo.desc}`);

    return {
      ...run,
      status: "exploring",
      floor: next.floor,
      floorName: nextInfo.name,
      step: next.step,
      stepsPerFloor: nextInfo.stepsPerFloor,
      hp: syncedHp,
      choices: next.choices,
      activeNode: null,
      activeEnemy: null,
      loot: nextLoot,
      usedItems: allUsed,
      clearedNodes: run.clearedNodes + 1,
      log: logs,
    };
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
