// WO-16D-4 放行指标持久化契约测试（v2 跨会话累计口径）
import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetReleaseMetrics,
  _setReleaseMetricsEnabledForTest,
  _setReleaseMetricsStorageForTest,
  recordIntakeMetric,
  recordSealMetric,
  releaseMetricsExport,
  RELEASE_METRICS_STORAGE_KEY,
} from "./releaseMetrics.js";

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    _data: data,
  };
}
const cfg = { provider: "openai", model: "gpt-x", apiKey: "sk-secret-should-never-persist" };

describe("放行指标持久化 v2", () => {
  beforeEach(() => {
    _resetReleaseMetrics();
    _setReleaseMetricsEnabledForTest(true);
    _setReleaseMetricsStorageForTest(fakeStorage());
  });

  it("跨会话累计：写穿持久层，export 直读存储+未写穿增量", () => {
    recordIntakeMetric({ epoch: "e1", cfg, outcome: "schemaOk" });
    recordIntakeMetric({ epoch: "e2", cfg, outcome: "parseFailed" });
    const exported = releaseMetricsExport();
    expect(exported.version).toBe(2);
    const row = exported.cumulative.intake[0];
    // epoch 不同也合入同一 provider::model 桶——epoch 无跨会话语义
    expect(row.calls).toBe(2);
    expect(row.schemaOk).toBe(1);
    expect(row.parseFailed).toBe(1);
    expect(row.epoch).toBeUndefined(); // 持久层无 epoch 维
  });

  it("provider/model 分桶隔离", () => {
    recordIntakeMetric({ epoch: "e1", cfg, outcome: "schemaOk" });
    recordIntakeMetric({ epoch: "e1", cfg: { provider: "vertex", model: "gemini-x" }, outcome: "validateFailed" });
    const exported = releaseMetricsExport();
    expect(exported.cumulative.intake).toHaveLength(2);
    const vertex = exported.cumulative.intake.find((r) => r.provider === "vertex");
    expect(vertex.validateFailed).toBe(1);
  });

  it("多标签不互抹：读-合-写只加自己增量（模拟另一标签已写存储）", () => {
    const storage = fakeStorage();
    _setReleaseMetricsStorageForTest(storage);
    // 另一标签的既有样本
    storage.setItem(RELEASE_METRICS_STORAGE_KEY, JSON.stringify({
      version: 2,
      cumulative: { intake: { "openai::gpt-x": { provider: "openai", model: "gpt-x", calls: 50, schemaOk: 48, parseFailed: 1, validateFailed: 1, otherFailed: 0 } }, seal: {} },
    }));
    recordIntakeMetric({ epoch: "e1", cfg, outcome: "schemaOk" });
    const persisted = JSON.parse(storage.getItem(RELEASE_METRICS_STORAGE_KEY));
    // 50 旧样本没丢，新增 1 加上
    expect(persisted.cumulative.intake["openai::gpt-x"].calls).toBe(51);
    expect(persisted.cumulative.intake["openai::gpt-x"].schemaOk).toBe(49);
  });

  it("增量不重复加：连续两次 record 后持久层精确计数", () => {
    recordIntakeMetric({ epoch: "e1", cfg, outcome: "schemaOk" });
    recordIntakeMetric({ epoch: "e1", cfg, outcome: "schemaOk" });
    recordIntakeMetric({ epoch: "e1", cfg, outcome: "parseFailed" });
    const exported = releaseMetricsExport();
    const row = exported.cumulative.intake[0];
    expect(row.calls).toBe(3);
    expect(row.schemaOk).toBe(2);
    expect(row.parseFailed).toBe(1);
  });

  it("无敏感字段：持久层 JSON 不含 apiKey/正文/地址/epoch 噪音", () => {
    recordIntakeMetric({ epoch: "e1", cfg, outcome: "schemaOk" });
    recordSealMetric({ epoch: "e1", cfg, sealText: "---SEAL---正文内容", sealData: { secret: "x" } });
    const exported = JSON.stringify(releaseMetricsExport());
    expect(exported).not.toContain("sk-secret");
    expect(exported).not.toContain("apiKey");
    expect(exported).not.toContain("SEAL---正文");
    expect(exported).not.toContain("secret");
    expect(exported).not.toContain("http");
  });

  it("生产默认零写入：未启用时 record 不落持久层", () => {
    _setReleaseMetricsEnabledForTest(false);
    recordIntakeMetric({ epoch: "e1", cfg, outcome: "schemaOk" });
    expect(releaseMetricsExport().cumulative.intake).toHaveLength(0);
  });

  it("seal 计数持久化且 shape 可脚本消费", () => {
    recordSealMetric({ epoch: "e1", cfg, sealText: "x", sealData: {}, warnings: [] });
    const exported = releaseMetricsExport();
    const row = exported.cumulative.seal[0];
    expect(row.total).toBe(1);
    expect(row.passed).toBe(1);
    expect(row.provider).toBe("openai");
  });

  it("v1 epoch shape 旧数据不混入（放弃而非失真）", () => {
    const storage = fakeStorage();
    storage.setItem(RELEASE_METRICS_STORAGE_KEY, JSON.stringify({ version: 1, epochs: { e1: { intake: { x: { provider: "openai", model: "gpt-x", calls: 99 } }, seal: {} } } }));
    _setReleaseMetricsStorageForTest(storage);
    recordIntakeMetric({ epoch: "e1", cfg, outcome: "schemaOk" });
    const exported = releaseMetricsExport();
    expect(exported.cumulative.intake[0].calls).toBe(1); // 不是 100
  });
});

