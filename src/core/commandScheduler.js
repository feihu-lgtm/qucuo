import { CATEGORY, SYSTEM_COMMANDS, getCommand } from "./commands.js";

const WHISPER_IDS = new Set(["privateWhisper", "actWhisper"]);
const BLOCKING_CATEGORIES = new Set([CATEGORY.LOCAL, CATEGORY.MOVE, CATEGORY.AI_TURN, CATEGORY.SYSTEM]);
export function decide(cmd, running) {
  if (!running) return "run";
  if (running.category === CATEGORY.SYSTEM) return "reject";

  if (cmd.category === CATEGORY.SYSTEM) {
    if (cmd.id === SYSTEM_COMMANDS.rollback) {
      if (running.id === "autoTravel" && running.category === CATEGORY.MOVE) return "queue";
      return [CATEGORY.AI_TURN, CATEGORY.MOVE].includes(running.category) ? "reject" : "run";
    }
    if (cmd.id === SYSTEM_COMMANDS.settings) return "run";
    if (cmd.id === SYSTEM_COMMANDS.save) return "queue";
    if (cmd.id === SYSTEM_COMMANDS.apiConfig) return "run"; // Active turns keep the config captured at their start.
    if (cmd.id === SYSTEM_COMMANDS.load || cmd.id === SYSTEM_COMMANDS.newGame) return "reject";
    return "reject";
  }

  if (cmd.category === CATEGORY.VIEW) return "run";
  if (cmd.category === CATEGORY.BACKGROUND) {
    if (WHISPER_IDS.has(cmd.id) && WHISPER_IDS.has(running.id)) return "queue";
    return "run";
  }

  if (cmd.category === CATEGORY.MOVE && running.id === "autoTravel") {
    return cmd.meta?.routeLeg ? "queue" : "replaceRoute";
  }
  if (
    [CATEGORY.AI_TURN, CATEGORY.LOCAL, CATEGORY.MOVE].includes(cmd.category)
    && [CATEGORY.AI_TURN, CATEGORY.MOVE].includes(running.category)
  ) return "queue";

  return "run";
}

