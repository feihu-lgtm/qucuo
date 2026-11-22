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

  it("成功回合不回滚：runTurn 结果照常提交", async () => {
    initGameStore(BASE);
    runTurn.mockResolvedValue({ text: "成了", changes: {} });

    const result = await playTurn(makeContext(), "正常一回");

    expect(result.ok).not.toBe(false);
    expect(commitRound).toHaveBeenCalledTimes(1);
  });
});
