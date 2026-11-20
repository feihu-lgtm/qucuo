import { CATEGORY, SYSTEM_COMMANDS, getCommand } from "./commands.js";

const WHISPER_IDS = new Set(["privateWhisper", "actWhisper"]);
const BLOCKING_CATEGORIES = new Set([CATEGORY.LOCAL, CATEGORY.MOVE, CATEGORY.AI_TURN, CATEGORY.SYSTEM]);
export function decide(cmd, running) {
  if (!running) return "run";
  if (running.category === CATEGORY.SYSTEM) return "reject";

  if (cmd.category === CATEGORY.SYSTEM) {
    if (cmd.id === SYSTEM_COMMANDS.rollback) {
      return [CATEGORY.AI_TURN, CATEGORY.MOVE].includes(running.category) ? "reject" : "run";
    }
    if (cmd.id === SYSTEM_COMMANDS.settings) return "run";
    if (cmd.id === SYSTEM_COMMANDS.save || cmd.id === SYSTEM_COMMANDS.apiConfig) return "queue";
    if (cmd.id === SYSTEM_COMMANDS.load || cmd.id === SYSTEM_COMMANDS.newGame) return "reject";
    return "reject";
  }

  if (cmd.category === CATEGORY.VIEW) return "run";
  if (cmd.category === CATEGORY.BACKGROUND) {
    if (WHISPER_IDS.has(cmd.id) && WHISPER_IDS.has(running.id)) return "queue";
    return "run";
  }

  if (cmd.category === CATEGORY.MOVE && running.id === "autoTravel") return "replaceRoute";
  if (
    [CATEGORY.AI_TURN, CATEGORY.LOCAL, CATEGORY.MOVE].includes(cmd.category)
    && [CATEGORY.AI_TURN, CATEGORY.MOVE].includes(running.category)
  ) return "queue";

  return "run";
}

export function createScheduler({ onReject = () => {}, onChange = () => {} } = {}) {
  const queue = [];
  const active = new Map();
  const listeners = new Set();
  const executionStack = [];
  let sequence = 0;
  let draining = false;

  const orderedActive = () => [...active.values()].sort((a, b) => a.startedAt - b.startedAt);
  const primaryRunning = () => {
    const tasks = orderedActive();
    return tasks.find((task) => task.category === CATEGORY.SYSTEM)
      || tasks.find((task) => [CATEGORY.AI_TURN, CATEGORY.MOVE, CATEGORY.LOCAL].includes(task.category))
      || tasks[0]
      || null;
  };
  const publish = () => {
    const state = { running: primaryRunning(), queue: [...queue] };
    onChange(state);
    for (const listener of listeners) listener(state);
  };
  const runningFor = (cmd) => {
    const tasks = orderedActive();
    const system = tasks.find((task) => task.category === CATEGORY.SYSTEM);
    if (system) return system;
    if (cmd.id && WHISPER_IDS.has(cmd.id)) {
      const whisper = tasks.find((task) => WHISPER_IDS.has(task.id));
      if (whisper) return whisper;
    }
    if (cmd.category === CATEGORY.SYSTEM) return tasks.at(-1) || null;
    return tasks.find((task) => [CATEGORY.AI_TURN, CATEGORY.MOVE, CATEGORY.LOCAL].includes(task.category))
      || tasks[0]
      || null;
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
    const record = {
      id: entry.id,
      category: entry.category,
      label: entry.label,
      phase: "machine",
      startedAt: Date.now(),
      token: ++sequence,
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
        record.phase = "done";
        active.delete(record.token);
        publish();
        settleEntry(entry, "value", result);
        void drain();
      },
      (error) => {
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
        if (decision === "queue") break;
        queue.shift();
        if (decision === "reject") {
          onReject(entry, running);
          settleEntry(entry, "value", { status: "rejected" });
          publish();
          continue;
        }
        if (decision === "replaceRoute") {
          const index = removeQueuedRoute();
          queue.splice(Math.min(index, queue.length), 0, entry);
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
      onReject(entry, running);
      settleEntry(entry, "value", { status: "rejected" });
      return entry.promise;
    }
    if (decision === "queue") {
      queue.push(entry);
      publish();
      return entry.promise;
    }
    if (decision === "replaceRoute") {
      const index = removeQueuedRoute();
      queue.splice(Math.min(index, queue.length), 0, entry);
      publish();
      return entry.promise;
    }
    if (id === SYSTEM_COMMANDS.rollback) clearQueue();
    runEntry(entry);
    return entry.promise;
  };

  function clearQueue() {
    for (const entry of queue.splice(0)) settleEntry(entry, "value", { status: "cleared" });
    publish();
  }

  const setPhase = (phase) => {
    const task = primaryRunning();
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
    setPhase,
    subscribe,
  };
}
