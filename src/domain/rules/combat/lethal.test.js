// WO-23C2a 生死战 lethal 边界契约测试
import { describe, expect, it } from "vitest";
import { lethalVerdict, recordLethalOutcome } from "./lethal.js";
import { settleNpcDuel } from "../../../features/npc/settleDuel.js";

function duelState() {
  return {
    time: 20, inv: [], room: { name: "黑风寨", npcs: [] },
    char: { hp: [30, 40], money: 10, special: {}, name: "阿部" }, skills: [], flags: [],
    questProgress: {}, varTree: { 角色: {}, 世界: {} }, pot: 0,
  };
}
const foe = { name: "扎西", faction: "雪山派", levelCap: 1 };

describe("lethalVerdict 判定位置", () => {
  it("lethal win → dying；spare → spared；宿敌 active 才假死候选", () => {
    expect(lethalVerdict({ outcome: "win", lethal: true })).toEqual({ status: "dying", fakeDeadCandidate: false });
    expect(lethalVerdict({ outcome: "win", lethal: true, nemesisActive: true })).toEqual({ status: "dying", fakeDeadCandidate: true });
    expect(lethalVerdict({ outcome: "win", lethal: true, spare: true })).toEqual({ status: "spared", fakeDeadCandidate: false });
    // 切磋链零影响：非 lethal/非 win 一律 null
    expect(lethalVerdict({ outcome: "win", lethal: false })).toBeNull();
    expect(lethalVerdict({ outcome: "lose", lethal: true })).toBeNull();
    expect(lethalVerdict({ outcome: null, lethal: true })).toBeNull();
  });
});

describe("settleNpcDuel lethal 接线", () => {
  it("普通切磋 win 绝不产生生死账（回归闸）", () => {
    const out = settleNpcDuel(duelState(), foe, { outcome: "win", battleLog: [] });
    const vt = typeof out.changes.varTree === "function" ? out.changes.varTree({ 角色: {}, 世界: {} }) : {};
    expect(vt?.世界?.生死).toBeUndefined();
    expect(out.logs.some((l) => l.text.includes("血泊"))).toBe(false);
  });

  it("lethal win 显式调用签 dying 生死簿", () => {
    const out = settleNpcDuel(duelState(), foe, { outcome: "win", battleLog: [], lethal: true });
    const vt = out.changes.varTree({ 角色: {}, 世界: {} });
    expect(vt.世界.生死.扎西).toMatchObject({ status: "dying", turn: 20, place: "黑风寨", fakeDeadCandidate: false });
    expect(out.logs.some((l) => l.text.includes("血泊"))).toBe(true);
  });

  it("lethal+spare 签 spared 不死；宿敌 active dying 带假死候选", () => {
    const out1 = settleNpcDuel(duelState(), foe, { outcome: "win", battleLog: [], lethal: true, spare: true });
    const vt1 = out1.changes.varTree({ 角色: {}, 世界: {} });
    expect(vt1.世界.生死.扎西.status).toBe("spared");
    // 宿敌谱 active entry 在先 → 候选
    const st = duelState();
    st.varTree.世界.宿敌谱 = { 雪山派: { entries: { nm1: { id: "nm1", name: "扎西", faction: "雪山派", status: "active" } } } };
    const out2 = settleNpcDuel(st, foe, { outcome: "win", battleLog: [], lethal: true });
    const vt2 = out2.changes.varTree({ 角色: {}, 世界: st.varTree.世界 });
    expect(vt2.世界.生死.扎西.fakeDeadCandidate).toBe(true);
  });

  it("同 turn 幂等不覆盖；旧档无生死簿不炸；输入不原地改", () => {
    const book = { 扎西: { status: "dying", turn: 20, place: "x", fakeDeadCandidate: false } };
    expect(recordLethalOutcome(book, foe, { status: "spared" }, { turn: 20 })).toBeNull();
    const next = recordLethalOutcome({}, foe, { status: "dying" }, { turn: 21, place: "雪山" });
    expect(next.扎西.status).toBe("dying");
    expect(next).not.toBe(book);
    const st = duelState();
    delete st.varTree.世界;
    expect(() => settleNpcDuel(st, foe, { outcome: "win", battleLog: [], lethal: true })).not.toThrow();
  });
});
