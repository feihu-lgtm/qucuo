import { describe, expect, it } from "vitest";
import { getAllBattleCandidates, buildBattleFighter } from "./battlePool.js";
import { initCombatState } from "../../rules/quickBattle/battleEngine.js";
import { ADVENTURER_POOL_IP } from "../dungeon/adventurersIP.js";

describe("斗蛐蛐阵容池扩编", () => {
  it("OC 冒险者全量入池并单列一组（pool:oc）", () => {
    const all = getAllBattleCandidates();
    const oc = all.filter((c) => c.pool === "oc");
    // IP 池 54+1 位，全量入选（同名撞基础池的去重后仍留 OC 版）
    expect(oc.length).toBe(ADVENTURER_POOL_IP.length);
    for (const adv of ADVENTURER_POOL_IP) {
      const hit = all.find((c) => c.name === adv.name);
      expect(hit, `${adv.name} 应入选`).toBeTruthy();
      expect(hit.pool).toBe("oc");
    }
  });

  it("按名字去重：同名撞车留 OC 版（kungfu 更全）", () => {
    const all = getAllBattleCandidates();
    const names = all.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    const ydy = all.find((c) => c.name === "元朵朵");
    if (ydy) expect(ydy.pool).toBe("oc");
  });

  it("OC 专属招式进 moveset：云无月出「魇梦深渊」", () => {
    const all = getAllBattleCandidates();
    const ywy = all.find((c) => c.name === "云无月");
    const fighter = initCombatState(buildBattleFighter(ywy));
    const names = fighter.moveset.map((m) => m.name);
    expect(names).toContain("魇梦深渊");
    const sig = fighter.moveset.find((m) => m.name === "魇梦深渊");
    expect(sig.signature).toBe(true);
  });

  it("基础池候选人不受影响：无 pool:oc 标记", () => {
    const all = getAllBattleCandidates();
    const base = all.filter((c) => c.pool !== "oc");
    expect(base.length).toBeGreaterThan(100);
  });
});
