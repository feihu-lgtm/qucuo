import { getTurnContext, PHASE, turnMonitor, withTurnContext } from "../infra/turnMonitor.js";

function sameDeps(left, right) {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}

export function createWorldRules(rules, { getState, applyResult, ctx = {} }) {
  const lastDeps = new Map();
  const ids = new Set();

  for (const rule of rules) {
    if (!rule?.id || typeof rule.deps !== "function" || typeof rule.run !== "function") {
      throw new TypeError("World rules require an id, deps(state), and run(state, ctx)");
    }
    if (ids.has(rule.id)) throw new Error(`Duplicate world rule id: ${rule.id}`);
    ids.add(rule.id);
  }

  function check(turn = getTurnContext()) {
    let trace = turn;
    try {
      checkRules((result, rule) => {
        if (!trace && result == null) return;
        trace ||= turnMonitor.start("世界规则", { source: "world-rules", background: true, commandId: "worldRules" });
        turnMonitor.add(trace, "rules", rule.id, {
          status: result == null ? "skip" : "pass",
          detail: result == null ? "无变更" : Object.keys(result.changes || result).join("、"),
        });
        if (result == null) return;
        trace.inRules = true;
        try { withTurnContext(trace, () => applyResult(result, rule)); }
        finally { delete trace.inRules; }
      });
      if (!turn && trace) turnMonitor.finish(trace);
    } catch (error) {
      if (!turn && trace) turnMonitor.transition(trace, PHASE.ERROR, String(error));
      throw error;
    }
  }

  function checkRules(apply) {
    for (let pass = 0; pass < 5; pass++) {
      for (const rule of rules) {
        const state = getState();
        const deps = rule.deps(state);
        if (!Array.isArray(deps)) {
          throw new TypeError(`World rule "${rule.id}" deps must return an array`);
        }

        const firstRun = !lastDeps.has(rule.id);
        const previousDeps = lastDeps.get(rule.id);
        if (!firstRun && sameDeps(deps, previousDeps)) continue;

        lastDeps.set(rule.id, deps.slice());
        const result = rule.run(state, {
          ...ctx,
          firstRun,
          previousDeps,
        });
        apply(result, rule);
      }

      const pending = rules.some((rule) => {
        const previousDeps = lastDeps.get(rule.id);
        return !sameDeps(rule.deps(getState()), previousDeps);
      });
      if (!pending) return;
      if (pass === 4) console.warn("[worldRules] Cascade exceeded 5 passes; remaining changes will wait for the next check.");
    }
  }

  return {
    check,
    reset() {
      lastDeps.clear();
    },
  };
}

export function createCoalescedCheck(check, enqueue = queueMicrotask) {
  let pending = false;
  let running = false;
  let disposed = false;
  let context;

  function schedule() {
    if (running || disposed) return;
    context = getTurnContext() || context;
    if (pending) return;
    pending = true;
    enqueue(() => {
      pending = false;
      if (disposed) return;
      running = true;
      try {
        withTurnContext(context, check);
      } finally {
        context = undefined;
        running = false;
      }
    });
  }

  return {
    schedule,
    dispose() {
      disposed = true;
    },
  };
}
