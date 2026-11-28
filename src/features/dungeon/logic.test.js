import { describe, expect, it } from "vitest";
import { LOG_TYPES } from "../../domain/rules/log/logTypes.js";
import {
  DUNGEON_ID_TO_DISTRICT,
  runEnd,
  startMapRun,
} from "../../domain/rules/dungeon/engine.js";
import { DUNGEON_CATALOG } from "../../domain/data/dungeon/catalog.js";
import { settleDungeonRun, settleMapRun } from "./logic.js";

describe("settleDungeonRun", () => {
  const baseState = {
    char: { name: "主角", money: 100, hp: [80, 120] },
    inv: [
      { id: "heal_1", name: "守塔僧金疮药", category: "misc", equipped: false },
      { id: "heal_2", name: "守塔僧金疮药", category: "misc", equipped: false },
    ],
    exp: 10,
    pot: 5,
    time: 8,
    flags: ["white_pagoda_crypt_clue"],
  };

  it("通关胜利时全额发放奖励、按件扣消耗品、推进时间并写入首通 flag", () => {
    const run = {
      dungeonId: "white_pagoda_crypt",
      dungeonName: "白塔地宫",
      clearFlag: "dungeon_cleared_white_pagoda_crypt",
      status: "victory",
      floor: 3,
      hp: [64, 120],
      loot: { money: 80, exp: 12, pot: 7, items: ["降魔杵", "守宫砂"] },
      usedItems: ["守塔僧金疮药"],
      bossDefeated: true,
    };

    const res = settleDungeonRun(baseState, run, { now: 1000 });
    expect(res.changes.char.money).toBe(180);
    expect(res.changes.char.hp).toEqual([64, 120]);
    expect(res.changes.exp).toBe(22);
    expect(res.changes.pot).toBe(12);
    expect(res.changes.time).toBe(11);
    expect(res.changes.flags).toContain("dungeon_cleared_white_pagoda_crypt");

    // 原有 2 个守塔僧金疮药扣除 1 个，加上新带出的 2 件物品共 3 件
    expect(res.changes.inv).toHaveLength(3);
    expect(res.changes.inv.filter((i) => i.name === "守塔僧金疮药")).toHaveLength(1);
    expect(res.changes.inv.some((i) => i.name === "降魔杵" && i.quality === "紫")).toBe(true);
    expect(res.changes.inv.some((i) => i.name === "守宫砂" && i.quality === "蓝")).toBe(true);

    for (const entry of res.logs) {
      expect(LOG_TYPES.has(entry.t)).toBe(true);
    }
    expect(res.note.text).toContain("白塔地宫");
  });

  it("战败脱身时保留至少 1 血，银两/经验/潜能折半，物品仍全部保留，不写通关 flag", () => {
    const run = {
      dungeonId: "white_pagoda_crypt",
      dungeonName: "白塔地宫",
      clearFlag: "dungeon_cleared_white_pagoda_crypt",
      status: "defeated",
      floor: 2,
      hp: [0, 120],
      loot: { money: 35, exp: 7, pot: 3, items: ["铁网僧袍"] },
      usedItems: ["守塔僧金疮药", "守塔僧金疮药"],
      bossDefeated: false,
    };

    const res = settleDungeonRun(baseState, run, { now: 2000 });
    expect(res.changes.char.hp).toEqual([1, 120]);
    expect(res.changes.char.money).toBe(100 + 17);
    expect(res.changes.exp).toBe(10 + 3);
    expect(res.changes.pot).toBe(5 + 1);
    expect(res.changes.time).toBe(10);
    expect(res.changes.flags).toEqual(["white_pagoda_crypt_clue"]);
    expect(res.changes.inv).toHaveLength(1);
    expect(res.changes.inv[0].name).toBe("铁网僧袍");
  });
});

