import { beforeEach, describe, expect, it, vi } from "vitest";
import { DUNGEON_CATALOG, DUNGEON_NODE_TYPE, getDungeonConfig } from "../../data/dungeon/catalog.js";
import { ADVENTURER_POOL, getWorldAdventurers, isAdventurerName } from "../../data/dungeon/adventurers.js";
import { QUCUO_MAP } from "../../data/map/qucuoMap.js";
import { CATALOG_INDEX } from "../../data/items/catalog.js";
import { residentNpcRule } from "../npc/rules.js";
import { setSeed } from "../../../utils/rng.js";
import {
  applyDungeonBattleResult,
  calcDungeonCheckRate,
  computeSettledLoot,
  createDungeonRun,
  resolveDungeonChoice,
  retreatDungeonRun,
  selectDungeonNode,
} from "./engine.js";

beforeEach(() => {
  setSeed(123456);
  vi.restoreAllMocks();
});

describe("地宫配置表与基础初始化", () => {
  it("八大地宫与二十二位 OC 冒险者的掉落/随身物品均存在于 CATALOG_INDEX", () => {
    expect(Object.keys(DUNGEON_CATALOG)).toHaveLength(8);
    expect(ADVENTURER_POOL).toHaveLength(22);
    expect(new Set(ADVENTURER_POOL.map((a) => a.name)).size).toBe(22);

    const names = new Set();
    for (const cfg of Object.values(DUNGEON_CATALOG)) {
      for (const pool of [cfg.traps, cfg.events, cfg.treasures, cfg.rests]) {
        for (const entry of pool) {
          for (const ch of entry.choices) {
            for (const item of ch.success?.items || []) names.add(item);
            for (const item of ch.fail?.items || []) names.add(item);
          }
        }
      }
      for (const enemy of [...cfg.enemies, cfg.boss]) {
        for (const c of enemy.carry || []) names.add(c.name);
        for (const item of enemy.reward?.items || []) names.add(item);
      }
    }
    for (const adv of ADVENTURER_POOL) {
      expect(adv.rainbow).toBe(true);
      expect(isAdventurerName(adv.name)).toBe(true);
      for (const c of adv.carry || []) names.add(c.name);
    }
    const missing = [...names].filter((name) => !CATALOG_INDEX[name]);
    expect(missing).toEqual([]);
  });

  it("createDungeonRun 初始化一层状态并生成两个可探索节点，未知 id 回退白塔地宫", () => {
    expect(getDungeonConfig("unknown_id")).toBe(DUNGEON_CATALOG.white_pagoda_crypt);
    const run = createDungeonRun("white_pagoda_crypt", { char: { hp: [75, 120] } });
    expect(run.dungeonId).toBe("white_pagoda_crypt");
    expect(run.status).toBe("exploring");
    expect(run.floor).toBe(1);
    expect(run.maxFloors).toBe(3);
    expect(run.hp).toEqual([75, 120]);
    expect(run.choices).toHaveLength(2);
    expect(run.bossDefeated).toBe(false);
  });

  it("calcDungeonCheckRate 遵循七维差值并限制在 [15, 95]", () => {
    expect(calcDungeonCheckRate(5, 5)).toBe(35);
    expect(calcDungeonCheckRate(1, 10)).toBe(15);
    expect(calcDungeonCheckRate(12, 3)).toBe(95);
    expect(calcDungeonCheckRate(8, 5)).toBe(71);
  });
});

