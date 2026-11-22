import { describe, expect, it } from "vitest";
import { factionAmbushRule, factionRoomAmbushRule, pickAmbusher, pickRoomAmbusher } from "./ambush.js";

const state = (rep, time = 0, flags = [], room = "大草甸", innerRoomName = "", faction = "唐门") => ({
  room: { name: room, npcs: [] },
  innerRoomName,
  varTree: { 世界: { 势力声誉: rep != null ? { [faction]: rep } : {} } },
  time, flags,
});

describe("faction ambush rule", () => {
  it("never ambushes above the -60 threshold", () => {
    expect(factionAmbushRule.run(state(-59))).toBeNull();
    expect(pickAmbusher(state(-59), () => 0)).toBeNull();
    expect(pickAmbusher(state(-59, 0, [], "雪山派", "", "雪山派"), () => 0)).toBeNull();
  });

  it("forces a duel with the squad member when rep ≤ -60 and the roll hits", () => {
    const hit = pickAmbusher(state(-80), () => 0);
    expect(hit.npc).toMatchObject({ name: "唐门暗弩手", faction: "唐门", levelCap: 3 });
    expect(hit.npc.moveset?.length).toBeGreaterThan(0);
    const result = factionAmbushRule.run(state(-80, 100));
    expect(result.forcedDuelNpc.name).toBe("唐门暗弩手");
    expect(result.logs[0].text).toContain("暗杀组");
  });

  it("ambushes defectors even above the rep line", () => {
    expect(pickAmbusher(state(-40, 0, ["叛出:唐门"]), () => 0)).not.toBeNull();
  });

  it("passes on a missed roll", () => {
    expect(pickAmbusher(state(-80), () => 0.99)).toBeNull();
  });

  it("欢喜教 ≤ -60：踏进天都香行前厅必遭截杀，别处与大地图移动不触发", () => {
    const hx = (rep, inner, district = "天都镇") => ({
      room: { name: district, npcs: [] }, innerRoomName: inner,
      varTree: { 世界: { 势力声誉: { 欢喜教: rep } } }, time: 0, flags: [],
    });
    const result = factionRoomAmbushRule.run(hx(-60, "天都香行"));
    expect(result.forcedDuelNpc).toMatchObject({ name: "欢喜教内院弟子", faction: "欢喜教" });
    expect(result.forcedDuelNpc.moveset?.length).toBeGreaterThan(0);
    expect(result.logs[0].text).toContain("老何");
    expect(factionRoomAmbushRule.run(hx(-59, "天都香行"))).toBeNull();
    expect(factionRoomAmbushRule.run(hx(-80, "品香雅座"))).toBeNull();
    expect(pickRoomAmbusher(hx(-80, "天都香行", "锦官城"), () => 0)).toBeNull();
    expect(pickAmbusher(hx(-80, "天都香行"), () => 0)).toBeNull();
  });

  it("按房间登记的伏击不在大地图移动时掷骰，唐门伏击也不随内层房间重掷", () => {
    const both = { room: { name: "天都镇", npcs: [] }, innerRoomName: "天都香行", time: 0, flags: [],
      varTree: { 世界: { 势力声誉: { 唐门: -80, 欢喜教: 0 } } } };
    expect(pickAmbusher(both, () => 0).npc.name).toBe("唐门暗弩手");
    expect(pickRoomAmbusher(both, () => 0)).toBeNull();
  });

  it("读档/换局后的首跑不算移动，不重掷伏击", () => {
    const hx = { room: { name: "天都镇", npcs: [] }, innerRoomName: "天都香行", time: 0, flags: [],
      varTree: { 世界: { 势力声誉: { 唐门: -80, 欢喜教: -80 } } } };
    expect(factionAmbushRule.run(state(-80, 100), { firstRun: true })).toBeNull();
    expect(factionRoomAmbushRule.run(hx, { firstRun: true })).toBeNull();
    expect(factionRoomAmbushRule.run(hx, { firstRun: false }).forcedDuelNpc.name).toBe("欢喜教内院弟子");
  });

  it("always ambushes at a forted stronghold (places = 1)", () => {
    const hit = pickAmbusher(state(-80, 0, [], "雪山派", "", "雪山派"), () => 0.99);
    expect(hit.npc.name).toBe("雪山派截杀弟子");
  });

  it("does not ambush a place-locked faction elsewhere on the map", () => {
    expect(pickAmbusher(state(-80, 0, [], "大草甸", "", "雪山派"), () => 0)).toBeNull();
  });

  it("patrols the listed outer districts at the written chance", () => {
    const hit = pickAmbusher(state(-80, 0, [], "大草甸", "", "鱼定土司府"), () => 0);
    expect(hit.npc.name).toBe("巡捕营校尉");
    expect(pickAmbusher(state(-80, 0, [], "鱼定村", "", "鱼定土司府"), () => 0.99)).toBeNull();
  });

  it("guards an inner room by the 据点·内层房 key only", () => {
    expect(pickRoomAmbusher(state(-80, 0, [], "雅江", "", "青城派"), () => 0)).toBeNull();
    const hit = pickRoomAmbusher(state(-80, 0, [], "雅江", "青城山山门", "青城派"), () => 0.99);
    expect(hit.npc.name).toBe("青城剑阵弟子");
    expect(pickAmbusher(state(-80, 0, [], "雅江", "青城山山门", "青城派"), () => 0)).toBeNull();
  });

  it("lets a stronghold place override the roaming miss", () => {
    const hit = pickAmbusher(state(-80, 0, [], "蜀南唐堡"), () => 0.99);
    expect(hit.npc.name).toBe("唐门暗弩手");
  });
});