export function createScheduler({ onReject = () => {}, onQueue = () => {}, onChange = () => {} } = {}) {
  const queue = [];
  const active = new Map();
  const listeners = new Set();
  const executionStack = [];
  let sequence = 0;
  let draining = false;

  const orderedActive = () => [...active.values()].sort((a, b) => a.token - b.token);
  const latestTurn = () => orderedActive().reverse()
    .find((task) => [CATEGORY.AI_TURN, CATEGORY.MOVE].includes(task.category)) || null;
  const primaryRunning = () => {
    const tasks = orderedActive();
    return tasks.find((task) => task.category === CATEGORY.SYSTEM)
      || latestTurn()
      || tasks.find((task) => task.category === CATEGORY.LOCAL)
      || tasks[0]
      || null;
  };
  const runningFor = (cmd) => {
    const tasks = orderedActive();
    const system = tasks.find((task) => task.category === CATEGORY.SYSTEM);
    if (system) return system;
    if (cmd.id && WHISPER_IDS.has(cmd.id)) {
      const whisper = tasks.find((task) => WHISPER_IDS.has(task.id));
      if (whisper) return whisper;
    }
    if (cmd.category === CATEGORY.SYSTEM) {
      const autoTravel = cmd.id === SYSTEM_COMMANDS.rollback
        ? tasks.find((task) => task.id === "autoTravel" && task.category === CATEGORY.MOVE)
        : null;
      return autoTravel || latestTurn() || tasks.at(-1) || null;
    }
    return latestTurn()
      || tasks.find((task) => task.category === CATEGORY.LOCAL)
      || tasks[0]
      || null;
  };
  const canRun = (id) => {
    const command = getCommand(id);
    return decide(command, runningFor(command)) === "run";
  };
  const publish = () => {
    const rollback = getCommand(SYSTEM_COMMANDS.rollback);
    const rollbackRunning = runningFor(rollback);
    const rollbackDecision = decide(rollback, rollbackRunning);
    const state = {
      running: primaryRunning(),
      queue: [...queue],
      rollbackBlocked: !canRun(rollback.id)
        && rollbackDecision === "reject"
        && [CATEGORY.AI_TURN, CATEGORY.MOVE].includes(rollbackRunning?.category),
    };
    onChange(state);
    for (const listener of listeners) listener(state);
  };

  const settleEntry = (entry, status, value) => {
    if (entry.settled) return;
    entry.settled = true;
    if (status === "error") entry.reject(value);
    else entry.resolve(value);
  };

  const removeQueuedRoute = () => {
    let insertAt = queue.length;
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      if (!queue[index].meta.routeQueue) continue;
      insertAt = Math.min(insertAt, index);
      const [removed] = queue.splice(index, 1);
      settleEntry(removed, "value", { status: "replaced" });
    }
    return insertAt;
  };

  const clearRouteQueue = () => {
    let removed = 0;
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      if (!queue[index].meta.routeQueue) continue;
      const [entry] = queue.splice(index, 1);
      settleEntry(entry, "value", { status: "cleared" });
      removed += 1;
    }
    if (removed) publish();
    return removed;
  };

  const runEntry = (entry) => {
    if (entry.id === SYSTEM_COMMANDS.rollback) clearQueue();
    const record = {
      id: entry.id,
      category: entry.category,
      label: entry.label,
      phase: "machine",
      startedAt: Date.now(),
      token: ++sequence,
      entry,
    };
    active.set(record.token, record);
    publish();

    let value;
    executionStack.push(record);
    try {
      value = entry.fn();
    } catch (error) {
      executionStack.pop();
      active.delete(record.token);
      publish();
      settleEntry(entry, "error", error);
      void drain();
      return;
    }
    executionStack.pop();

    Promise.resolve(value).then(
      (result) => {
        if (!active.has(record.token)) return;
        record.phase = "done";
        active.delete(record.token);
        publish();
        settleEntry(entry, "value", result);
        void drain();
      },
      (error) => {
        if (!active.has(record.token)) return;
        record.phase = "error";
        active.delete(record.token);
        publish();
        settleEntry(entry, "error", error);
        void drain();
      },
    );
  };

  const makeEntry = (id, fn, meta = {}) => {
    const command = getCommand(id);
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return {
      ...command,
      fn,
      meta,
      promise,
      resolve,
      reject,
      settled: false,
    };
  };

  const enqueue = (id, fn, meta = {}) => {
    const entry = makeEntry(id, fn, meta);
    queue.push(entry);
    publish();
    return entry.promise;
  };

  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (queue.length) {
        const entry = queue[0];
        const running = runningFor(entry);
        const decision = decide(entry, running);
        if (decision === "queue" || decision === "replaceRoute") break;
        queue.shift();
        if (decision === "reject") {
          const message = onReject(entry, running);
          settleEntry(entry, "value", { status: "rejected", message });
          publish();
          continue;
        }
        runEntry(entry);
        if (BLOCKING_CATEGORIES.has(entry.category)) break;
      }
    } finally {
      draining = false;
    }
  }

  const dispatch = (id, fn, meta = {}) => {
    const entry = makeEntry(id, fn, meta);
    const parent = executionStack.at(-1);
    if (parent && entry.category !== CATEGORY.SYSTEM) {
      runEntry(entry);
      return entry.promise;
    }

    const running = runningFor(entry);
    const decision = decide(entry, running);
    if (decision === "reject") {
      const message = onReject(entry, running);
      settleEntry(entry, "value", { status: "rejected", message });
      return entry.promise;
    }
    if (decision === "queue") {
      if (id === SYSTEM_COMMANDS.rollback && running?.id === "autoTravel") {
        clearRouteQueue();
        queue.unshift(entry);
      } else {
        queue.push(entry);
      }
      onQueue(entry, queue.indexOf(entry) + 1);
      publish();
      return entry.promise;
    }
    if (decision === "replaceRoute") {
      const index = removeQueuedRoute();
      queue.splice(Math.min(index, queue.length), 0, entry);
      onQueue(entry, queue.indexOf(entry) + 1);
      publish();
      return entry.promise;
    }
    runEntry(entry);
    return entry.promise;
  };

  function clearQueue() {
    for (const entry of queue.splice(0)) settleEntry(entry, "value", { status: "cleared" });
    publish();
  }

  const stopRunning = () => {
    const record = orderedActive().reverse()
      .find((task) => [CATEGORY.AI_TURN, CATEGORY.MOVE].includes(task.category));
    if (!record) return false;
    active.delete(record.token);
    record.phase = "stopped";
    settleEntry(record.entry, "value", { status: "stopped" });
    publish();
    void drain();
    return true;
  };

  const setPhase = (phase) => {
    const task = latestTurn();
    if (!task) return;
    task.phase = phase;
    publish();
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    dispatch,
    enqueue,
    queue,
    clearQueue,
    clearRouteQueue,
    get running() {
      return primaryRunning();
    },
    canRun,
    stopRunning,
    setPhase,
    subscribe,
  };
}
