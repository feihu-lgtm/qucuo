import { describe, it, expect, vi, beforeEach } from "vitest";
import CharacterPage from "./CharacterPage.jsx";

let stateValues = [];
let stateIdx = 0;
let setters = [];
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  const mocked = {
    ...actual,
    useState: (initial) => {
      const idx = stateIdx++;
      if (!(idx in stateValues)) stateValues[idx] = typeof initial === "function" ? initial() : initial;
      const set = (v) => { stateValues[idx] = typeof v === "function" ? v(stateValues[idx]) : v; };
      setters[idx] = set;
      return [stateValues[idx], set];
    },
    useRef: (initial) => ({ current: initial }),
    useCallback: (fn) => fn,
  };
  return { ...mocked, default: mocked };
});

function renderTree(props) {
  const expand = (node) => {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(expand);
    if (typeof node.type === "function") return expand(node.type(node.props));
    if (!node.props?.children) return node;
    return { ...node, props: { ...node.props, children: expand(node.props.children) } };
  };
  stateIdx = 0;
  return expand(CharacterPage(props));
}

function flatten(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  return [node, ...flatten(node.props?.children)];
}

function extractText(node) {
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(extractText);
  return extractText(node.props?.children);
}

describe("WO-21A CharacterPage 心账五类展示", () => {
  beforeEach(() => {
    stateValues = [];
    setters = [];
  });

  it("按五类小签展示心账（含旧值 谊→恩 兼容、无 chunkId 旧账与未知旧类目）", () => {
    const varTree = {
      角色: {
        才旦: {
          好感度: 50,
          心账: [
            { turn: 2, kind: "谊", reason: "替他挡了一箭" },
            { id: "h2", tag: "诺", summary: "约定秋收同去茶马道", chunkId: "b1_6_1", turn: 6, place: "鱼定村" },
            { turn: 3, kind: "旧怪谈", reason: "古早条目" },
          ],
        },
      },
    };
    const props = {
      varTree,
      claimedMilestones: new Set(),
      onClaimMilestone: vi.fn(),
      onClose: vi.fn(),
      onGift: vi.fn(),
      initialSelected: "才旦",
    };
    const tree = renderTree(props);
    const text = extractText(tree).join("");
    expect(text).toContain("心账");
    expect(text).toContain("恩 1");
    expect(text).toContain("诺 1");
    expect(text).toContain("旧类 1");
    expect(text).toContain("[恩]");
    expect(text).toContain("替他挡了一箭");
    expect(text).toContain("[诺]");
    expect(text).toContain("约定秋收同去茶马道");
    expect(text).toContain("[旧怪谈]");
    expect(text).toContain("古早条目");
  });

  it("心账条目纯摘要展示：无原文点击交互，chunkId 仅作数据预留不渲染入口", () => {
    const varTree = {
      角色: {
        才旦: {
          好感度: 50,
          心账: [
            { id: "h_hit", tag: "诺", summary: "击掌约盟", chunkId: "b1_6_1", turn: 6, place: "鱼定村" },
          ],
        },
      },
    };
    const props = {
      varTree,
      claimedMilestones: new Set(),
      onClaimMilestone: vi.fn(),
      onClose: vi.fn(),
      onGift: vi.fn(),
      initialSelected: "才旦",
    };
    const tree = renderTree(props);
    const text = extractText(tree).join("");
    expect(text).toContain("击掌约盟");
    expect(text).toContain("第6回合");
    expect(text).toContain("鱼定村");
    expect(text).not.toContain("查看原文");
    const card = flatten(tree).find((n) => n.props?.["data-ledger-id"] === "h_hit");
    expect(card).toBeTruthy();
    expect(card.props.onClick).toBeUndefined();
  });
});