describe("节点选择、检定与流程推进", () => {
  it("selectDungeonNode 进入非战斗节点或生成完整可战 NPC", () => {
    const run = createDungeonRun("white_pagoda_crypt", { char: { hp: [100, 100] } });
    const combatChoice = run.choices.find((c) => c.type === DUNGEON_NODE_TYPE.COMBAT);
    if (combatChoice) {
      const entered = selectDungeonNode(run, combatChoice.nodeId);
      expect(entered.status).toBe("combat");
      expect(entered.activeEnemy?.moveset?.length).toBeGreaterThan(0);
      expect(entered.activeEnemy?.combatStats?.hp).toHaveLength(2);
    }

    const nonCombatChoice = run.choices.find((c) => c.type !== DUNGEON_NODE_TYPE.COMBAT);
    const nodeRun = selectDungeonNode(run, nonCombatChoice.nodeId);
    expect(nodeRun.status).toBe("node");
    expect(nodeRun.activeNode?.nodeId).toBe(nonCombatChoice.nodeId);
  });

  it("resolveDungeonChoice 处理无检定休整回血与带检定机关成功/失败", () => {
    const baseRun = createDungeonRun("white_pagoda_crypt", { char: { hp: [50, 100] } });
    const restNode = {
      type: DUNGEON_NODE_TYPE.REST,
      nodeId: "test_rest",
      title: "休整 · 测试",
      desc: "desc",
      choices: [{
        id: "heal_choice",
        label: "包扎",
        success: { text: "回血", hpHealRatio: 0.3, exp: 2 },
      }],
    };
    const afterRest = resolveDungeonChoice({ ...baseRun, status: "node", activeNode: restNode }, "heal_choice");
    expect(afterRest.status).toBe("exploring");
    expect(afterRest.hp).toEqual([80, 100]);
    expect(afterRest.loot.exp).toBe(2);
    expect(afterRest.step).toBe(1);

    const trapNode = {
      type: DUNGEON_NODE_TYPE.TRAP,
      nodeId: "test_trap",
      title: "机关 · 测试",
      desc: "desc",
      choices: [{
        id: "trap_opt",
        label: "闪避",
        stat: "身法",
        dc: 5,
        success: { text: "躲开", money: 20 },
        fail: { text: "受伤", hpLoss: 60 },
      }],
    };
    // 高身法且锁定随机数为 0.01 -> 必然成功
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const trapWin = resolveDungeonChoice({ ...baseRun, status: "node", activeNode: trapNode }, "trap_opt", { 身法: 9 });
    expect(trapWin.status).toBe("exploring");
    expect(trapWin.loot.money).toBe(20);

    // 气血不足扣至 <= 0 -> defeated
    setSeed(1);
    // 找一个使得 engine rng >= 0.95 的种子或测低血量必死分支：先把 stat 设低（15%胜率）并重设多轮直到 fail，或直接 hp=10, hpLoss=60
    const fatalTrap = {
      ...trapNode,
      choices: [{ id: "fatal", label: "硬闯", stat: "身法", dc: 12, success: { text: "过", money: 1 }, fail: { text: "倒", hpLoss: 60 } }],
    };
    let cur = { ...baseRun, hp: [10, 100], status: "node", activeNode: fatalTrap };
    // 尝试不同 seed 触发 fail
    let failedRun = null;
    for (let s = 1; s < 50; s += 1) {
      setSeed(s);
      const res = resolveDungeonChoice(cur, "fatal", { 身法: 1 });
      if (res.status === "defeated") { failedRun = res; break; }
    }
    expect(failedRun?.status).toBe("defeated");
    expect(failedRun?.hp[0]).toBe(0);
  });

  it("跨层推进直至第 3 层末尾触发唯一 Boss，击败后变为 victory", () => {
    let run = createDungeonRun("white_pagoda_crypt", { char: { hp: [120, 120] } });
    const dummyNode = {
      type: DUNGEON_NODE_TYPE.EVENT,
      nodeId: "step_node",
      title: "奇遇",
      desc: "ok",
      choices: [{ id: "ok", label: "继续", success: { text: "推进", money: 5, exp: 1 } }],
    };

    // 3 层 × 每层 2 步 = 6 步
    for (let i = 0; i < 6; i += 1) {
      run = resolveDungeonChoice({ ...run, status: "node", activeNode: dummyNode }, "ok");
    }
    expect(run.floor).toBe(3);
    expect(run.choices).toHaveLength(1);
    expect(run.choices[0].type).toBe(DUNGEON_NODE_TYPE.BOSS);

    const bossCombat = selectDungeonNode(run, run.choices[0].nodeId);
    expect(bossCombat.status).toBe("combat");
    const won = applyDungeonBattleResult(bossCombat, {
      outcome: "win",
      loot: { droppedMoney: 30, droppedItem: { name: "降魔杵" }, guaranteedLoot: [] },
      playerHp: [92, 120],
      usedItems: ["守塔僧金疮药"],
      dodgeStolenItems: [{ name: "守塔僧的念珠" }],
    });
    expect(won.status).toBe("victory");
    expect(won.bossDefeated).toBe(true);
    expect(won.hp).toEqual([92, 120]);
    expect(won.usedItems).toEqual(["守塔僧金疮药"]);
    expect(won.loot.items).toContain("守宫砂");
    expect(won.loot.items).toContain("降魔杵");
    expect(won.loot.items).toContain("守塔僧的念珠");
    expect(won.loot.money).toBeGreaterThanOrEqual(30 + 68 + 30);
  });

  it("小怪胜/逃跑撤退/战败保底与 computeSettledLoot 规则正确", () => {
    const run = createDungeonRun("white_pagoda_crypt", { char: { hp: [100, 100] } });
    const combatNode = {
      type: DUNGEON_NODE_TYPE.COMBAT,
      nodeId: "c1",
      title: "守卫",
      desc: "d",
      enemyTemplate: { id: "g1", name: "守塔僧", role: "守塔僧", region: "宗教", levelCap: 1, desc: "d" },
      reward: { money: 20, exp: 3, pot: 2 },
    };
    const inCombat = selectDungeonNode({ ...run, choices: [combatNode] }, "c1");

    const afterFlee = applyDungeonBattleResult(inCombat, { outcome: "flee", playerHp: [44, 100], usedItems: ["活血草"] });
    expect(afterFlee.status).toBe("retreated");
    expect(afterFlee.hp).toEqual([44, 100]);
    expect(afterFlee.usedItems).toEqual(["活血草"]);

    const afterLose = applyDungeonBattleResult(
      { ...inCombat, loot: { money: 41, exp: 5, pot: 3, items: ["守宫砂"] } },
      { outcome: "lose", playerHp: [0, 100], usedItems: ["守塔僧金疮药"] },
    );
    expect(afterLose.status).toBe("defeated");
    expect(afterLose.hp).toEqual([0, 100]);
    expect(afterLose.usedItems).toEqual(["守塔僧金疮药"]);

    // 战败银两经验潜能折半，物品全留
    expect(computeSettledLoot(afterLose)).toEqual({
      money: 20,
      exp: 2,
      pot: 1,
      items: ["守宫砂"],
    });

    const retreated = retreatDungeonRun({ ...run, loot: { money: 41, exp: 5, pot: 3, items: ["守宫砂"] } });
    expect(retreated.status).toBe("retreated");
    expect(computeSettledLoot(retreated)).toEqual({
      money: 41,
      exp: 5,
      pot: 3,
      items: ["守宫砂"],
    });
  });
});

