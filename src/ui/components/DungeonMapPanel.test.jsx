import { describe, expect, it, vi, beforeEach } from "vitest";
import DungeonMapPanel from "./DungeonMapPanel.jsx";

// 仓库无 jsdom/RTL：沿用 ClickableMap.test.jsx 的 vnode 树断言惯例。
// useState 打桩注入可控输入文本，验证自由文本回传。
let mockText = "";
const setTextSpy = vi.fn();
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  const mocked = {
    ...actual,
    useState: () => [mockText, setTextSpy],
    useMemo: (fn) => fn(),
    useRef: (initial) => ({ current: initial }),
    useCallback: (fn) => fn,
    useEffect: () => {},
  };
  return { ...mocked, default: mocked };
});

const ROOM = {
  name: "耳室",
  desc: "四壁渗水，烛火将熄。",
  exits: { n: "前殿", e: "侧廊" },
  residentNpcName: "独臂老僧",
  groundLoot: [{ name: "半卷残经" }],
  envTag: "xueshanWindchill",
  isTreasure: true,
  isCheckpoint: true,
  roomEvent: { options: [{ label: "推开石门" }, { label: "叩问老僧" }] },
};

function flatten(node, out = []) {
  if (node == null || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push({ type: "#text", text: String(node) });
    return out;
  }
  if (Array.isArray(node)) { node.forEach(n => flatten(n, out)); return out; }
  out.push(node);
  const kids = node.props?.children;
  if (kids != null) flatten(kids, out);
  return out;
}

const texts = (flat) => flat.filter(n => n.type === "#text").map(n => n.text).join("");
const part = (flat, key) => flat.find(n => n.props?.["data-part"] === key);
const buttonsIn = (flat, key) => flat.filter(n => n.type === "button" && part(flat, key) && isDescendant(part(flat, key), n));

function isDescendant(parent, node) {
  const kids = parent?.props?.children;
  if (kids == null) return false;
  const arr = Array.isArray(kids) ? kids : [kids];
  return arr.some(k => k === node || isDescendant(k, node));
}

function render(room = ROOM, runState = null) {
  const onMove = vi.fn(), onAction = vi.fn(), onText = vi.fn();
  const tree = flatten(DungeonMapPanel({ room, runState, onMove, onAction, onText }));
  return { tree, onMove, onAction, onText };
}

describe("DungeonMapPanel", () => {
  beforeEach(() => { mockText = ""; setTextSpy.mockClear(); });

  it("呈现顺序：房名→描述→实体→出口→动作→输入", () => {
    const { tree } = render(ROOM, { step: 3, hp: 80, loot: ["残经"] });
    const keys = ["room-name", "room-desc", "room-entities", "room-exits", "room-actions", "room-input", "run-state"];
    const order = tree.filter(n => n.props?.["data-part"]).map(n => n.props["data-part"]);
    expect(order).toEqual(keys);
  });

  it("房名/描述/实体齐全：人物、地上物、藏宝与检点徽记", () => {
    const { tree } = render();
    expect(texts(flatten(part(tree, "room-name")))).toContain("耳室");
    expect(texts(tree)).toContain("四壁渗水，烛火将熄。");
    expect(texts(flatten(part(tree, "room-entities")))).toContain("独臂老僧");
    expect(texts(flatten(part(tree, "room-entities")))).toContain("半卷残经");
    expect(texts(flatten(part(tree, "room-name")))).toContain("✦ 藏宝");
    expect(texts(flatten(part(tree, "room-name")))).toContain("◈ 检点");
    expect(texts(flatten(part(tree, "room-name")))).toContain("xueshanWindchill");
  });

  it("六向键按 n/s/e/w/u/d 序，有出口亮、无出口灭；点击仅亮键回调", () => {
    const { tree, onMove } = render();
    const exitsPart = part(tree, "room-exits");
    const buttons = tree.filter(n => n.type === "button" && isDescendant(exitsPart, n));
    expect(buttons.map(b => texts(flatten(b)))).toEqual(["北", "南", "东", "西", "上", "下"]);
    expect(buttons.map(b => !b.props.disabled)).toEqual([true, false, true, false, false, false]);
    buttons[0].props.onClick(); buttons[2].props.onClick();
    expect(onMove.mock.calls.map(c => c[0])).toEqual(["n", "e"]);
    buttons[1].props.onClick();
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it("动作按钮按 options 顺序渲染并回传 label", () => {
    const { tree, onAction } = render();
    const actionsPart = part(tree, "room-actions");
    const buttons = tree.filter(n => n.type === "button" && isDescendant(actionsPart, n));
    expect(buttons.map(b => texts(flatten(b)))).toEqual(["推开石门", "叩问老僧"]);
    buttons[1].props.onClick();
    expect(onAction).toHaveBeenCalledWith("叩问老僧");
  });

  it("自由文本：按钮与回车均回传 onText 并清空", () => {
    mockText = "推开石门";
    const { tree, onText } = render();
    const inputPart = part(tree, "room-input");
    const input = tree.find(n => n.type === "input" && isDescendant(inputPart, n));
    const send = tree.find(n => n.type === "button" && isDescendant(inputPart, n));
    input.props.onKeyDown({ key: "Enter" });
    send.props.onClick();
    expect(onText.mock.calls.map(c => c[0])).toEqual(["推开石门", "推开石门"]);
    expect(setTextSpy).toHaveBeenCalledWith("");
  });

  it("空房：全灭方向键、无动作区、无实体区", () => {
    const { tree } = render({ name: "空廊", desc: "空无一物。", exits: {} });
    const exitsPart = part(tree, "room-exits");
    const buttons = tree.filter(n => n.type === "button" && isDescendant(exitsPart, n));
    expect(buttons.every(b => b.props.disabled)).toBe(true);
    expect(part(tree, "room-actions")).toBeUndefined();
    expect(part(tree, "room-entities")).toBeUndefined();
  });

  it("runState 底栏：步数/气血/得物计数", () => {
    const { tree } = render(ROOM, { step: 7, hp: 66, loot: ["a", "b"] });
    const rs = texts(flatten(part(tree, "run-state")));
    expect(rs).toContain("第 7 步");
    expect(rs).toContain("气血 66");
    expect(rs).toContain("得物 2 件");
  });
});
