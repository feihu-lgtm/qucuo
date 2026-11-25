import { describe, it, expect, vi, beforeEach } from "vitest";
import CharacterPage from "./CharacterPage.jsx";

const chunkMocks = new Map();
vi.mock("../../engine/ports/recallBlock.js", () => ({
  getProseChunkById: vi.fn(async (id) => chunkMocks.get(id) || null),
}));

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

describe("WO-21A CharacterPage 心账五类展示与原文联动", () => {
  beforeEach(() => {
    stateValues = [];
    setters = [];
    chunkMocks.clear();
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

  it("点击有 chunkId 的条目优先展示原文段落，查不到时降级为摘要", async () => {
    chunkMocks.set("b1_6_1", {
      id: "b1_6_1",
      rawText: "才旦拍拍胸脯，*他心想这回可算靠得住* 与你击掌为誓。",
      publicText: "才旦拍拍胸脯，与你击掌为誓。",
    });
    const varTree = {
      角色: {
        才旦: {
          好感度: 50,
          心账: [
            { id: "h_hit", tag: "诺", summary: "击掌约盟", chunkId: "b1_6_1", turn: 6, place: "鱼定村" },
            { id: "h_miss", tag: "欠", summary: "欠一壶青稞酒", chunkId: "missing_chunk", turn: 7, place: "客栈" },
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

    const tree1 = renderTree(props);
    const nodes = flatten(tree1);
    const hitCard = nodes.find((n) => n.props?.["data-ledger-id"] === "h_hit");
    expect(hitCard).toBeTruthy();
    await hitCard.props.onClick();

    const tree2 = renderTree(props);
    const text2 = extractText(tree2).join("");
    expect(text2).toContain("与你击掌为誓");
    expect(text2).not.toContain("这回可算靠得住");

    const missCard = flatten(tree2).find((n) => n.props?.["data-ledger-id"] === "h_miss");
    await missCard.props.onClick();
    const tree3 = renderTree(props);
    expect(extractText(tree3).join("")).toContain("摘要兜底：欠一壶青稞酒");
  });
});
