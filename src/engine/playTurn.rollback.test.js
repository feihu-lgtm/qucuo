import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PHASE, turnMonitor } from "../infra/turnMonitor.js";
import { gameActions, gameStore, initGameStore, subscribeGameReplaced } from "../store/gameStore.js";
import { getRngState, setSeed } from "../utils/rng.js";
import { commitRound } from "./act/commitRound.js";
import { runTurn } from "./runTurn.js";
import { playTurn } from "./playTurn.js";
import { createMockAi } from "./ports/ai.js";

vi.mock("./act/commitRound.js", () => ({ commitRound: vi.fn() }));
vi.mock("./runTurn.js", () => ({ runTurn: vi.fn() }));

function makeContext(overrides = {}) {
  return {
    apiCfg: {}, bookkeep: false,
    ai: createMockAi(['{"text":"旁白"}']),
    commitDeps: () => ({}),
    getGameState: () => gameStore.getState(),
    gameActions,
    subscribeGameReplaced,
    _trace: turnMonitor.start("测试行动"),
    ...overrides,
  };
}

const BASE = {
  room: { name: "鱼定村", desc: "河谷", exits: [], npcs: [], items: ["石子"] },
  char: { name: "少侠", hp: [50, 100], neigong: 5, waigong: 8, special: { 气运: 5 }, money: 30 },
  inv: [{ id: "i1", name: "干粮" }],
  exp: 7, pot: 9, flags: ["f1"], mapData: { 鱼定村: { x: 0, y: 0 } },
  time: 10, varTree: { 世界: { A: 1 } }, convo: [],
};

beforeEach(() => {
  runTurn.mockReset();
  commitRound.mockReset();
  commitRound.mockReturnValue({});
});

afterEach(() => {
  initGameStore({});
  turnMonitor.clear();
});

describe("Issue #3：AI 回合失败回滚到回合开始快照", () => {
  it("runTurn 抛错时回滚全部回合键与 rng，返回 ok:false", async () => {
    initGameStore(BASE);
    setSeed(1234);
    const rngBefore = getRngState();
    const before = gameStore.getState();
    // 回合中途把状态弄脏（模拟半场写库），随后 runTurn 抛错 → 应整体回到快照
    runTurn.mockImplementation(() => {
      gameActions.setRoom({ name: "锦官城" });
      gameActions.setTime(99);
      gameActions.setVarTreeState({ 世界: { A: 999 } });
      return Promise.reject(new Error("model exploded"));
    });

    const result = await playTurn(makeContext(), "试试手气");

    expect(result.ok).toBe(false);
    const after = gameStore.getState();
    for (const key of ["room", "char", "dao", "skills", "inv", "exp", "pot", "flags", "mapData", "time", "varTree", "convo"]) {
      expect(after[key]).toEqual(before[key]);
    }
    expect(getRngState()).toBe(rngBefore);
    expect(turnMonitor.getSnapshot().current.phase).toBe(PHASE.ERROR);
  });

  it("回合前同 tick 的 varTree 写入算进快照，失败回滚不把它吃掉", () => {
    initGameStore(BASE);
    const freshTree = { 世界: { A: 1, 新写入: "同tick" } };
    gameActions.setVarTreeState(freshTree); // 先写，再同 tick 调 act
    runTurn.mockRejectedValue(new Error("boom"));

    return playTurn(makeContext(), "再试").then((result) => {
      expect(result.ok).toBe(false);
      expect(gameStore.getState().varTree).toEqual(freshTree);
    });
  });

  it("WO-16D-3：prepSeeds 进快照切片但不参与回滚", async () => {
    // 口径：captureSnapshot 复制 prepSeeds 回合前引用（shadowPre 同源），
    // 但它不在 ROLLBACK_KEYS——备料是缓存不是回合事务，回滚不得恢复它。
    initGameStore({ ...BASE, prepSeeds: [{ id: "seed-a", kind: "npc_plan" }] });
    const seedBefore = gameStore.getState().prepSeeds;
    let seedInSnapshotProbe = null;
    runTurn.mockImplementation(() => {
      // 回合中途后台备料入库/失效（world.prep 语义）——模拟恰好此时改写
      gameActions.setPrepSeeds([{ id: "seed-b", kind: "prep_item" }]);
      return Promise.reject(new Error("boom"));
    });

    const result = await playTurn(makeContext(), "试试");
    expect(result.ok).toBe(false);
    // 回滚不恢复 prepSeeds：回合中途的入库不被吃掉（缓存不归回合事务管）
    expect(gameStore.getState().prepSeeds).toEqual([{ id: "seed-b", kind: "prep_item" }]);
    expect(gameStore.getState().prepSeeds).not.toEqual(seedBefore);
    // 其余回合键照常回滚（对照组，证明本测试的回滚路径真的走了一遍）
    expect(gameStore.getState().time).toEqual(BASE.time);
    void seedInSnapshotProbe;
  });

  it("成功回合不回滚：runTurn 结果照常提交", async () => {
    initGameStore(BASE);
    runTurn.mockResolvedValue({ text: "成了", changes: {} });

    const result = await playTurn(makeContext(), "正常一回");

    expect(result.ok).not.toBe(false);
    expect(commitRound).toHaveBeenCalledTimes(1);
  });
});
