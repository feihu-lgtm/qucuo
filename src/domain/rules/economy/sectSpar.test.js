import { describe, expect, it } from "vitest";
import { sectSparRepGain } from "./sectSpar.js";
import { settleNpcDuel } from "../../../features/npc/settleDuel.js";

const songhe = { id: "resident_songhe", name: "松鹤道长", levelCap: 4 };
const state = (extra = {}) => ({
  time: 30, flags: [], varTree: {}, char: { name: "少侠", hp: [100, 100], money: 0, special: {} }, inv: [], room: { name: "剑坪", npcs: [] },
  ...extra,
});
const rep = (value) => ({ 世界: { 势力声誉: { 青城派: value } } });

describe("sectSparRepGain", () => {
  it("first win over a Qingcheng sparring master is +5, then +2 once per day", () => {
    expect(sectSparRepGain(state(), songhe, { outcome: "win" })).toEqual({
      faction: "青城派", delta: 5, flags: ["qingcheng_spar_first", "qingcheng_spar_day_1"],
    });
    const after = state({ flags: ["qingcheng_spar_first", "qingcheng_spar_day_1"], varTree: rep(5) });
    expect(sectSparRepGain(after, songhe, { outcome: "win" })).toBeNull();
    expect(sectSparRepGain({ ...after, time: 50 }, { name: "青玄" }, { outcome: "win" })).toEqual({
      faction: "青城派", delta: 2, flags: ["qingcheng_spar_first", "qingcheng_spar_day_2"],
    });
  });

  it("daily sparring stops at 39 and ignores losses, strangers and poisoned wins", () => {
    const veteran = state({ flags: ["qingcheng_spar_first"], varTree: rep(38) });
    expect(sectSparRepGain(veteran, songhe, { outcome: "win" }).delta).toBe(1);
    expect(sectSparRepGain(state({ flags: ["qingcheng_spar_first"], varTree: rep(39) }), songhe, { outcome: "win" })).toBeNull();
    expect(sectSparRepGain(state(), songhe, { outcome: "lose" })).toBeNull();
    expect(sectSparRepGain(state(), { name: "护谷弟子" }, { outcome: "win" })).toBeNull();
    const poisoned = [{ round: 1, result: { statusAppliedToB: "淬毒" } }];
    expect(sectSparRepGain(state(), songhe, { outcome: "win", battleLog: poisoned })).toEqual({ faction: "青城派", delta: 0, poison: true });
    const teamPoisoned = [{ round: 1, actor: { id: "resident_songhe", name: "松鹤道长" }, target: { id: "leopard", name: "雪豹" }, result: { statusAppliedToA: "剧毒" } }];
    expect(sectSparRepGain(state(), songhe, { outcome: "win", battleLog: teamPoisoned }).poison).toBe(true);
    const poisonOnPlayer = [{ round: 1, actor: { id: "resident_songhe", name: "松鹤道长" }, target: { id: "player", name: "少侠" }, result: { statusAppliedToB: "淬毒" } }];
    expect(sectSparRepGain(state(), songhe, { outcome: "win", battleLog: poisonOnPlayer }).delta).toBe(5);
    const qingxuan = { id: "resident_qingxuan", name: "青玄" };
    const namesake = [{ round: 1, actor: { id: "player", name: "青玄" }, target: { id: "resident_qingxuan", name: "青玄" }, result: { statusAppliedToB: "淬毒" } }];
    expect(sectSparRepGain(state(), qingxuan, { outcome: "win", battleLog: namesake }).poison).toBe(true);
  });

  it("settleNpcDuel writes the faction reputation and the sparring flags", () => {
    const start = state();
    const duel = settleNpcDuel(start, songhe, { outcome: "win", rng: () => 1 });
    const next = { ...start };
    for (const [key, update] of Object.entries(duel.changes)) next[key] = update(start[key]);
    expect(next.varTree.世界.势力声誉.青城派).toBe(5);
    expect(next.flags).toEqual(["qingcheng_spar_first", "qingcheng_spar_day_1"]);
    expect(duel.logs.map((row) => row.text)).toContain("  ✦ 堂堂正正赢了松鹤道长，青城派声誉 +5");
  });

  it("sparring with Tangmen disciples on the 千机演武坪 raises 唐门 reputation", () => {
    const tingzhu = { id: "resident_tangtingzhu", name: "唐听竹" };
    expect(sectSparRepGain(state(), tingzhu, { outcome: "win" })).toEqual({
      faction: "唐门", delta: 5, flags: ["tangmen_spar_first", "tangmen_spar_day_1"],
    });
    expect(sectSparRepGain(state(), { name: "唐仲衡" }, { outcome: "win" }).faction).toBe("唐门");
    expect(sectSparRepGain(state(), { name: "唐伯渊" }, { outcome: "win" })).toBeNull();
  });
});
