import { getCommand } from "./commands.js";

export const PHASE = Object.freeze({
  MACHINE: "MACHINE", AI_WAIT: "AI_WAIT", AI_STREAM: "AI_STREAM", COMMIT: "COMMIT",
  DONE: "DONE", ERROR: "ERROR", ROLLED_BACK: "ROLLED_BACK", DISCARDED: "DISCARDED",
});

const { MACHINE, AI_WAIT, AI_STREAM, COMMIT, DONE, ERROR, ROLLED_BACK, DISCARDED } = PHASE;
const transitions = {
  [MACHINE]: [AI_WAIT, COMMIT, ERROR, ROLLED_BACK, DISCARDED],
  [AI_WAIT]: [AI_STREAM, COMMIT, ERROR, DISCARDED],
  [AI_STREAM]: [COMMIT, ERROR, DISCARDED],
  [COMMIT]: [DONE, ERROR, ROLLED_BACK, DISCARDED],
  [DONE]: [], [ERROR]: [], [ROLLED_BACK]: [], [DISCARDED]: [],
};
const terminal = new Set([DONE, ERROR, ROLLED_BACK, DISCARDED]);
const LIMIT = 40;
const layers = ["ui", "app", "feature", "domain", "engine", "rules", "result"];

export function createTurnMonitor({ now = Date.now, strict = !!import.meta.env?.VITEST } = {}) {
  let seq = 0;
  let trees = [];
  let current = null;
  let backgroundCount = 0;
  let snapshot = { current, trees, backgroundCount };
  const listeners = new Set();

  function trimHistory() {
    while (trees.length > LIMIT) {
      const index = trees.findLastIndex((entry) => terminal.has(entry.phase));
      if (index < 0) break;
      trees.splice(index, 1);
    }
  }

  function publish() {
    const view = (turn) => turn && { ...turn, phases: [...turn.phases],
      nodes: [...turn.nodes].sort((a, b) => layers.indexOf(a.layer) - layers.indexOf(b.layer)).map((node) => ({ ...node })) };
    snapshot = { current: view(current), trees: trees.map(view), backgroundCount };
    listeners.forEach((listener) => listener());
  }

  function add(turn, layer, label, fields = {}) {
    const node = {
      id: `node-${++seq}`, turnId: turn.id, layer, label, atMs: now() - turn.ts, ...fields,
    };
    turn.nodes.push(node);
    publish();
    return node;
  }

  function start(label, { raw = label, source = "command", background = false, parentId, passive = false, commandId } = {}) {
    const command = commandId && getCommand(commandId);
    const turn = { id: `turn-${++seq}`, cmd: label, raw, source, background, parentId,
      commandId: command?.id, category: command?.category,
      ts: now(), phase: MACHINE, phases: [MACHINE], nodes: [], model: null, passive };
    trees = [turn, ...trees];
    trimHistory();
    if (!background && !passive) current = turn;
    add(turn, background ? "engine" : "ui", label, { kind: "entry", source });
    return turn;
  }

  function transition(turn, next, detail) {
    const allowed = transitions[turn.phase]?.includes(next);
    if (!allowed) {
      const message = `Illegal turn transition ${turn.phase} → ${next} (${turn.id})`;
      add(turn, "engine", message, { kind: "transition-error", status: "fail" });
      if (strict) throw new Error(message);
      return false;
    }
    turn.phase = next;
    turn.phases.push(next);
    if (terminal.has(next)) {
      turn.totalMs = now() - turn.ts;
      turn.summary = detail;
      trimHistory();
      add(turn, "result", detail || next, { kind: next, durationMs: turn.totalMs });
    } else if (next === COMMIT) {
      add(turn, "engine", detail || "提交", { kind: "commit" });
    } else publish();
    return true;
  }

  function finish(turn, detail) {
    if (terminal.has(turn.phase)) return;
    if (turn.phase !== COMMIT) transition(turn, COMMIT);
    transition(turn, DONE, detail);
  }

  function beginAi(parent, request) {
    const background = !parent || parent.background || terminal.has(parent.phase);
    const turn = background && (!parent || terminal.has(parent.phase))
      ? start(request.callLabel, { background: true, source: "background-ai" }) : parent;
    if (background) backgroundCount++;
    else {
      turn.model = request.model;
      if (turn.phase === MACHINE) transition(turn, AI_WAIT);
    }
    const startedAt = now();
    const node = add(turn, "engine", request.callLabel, { kind: "ai", model: request.model });
    const ids = { nodeId: node.id, turnId: turn.id, seq };
    node.pipeline = { ...request, ...ids, ts: startedAt };
    publish();
    return {
      chunk() {
        if (!background && turn.phase === AI_WAIT) transition(turn, AI_STREAM);
      },
      end(response) {
        node.durationMs = now() - startedAt;
        node.pipeline = { ...node.pipeline, ...response, ...ids, durationMs: node.durationMs };
        if (background) {
          backgroundCount--;
          if (!parent || parent !== turn) {
            if (response.success) finish(turn);
            else transition(turn, ERROR, response.error);
          }
        }
        publish();
      },
    };
  }

  return {
    start, add, transition, finish, beginAi,
    queue(turn) {
      turn.queued = true;
      add(turn, "app", turn.commandId === "rollback" ? "回滚已排队" : "命令已排队", { kind: "queued" });
    },
    dequeue(turn) {
      if (!turn.queued) return;
      turn.queued = false;
      publish();
    },
    activate(turn) {
      turn.passive = false;
      if (current !== turn) { current = turn; publish(); }
    },
    park(turn) {
      turn.passive = true;
      if (current === turn) current = trees.find((entry) => !entry.passive && !entry.background) ?? null;
      publish();
    },
    getSnapshot: () => snapshot,
    getTrees: () => snapshot.trees,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear() {
      trees = trees.filter((turn) => !terminal.has(turn.phase));
      if (current && terminal.has(current.phase)) current = null;
      publish();
    },
  };
}

export const turnMonitor = createTurnMonitor();

let synchronousTurn;
export const getTurnContext = () => synchronousTurn;
export function withTurnContext(turn, fn) {
  const previous = synchronousTurn;
  synchronousTurn = turn;
  try { return fn(); } finally { synchronousTurn = previous; }
}

export function formatTurnStatus({ current, trees, backgroundCount }, now = Date.now()) {
  const time = (ms) => `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`;
  const label = current ? {
    [MACHINE]: `机器结算 · ${current.cmd}`,
    [AI_WAIT]: "等待 AI", [AI_STREAM]: "AI 生成中", [COMMIT]: "提交中",
    [DONE]: "完成", [ERROR]: "出错", [ROLLED_BACK]: "已回滚", [DISCARDED]: "已丢弃",
  }[current.phase] : "就绪";
  const model = current?.model && [AI_WAIT, AI_STREAM].includes(current.phase) ? ` · ${current.model}` : "";
  const elapsed = current ? time(current.totalMs ?? now - current.ts) : "";
  const rollback = trees?.some((turn) => turn.commandId === "rollback" && turn.queued) ? " · 回滚已排队" : "";
  return { label: `${label}${model}${elapsed ? ` · ${elapsed}` : ""}${rollback}`, backgroundCount };
}
