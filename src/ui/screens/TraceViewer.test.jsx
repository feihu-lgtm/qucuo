import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import TraceViewer from "./TraceViewer.jsx";
import {
  _resetReleaseMetrics,
  _setReleaseMetricsEnabledForTest,
  recordIntakeMetric,
  recordSealMetric,
} from "../../engine/ports/releaseMetrics.js";

vi.mock("../../store/gameStore.js", () => ({
  gameStore: { getState: () => ({ time: 30 }) },
  useGameStore: (selector) => selector({ time: 30 }),
  getGameEpoch: () => 0,
}));

let mockTrees = [];
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  const mocked = {
    ...actual,
    useState: (initial) => [initial, vi.fn()],
    useRef: (initial) => ({ current: initial }),
    useCallback: (fn) => fn,
    useEffect: () => {},
    useSyncExternalStore: () => ({ trees: mockTrees }),
  };
  return { ...mocked, default: mocked };
});

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

  it("displays current game day, turn, and live clock in header", () => {
    const tree = TraceViewer({ theme: {}, onClose: vi.fn(), onReport: vi.fn() });
    const text = extractText(tree).join("");
    expect(text).toContain("全流程日志");
    expect(text).toContain("第2日");
    expect(text).toContain("第30回合");
    expect(text).toContain("现实");
  });
});

describe("WO-16D PR-D2 影子对账展示", () => {
  it("shadow 节点渲染逐类目 verdict 折叠段，excluded 明示盲区", () => {
    mockTrees = [{
      id: "t1", cmd: "test", ts: 0, nodes: [{
        id: "n1", turnId: "t1", layer: "shadow", label: "影子对账", atMs: 1, kind: "shadow",
        status: "block", detail: "inv:single_only",
        verdicts: {
          inv: { verdict: "single_only", single: { add: ["羊肉"], rm: [] }, judge: { add: [], rm: [] } },
          npcs: { verdict: "excluded" },
        },
      }],
    }];
    const tree = TraceViewer({ theme: {}, onClose: vi.fn(), onReport: vi.fn() });
    // mocked-react 下自定义组件不会自动展开——找到 ShadowDetails 元素手动调用验证渲染输出
    const shadowEl = flatten(tree).find((n) => typeof n.type === "function" && n.props?.node?.verdicts);
    expect(shadowEl).toBeTruthy();
    const inner = extractText(shadowEl.type(shadowEl.props)).join(" ");
    expect(inner).toContain("影子对账");
    expect(inner).toContain("判官漏判");
    expect(inner).toContain("盲区");
    mockTrees = [];
  });

  it("无 shadow 数据时不渲染聚合块（零噪音）", () => {
    mockTrees = [];
    const tree = TraceViewer({ theme: {}, onClose: vi.fn(), onReport: vi.fn() });
    const text = extractText(tree).join(" ");
    expect(text).not.toContain("影子对账聚合");
    expect(text).not.toContain("放行指标观测");
  });
});

describe("放行指标观测与 Markdown 复制报告", () => {
  beforeEach(() => {
    _resetReleaseMetrics();
    _setReleaseMetricsEnabledForTest(false);
  });

  afterEach(() => {
    _resetReleaseMetrics();
    _setReleaseMetricsEnabledForTest(null);
    vi.unstubAllGlobals();
  });

  it("有观测样本时渲染 dev 聚合区，点击复制报告写入 Markdown 表格", async () => {
    _setReleaseMetricsEnabledForTest(true);
    recordIntakeMetric({ epoch: "0", cfg: { provider: "openai", model: "gpt-4o-mini" }, outcome: "schemaOk" });
    recordSealMetric({ epoch: "0", cfg: { provider: "openai", model: "gpt-4o" }, sealText: "{\"fills\":{}}", sealData: { fills: {} } });

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const tree = TraceViewer({ theme: {}, onClose: vi.fn(), onReport: vi.fn() });
    const text = extractText(tree).join(" ");
    expect(text).toContain("放行指标观测");
    expect(text).toContain("intake[openai/gpt-4o-mini]");
    expect(text).toContain("SEAL[openai/gpt-4o/judge]");

    const copyReportBtn = flatten(tree).find((n) => n.type === "button"
      && flatten(n.props?.children).concat([n.props?.children]).flat().includes("复制报告"));
    expect(copyReportBtn).toBeTruthy();
    await copyReportBtn.props.onClick();
    expect(writeText).toHaveBeenCalledTimes(1);
    const report = writeText.mock.calls[0][0];
    expect(report).toContain("### 2. turn.intake Schema 合格率");
    expect(report).toContain("| openai | gpt-4o-mini | 1 | 1 | 0 | 0 | 0 | 100.0% |");
    expect(report).toContain("### 3. ---SEAL--- 尾章合格率");
  });
});
