// WO-23D1 器物觉醒账本契约测试
import { describe, expect, it } from "vitest";
import { recordWeaponVictory, awakenableWeapons } from "./itemAwaken.js";
import { settleNpcDuel } from "../../../features/npc/settleDuel.js";

const blade = { id: "wpn_001", name: "青钢剑", category: "weapon", equipped: true };

describe("itemAwaken 战绩账本", () => {
  it("五胜 ready", () => {
    let ledger = {};
    for (const t of [1, 2, 3, 4, 5]) {
      ledger = recordWeaponVictory(ledger, blade, { turn: t, battleKey: `${t}:n1` }) || ledger;
    }
    expect(ledger.wpn_001.wins).toBe(5);
    expect(ledger.wpn_001.awakenReady).toBe(true);
  });

  it("斩宿敌立即 ready", () => {
    const out = recordWeaponVictory({}, blade, { turn: 1, battleKey: "1:n1", nemesisKill: true });
    expect(out.wpn_001).toMatchObject({ nemesisKills: 1, awakenReady: true, wins: 1 });
  });

  it("同场 battleKey 幂等不重刷", () => {
    const r1 = recordWeaponVictory({}, blade, { turn: 1, battleKey: "1:n1" });
    const r2 = recordWeaponVictory(r1, blade, { turn: 1, battleKey: "1:n1" });
    expect(r2).toBeNull();
    expect(r1.wpn_001.wins).toBe(1);
  });

  it("同名多把严格按 id 分账", () => {
    const blade2 = { ...blade, id: "wpn_002" };
    let ledger = recordWeaponVictory({}, blade, { turn: 1, battleKey: "1:n1" });
    ledger = recordWeaponVictory(ledger, blade2, { turn: 1, battleKey: "1:n2" });
    expect(ledger.wpn_001.wins).toBe(1);
    expect(ledger.wpn_002.wins).toBe(1);
  });

  it("无 id/非武器/未装备不记", () => {
    expect(recordWeaponVictory({}, { name: "无柄剑", category: "weapon", equipped: true }, { turn: 1, battleKey: "k" })).toBeNull();
    expect(recordWeaponVictory({}, { id: "x1", name: "护符", category: "accessory", equipped: true }, { turn: 1, battleKey: "k" })).toBeNull();
    expect(recordWeaponVictory({}, { id: "x2", name: "青钢剑", category: "weapon", equipped: false }, { turn: 1, battleKey: "k" })).toBeNull();
  });

  it("红档封顶仍记 wins 不再 ready；已觉醒同理", () => {
    const red = { ...blade, quality: "红" };
    let ledger = {};
    for (const t of [1, 2, 3, 4, 5]) {
      ledger = recordWeaponVictory(ledger, red, { turn: t, battleKey: `${t}:n` }) || ledger;
    }
    expect(ledger.wpn_001.wins).toBe(5);
    expect(ledger.wpn_001.awakenReady).toBe(false);
  });

  it("输入不原地改", () => {
    const before = {};
    recordWeaponVictory(before, blade, { turn: 1, battleKey: "k" });
    expect(before.wpn_001).toBeUndefined();
  });

  it("awakenableWeapons 只出背包内 ready 未醒非红武器", () => {
    const ledger = {
      wpn_001: { awakenReady: true, awakened: false },
      wpn_gone: { awakenReady: true, awakened: false }, // 账本残留但不在背包
    };
    const state = { inv: [blade], varTree: { 世界: { 器物谱: ledger } } };
    const out = awakenableWeapons(state);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("wpn_001");
    expect(awakenableWeapons({ inv: [], varTree: {} })).toHaveLength(0);
  });
});

describe("settleNpcDuel 器物账本接线", () => {
  function duelState(inv) {
    return {
      time: 20, inv, room: { name: "黑风寨", npcs: [] },
      char: { hp: [30, 40], money: 10, special: {} }, skills: [], flags: [],
      questProgress: {}, varTree: { 角色: {}, 世界: {} }, pot: 0,
    };
  }
  const foe = { name: "扎西", faction: "雪山派", levelCap: 1 };

  it("win 记装备武器胜场；同场重放幂等", () => {
    const st = duelState([blade]);
    const out = settleNpcDuel(st, foe, { outcome: "win", battleLog: [] });
    const vt = out.changes.varTree({ 角色: {}, 世界: {} });
    expect(vt.世界.器物谱.wpn_001.wins).toBe(1);
    // 旧档无器物谱不炸
    expect(vt.世界.器物谱.wpn_001.awakenReady).toBe(false);
  });

  it("击败宿敌谱 active entry 计 nemesisKills 立即 ready", () => {
    const st = duelState([blade]);
    st.varTree.世界.宿敌谱 = { 雪山派: { entries: { nm1: { id: "nm1", name: "扎西", faction: "雪山派", status: "active", tier: 2 } } } };
    const out = settleNpcDuel(st, foe, { outcome: "win", battleLog: [] });
    const vt = out.changes.varTree({ 角色: {}, 世界: st.varTree.世界 });
    expect(vt.世界.器物谱.wpn_001.nemesisKills).toBe(1);
    expect(vt.世界.器物谱.wpn_001.awakenReady).toBe(true);
  });

  it("lose/无 outcome 不记战绩", () => {
    const out = settleNpcDuel(duelState([blade]), foe, { outcome: "lose", battleLog: [] });
    const vt = typeof out.changes.varTree === "function" ? out.changes.varTree({ 角色: {}, 世界: {} }) : {};
    expect(vt?.世界?.器物谱).toBeUndefined();
  });
});
