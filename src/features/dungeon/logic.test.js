import { describe, expect, it } from "vitest";
import { LOG_TYPES } from "../../domain/rules/log/logTypes.js";
import { settleDungeonRun } from "./logic.js";

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
