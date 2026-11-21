import { describe, expect, it, vi } from "vitest";
import { runScript } from "../../cli/runner.mjs";
import { createMockAi } from "../engine/ports/ai.js";
import { createTurnMonitor, PHASE as P } from "./turnMonitor.js";
import { fmtClock, formatTrace } from "../infra/actionTrace.js";

it("shows the phase order and layered nodes of a mock AI script turn", async () => {
  const output = [];
  const script = ":new\n探索石阶\n:status\n:tree 1";
  const ai = createMockAi(['{"output":["石阶旁的草叶轻轻摇动。"]}']);
  expect(await runScript(script, { out: (text) => output.push(text), ai })).toBe(0);
  expect(output.join("\n")).toMatch(/DONE · 完成/);
  const tree = output.find((text) => text.includes("MACHINE →"));
  expect(tree).toMatch(/=== \d{2}:\d{2}:\d{2} turn-\d+ 探索石阶/);
  expect(tree).toMatch(/探索石阶 \| MACHINE → AI_WAIT → COMMIT → DONE/);
  expect(tree).toMatch(/\[ui\].*\n\s+\[app\].*\n\s+\[feature\][\s\S]*\[domain\][\s\S]*\[engine\] 主叙事[\s\S]*\[engine\] 提交[\s\S]*\[rules\][\s\S]*\[result\]/);
});

it("formats local clock time in trace headers", () => {
  const ts = new Date(2024, 0, 2, 9, 3, 5).getTime();
  expect(fmtClock(ts)).toBe("09:03:05");
  expect(formatTrace({
    ts, id: "turn-32", raw: "查看预热", phases: [P.DONE], totalMs: 3800, nodes: [],
  }).split("\n")[0]).toBe("=== 09:03:05 turn-32 查看预热 | DONE | 3.8s ===");
});

const paths = [
  [P.MACHINE, [P.AI_WAIT, P.COMMIT, P.ERROR, P.ROLLED_BACK, P.DISCARDED]],
  [P.AI_WAIT, [P.AI_STREAM, P.COMMIT, P.ERROR, P.DISCARDED]],
  [P.AI_STREAM, [P.COMMIT, P.ERROR, P.DISCARDED]],
  [P.COMMIT, [P.DONE, P.ERROR, P.ROLLED_BACK, P.DISCARDED]],
  ...[P.DONE, P.ERROR, P.ROLLED_BACK, P.DISCARDED].map((phase) => [phase, []]),
];

const setup = {
  [P.MACHINE]: [], [P.AI_WAIT]: [P.AI_WAIT], [P.AI_STREAM]: [P.AI_WAIT, P.AI_STREAM],
  [P.COMMIT]: [P.COMMIT], [P.DONE]: [P.COMMIT, P.DONE],
  [P.ERROR]: [P.ERROR], [P.ROLLED_BACK]: [P.ROLLED_BACK], [P.DISCARDED]: [P.DISCARDED],
};

describe("turn phase machine", () => {
  it.each(paths)("enforces all outgoing transitions from %s", (phase, allowed) => {
    for (const next of Object.values(P)) {
      const monitor = createTurnMonitor();
      const turn = monitor.start("测试");
      for (const prior of setup[phase]) monitor.transition(turn, prior);
      if (allowed.includes(next)) {
        expect(monitor.transition(turn, next)).toBe(true);
        expect(turn.phase).toBe(next);
      } else {
        expect(() => monitor.transition(turn, next)).toThrow(/Illegal turn transition/);
        expect(turn.phase).toBe(phase);
        expect(turn.nodes.at(-1)).toMatchObject({ kind: "transition-error", status: "fail" });
      }
    }
  });

  it("publishes independent background calls and correlates overlapping replies by node id", () => {
    let time = 0;
    const monitor = createTurnMonitor({ now: () => time });
    const listener = vi.fn();
    const unsubscribe = monitor.subscribe(listener);
    const turn = monitor.start("行动");
    const main = monitor.beginAi(turn, { model: "test", callLabel: "主叙事" });
    const background = monitor.beginAi(undefined, { model: "other", callLabel: "后台" });
    expect(monitor.getSnapshot()).toMatchObject({ current: { phase: P.AI_WAIT }, backgroundCount: 1 });
    time += 10;
    main.chunk();
    background.end({ success: true, response: "后台回复" });
    expect(monitor.getSnapshot()).toMatchObject({ current: { phase: P.AI_STREAM }, backgroundCount: 0 });
    time += 20;
    main.end({ success: true, response: "主叙事回复" });
    monitor.finish(turn);
    const node = monitor.getTrees().find((tree) => tree.id === turn.id).nodes.find((entry) => entry.kind === "ai");
    expect(node.pipeline).toMatchObject({ nodeId: node.id, turnId: turn.id, response: "主叙事回复", durationMs: 30 });
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    monitor.clear();
    expect(listener).not.toHaveBeenCalled();
  });
});
