import { describe, it, expect } from "vitest";
import { summonFollower, followerEffectInCombat, followerLeaveChance, dismissFollower, findAdventurer } from "./followers.js";
import { ADVENTURER_POOL } from "../../data/dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";
import { seededRand } from "../../../utils/seededRandom.js";

const FULL = [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP];
const rng = (s) => seededRand(0, `f|${s}`);
const byType = (t) => FULL.find((a) => a.follower?.type === t);

describe("summonFollower", () => {
  it("兽 → beast 战斗单位（hp/atk/def 按主人 0.6 档）", () => {
    const owner = byType("兽");
    const r = summonFollower(owner.id, rng("a"));
    expect(r.follower.role).toBe("beast");
    expect(r.follower.combatStat.hp).toBeGreaterThan(0);
    expect(r.follower.combatStat.atk).toBeGreaterThan(0);
    expect(r.log).toContain(owner.name);
  });

  it("人 → human 可参战/观战", () => {
    const r = summonFollower(byType("人").id, rng("a"));
    expect(r.follower.role).toBe("human");
    expect(r.follower.canSpectate).toBe(true);
    expect(r.follower.combatStat).toBeDefined();
  });

  it("机关人偶 → golem 一次性 aura", () => {
    const r = summonFollower(byType("机关人偶").id, rng("a"));
    expect(r.follower.role).toBe("golem");
    expect(r.follower.aura.uses).toBe(1);
    expect(r.follower.combatStat).toBeUndefined();
  });

  it("剑灵 → spirit 一次性 aura", () => {
    const r = summonFollower(byType("剑灵").id, rng("a"));
    expect(r.follower.role).toBe("spirit");
    expect(r.follower.aura.duration).toBe(1);
  });

  it("无 follower 的主人返回 null", () => {
    expect(summonFollower("nonexistent", rng("a"))).toBeNull();
  });

  it("同 seed 输出一致", () => {
    const id = byType("兽").id;
    expect(summonFollower(id, rng("z"))).toEqual(summonFollower(id, rng("z")));
  });
});

describe("followerEffectInCombat / 离队", () => {
  it("beast/human 给 atk/def 助益", () => {
    const f = summonFollower(byType("兽").id, rng("a")).follower;
    const r = followerEffectInCombat(f, { name: "主人" });
    expect(r.assistDelta.atk).toBeGreaterThan(0);
    expect(r.log).toContain(f.name);
  });

  it("golem/spirit 有 use 时挂 buff，耗尽无效果", () => {
    const f = summonFollower(byType("机关人偶").id, rng("a")).follower;
    expect(followerEffectInCombat(f).assistDelta.def).toBeGreaterThan(0);
    f.aura.uses = 0;
    expect(followerEffectInCombat(f).assistDelta.def).toBe(0);
  });

  it("leaveChance：主人死必走，低好感概率升", () => {
    const f = summonFollower(byType("兽").id, rng("a")).follower;
    expect(followerLeaveChance(f, { ownerAlive: false })).toBe(1);
    expect(followerLeaveChance(f, { affinity: 10 })).toBe(0.5);
    expect(followerLeaveChance(f, { affinity: 60 })).toBe(0);
  });

  it("dismissFollower 返回离队 log", () => {
    const f = summonFollower(byType("人").id, rng("a")).follower;
    const r = dismissFollower(f);
    expect(r.dismissed).toBe(true);
    expect(r.log).toContain(f.name);
  });
});
