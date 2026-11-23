import { afterEach, describe, expect, it } from "vitest";
import { bindTurnRuntime } from "../features/turnRuntime.js";
import { getTurnContext, PHASE, turnMonitor, withTurnContext } from "../infra/turnMonitor.js";
bindTurnRuntime({ getTurnContext, PHASE, turnMonitor, withTurnContext });
import { applyResult } from "../features/run.js";
import { deposit, withdraw } from "../features/bank/logic.js";
import { meditate, trainNeigong, trainWaigong } from "../features/cultivation/logic.js";
import { gameActions, gameStore, initGameStore } from "../store/gameStore.js";
import { snapshotFromStore } from "../store/persist.js";
import { tryRestoreSnapshot } from "../infra/saves.js";
import { buildInitialGameState, DEFAULT_PRESETS } from "../engine/newGame.js";
import { statsForQuality } from "../domain/rules/economy/equipment.js";

const PRESET = DEFAULT_PRESETS[0];
const ctx = { gameActions };

function freshGame(overrides = {}) {
  initGameStore({
    preset: PRESET,
    room: PRESET.room,
    char: { ...PRESET.char, hp: [50, 100] },
    dao: PRESET.dao,
    skills: [...PRESET.skills],
    inv: [...PRESET.inv],
    log: [], convo: [], flags: [], mapData: {},
    time: 10, exp: 0, pot: 100, varTree: { 世界: {} },
    claimedMilestones: new Set(), questProgress: {},
    deposit: 0, depositedAt: null, pledgedItems: [], persuasionProgress: {},
    innerRoomName: "村口", companionState: null,
    ...overrides,
  });
}

// 把当前 store 快照按"读档"流程走一遍：序列化 → 兼容判定 → 重建初始状态。
function roundtrip() {
  const snap = snapshotFromStore({});
  const restored = tryRestoreSnapshot([PRESET], snap, { statsForQuality });
  expect(restored).toBeTruthy();
  return buildInitialGameState(restored, 1);
}

afterEach(() => initGameStore({}));

describe("Issue #3 状态/存档往返（本地操作 → 快照 → 读档一致）", () => {
  it("钱庄存款：存后 deposit/depositedAt 入账，读档一致", () => {
    freshGame({ char: { ...PRESET.char, hp: [50, 100], money: 200 } });
    applyResult(ctx, deposit(gameStore.getState(), 120));

    const state = gameStore.getState();
    expect(state.char.money).toBe(80);
    expect(state.deposit).toBe(120);
    expect(state.depositedAt).toBe(10);

    const restored = roundtrip();
    expect(restored.deposit).toBe(120);
    expect(restored.depositedAt).toBe(10);
    expect(restored.char.money).toBe(80);
  });

  it("钱庄取款：deposit 清零、本息回到随身银两，读档一致", () => {
    freshGame({ char: { ...PRESET.char, hp: [50, 100], money: 10 }, deposit: 100, depositedAt: 1 });
    applyResult(ctx, withdraw(gameStore.getState()));

    const before = gameStore.getState();
    expect(before.deposit).toBe(0);
    expect(before.char.money).toBeGreaterThan(10); // 本金+利息

    const restored = roundtrip();
    expect(restored.deposit).toBe(0);
    expect(restored.depositedAt).toBe(null);
    expect(restored.char.money).toBe(before.char.money);
  });

  it("打坐：时间推进、气血回复，读档一致", () => {
    freshGame({ char: { ...PRESET.char, hp: [10, 100] }, time: 7 });
    applyResult(ctx, meditate(gameStore.getState()));

    expect(gameStore.getState().time).toBe(8);
    expect(gameStore.getState().char.hp[0]).toBeGreaterThan(10);

    const restored = roundtrip();
    expect(restored.time).toBe(8);
    expect(restored.char.hp).toEqual(gameStore.getState().char.hp);
  });

  it("练功：内功/外功结算扣潜能涨属性，读档一致", () => {
    freshGame({ char: { ...PRESET.char, hp: [50, 100], neigong: 10, waigong: 10 }, pot: 100 });
    applyResult(ctx, trainNeigong(gameStore.getState()));
    applyResult(ctx, trainWaigong(gameStore.getState()));

    const after = gameStore.getState();
    expect(after.char.neigong).toBe(11);
    expect(after.char.waigong).toBe(11);
    expect(after.pot).toBeLessThan(100);
    expect(after.time).toBe(14); // 10 + 2 + 2

    const restored = roundtrip();
    expect(restored.char.neigong).toBe(11);
    expect(restored.char.waigong).toBe(11);
    expect(restored.pot).toBe(after.pot);
    expect(restored.time).toBe(14);
  });

  it("潜能不足时练功失败不落 changes，存档保持原值", () => {
    freshGame({ pot: 0 });
    applyResult(ctx, trainNeigong(gameStore.getState()));
    expect(gameStore.getState().char.neigong).toBe(PRESET.char.neigong);
    expect(roundtrip().pot).toBe(0);
  });

  it("claimedMilestones：函数式 changes 加里程碑，快照序列化为数组、读档还原为 Set", () => {
    freshGame();
    applyResult(ctx, {
      changes: { claimedMilestones: (prev) => new Set(prev).add("少侠:10") },
    });

    const snap = snapshotFromStore({});
    expect(Array.isArray(snap.claimedMilestones)).toBe(true);
    expect(snap.claimedMilestones).toEqual(["少侠:10"]);

    const restored = roundtrip();
    expect(restored.claimedMilestones instanceof Set).toBe(true);
    expect(restored.claimedMilestones.has("少侠:10")).toBe(true);
  });

  it("内层移动：innerRoomName 写入快照，读档回到同一内层房间", () => {
    freshGame({ innerRoomName: "溪边小屋" });
    expect(roundtrip().innerRoomName).toBe("溪边小屋");
  });
});
