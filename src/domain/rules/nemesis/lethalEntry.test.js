// WO-23C2d 生死战显式入口契约测试
import { describe, expect, it } from "vitest";
import { isActiveNemesisNpc, nemesisFactionOf } from "./nemesisEngine.js";
import { settleNpcDuel } from "../../../features/npc/settleDuel.js";

const ROSTER = {
  雪山派: { entries: { nm1: { id: "nm1", name: "扎西", faction: "雪山派", status: "active", tier: 2, scars: [], grudge: 2, origin: { turn: 1, place: "雪山", summary: "s" } } } },
  黑风寨: { entries: { nm2: { id: "nm2", name: "麻三", faction: "黑风寨", status: "fakeDead", tier: 1, scars: [], grudge: 1, origin: { turn: 1, place: "x", summary: "s" } } } },
};

describe("isActiveNemesisNpc 入口可见性", () => {
  const vt = { 世界: { 宿敌谱: ROSTER } };
  it("active 宿敌精确命中才有入口；fakeDead/recruited/普通 NPC 都没有", () => {
    expect(isActiveNemesisNpc(vt, { name: "扎西", faction: "雪山派" })).toBe(true);
    expect(isActiveNemesisNpc(vt, { name: "麻三", faction: "黑风寨" })).toBe(false); // fakeDead
    expect(isActiveNemesisNpc(vt, { name: "扎西", faction: "黑风寨" })).toBe(false); // 跨势力同名不串
    expect(isActiveNemesisNpc(vt, { name: "扎西" })).toBe(false); // faction 对不上（npcFactions 无映射时）
    expect(isActiveNemesisNpc(vt, { name: "路人", faction: "黑风寨" })).toBe(false); // 非宿敌
    expect(isActiveNemesisNpc({ 世界: {} }, { name: "扎西", faction: "雪山派" })).toBe(false); // 旧档
    expect(isActiveNemesisNpc(null, null)).toBe(false);
  });
});

describe("lethal 传递不串场", () => {
  function st() {
    return {
      time: 20, inv: [], room: { name: "黑风寨", npcs: [] },
      char: { hp: [30, 40], money: 10, special: {}, name: "阿部" }, skills: [], flags: [],
      questProgress: {}, varTree: { 角色: {}, 世界: { 宿敌谱: ROSTER } }, pot: 0,
    };
  }
  const foe = { name: "扎西", faction: "雪山派", levelCap: 1, lethal: true };

  it("生死战 win lethal 进生死簿+谱置位；lethal 标志只在带标记 npc 上生效", () => {
    const s = st();
    const out = settleNpcDuel(s, foe, { outcome: "win", battleLog: [], lethal: !!foe.lethal });
    const vtOut = out.changes.varTree({ 角色: {}, 世界: s.varTree.世界 });
    expect(vtOut.世界.生死.扎西).toBeTruthy();
    expect(["fakeDead", "dead"]).toContain(vtOut.世界.宿敌谱.雪山派.entries.nm1.status);
    // 文案无 spared/假死泄漏
    expect(out.logs.some((l) => l.text.includes("假死"))).toBe(false);
    // 同 npc 不带 lethal 标志的普通切磋：零生死账
    const plain = { name: "扎西", faction: "雪山派", levelCap: 1 };
    const out2 = settleNpcDuel(st(), plain, { outcome: "win", battleLog: [], lethal: !!plain.lethal });
    const vt2 = out2.changes.varTree({ 角色: {}, 世界: st().varTree.世界 });
    expect(vt2.世界.生死?.扎西).toBeUndefined();
    expect(vt2.世界.宿敌谱.雪山派.entries.nm1.status).toBe("active");
  });
});

describe("WO-23C7 生死战后果收口", () => {
  it("任务关键 active 宿敌入口禁用有原因；非关键不受影响", async () => {
    const { nemesisLethalBlockReason, questCriticalNpcNames } = await import("./nemesisEngine.js");
    const vt = { 世界: { 宿敌谱: ROSTER } };
    // 白玛次仁是 yudingtusi-1a giver——谱中造一个 active entry
    const vt2 = { 世界: { 宿敌谱: { 鱼定土司府: { entries: { nm9: { id: "nm9", name: "白玛次仁", faction: "鱼定土司府", status: "active", tier: 1, scars: [], grudge: 1, origin: { turn: 1, place: "x", summary: "s" } } } } } } };
    const blocker = nemesisLethalBlockReason({ varTree: vt2, questProgress: {} }, { name: "白玛次仁", faction: "鱼定土司府" });
    expect(blocker).toContain("未了之事");
    // 已完成任务后解禁
    const done = nemesisLethalBlockReason({ varTree: vt2, questProgress: { "yudingtusi_1_xunshan_cuiliang": { status: "completed" } } }, { name: "白玛次仁", faction: "鱼定土司府" });
    expect(done).toBeNull();
    // 非关键宿敌不受任务账本影响
    expect(nemesisLethalBlockReason({ varTree: vt, questProgress: {} }, { name: "扎西", faction: "雪山派" })).toBeNull();
    // 名册本身：未完成/无记录皆护
    expect(questCriticalNpcNames({}).has("白玛次仁")).toBe(true);
  });

  it("随机路人无生死入口（跨日无身份持久化）", async () => {
    const { nemesisLethalBlockReason } = await import("./nemesisEngine.js");
    const vt = { 世界: { 宿敌谱: ROSTER } };
    const blocker = nemesisLethalBlockReason({ varTree: vt, questProgress: {} }, { name: "扎西", faction: "雪山派", randomPasser: 3 });
    expect(blocker).toContain("萍水相逢");
  });

  it("投放链统一过滤：fakeDead/dead 宿敌不进竞价/游走/过路/冒险者", async () => {
    const { recruitedNemesisNames } = await import("../npc/rules.js");
    // 过滤口径即 notRecruited——recruitedNemesisNames 含 fakeDead/dead/recruited，
    // 本测试钉住该集合语义（投放链各处 .filter(notRecruited) 共用）
    const names = recruitedNemesisNames({ 世界: { 宿敌谱: { 雪山派: { entries: { a: { name: "扎西", status: "fakeDead" }, b: { name: "死者", status: "dead" }, c: { name: "收服者", status: "recruited" }, d: { name: "活着", status: "active" } } } } } });
    expect(names.has("扎西")).toBe(true);
    expect(names.has("死者")).toBe(true);
    expect(names.has("收服者")).toBe(true);
    expect(names.has("活着")).toBe(false);
  });
});
