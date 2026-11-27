import { describe, expect, it } from "vitest";
import { createTurnMonitor, formatTurnStatus, turnMonitor } from "./turnMonitor.js";

describe("turnMonitor 节点顺序与缓冲区", () => {
  it("节点按真实发生顺序排列，不再按层重排", () => {
    const turn = turnMonitor.start("test");
    turnMonitor.add(turn, "result", "结果节点");
    turnMonitor.add(turn, "shadow", "影子对账");
    turnMonitor.add(turn, "engine", "引擎节点");
    const { trees } = turnMonitor.getSnapshot();
    const labels = trees.find((t) => t.id === turn.id).nodes.map((n) => n.label);
    expect(labels).toEqual(["test", "结果节点", "影子对账", "引擎节点"]);
    turnMonitor.clear();
  });

  it("后台调用再多，也挤不掉前台回合", () => {
    const monitor = createTurnMonitor({ strict: false });
    const front = monitor.start("玩家行动");
    monitor.finish(front);
    for (let i = 0; i < 60; i += 1) {
      const bg = monitor.start(`后台${i}`, { background: true });
      monitor.finish(bg);
    }
    const trees = monitor.getTrees();
    expect(trees.some((t) => t.id === front.id)).toBe(true);
    expect(trees.filter((t) => t.background).length).toBeLessThanOrEqual(40);
  });

  it("瞬态说明只挂在进行中的回合上，结束后不再显示", () => {
    const monitor = createTurnMonitor({ strict: false });
    const turn = monitor.start("行动");
    monitor.note(turn, "接口中断，正在重试 1/2");
    expect(formatTurnStatus(monitor.getSnapshot()).label).toContain("正在重试 1/2");
    monitor.finish(turn);
    expect(formatTurnStatus(monitor.getSnapshot()).label).not.toContain("正在重试");
  });
});
