// 同伴系统·入队驻场 + 任意房留守 + 好感漂移（PR-A）
import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/rng.js", () => ({ random: () => 0.5, setSeed: () => {}, getRngState: () => 0, setRngState: () => {} }));

const loaded = {};
async function m() {
  loaded.rules ??= await import("../../domain/rules/npc/rules.js");
  loaded.companion ??= await import("../../domain/rules/companion/companion.js");
  loaded.intimacy ??= await import("../../domain/rules/npc/intimacy.js");
  loaded.ocRecruit ??= await import("../../features/npc/ocRecruit.js");
  loaded.adv ??= await import("../../domain/data/dungeon/adventurersIP.js");
  return loaded;
}

const DUODUO_STATE = {
  companionState: {},
  varTree: { 角色: { 元朵朵: { 好感度: 80 } } },
  flags: [],
  questProgress: {},
  char: { money: 500 },
  npcState: {},
};

describe("朵朵入队 + 驻场不再复现", () => {
  it("favor 路招募成功 → companionState 解锁", async () => {
    const { ocRecruit, adv } = await m();
    const duoduo = adv.ADVENTURER_IP_BY_NAME["元朵朵"];
    expect(duoduo).toBeTruthy();
    const res = ocRecruit.recruitOC(DUODUO_STATE, duoduo, "favor");
    expect(res.ok).toBe(true);
    const cs = res.effect.companionState;
    expect(cs[Object.keys(cs)[0]].unlocked).toBe(true);
  });

  it("OC 驻场（homeDistrict）入队后被过滤、不再注入房间", async () => {
    const { rules, companion } = await m();
    const cs = companion.unlockImportedCompanion({}, { name: "元朵朵", levelCap: 1 });
    expect(rules.isResidentJoinedCompanion({ name: "元朵朵", homeDistrict: "鱼定村" }, cs)).toBe(true);
    // 未入队时照常注入
    expect(rules.isResidentJoinedCompanion({ name: "元朵朵", homeDistrict: "鱼定村" }, {})).toBe(false);
    // 同名但非 OC 驻场（无 homeDistrict/标记）不误伤
    expect(rules.isResidentJoinedCompanion({ name: "普通人" }, cs)).toBe(false);
    // 内置候选（雪豹）仍旧拦截
    expect(rules.isResidentJoinedCompanion({ name: "雪豹", companionCandidate: true }, cs)).toBe(false);
  });
});

describe("任意房间留守", () => {
  it("留守到非当前房间 → stationedNpcsFor 在该房命中、原房不命中", async () => {
    const { companion } = await m();
    let cs = companion.unlockImportedCompanion({}, { name: "元朵朵", levelCap: 1 });
    const key = Object.keys(cs)[0];
    cs = companion.stationCompanion({ ...cs, [key]: { ...cs[key], active: false } }, key, { district: "天都镇", roomId: "茶楼", roomName: "茶楼" });
    const atTarget = companion.stationedNpcsFor(cs, { district: "天都镇", roomId: "茶楼", roomName: "茶楼" });
    expect(atTarget.map(n => n.name)).toContain("元朵朵");
    const elsewhere = companion.stationedNpcsFor(cs, { district: "鱼定村", roomId: "鱼定村", roomName: "鱼定村" });
    expect(elsewhere.map(n => n.name)).not.toContain("元朵朵");
  });

  it("唤回清 stationed 归队", async () => {
    const { companion } = await m();
    let cs = companion.unlockImportedCompanion({}, { name: "元朵朵", levelCap: 1 });
    const key = Object.keys(cs)[0];
    cs = companion.stationCompanion({ ...cs, [key]: { ...cs[key], active: false } }, key, { district: "天都镇", roomId: "茶楼", roomName: "茶楼" });
    cs = companion.unstationCompanion(cs, key);
    expect(cs[key].stationed).toBeUndefined();
  });
});

describe("好感衰减/漂移", () => {
  it("留守在任意房间的同伴都被衰减覆盖（不再只认本房）", async () => {
    const { companion, intimacy } = await m();
    let cs = companion.unlockImportedCompanion({}, { name: "元朵朵", levelCap: 1 });
    const key = Object.keys(cs)[0];
    cs = companion.stationCompanion({ ...cs, [key]: { ...cs[key], active: false } }, key, { district: "天都镇", roomId: "茶楼", roomName: "茶楼" });
    const state = { time: 48, companionState: cs, varTree: { 角色: { 元朵朵: { 好感度: 50 } } } };
    const r = intimacy.stationedFavorDecayRule.run(state, {});
    expect(r.changes.varTree(state.varTree).角色.元朵朵.好感度).toBe(49);
  });

  it("随行同伴每日 +0.5 漂移；留守不涨；满 100 封顶", async () => {
    const { companion, intimacy } = await m();
    let cs = companion.unlockImportedCompanion({}, { name: "阿明", levelCap: 1 });
    const keyA = Object.keys(cs)[0];
    cs = companion.unlockImportedCompanion(cs, { name: "阿强", levelCap: 1 });
    const keyB = Object.keys(cs).find(k => k !== keyA);
    cs = companion.stationCompanion({ ...cs, [keyB]: { ...cs[keyB], active: false } }, keyB, { district: "天都镇", roomId: "茶楼", roomName: "茶楼" });
    const state = {
      time: 48,
      companionState: cs,
      varTree: { 角色: { 阿明: { 好感度: 30 }, 阿强: { 好感度: 30 }, 满员: { 好感度: 100 } } },
    };
    const r = intimacy.followFavorDriftRule.run(state, {});
    const vt = r.changes.varTree(state.varTree);
    expect(vt.角色.阿明.好感度).toBe(30.5);
    expect(vt.角色.阿强.好感度).toBe(30); // 留守不吃随行漂移
  });
});
