import { describe, expect, it } from "vitest";
import { checkLayerRedLines, checkUiStructure, collectRatchetMetrics, extractImportSpecifiers, formatStats, KNOWN_LAYER_DEBT, KNOWN_UI_STRUCTURE_CAP } from "./ratchet.mjs";

describe("extractImportSpecifiers", () => {
  it("ignores line and block comments without treating comment markers in strings as comments", () => {
    const source = [
      'const url = "https://example.test/path/*literal*/";',
      '// import("../ui/line-comment.js")',
      '/* import("../app/block-comment.js") */',
      'import "../domain/actual.js"; // import("../ui/trailing-comment.js")',
    ].join("\n");

    expect(extractImportSpecifiers(source)).toEqual(["../domain/actual.js"]);
  });

  it("counts static template-literal imports and skips interpolated specifiers", () => {
    const source = "import(`../ui/static.js`); import(`../features/${name}.js`);";

    expect(extractImportSpecifiers(source)).toEqual(["../ui/static.js"]);
  });

  it("counts every re-export form as a dependency", () => {
    // 整文件再导出（export * / export { x } from）在 import 图上是一条真实依赖边，
    // 分层越界检查不许漏。domain/memory/tally.js 就是一条 `export *`。
    const source = [
      'export * from "../features/star.js";',
      'export { a, b as c } from "../features/named.js";',
      'export * as ns from "../features/namespace.js";',
      'export { d } from \'../features/single-quote.js\';',
      "export { local };",
    ].join("\n");

    expect(extractImportSpecifiers(source)).toEqual([
      "../features/star.js",
      "../features/named.js",
      "../features/namespace.js",
      "../features/single-quote.js",
    ]);
  });

  it("counts a multiline re-export with members on their own lines", () => {
    const source = [
      "export {",
      "  first,",
      "  second,",
      '} from "../features/multiline.js";',
    ].join("\n");

    expect(extractImportSpecifiers(source)).toEqual(["../features/multiline.js"]);
  });
});

describe("checkLayerRedLines（硬红线：跨层逆向依赖 0 容忍）", () => {
  it("没有逆向依赖时通过", () => {
    expect(checkLayerRedLines({ layerViolations: {} })).toMatchObject({ ok: true, failures: [] });
  });

  it("欠账目录已清零：任何层间规则出现一条即失败（0 容忍）", () => {
    expect(Object.keys(KNOWN_LAYER_DEBT)).toHaveLength(0);
    const over = checkLayerRedLines({ layerViolations: { "app->ui": 1 } });
    expect(over.ok).toBe(false);
    expect(over.failures[0]).toContain("app->ui");
  });

  it("已清零的层间规则只要出现一条就失败（0 容忍）", () => {
    const result = checkLayerRedLines({ layerViolations: { "infra->core": 1, "domain->engine": 2 } });
    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(2);
  });
});

describe("formatStats（软指标只打印不阻断）", () => {
  it("打印全部指标行且不含通过/失败判定", () => {
    const lines = formatStats({
      layerViolations: { "app->ui": 16 },
      externalInfraImports: { app: 19 },
      distinctHexColors: 399,
      totalHexOccurrences: 1396,
      largeFiles: { "ui/x.jsx": 500 },
      mainJsGzipBytes: 1000,
      featureCtxRefCount: 199,
      mudRpgHookArgs: 304,
    });
    expect(lines.join("\n")).toContain("app->ui=16");
    expect(lines.join("\n")).toContain("distinctHexColors: 399");
    expect(lines.join("\n")).toContain("ui/x.jsx=500");
    expect(lines.join("\n")).toContain("featureCtxRefCount: 199");
    expect(lines.join("\n")).toContain("mudRpgHookArgs: 304");
  });
});

describe("checkUiStructure（前端结构统一棘轮：只减不增，降了必须同步改上限）", () => {
  const caps = { overlayFiles: 3, inlineStyles: 10 };

  it("与上限持平时通过", () => {
    expect(checkUiStructure({ overlayFiles: ["a", "b", "c"], inlineStyles: 10 }, caps)).toEqual([]);
  });

  it("超过上限即失败", () => {
    const failures = checkUiStructure({ overlayFiles: ["a", "b", "c", "d"], inlineStyles: 10 }, caps);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("超过上限 3");
  });

  it("低于上限也失败，并提示把上限改成新值", () => {
    const failures = checkUiStructure({ overlayFiles: ["a", "b", "c"], inlineStyles: 7 }, caps);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("KNOWN_UI_STRUCTURE_CAP.inlineStyles 从 10 改为 7");
  });

  it("当前仓库的五个数恰好等于登记的上限", () => {
    const { metrics } = collectRatchetMetrics();
    expect(checkUiStructure(metrics.uiStructure)).toEqual([]);
    expect(Object.keys(KNOWN_UI_STRUCTURE_CAP).sort()).toEqual(
      ["inlineStyles", "overlayFiles", "portsImporters", "rulesImporters", "zoneThemeFiles"],
    );
  });
});
