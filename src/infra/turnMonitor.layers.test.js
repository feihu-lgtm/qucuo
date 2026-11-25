import { describe, expect, it } from "vitest";
import { turnMonitor } from "./turnMonitor.js";

describe("turnMonitor layers 排序", () => {
  it("shadow 节点排在 engine 后、result 前", () => {
    const turn = turnMonitor.start("test");
    turnMonitor.add(turn, "result", "结果节点");
    turnMonitor.add(turn, "shadow", "影子对账");
    turnMonitor.add(turn, "engine", "引擎节点");
    const { trees } = turnMonitor.getSnapshot();
    const nodes = trees.find((t) => t.id === turn.id).nodes;
    const order = nodes.map((n) => n.layer);
    expect(order.indexOf("engine")).toBeLessThan(order.indexOf("shadow"));
    expect(order.indexOf("shadow")).toBeLessThan(order.indexOf("result"));
    turnMonitor.clear();
  });
});