describe("内层地图入口出口接线", () => {
  const baseState = {
    char: { name: "主角", money: 50, hp: [80, 120] },
    inv: [],
    exp: 10,
    pot: 5,
    time: 8,
    flags: [],
  };

  it("入口：八座旧地宫 dungeonId 全部有映射、键是旧目录真词条、值是十区真词条且能开图", () => {
    for (const [dungeonId, districtKey] of Object.entries(DUNGEON_ID_TO_DISTRICT)) {
      expect(DUNGEON_CATALOG[dungeonId], `${dungeonId} 应存在于旧目录`).toBeDefined();
      const rs = startMapRun(districtKey, "entry-test");
      expect(rs.status).toBe("exploring");
      expect(rs.current).toBe(rs.map.anchor);
    }
  });

  it("出口：内层 run 走 settleMapRun 落盘——胜全带、败 1 血丢半、物品全留", () => {
    let rs = startMapRun(DUNGEON_ID_TO_DISTRICT.white_pagoda_crypt, "exit-test");
    rs = { ...rs, loot: { money: 40, exp: 8, pot: 4, items: ["降魔杵"] } };

    const win = settleMapRun(baseState, runEnd(rs, "victory").runState, { now: 1 });
    expect(win.changes.char.money).toBe(90);
    expect(win.changes.exp).toBe(18);
    expect(win.changes.pot).toBe(9);
    expect(win.changes.inv.map((i) => i.name)).toContain("降魔杵");
    expect(win.note.text).toContain("白塔地宫");

    const lose = settleMapRun(baseState, runEnd(rs, "defeated").runState, { now: 1 });
    expect(lose.changes.char.hp).toEqual([1, 120]);
    expect(lose.changes.char.money).toBe(50 + 20);
    expect(lose.changes.exp).toBe(10 + 4);
    expect(lose.changes.inv.map((i) => i.name)).toContain("降魔杵");
  });

  it("撤退不抹血：超上限气血与 run 外回血都保留，只扣 run 内真实掉的血", () => {
    // 入图时 150/120（超上限增益），走一步没走直接撤退——血不动
    const rs = startMapRun("白塔地宫", "hp", { char: { hp: [150, 120] } });
    expect(rs.entryHp).toBe(120); // 归一化后的入口记录
    const retreated = { ...rs, status: "retreated" };
    const overCap = settleMapRun(
      { ...baseState, char: { ...baseState.char, hp: [150, 120] } },
      retreated,
    );
    expect(overCap.changes.char.hp).toEqual([150, 120]);

    // run 内掉到 60（未来战斗），结算时 char 已回血到 110——只扣差值 60
    const hurt = { ...rs, hp: [60, 120], status: "retreated" };
    const healed = settleMapRun(
      { ...baseState, char: { ...baseState.char, hp: [110, 120] } },
      hurt,
    );
    expect(healed.changes.char.hp).toEqual([50, 120]); // 110 - (120-60)
  });

  it("白塔 13×13 结算：扣除spentMoney、写入色色卡/神兵flag、领悟武学并回写7天worlds", () => {
    const rs = startMapRun("白塔地宫", "settle-v2", { char: { hp: [100, 100], money: 80 } });
    const settledRun = {
      ...rs,
      status: "victory",
      bossDefeated: true,
      spentMoney: 30,
      loot: { money: 20, exp: 10, pot: 15, items: ["不动明王杵"] },
      unlockedExits: [rs.map.exitRooms[0]],
      unlockedEntries: [rs.map.anchor, rs.map.exitRooms[0]],
      unlockedCards: ["cg_baita_jingfan"],
      divineFlags: ["divine_obtained_budongmingwang"],
      learnedSkills: [{ id: "kf_lama_zhongming", name: "听钟·无畏", type: "招式", quality: "蓝" }],
    };
    const res = settleMapRun({
      ...baseState,
      char: { name: "主角", money: 80, hp: [100, 100] },
      skills: [],
      dungeonRun: {
        active: settledRun,
        worlds: {
          白塔地宫: {
            districtKey: "白塔地宫",
            epoch: 1,
            seed: rs.seed,
            createdAtDay: 1,
            lastExitDay: 1,
            expiresAtDay: 8,
            bossClearedDay: null,
            bossDefeated: false,
            unlockedExits: [],
            unlockedEntries: [rs.map.anchor],
            revealedExits: [],
            openedChests: [],
            solvedPuzzles: [],
            clearedRooms: [],
            marketBought: {},
            visitedEver: [rs.map.anchor],
            adventurers: [],
            map: rs.map,
          },
        },
      },
    }, settledRun, { now: 1 });

    expect(res.changes.char.money).toBe(80 + 20 - 30);
    expect(res.changes.flags).toContain("cg_baita_jingfan");
    expect(res.changes.flags).toContain("divine_obtained_budongmingwang");
    expect(res.changes.skills.some((s) => s.id === "kf_lama_zhongming")).toBe(true);
    expect(res.changes.dungeonRun.active).toBeNull();
    expect(res.changes.dungeonRun.worlds.白塔地宫.unlockedEntries).toContain(rs.map.exitRooms[0]);
    expect(res.changes.dungeonRun.worlds.白塔地宫.bossDefeated).toBe(true);
  });
});
