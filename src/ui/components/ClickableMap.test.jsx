import { describe, expect, it, vi } from "vitest";
import ClickableMap from "./ClickableMap.jsx";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  const mocked = {
    ...actual,
    useState: (initial) => [initial, vi.fn()],
    useMemo: (fn) => fn(),
    useRef: (initial) => ({ current: initial }),
    useCallback: (fn) => fn,
    useEffect: () => {},
  };
  return { ...mocked, default: mocked };
});

const NODES = [
  { name: "鱼定村", x: 0, y: 0, explored: true, current: true, links: ["雅江"] },
  { name: "雅江", x: 1, y: 0, explored: true, reachable: true, dir: "e", links: ["鱼定村"] },
];

function flatten(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  return [node, ...flatten(node.props?.children)];
}

const makeTarget = (isHit) => ({ closest: (sel) => (sel === "[data-map-node-hit-target]" ? (isHit ? {} : null) : null) });
const makeSvgEvent = (isHit, extra = {}) => ({
  target: makeTarget(isHit),
  clientX: 10, clientY: 10, pointerId: 1,
  currentTarget: { setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {} },
  ...extra,
});

describe("ClickableMap route edges", () => {
  it("treats a click on the connector line as clicking the destination node", () => {
    const onGo = vi.fn();
    const tree = ClickableMap({ nodes: NODES, onGo, accent: "#a00", loading: false });
    const lines = flatten(tree).filter(n => n.type === "line" && n.props.pointerEvents === "stroke");
    expect(lines).toHaveLength(1);
    lines[0].props.onClick({});
    expect(onGo).toHaveBeenCalledWith("e", "雅江", undefined);
  });
});

describe("ClickableMap drag lifecycle", () => {
  it("never reads baseTx after the drag handle was released", () => {
    const onGo = vi.fn();
    const tree = ClickableMap({ nodes: NODES, onGo, accent: "#a00", loading: false });
    const svg = flatten(tree).find(n => n.type === "svg");
    const move = { clientX: 30, clientY: 30, pointerId: 1, target: makeTarget(false) };
    // down → move → up（松开释放引用）→ 迟到的 move/up/cancel 都应是空操作，不得抛 null.baseTx
    svg.props.onPointerDown(makeSvgEvent(false));
    svg.props.onPointerMove(move);
    svg.props.onPointerUp(makeSvgEvent(false));
    expect(() => {
      svg.props.onPointerMove(move);
      svg.props.onPointerUp(makeSvgEvent(false));
      svg.props.onLostPointerCapture?.(makeSvgEvent(false));
    }).not.toThrow();
  });

  it("a click on a node hit-target never starts a drag", () => {
    const tree = ClickableMap({ nodes: NODES, onGo: vi.fn(), accent: "#a00", loading: false });
    const svg = flatten(tree).find(n => n.type === "svg");
    svg.props.onPointerDown(makeSvgEvent(true));
    // drag 未启动：pointermove 是空操作而不是读 null 字段
    expect(() => svg.props.onPointerMove({ clientX: 40, clientY: 40, pointerId: 1, target: makeTarget(true) })).not.toThrow();
  });
});
