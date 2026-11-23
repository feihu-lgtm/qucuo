import { beforeEach, describe, expect, it, vi } from "vitest";
import { DUNGEON_CATALOG, DUNGEON_NODE_TYPE, getDungeonConfig } from "../../data/dungeon/catalog.js";
import { CATALOG_INDEX } from "../../data/items/catalog.js";
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
  it("白塔地宫配置的所有掉落物品均存在于 CATALOG_INDEX", () => {
    const cfg = getDungeonConfig("white_pagoda_crypt");
    const names = new Set();
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
