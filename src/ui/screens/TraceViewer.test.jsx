import { describe, expect, it, vi } from "vitest";
import TraceViewer from "./TraceViewer.jsx";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  const mocked = {
    ...actual,
    useState: (initial) => [initial, vi.fn()],
    useRef: (initial) => ({ current: initial }),
    useCallback: (fn) => fn,
    useEffect: () => {},
    useSyncExternalStore: () => ({ trees: [] }),
  };
  return { ...mocked, default: mocked };
});

function flatten(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  return [node, ...flatten(node.props?.children)];
}

describe("TraceViewer report entry", () => {
  it("opens the bug report without closing the trace itself", () => {
    const onClose = vi.fn();
    const onReport = vi.fn();
    const tree = TraceViewer({ theme: {}, onClose, onReport });
    const reportBtn = flatten(tree).find(n => n.type === "button"
      && flatten(n.props?.children).concat([n.props?.children]).flat().includes("报告问题"));
    expect(reportBtn).toBeTruthy();
    reportBtn.props.onClick();
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
