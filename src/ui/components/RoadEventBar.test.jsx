import { describe, expect, it, vi } from "vitest";
import RoadEventBar from "./RoadEventBar.jsx";
import { Button } from "../primitives/index.js";

// 仓库无 jsdom/RTL：沿用 ClickableMap/DungeonMapPanel 的 vnode 树断言惯例。
// useRoadEventPending 是 React hook，直接调组件函数跑不了——打桩成纯数据返回。
let mockPending = null;
vi.mock("zustand", () => ({ useStore: () => mockPending }));
vi.mock("../../features/roadevent/pending.js", () => ({
  roadEventPendingStore: { fake: true },
}));

const isButton = (n) => n.type === "button" || n.type === Button;

function collectButtons(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectButtons(item, out);
    return out;
  }
  if (isButton(node)) out.push(node);
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    collectButtons(child, out);
  }
  return out;
}

describe("WO-25O RoadEventBar 可行之事按钮条", () => {
  it("无挂起时不渲染", () => {
    mockPending = null;
    expect(RoadEventBar({ onChoose: () => {} })).toBeNull();
  });

  it("挂起三选项渲染三个按钮，点击照抄 label 派发——不触碰任何状态直写", () => {
    mockPending = {
      roll: {
        eventId: "P15",
        options: [
          { key: "main", label: "下场一试" },
          { key: "alt", label: "旁观看破" },
          { key: "leave", label: "不凑热闹" },
        ],
      },
    };
    const onChoose = vi.fn();
    const tree = RoadEventBar({ onChoose });
    expect(tree).toBeTruthy();
    const buttons = collectButtons(tree);
    expect(buttons.map((b) => b.props.children)).toEqual(["下场一试", "旁观看破", "不凑热闹"]);
    buttons[0].props.onClick();
    expect(onChoose).toHaveBeenCalledWith("下场一试");
    buttons[2].props.onClick();
    expect(onChoose).toHaveBeenCalledWith("不凑热闹");
  });
});
