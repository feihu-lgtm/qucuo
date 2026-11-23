// 地宫节点裁决：探索推进 + 冒险者交互 + 普通节点选项结算。

import { DUNGEON_NODE_TYPE, getDungeonConfig } from "../../data/dungeon/catalog.js";
import { random } from "../../../utils/rng.js";
import { clamp, floorInfo, mergeLoot, buildCombatNpc, calcDungeonCheckRate } from "./internal.js";
import { generateChoices } from "./nodes.js";
import { snatchPlayerLoot, buildRobberyConfrontation } from "./adventurers.js";

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

export function advanceExploring(run, nextHp, nextLoot, logLine) {
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
