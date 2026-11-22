import { describe, it, expect } from "vitest";
import { buildInitialGameState, DEFAULT_PRESETS } from "./newGame.js";
import { buildSnapshot, tryRestoreSnapshot } from "../infra/saves.js";
import { getDistrictAnchor } from "../domain/rules/map/innerMap.js";
import { statsForQuality } from "../domain/rules/economy/equipment.js";

const PRESET = DEFAULT_PRESETS[0];

// 一个"长得像正式存档"的最小快照：preset/char/room 直接沿用预设（三者都被
// tryRestoreSnapshot 的兼容判定认可），其余字段按需覆盖。
function makeSnap(overrides = {}) {
  return buildSnapshot({
    preset: PRESET, room: PRESET.room, char: PRESET.char, dao: PRESET.dao,
    skills: PRESET.skills, inv: [...PRESET.inv], log: [{ t: "sys", text: "x" }],
    convo: [], exp: 0, pot: 0, flags: [], mapData: {}, time: 6,
    narrator: null, varTree: { 世界: {} }, claimedMilestones: new Set(),
    questProgress: {}, deposit: 0, depositedAt: null, pledgedItems: [],
    persuasionProgress: {}, innerRoomName: null, companionState: null,
    squares: null, roomMap: null, rngState: 42,
    ...overrides,
  });
}

function restore(snap) {
  const restored = tryRestoreSnapshot([PRESET], snap, { statsForQuality });
  if (!restored) return null;
  return buildInitialGameState(restored, 1);
}

describe("存档恢复（Issue #3：内层房间/钱庄/里程碑/旧档兼容）", () => {
  it("内层房间：存档里有效的 innerRoomName 原样恢复", () => {
    const state = restore(makeSnap({ innerRoomName: "溪边小屋" }));
    expect(state.innerRoomName).toBe("溪边小屋");
  });

  it("内层房间：老存档没有该字段或房间已不存在时退回锚点", () => {
    for (const innerRoomName of [undefined, "已拆掉的房间"]) {
      const snap = makeSnap({ innerRoomName });
      if (innerRoomName === undefined) delete snap.innerRoomName; // 模拟老档缺字段
      expect(restore(snap).innerRoomName).toBe(getDistrictAnchor("鱼定村"));
    }
  });

  it("内层房间：读到的据点没有内景时置 null", () => {
    const room = { ...PRESET.room, name: "无名小集", desc: "没有内景的据点" };
    expect(restore(makeSnap({ room, innerRoomName: "溪边小屋" })).innerRoomName).toBe(null);
  });

  it("钱庄：deposit / depositedAt / pledgedItems 存读一致", () => {
    const pledged = [{ item: { id: "sword1", name: "青锋剑" }, pledgeValue: 30 }];
    const state = restore(makeSnap({ deposit: 120, depositedAt: 48, pledgedItems: pledged }));
    expect(state.deposit).toBe(120);
    expect(state.depositedAt).toBe(48);
    expect(state.pledgedItems).toEqual(pledged);
  });

  it("练功结算：exp / pot / 内功 / 气血 存读一致", () => {
    const char = { ...PRESET.char, hp: [77, 116], neigong: 9, waigong: 12 };
    const state = restore(makeSnap({ char, exp: 33, pot: 56 }));
    expect(state.exp).toBe(33);
    expect(state.pot).toBe(56);
    expect(state.char.neigong).toBe(9);
    expect(state.char.hp).toEqual([77, 116]);
  });

  it("claimedMilestones 读档后仍是 Set 且条目齐全", () => {
    const state = restore(makeSnap({ claimedMilestones: new Set(["少侠:10", "少侠:20"]) }));
    expect(state.claimedMilestones instanceof Set).toBe(true);
    expect([...state.claimedMilestones].sort()).toEqual(["少侠:10", "少侠:20"]);
  });

  it("varTree 原样恢复，不重复灌知识基底", () => {
    const varTree = { 世界: { 八云: { 好感度: 20 } }, 知识: {} };
    expect(restore(makeSnap({ varTree })).varTree).toEqual(varTree);
  });

  it("旧存档：缺新字段的档按默认值兜底，不崩不漏", () => {
    const snap = makeSnap();
    for (const key of ["claimedMilestones", "companionState", "squares", "roomMap", "innerRoomName", "depositedAt"]) {
      delete snap[key];
    }
    const state = restore(snap);
    expect(state.claimedMilestones instanceof Set).toBe(true);
    expect(state.claimedMilestones.size).toBe(0);
    expect(state.depositedAt).toBe(null);
    expect(state.companionState).toBeTruthy();
  });

  it("旧存档：char 结构不兼容时整档拒收（不硬塞新代码）", () => {
    const bad = makeSnap({ char: { name: "老档主角" } }); // 缺 hp/neigong/waigong/special
    expect(tryRestoreSnapshot([PRESET], bad, { statsForQuality })).toBe(null);
  });

  it("旧存档：atkMul 倍率武器迁移补算 atk", () => {
    const inv = [{ id: "w1", name: "无主的青锋剑", category: "weapon", quality: "凡品", atkMul: 2 }];
    const restored = tryRestoreSnapshot([PRESET], makeSnap({ inv }), { statsForQuality });
    expect(restored.snap.inv[0].atk).toBe(Math.round(statsForQuality("weapon", "凡品").atk * 2));
  });
});
