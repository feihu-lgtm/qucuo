import { afterEach, describe, expect, it, vi } from "vitest";
import { createCoalescedCheck, createWorldRules } from "./worldRules.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("world rules", () => {
  it("runs once initially, then only when an Object.is dependency changes", () => {
    const state = { time: 1, room: {} };
    const run = vi.fn();
    const runner = createWorldRules([{
      id: "time",
      deps: (current) => [current.time, current.room],
      run,
    }], {
      getState: () => state,
      applyResult: vi.fn(),
    });

    runner.check();
    runner.check();
    state.room = {};
    runner.check();
    state.time = 2;
    runner.check();

    expect(run).toHaveBeenCalledTimes(3);
    expect(run.mock.calls[0][1]).toMatchObject({ firstRun: true, previousDeps: undefined });
    expect(run.mock.calls[1][1]).toMatchObject({ firstRun: false, previousDeps: [1, expect.any(Object)] });
  });

  it("reset forgets dependencies so the next check is a first run", () => {
    const state = { time: 8 };
    const run = vi.fn();
    const runner = createWorldRules([{
      id: "time",
      deps: (current) => [current.time],
      run,
    }], {
      getState: () => state,
      applyResult: vi.fn(),
    });

    runner.check();
    state.time = 9;
    runner.reset();
    runner.check();

    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1][1]).toMatchObject({ firstRun: true, previousDeps: undefined });
  });

  it("applies cascaded changes in rule order until dependencies settle", () => {
    const state = { stage: 0, done: false };
    const applied = [];
    const runner = createWorldRules([
      {
        id: "advance",
        deps: (current) => [current.stage],
        run: (current) => current.stage === 1 ? { stage: 2 } : null,
      },
      {
        id: "complete",
        deps: (current) => [current.stage],
        run: (current) => current.stage === 2 ? { done: true } : null,
      },
    ], {
      getState: () => state,
      applyResult: (result) => {
        applied.push(result);
        Object.assign(state, result);
      },
    });

    runner.check();
    state.stage = 1;
    runner.check();

    expect(state).toEqual({ stage: 2, done: true });
    expect(applied).toEqual([{ stage: 2 }, { done: true }]);
  });

  it("caps dependency cascades at five passes and warns", () => {
    const state = { value: 0 };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runner = createWorldRules([{
      id: "toggle",
      deps: (current) => [current.value],
      run: (current) => ({ value: current.value === 0 ? 1 : 0 }),
    }], {
      getState: () => state,
      applyResult: (result) => Object.assign(state, result),
    });

    runner.check();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(state.value).toBe(1);
  });

  it("coalesces queued checks and can dispose a pending callback", () => {
    const queued = [];
    let scheduler;
    const check = vi.fn(() => scheduler.schedule());
    scheduler = createCoalescedCheck(check, (callback) => queued.push(callback));

    scheduler.schedule();
    scheduler.schedule();
    expect(queued).toHaveLength(1);
    queued.shift()();
    expect(check).toHaveBeenCalledTimes(1);
    expect(queued).toHaveLength(0);

    scheduler.schedule();
    scheduler.dispose();
    queued.shift()();
    scheduler.schedule();
    expect(check).toHaveBeenCalledTimes(1);
    expect(queued).toHaveLength(0);
  });
});
