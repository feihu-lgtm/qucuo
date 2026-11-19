export function createAutosaveScheduler({
  subscribe,
  isArmed,
  isBusy,
  save,
  onPlayed,
  onReset,
  delayMs = 1500,
  timers = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  },
}) {
  let played = false;
  let pending = false;
  let timeoutId = null;
  let disposed = false;
  let silenceDepth = 0;

  const cancelTimer = () => {
    if (timeoutId === null) return;
    timers.clearTimeout(timeoutId);
    timeoutId = null;
  };

  const scheduleChange = (skipBusyCheck) => {
    try {
      if (disposed || silenceDepth > 0 || !isArmed() || (!skipBusyCheck && isBusy())) return;
      pending = true;
      if (!played) {
        played = true;
        onPlayed?.();
      }
      cancelTimer();
      timeoutId = timers.setTimeout(() => {
        timeoutId = null;
        if (disposed || !pending) return;
        pending = false;
        if (!isBusy()) save();
      }, delayMs);
    } catch (error) {
      console.error("[autosave]", error);
    }
  };

  const schedule = () => scheduleChange(false);

  const unsubscribe = subscribe(schedule);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelTimer();
      pending = false;
      unsubscribe();
    },
    runSilently(fn) {
      silenceDepth += 1;
      try {
        return fn();
      } finally {
        silenceDepth -= 1;
      }
    },
    touch() {
      scheduleChange(true);
    },
    resetPlayed() {
      if (disposed) return;
      played = false;
      pending = false;
      cancelTimer();
      onReset?.();
    },
    flushNow() {
      if (disposed || !pending) return;
      cancelTimer();
      pending = false;
      save();
    },
  };
}
