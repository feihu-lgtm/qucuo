// B0：群聊尾章计量口径——有尾章/缺尾章/坏 JSON/越界名字的 passed/failed 计数。
// 测试复刻 runTurn 接线参数（parseGroupTalkSeal → recordSealMetric chain=group），
// 与 wiring 断言配合钉住真链。
import { beforeEach, describe, expect, it } from "vitest";
import { parseGroupTalkSeal } from "../../domain/rules/judge/judgeRuleBlock.js";
import {
  _resetReleaseMetrics, _setReleaseMetricsEnabledForTest, _setReleaseMetricsStorageForTest,
  recordSealMetric, releaseMetricAggregates,
} from "./releaseMetrics.js";
import { readFileSync } from "node:fs";

const cfg = { provider: "custom", model: "m1" };
const record = (sealText, present) => {
  const parsed = parseGroupTalkSeal(sealText, present);
  recordSealMetric({
    epoch: "e1", cfg, chain: "group", sealText,
    sealData: parsed.jsonOk ? parsed.data : null,
    warnings: [
      ...(parsed.validationErrors || []),
      ...(parsed.dropped.length ? [`dropped:${parsed.dropped.join("/")}`] : []),
    ],
  });
};

describe("群聊尾章计量（chain=group）", () => {
  beforeEach(() => {
    _resetReleaseMetrics();
    _setReleaseMetricsEnabledForTest(true);
    _setReleaseMetricsStorageForTest(null);
  });

  it("有尾章+JSON 可解析+无越界：passed", () => {
    record('{"respondedNpcs":["温掌柜"]}', ["温掌柜"]);
    const row = releaseMetricAggregates("e1").seal[0];
    expect(row.chain).toBe("group");
    expect(row.passed).toBe(1);
    expect(row.failed).toBe(0);
  });
  it("缺尾章：missingSeal+failed", () => {
    record("", ["温掌柜"]);
    const row = releaseMetricAggregates("e1").seal[0];
    expect(row.missingSeal).toBe(1);
    expect(row.failed).toBe(1);
  });
  it("坏 JSON：jsonFailed+failed", () => {
    record("这不是json", ["温掌柜"]);
    const row = releaseMetricAggregates("e1").seal[0];
    expect(row.withSeal).toBe(1);
    expect(row.jsonFailed).toBe(1);
    expect(row.failed).toBe(1);
  });
  it("越界名字：dropped 非空即 failed", () => {
    record('{"respondedNpcs":["不在场的人"]}', ["温掌柜"]);
    const row = releaseMetricAggregates("e1").seal[0];
    expect(row.failed).toBe(1);
    expect(row.passed).toBe(0);
  });
  it("{}：缺 respondedNpcs 键即 failed（初审修）", () => {
    record('{}', ["温掌柜"]);
    const row = releaseMetricAggregates("e1").seal[0];
    expect(row.failed).toBe(1);
    expect(row.passed).toBe(0);
  });
  it("额外键：契约外键即 failed", () => {
    record('{"respondedNpcs":["温掌柜"],"mood":"happy"}', ["温掌柜"]);
    const row = releaseMetricAggregates("e1").seal[0];
    expect(row.failed).toBe(1);
  });
  it("非数组 respondedNpcs：failed", () => {
    record('{"respondedNpcs":"温掌柜"}', ["温掌柜"]);
    const row = releaseMetricAggregates("e1").seal[0];
    expect(row.failed).toBe(1);
  });
  it("合法空数组：passed（无人接话是合法尾章）", () => {
    record('{"respondedNpcs":[]}', ["温掌柜"]);
    const row = releaseMetricAggregates("e1").seal[0];
    expect(row.passed).toBe(1);
  });

  it("接线断言：runTurn 群聊段 recordSealMetric chain=group", () => {
    const src = readFileSync(new URL("../runTurn.js", import.meta.url), "utf8");
    expect(src).toContain('chain: "group"');
  });
  it("接线断言：judgeTail recordSealMetric chain=judge", () => {
    const src = readFileSync(new URL("../turn/judgeTail.js", import.meta.url), "utf8");
    expect(src).toContain('chain: "judge"');
  });
});
