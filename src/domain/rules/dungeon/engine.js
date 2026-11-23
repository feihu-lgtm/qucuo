// 地宫探险 · 纯前端状态机与规则裁决（零 React / infra / store 依赖）。
// 输入当前 run 状态与玩家行动，返回下一个不可变 run 快照。

import { DUNGEON_NODE_TYPE, getDungeonConfig } from "../../data/dungeon/catalog.js";
import { pickDungeonAdventurer } from "../../data/dungeon/adventurers.js";
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

function buildAdventurerNode(keyPrefix, metAdventurers = [], lootMoney = 0) {
  const adv = pickDungeonAdventurer(metAdventurers);
  const scenario = lootMoney > 0 && (adv.stealBias >= 0.45 || random() < 0.45) ? "ambush" : "help";
  if (scenario === "ambush") {
    return {
      type: DUNGEON_NODE_TYPE.ADVENTURER,
      nodeId: `${keyPrefix}_${adv.id}`,
      title: `狭路相逢 · ${adv.name}`,
      desc: `${adv.name}（${adv.title} · ${adv.archetypeLabel}）斜倚在石柱旁目光落向你腰间行囊：「这地宫里的货，见者有份吧？」`,
      scenario,
      adventurer: adv,
      choices: [
        { id: "adv_fight", kind: "adv_fight", label: "拔刀护宝，与他切磋论高下（迎战）" },
        { id: "adv_outwit", kind: "adv_outwit", label: "虚晃一招凭智谋甩开（检定避战）", stat: "智谋", dc: 5 },
        { id: "adv_yield", kind: "adv_yield", label: "破财消灾，舍出几两银子脱身（不管）" },
      ],
    };
  }
  return {
    type: DUNGEON_NODE_TYPE.ADVENTURER,
    nodeId: `${keyPrefix}_${adv.id}`,
    title: `江湖奇遇 · ${adv.name}`,
    desc: `${adv.name}（${adv.title} · ${adv.archetypeLabel}）正被一道半开的石门卡住身形：「道友来的巧，搭把手一块破开这机关？」`,
    scenario,
    adventurer: adv,
    choices: [
      { id: "adv_help", kind: "adv_help", label: "出手相助共破机关（可帮 · 需慎防贪心反水）", stat: "身法", dc: 5 },
      { id: "adv_ignore", kind: "adv_ignore", label: "冷眼旁观，绕道离开（不管）" },
      { id: "adv_rob", kind: "adv_rob", label: "趁火打劫，亮兵刃开抢（必战）" },
    ],
  };
}

function generateChoices(cfg, floorNum, step, metAdventurers = [], lootMoney = 0) {
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

function advanceProgress(cfg, run, metAdventurers = run.metAdventurers || [], lootMoney = run.loot?.money || 0) {
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
    choices: generateChoices(cfg, nextFloor, nextStep, metAdventurers, lootMoney),
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
    metAdventurers: [],
    log: [`踏入${cfg.name}，${firstFloor.name}。${firstFloor.desc}`],
    clearedNodes: 0,
    bossDefeated: false,
  };
}

function buildCombatNpc(tpl, prefix) {
  return ensureNpcCombatData({
    id: `${prefix}_${tpl.id}`,
    name: tpl.name,
    role: tpl.role || tpl.title || "江湖旅人",
    region: tpl.region || "中原",
    levelCap: tpl.levelCap ?? 2,
    desc: tpl.desc || tpl.brief || "",
    personality: tpl.personality,
    carry: tpl.carry || [],
  }, { levelCap: tpl.levelCap ?? 2 });
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

function snatchPlayerLoot(loot, ratio = 0.35, minMoney = 8) {
  const curMoney = loot.money || 0;
  const stolenMoney = curMoney > 0 ? Math.min(curMoney, Math.max(minMoney, Math.floor(curMoney * ratio))) : 0;
  const items = [...(loot.items || [])];
  const stolenItems = [];
  if (items.length > 0 && (stolenMoney === 0 || random() < 0.5)) {
    stolenItems.push(items.pop());
  }
  return {
    nextLoot: { ...loot, money: curMoney - stolenMoney, items },
    stolenMoney,
    stolenItems,
  };
}

function buildRobberyConfrontation(adv, node, stolenMoney, stolenItems, reason) {
  const parts = [];
  if (stolenMoney > 0) parts.push(`${stolenMoney}两银子`);
  if (stolenItems.length > 0) parts.push(stolenItems.join("、"));
  const stolenText = parts.length ? parts.join("与") : "行囊边角几文碎钱";
  return {
    node: {
      ...node,
      title: `反水夺宝 · ${adv.name}`,
      desc: `${reason} ${adv.name}顺手抢走${stolenText}转身便遁！`,
      stolenFromPlayer: { money: stolenMoney, items: stolenItems },
      choices: [
        { id: "adv_pursue", kind: "adv_pursue", label: "拔刀追击，夺回被抢财物（迎战）" },
        { id: "adv_let_go", kind: "adv_let_go", label: "算了，吃一堑长一智放他走" },
      ],
    },
    logLine: `${adv.name}反水抢走了${stolenText}！`,
  };
}

function advanceExploring(run, nextHp, nextLoot, logLine) {
  const cfg = getDungeonConfig(run.dungeonId);
  const next = advanceProgress(cfg, run, run.metAdventurers || [], nextLoot.money);
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
    activeEnemy: null,
    loot: nextLoot,
    clearedNodes: run.clearedNodes + 1,
    log: logs,
  };
}

