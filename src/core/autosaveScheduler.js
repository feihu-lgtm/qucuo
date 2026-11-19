export function createAutosaveScheduler({
  subscribe,
  isArmed,
  isBusy,
  save,
  onPlayed,
  delayMs = 1500,
  timers = { setTimeout, clearTimeout },
}) {
  let played = false;
  let pending = false;
  let timeoutId = null;
  let disposed = false;

  const cancelTimer = () => {
    if (timeoutId === null) return;
    timers.clearTimeout(timeoutId);
    timeoutId = null;
  };

  const schedule = () => {
    if (disposed || !isArmed()) return;
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
  };

  const unsubscribe = subscribe(schedule);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelTimer();
      pending = false;
      unsubscribe();
    },
    flushNow() {
      if (disposed || !pending) return;
      cancelTimer();
      pending = false;
      save();
    },
  };
}
