// A3 影子阶段计数与导出前收口测试
import { describe, expect, it, beforeEach, vi } from "vitest";
import { runShadowJudge, _resetShadowAggregates } from "./shadowJudge.js";
import {
  shadowStageCounts, recordShadowStage, drainShadowTasks, shadowInflightCount,
  formatStageReportLines, _resetShadowStages,
} from "./shadowStages.js";

vi.mock("../../ports/withAI.js", () => ({
  withAI: vi.fn(async () => ({ data: { actions: [] } })),
}));

const cfg = (over = {}) => ({ extractionEnabled: false, shadowJudgeEnabled: true, ...over });
const baseArgs = (over = {}) => ({
  cmd: "四下张望",
  preState: { inv: [], flags: [], varTree: {}, room: { npcs: [], name: "村口" }, turn: 5 },
  postState: { inv: [], flags: [], varTree: {}, room: { npcs: [], name: "村口" }, turn: 5 },
  deps: {}, ai: {}, apiCfg: cfg(), epoch: "t1",
  convo: [],
  ...over,
});

beforeEach(() => {
  _resetShadowAggregates();
  _resetShadowStages();
});

describe("A3 阶段计数", () => {
  it("完成的影子回合：started/intake/judge/compare 各 +1，无丢弃无出错", async () => {
    await runShadowJudge(baseArgs());
    const c = shadowStageCounts("t1");
    expect(c.shadowStarted).toBe(1);
    expect(c.intakeStarted).toBe(1);
    expect(c.intakeDone).toBe(1);
    expect(c.judgeDone).toBe(1);
    expect(c.compareDone).toBe(1);
    expect(c.droppedStale).toBe(0);
    expect(c.droppedEpoch).toBe(0);
    expect(c.errorTurns).toBe(0);
    // 恒等：完成+丢弃+出错+在途 = 开始
    expect(c.compareDone + c.droppedStale + c.droppedEpoch + c.errorTurns + shadowInflightCount()).toBe(c.shadowStarted);
  });

  it("闸门外（未启用/双调用）不计数", async () => {
    await runShadowJudge(baseArgs({ apiCfg: cfg({ shadowJudgeEnabled: false }) }));
    await runShadowJudge(baseArgs({ apiCfg: cfg({ extractionEnabled: true }) }));
    expect(shadowStageCounts("t1").shadowStarted).toBe(0);
  });

  it("纯搭话本地合成路径 intake 计完成（不调 AI）", async () => {
    await runShadowJudge(baseArgs({ isTalk: true }));
    const c = shadowStageCounts("t1");
    expect(c.intakeDone).toBe(1);
    expect(c.compareDone).toBe(1);
  });

  it("stale 中途丢弃：计 droppedStale 且终态互斥", async () => {
    let calls = 0;
    await runShadowJudge(baseArgs({ isStale: () => ++calls > 2 }));
    const c = shadowStageCounts("t1");
    expect(c.droppedStale).toBe(1);
    expect(c.compareDone).toBe(0);
    expect(c.compareDone + c.droppedStale + c.droppedEpoch + c.errorTurns + shadowInflightCount()).toBe(c.shadowStarted);
  });

  it("epochGuard 中途丢弃：计 droppedEpoch", async () => {
    let calls = 0;
    await runShadowJudge(baseArgs({ epochGuard: () => ++calls > 2 }));
    const c = shadowStageCounts("t1");
    expect(c.droppedEpoch).toBe(1);
    expect(c.compareDone).toBe(0);
  });

  it("异常不外抛且计 errorTurns + errorByStage 类型", async () => {
    const bad = baseArgs();
    bad.convo = null; // convo.slice 抛 TypeError——preState 全链可选链不抛
    const r = await runShadowJudge(bad);
    expect(r).toBe(null); // 静默，不外抛
    const c = shadowStageCounts("t1");
    expect(c.errorTurns).toBe(1);
    expect(c.errorByStage.intake?.TypeError).toBe(1);
    // 异常终态也在恒等式内
    expect(c.compareDone + c.droppedStale + c.droppedEpoch + c.errorTurns + shadowInflightCount()).toBe(c.shadowStarted);
  });
});

describe("A3 导出前收口", () => {
  it("无在途时 drain 立即返回 waited:false", async () => {
    const r = await drainShadowTasks(50);
    expect(r).toEqual({ waited: false, pending: 0 });
  });

  it("drain 等待在途结束后返回 pending:0", async () => {
    // 手工模拟在途：进出一个不同步的任务
    const { shadowTaskEnter, shadowTaskExit } = await import("./shadowStages.js");
    shadowTaskEnter();
    const p = drainShadowTasks(2000);
    setTimeout(() => shadowTaskExit(), 30);
    const r = await p;
    expect(r.waited).toBe(true);
    expect(r.pending).toBe(0);
  });

  it("超时仍未结束计 pending", async () => {
    const { shadowTaskEnter, shadowTaskExit } = await import("./shadowStages.js");
    shadowTaskEnter();
    const r = await drainShadowTasks(30);
    expect(r.pending).toBe(1);
    shadowTaskExit(); // 清理防泄漏到别的用例
  });
});

describe("A3 报告口径", () => {
  it("表头含开始/完成/丢弃/出错/在途且恒等对账", () => {
    recordShadowStage("r1", "shadowStarted");
    recordShadowStage("r1", "compareDone");
    const lines = formatStageReportLines(shadowStageCounts("r1"), 0);
    expect(lines[0]).toContain("开始 1");
    expect(lines[0]).toContain("完成 1");
    expect(lines[1]).toContain("对账平");
  });

  it("不平则报计量有洞", () => {
    recordShadowStage("r2", "shadowStarted"); // 无任何终态——在途 0 时恒等不平
    const lines = formatStageReportLines(shadowStageCounts("r2"), 0);
    expect(lines[1]).toContain("不平");
  });
});
