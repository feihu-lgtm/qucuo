import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaveScheduler } from "./autosaveScheduler.js";
import { gameActions, gameStore, initGameStore } from "../store/gameStore.js";

// Issue #3「只做本地操作不写自动存档」的现状契约：订阅真实 gameStore 后，
// 打坐/卸装备/内层移动这类不走 AI 的本地操作同样会触发防抖存档——
// played 标记由"首次真实状态变化"点亮，不再只有 act() 回合能点亮。
// 用户手势（isArmed）仍是前置闸：没交互过的会话不写档。

function makeScheduler({ armed = true } = {}) {
  const save = vi.fn();
  const onPlayed = vi.fn();
  const onReset = vi.fn();
  const scheduler = createAutosaveScheduler({
    subscribe: gameStore.subscribe,
    isArmed: () => armed,
    isBusy: () => false,
    save, onPlayed, onReset,
    delayMs: 100,
  });
  return { scheduler, save, onPlayed, onReset };
}

beforeEach(() => {
  vi.useFakeTimers();
  initGameStore({ time: 6, char: { name: "少侠" } });
});

afterEach(() => {
  initGameStore({});
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("本地操作触发自动存档（真实 gameStore 订阅）", () => {
  it("本地操作（时间推进）在 armed 后触发防抖存档并点亮 played", () => {
    const { scheduler, save, onPlayed } = makeScheduler();

    gameActions.setTime(7); // 等价于一次打坐/内层移动引起的状态变化
    vi.advanceTimersByTime(150);

    expect(onPlayed).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  });

  it("未 armed 的会话写状态不存档也不点亮 played", () => {
    const { scheduler, save, onPlayed } = makeScheduler({ armed: false });

    gameActions.setTime(7);
    vi.advanceTimersByTime(300);

    expect(save).not.toHaveBeenCalled();
    expect(onPlayed).not.toHaveBeenCalled();
    scheduler.dispose();
  });

  it("runSilently 内的写（读档/回滚）不触发存档", () => {
    const { scheduler, save, onPlayed } = makeScheduler();

    scheduler.runSilently(() => gameActions.setTime(9));
    vi.advanceTimersByTime(300);

    expect(save).not.toHaveBeenCalled();
    expect(onPlayed).not.toHaveBeenCalled();
    scheduler.dispose();
  });

  it("连续本地操作只防抖合并成一次存档", () => {
    const { scheduler, save } = makeScheduler();

    gameActions.setTime(7);
    gameActions.setTime(8);
    gameActions.setTime(9);
    vi.advanceTimersByTime(150);

    expect(save).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  });
});