function resolveAdventurerChoice(run, choice, effectiveSpecial) {
  const node = run.activeNode;
  const adv = node.adventurer;
  const [curHp, maxHp] = run.hp;

  if (choice.kind === "adv_rob" || choice.kind === "adv_fight" || choice.kind === "adv_pursue") {
    const npc = buildCombatNpc(adv, node.nodeId);
    const reward = {
      money: choice.kind === "adv_pursue" ? 20 : 32,
      exp: 5,
      pot: 4,
    };
    return {
      ...run,
      status: "combat",
      activeNode: { ...node, reward },
      activeEnemy: npc,
      log: [...run.log, `与${adv.name}当场撕破脸，拔刃交锋！`],
    };
  }

  if (choice.kind === "adv_let_go") {
    return advanceExploring(run, run.hp, run.loot, `任由${adv.name}远去，你整束衣襟继续探路。`);
  }

  if (choice.kind === "adv_yield") {
    const paid = Math.min(run.loot.money, 14);
    const nextLoot = { ...run.loot, money: run.loot.money - paid };
    const text = paid > 0
      ? `破财消灾，舍出${paid}两银子打发走${adv.name}。`
      : `两手空空摊开给${adv.name}瞧，对方撇撇嘴转身走了。`;
    return advanceExploring(run, run.hp, nextLoot, text);
  }

  if (choice.kind === "adv_ignore") {
    if (adv.stealBias >= 0.5 && (run.loot.money > 0 || run.loot.items.length > 0) && random() < adv.stealBias * 0.65) {
      const { nextLoot, stolenMoney, stolenItems } = snatchPlayerLoot(run.loot, 0.25, 6);
      const { node: nextNode, logLine } = buildRobberyConfrontation(
        adv, node, stolenMoney, stolenItems, "你本想冷眼绕过，不料对方借着昏暗石影悄悄摸近身后！",
      );
      return { ...run, status: "node", activeNode: nextNode, loot: nextLoot, log: [...run.log, logLine] };
    }
    return advanceExploring(run, run.hp, run.loot, `冷眼避开${adv.name}，各自相安无事。`);
  }

  if (choice.kind === "adv_outwit") {
    const statVal = effectiveSpecial?.[choice.stat] ?? 5;
    const rate = calcDungeonCheckRate(statVal, choice.dc ?? 5);
    if (random() * 100 < rate) {
      const nextLoot = mergeLoot(run.loot, { money: 12, exp: 3, pot: 2 });
      return advanceExploring(run, run.hp, nextLoot, `巧言虚晃甩开${adv.name}（${choice.stat} ${statVal} · ${rate}%），还顺走碎银。`);
    }
    if (run.loot.money > 0 || run.loot.items.length > 0) {
      const { nextLoot, stolenMoney, stolenItems } = snatchPlayerLoot(run.loot, 0.3, 10);
      const { node: nextNode, logLine } = buildRobberyConfrontation(
        adv, node, stolenMoney, stolenItems, `没甩开${adv.name}的眼线，反被对方一把按住行囊！`,
      );
      return { ...run, status: "node", activeNode: nextNode, loot: nextLoot, log: [...run.log, logLine] };
    }
    const nextHp = [clamp(curHp - 10, 1, maxHp), maxHp];
    return advanceExploring(run, nextHp, run.loot, `与${adv.name}推搡几下勉强脱身，肩头微痛。`);
  }

  // adv_help
  const statVal = effectiveSpecial?.[choice.stat] ?? 5;
  const rate = calcDungeonCheckRate(statVal, choice.dc ?? 5);
  const checkPassed = random() * 100 < rate;
  const nextHp = checkPassed ? run.hp : [clamp(curHp - 8, 1, maxHp), maxHp];

  if ((run.loot.money > 0 || run.loot.items.length > 0) && random() < adv.stealBias) {
    const { nextLoot, stolenMoney, stolenItems } = snatchPlayerLoot(run.loot, 0.35, 8);
    const { node: nextNode, logLine } = buildRobberyConfrontation(
      adv, node, stolenMoney, stolenItems, "石门轰然开启的刹那，你背脊一凉——",
    );
    return { ...run, status: "node", hp: nextHp, activeNode: nextNode, loot: nextLoot, log: [...run.log, logLine] };
  }

  const gift = adv.carry?.length && random() < 0.45 ? [adv.carry[0].name] : [];
  const nextLoot = mergeLoot(run.loot, { money: 28, exp: 3, pot: 3, items: gift });
  const giftText = gift.length ? `，临走还赠你一件「${gift[0]}」` : "";
  return advanceExploring(
    run, nextHp, nextLoot,
    `搭手帮${adv.name}解开石门，对方仗义分出一份银两与修为${giftText}。`,
  );
}

export function resolveDungeonChoice(run, choiceId, effectiveSpecial = {}) {
  if (run.status !== "node" || !run.activeNode) return run;
  const choice = (run.activeNode.choices || []).find((c) => c.id === choiceId);
  if (!choice) return run;

  if (run.activeNode.type === DUNGEON_NODE_TYPE.ADVENTURER || choice.kind?.startsWith("adv_")) {
    return resolveAdventurerChoice(run, choice, effectiveSpecial);
  }

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

  return advanceExploring(run, nextHp, nextLoot, logLine);
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