describe("复审返修：写入失败增量不丢", () => {
  beforeEach(() => {
    _resetReleaseMetrics();
    _setReleaseMetricsEnabledForTest(true);
  });

  it("setItem 抛错时增量留在 ownDeltas，恢复后样本补上", () => {
    let failWrites = true;
    const data = new Map();
    const storage = {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { if (failWrites) throw new Error("quota"); data.set(k, String(v)); },
      removeItem: (k) => data.delete(k),
    };
    _setReleaseMetricsStorageForTest(storage);
    recordIntakeMetric({ epoch: "e1", cfg, outcome: "schemaOk" });
    // 写入失败但 export 仍含未写穿增量（不丢）
    expect(releaseMetricsExport().cumulative.intake[0]?.calls).toBe(1);
    // 恢复写入后再 record：两次样本都在
    failWrites = false;
    recordIntakeMetric({ epoch: "e1", cfg, outcome: "schemaOk" });
    const persisted = JSON.parse(data.get(RELEASE_METRICS_STORAGE_KEY));
    expect(persisted.cumulative.intake["openai::gpt-x"].calls).toBe(2);
    // 已写穿后 export 不双计
    expect(releaseMetricsExport().cumulative.intake[0].calls).toBe(2);
  });
});

describe("B0：chain 维度与旧样本归并", () => {
  beforeEach(() => {
    _resetReleaseMetrics();
    _setReleaseMetricsEnabledForTest(true);
  });

  it("judge/group 分桶互不稀释，持久化带 chain", () => {
    const data = new Map();
    const storage = {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k),
    };
    _setReleaseMetricsStorageForTest(storage);
    recordSealMetric({ epoch: "e1", cfg, chain: "judge", sealText: "{}", sealData: {}, warnings: [] });
    recordSealMetric({ epoch: "e1", cfg, chain: "group", sealText: "", sealData: null, warnings: [] });
    const exported = releaseMetricsExport();
    const rows = exported.cumulative.seal;
    expect(rows).toHaveLength(2);
    const judge = rows.find((r) => r.chain === "judge");
    const group = rows.find((r) => r.chain === "group");
    expect(judge.passed).toBe(1);
    expect(group.missingSeal).toBe(1);
    expect(group.failed).toBe(1);
    // 持久化 shape 带 chain
    const persisted = JSON.parse(data.get(RELEASE_METRICS_STORAGE_KEY));
    expect(Object.keys(persisted.cumulative.seal).some((k) => k.endsWith("::group"))).toBe(true);
  });

  it("旧 v2 无 chain 行读取归并 judge 不丢样本", async () => {
    const data = new Map();
    // 预植旧 shape：键无 chain 后缀、行无 chain 字段
    data.set(RELEASE_METRICS_STORAGE_KEY, JSON.stringify({
      version: 2,
      cumulative: { intake: {}, seal: { "openai::gpt-x": { provider: "openai", model: "gpt-x", total: 50, withSeal: 50, missingSeal: 0, jsonOk: 50, jsonFailed: 0, passed: 49, failed: 1 } } },
    }));
    const storage = {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k),
    };
    _setReleaseMetricsStorageForTest(storage);
    const exported = releaseMetricsExport();
    const rows = exported.cumulative.seal;
    expect(rows).toHaveLength(1);
    expect(rows[0].chain).toBe("judge");
    expect(rows[0].total).toBe(50);
    expect(rows[0].passed).toBe(49);
  });
});
