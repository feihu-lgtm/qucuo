// 自动存档进度计数（模块状态）：「距离上次存档过了几回合」「本次会话是否真的玩过」。
// 原先是 hook 层两个 React ref 被 engine 跨层读写——现在收进本模块：
// commitRound（真走完一轮）调 noteRoundCompleted 自增；存档落盘/手动重置归零。
let roundsSinceLastSave = 0;
let playedThisSession = false;

export function notePlayed() {
  playedThisSession = true;
}

export function noteRoundCompleted() {
  roundsSinceLastSave += 1;
  playedThisSession = true;
}
export function noteAutosaveSaved() {
  roundsSinceLastSave = 0;
}
export function resetAutosaveProgress() {
  roundsSinceLastSave = 0;
  playedThisSession = false;
}
export function getRoundsSinceLastSave() {
  return roundsSinceLastSave;
}
export function getPlayedThisSession() {
  return playedThisSession;
}

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