describe("地宫随机冒险者遭遇与世界刷新", () => {
  const sampleAdv = ADVENTURER_POOL.find((a) => a.name === "燕绾烟");

  function makeAdvNode(scenario = "help") {
    return {
      type: DUNGEON_NODE_TYPE.ADVENTURER,
      nodeId: "f1_s0_b_adv_yan_wanyan",
      title: `江湖奇遇 · ${sampleAdv.name}`,
      desc: "desc",
      scenario,
      adventurer: sampleAdv,
      choices: scenario === "help"
        ? [
            { id: "adv_help", kind: "adv_help", label: "帮", stat: "身法", dc: 5 },
            { id: "adv_ignore", kind: "adv_ignore", label: "不管" },
            { id: "adv_rob", kind: "adv_rob", label: "开抢" },
          ]
        : [
            { id: "adv_fight", kind: "adv_fight", label: "迎战" },
            { id: "adv_outwit", kind: "adv_outwit", label: "智取", stat: "智谋", dc: 5 },
            { id: "adv_yield", kind: "adv_yield", label: "不管" },
          ],
    };
  }

  it("帮忙时未触发反水则仗义分赃，触发反水抢宝可拔刀夺回全部被抢财物", () => {
    const base = createDungeonRun("white_pagoda_crypt", { char: { hp: [100, 100] } });
    const withLoot = { ...base, loot: { money: 40, exp: 0, pot: 0, items: ["守宫砂"] } };
    const entered = selectDungeonNode({ ...withLoot, choices: [makeAdvNode("help")] }, "f1_s0_b_adv_yan_wanyan");
    expect(entered.metAdventurers).toContain(sampleAdv.id);

    // 1) 不反水：用高随机值跳过 stealBias(0.55) 判定
    let shared = null;
    for (let s = 1; s < 50; s += 1) {
      setSeed(s);
      const res = resolveDungeonChoice(entered, "adv_help", { 身法: 8 });
      if (res.status === "exploring" && res.loot.money > 40) { shared = res; break; }
    }
    expect(shared?.status).toBe("exploring");
    expect(shared?.loot.money).toBe(68);

    // 2) 触发反水抢宝 -> 选择追击夺回 -> 切磋胜利全数追回
    let betrayed = null;
    for (let s = 1; s < 50; s += 1) {
      setSeed(s);
      const res = resolveDungeonChoice(entered, "adv_help", { 身法: 6 });
      if (res.status === "node" && res.activeNode?.stolenFromPlayer) { betrayed = res; break; }
    }
    expect(betrayed?.status).toBe("node");
    const stolen = betrayed.activeNode.stolenFromPlayer;
    expect(stolen.money).toBeGreaterThan(0);
    expect(betrayed.loot.money).toBe(40 - stolen.money);

    const combat = resolveDungeonChoice(betrayed, "adv_pursue");
    expect(combat.status).toBe("combat");
    expect(combat.activeEnemy?.name).toBe("燕十三娘");

    const recovered = applyDungeonBattleResult(combat, { outcome: "win", playerHp: [88, 100] });
    expect(recovered.status).toBe("exploring");
    expect(recovered.loot.money).toBeGreaterThanOrEqual(40 + 20);
    for (const itm of stolen.items) expect(recovered.loot.items).toContain(itm);
  });

  it("冒险者节点支持冷眼不管、趁火打劫直接开战，以及抢宝对峙智谋失败被抢", () => {
    const base = createDungeonRun("white_pagoda_crypt", { char: { hp: [100, 100] } });
    const safeIgnore = resolveDungeonChoice({
      ...base,
      status: "node",
      activeNode: makeAdvNode("help"),
      loot: { money: 0, exp: 0, pot: 0, items: [] },
    }, "adv_ignore");
    expect(safeIgnore.status).toBe("exploring");

    const robCombat = resolveDungeonChoice({
      ...base,
      status: "node",
      activeNode: makeAdvNode("help"),
    }, "adv_rob");
    expect(robCombat.status).toBe("combat");
    expect(robCombat.activeEnemy?.name).toBe("燕十三娘");

    const ambushBase = {
      ...base,
      status: "node",
      activeNode: makeAdvNode("ambush"),
      loot: { money: 50, exp: 0, pot: 0, items: ["降魔杵"] },
    };
    let outwitFail = null;
    for (let s = 1; s < 50; s += 1) {
      setSeed(s);
      const res = resolveDungeonChoice(ambushBase, "adv_outwit", { 智谋: 1 });
      if (res.status === "node" && res.activeNode?.stolenFromPlayer) { outwitFail = res; break; }
    }
    expect(outwitFail?.activeNode?.stolenFromPlayer?.money).toBeGreaterThan(0);
  });

  it("getWorldAdventurers 每天把 22 位冒险者分布到各地，residentNpcRule 跨天换人并附带炫彩标记", () => {
    const day0List = Object.keys(QUCUO_MAP).flatMap((d) => getWorldAdventurers(d, 6));
    expect(day0List).toHaveLength(22);
    expect(new Set(day0List.map((a) => a.name)).size).toBe(22);

    const hostDistrict = Object.keys(QUCUO_MAP).find((d) => getWorldAdventurers(d, 6).length > 0);
    const expectedToday = getWorldAdventurers(hostDistrict, 6).map((a) => a.name);
    const importedRegistry = { getImportedForDistrict: () => [], getImportedResidentNames: () => [] };

    const day0State = {
      char: { special: { 气运: 5 } }, companionState: {}, flags: [], importedVer: 0, questProgress: {},
      room: { name: hostDistrict, npcs: [] }, time: 6,
    };
    const npcs0 = residentNpcRule.run(day0State, { importedRegistry }).changes.room(day0State.room).npcs;
    const spawned0 = npcs0.filter((n) => n.adventurer);
    expect(spawned0.map((n) => n.name).sort()).toEqual(expectedToday.sort());
    expect(spawned0.every((n) => n.rainbow && n.rainbowStyle && n.moveset?.length && n.combatStats)).toBe(true);

    // 推进到第 10 天时，清理掉过期冒险者
    const day10State = { ...day0State, room: { name: hostDistrict, npcs: npcs0 }, time: 24 * 10 + 6 };
    const npcs10 = residentNpcRule.run(day10State, { importedRegistry }).changes.room(day10State.room).npcs;
    expect(npcs10.some((n) => n.adventurerDay === 0)).toBe(false);
  });
});
