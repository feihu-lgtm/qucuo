import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaveScheduler } from "./autosaveScheduler.js";

function createHarness({ delayMs = 100 } = {}) {
  let armed = false;
  let busy = false;
  let listener;
  const unsubscribe = vi.fn();
  const save = vi.fn();
  const onPlayed = vi.fn();
  const onReset = vi.fn();
  const scheduler = createAutosaveScheduler({
    subscribe: (nextListener) => {
      listener = nextListener;
      return unsubscribe;
    },
    isArmed: () => armed,
    isBusy: () => busy,
    save,
    onPlayed,
    onReset,
    delayMs,
  });

  return {
    scheduler,
    save,
    onPlayed,
    onReset,
    unsubscribe,
    emit: () => listener?.(),
    arm: () => { armed = true; },
    setBusy: (value) => { busy = value; },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("createAutosaveScheduler", () => {
  it("does not save changes before the session is armed", () => {
    const harness = createHarness();
    harness.emit();

    vi.advanceTimersByTime(1000);

    expect(harness.save).not.toHaveBeenCalled();
    expect(harness.onPlayed).not.toHaveBeenCalled();
    harness.scheduler.dispose();
  });

  it("uses the default timer wrappers", () => {
    const harness = createHarness();
    harness.arm();
    harness.emit();

    vi.advanceTimersByTime(100);

    expect(harness.save).toHaveBeenCalledTimes(1);
    harness.scheduler.dispose();
  });

  it("debounces an armed burst into one delayed save", () => {
    const harness = createHarness();
    harness.arm();
    harness.emit();
    vi.advanceTimersByTime(50);
    harness.emit();
    vi.advanceTimersByTime(99);
    expect(harness.save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(harness.save).toHaveBeenCalledTimes(1);
  });

  it("skips a busy timer and saves after a later change", () => {
    const harness = createHarness();
    harness.arm();
    harness.emit();
    harness.setBusy(true);
    vi.advanceTimersByTime(100);
    expect(harness.save).not.toHaveBeenCalled();

    harness.setBusy(false);
    harness.emit();
    vi.advanceTimersByTime(100);

    expect(harness.save).toHaveBeenCalledTimes(1);
  });

  it("ignores changes while busy and schedules after busy clears", () => {
    const harness = createHarness();
    harness.arm();
    harness.setBusy(true);
    harness.emit();
    vi.advanceTimersByTime(1000);

    expect(harness.onPlayed).not.toHaveBeenCalled();
    expect(harness.save).not.toHaveBeenCalled();

    harness.setBusy(false);
    harness.emit();
    vi.advanceTimersByTime(100);

    expect(harness.onPlayed).toHaveBeenCalledTimes(1);
    expect(harness.save).toHaveBeenCalledTimes(1);
    harness.scheduler.dispose();
  });

  it("calls onPlayed only on the first armed change", () => {
    const harness = createHarness();
    harness.emit();
    harness.arm();
    harness.emit();
    harness.emit();

    expect(harness.onPlayed).toHaveBeenCalledTimes(1);
    harness.scheduler.dispose();
  });

  it("does not throw from the store listener when isArmed fails", () => {
    let listener;
    const error = new Error("arming failed");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const scheduler = createAutosaveScheduler({
      subscribe: (nextListener) => {
        listener = nextListener;
        return () => {};
      },
      isArmed: () => { throw error; },
      isBusy: () => false,
      save: vi.fn(),
    });

    expect(() => listener()).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith("[autosave]", error);
    scheduler.dispose();
  });

  it("ignores nested synchronous changes and restores silence depth", () => {
    const harness = createHarness();
    harness.arm();
    harness.scheduler.runSilently(() => {
      harness.emit();
      harness.scheduler.runSilently(() => harness.emit());
    });
    expect(() => harness.scheduler.runSilently(() => {
      throw new Error("silent callback failed");
    })).toThrow("silent callback failed");
    harness.emit();

    vi.advanceTimersByTime(100);

    expect(harness.onPlayed).toHaveBeenCalledTimes(1);
    expect(harness.save).toHaveBeenCalledTimes(1);
    harness.scheduler.dispose();
  });

  it("resetPlayed cancels pending work and permits a later play", () => {
    const harness = createHarness();
    harness.arm();
    harness.emit();
    expect(harness.onPlayed).toHaveBeenCalledTimes(1);

    harness.scheduler.resetPlayed();
    vi.advanceTimersByTime(100);
    expect(harness.save).not.toHaveBeenCalled();
    expect(harness.onReset).toHaveBeenCalledTimes(1);

    harness.emit();
    expect(harness.onPlayed).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(100);

    expect(harness.save).toHaveBeenCalledTimes(1);
  });

  it("dispose cancels pending work and unsubscribes", () => {
    const harness = createHarness();
    harness.arm();
    harness.emit();
    harness.scheduler.dispose();
    harness.emit();
    vi.advanceTimersByTime(1000);

    expect(harness.save).not.toHaveBeenCalled();
    expect(harness.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("flushNow saves immediately only when a change is pending", () => {
    const harness = createHarness();
    harness.scheduler.flushNow();
    expect(harness.save).not.toHaveBeenCalled();

    harness.arm();
    harness.emit();
    vi.advanceTimersByTime(50);
    harness.scheduler.flushNow();
    vi.advanceTimersByTime(100);

    expect(harness.save).toHaveBeenCalledTimes(1);
  });
});
