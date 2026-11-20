import { describe, expect, it } from "vitest";
import { compareRatchetMetrics } from "./ratchet.mjs";

const baseline = {
  layerViolations: { "app->ui": 2 },
  externalInfraImports: { app: 3 },
  distinctHexColors: 20,
  totalHexOccurrences: 100,
  largeFiles: { "app/MudRPG.jsx": 500 },
  mainJsGzipBytes: 1000,
};

describe("compareRatchetMetrics", () => {
  it("passes when metrics are unchanged", () => {
    expect(compareRatchetMetrics(baseline, structuredClone(baseline))).toMatchObject({
      ok: true,
      failures: [],
      improvements: [],
    });
  });

  it("reports increases by metric and rule", () => {
    const result = compareRatchetMetrics(baseline, {
      ...baseline,
      layerViolations: { "app->ui": 3 },
      distinctHexColors: 21,
      totalHexOccurrences: 101,
      largeFiles: { "app/MudRPG.jsx": 501 },
      mainJsGzipBytes: 1030,
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining([
      "layerViolations.app->ui: 2 -> 3 (+1)",
      "distinctHexColors: 20 -> 21 (+1)",
      "totalHexOccurrences: 100 -> 101 (+1)",
      "largeFiles.app/MudRPG.jsx: 500 -> 501 (+1 lines)",
      expect.stringContaining("mainJsGzipBytes: 1000 -> 1030"),
    ]));
  });

  it("treats decreases as improvements without failing", () => {
    const result = compareRatchetMetrics(baseline, {
      ...baseline,
      layerViolations: {},
      externalInfraImports: { app: 2 },
      distinctHexColors: 19,
      totalHexOccurrences: 90,
      largeFiles: { "app/MudRPG.jsx": 490 },
      mainJsGzipBytes: 900,
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.improvements.length).toBeGreaterThan(0);
  });

  it("rejects a new file over 400 lines", () => {
    const result = compareRatchetMetrics(baseline, {
      ...baseline,
      largeFiles: { ...baseline.largeFiles, "features/newFile.js": 401 },
    });

    expect(result.failures).toContain("largeFiles.features/newFile.js: new file has 401 lines (limit: 400)");
  });

  it("allows the 2% bundle tolerance and rejects growth beyond it", () => {
    const withinTolerance = compareRatchetMetrics(baseline, { ...baseline, mainJsGzipBytes: 1020 });
    const aboveTolerance = compareRatchetMetrics(baseline, { ...baseline, mainJsGzipBytes: 1021 });

    expect(withinTolerance.ok).toBe(true);
    expect(aboveTolerance.failures[0]).toContain("mainJsGzipBytes: 1000 -> 1021");
  });

  it("skips bundle comparison when dist is absent", () => {
    const result = compareRatchetMetrics(baseline, { ...baseline, mainJsGzipBytes: null });

    expect(result.ok).toBe(true);
    expect(result.notes).toContain("main JS gzip metric skipped because dist/ is missing or has no main chunk.");
  });
});
