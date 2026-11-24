import { expect, it } from "vitest";
import { ESLint } from "eslint";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  KNOWN_DIRECT_AI_CALL_DEBT,
  KNOWN_EXTERNAL_INFRA_CAP,
  KNOWN_MUD_RPG_HOOK_ARGS_CAP,
  KNOWN_STATE_WRITE_DEBT,
  checkLayerRedLines,
  collectRatchetMetrics,
} from "../scripts/ratchet.mjs";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)));
const infraDir = resolve(srcDir, "infra");
const engineDir = resolve(srcDir, "engine");
const featuresDir = resolve(srcDir, "features");
const promptDir = resolve(engineDir, "prompt");

function listJavaScriptFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  });
}

it("keeps React and non-vanilla Zustand imports out of infra, engine, and feature modules", () => {
  const violations = [infraDir, engineDir, featuresDir].flatMap((dir) =>
    listJavaScriptFiles(dir).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const imports = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]);
      return imports
        .filter((specifier) => specifier === "react" || (specifier.startsWith("zustand") && specifier !== "zustand/vanilla"))
        .map((specifier) => `${relative(dir, file)}: ${specifier}`);
    }),
  );

  expect(violations).toEqual([]);
});

it("keeps React and browser globals out of feature modules", () => {
  const violations = listJavaScriptFiles(featuresDir).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const imports = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]);
    const forbiddenImports = imports
      .filter((specifier) => specifier === "react" || specifier === "react-dom")
      .map((specifier) => `${relative(featuresDir, file)}: ${specifier}`);
    const browserGlobals = [...source.matchAll(/\b(window|document|localStorage)\b/g)]
      .map((match) => `${relative(featuresDir, file)}: ${match[1]}`);
    return [...forbiddenImports, ...browserGlobals];
  });

  expect(violations).toEqual([]);
});

it("keeps the UI overlay store out of infra, engine, and feature modules", () => {
  const violations = [infraDir, engineDir, featuresDir].flatMap((dir) =>
    listJavaScriptFiles(dir).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const imports = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]);
      return imports
        .filter((specifier) => specifier.includes("uiStore"))
        .map((specifier) => `${relative(dir, file)}: ${specifier}`);
    }),
  );

  expect(violations).toEqual([]);
});

it("keeps prompt builders free of UI imports and nondeterministic globals", () => {
  const violations = listJavaScriptFiles(promptDir)
    .filter((file) => !file.endsWith(".test.js"))
    .flatMap((file) => {
      const source = readFileSync(file, "utf8").replace(/\/\/[^\n]*/g, "");
      const forbidden = /\b(?:window|document|localStorage|fetch|Date)\b|Math\.random|from\s*["'](?:react|react-dom|[^"']*uiStore)/g;
      return [...source.matchAll(forbidden)].map((match) => `${relative(promptDir, file)}: ${match[0]}`);
    });
  expect(violations).toEqual([]);
});

// 跨层红线（0 容忍）——与 `npm run ratchet` 同一份实现，scan 逻辑在 scripts/ratchet.mjs。
// 已清零的逆向依赖一律不许再出现；`app->ui` 现存 16 条欠账写死上限、只减不增。
// 软指标（大文件/颜色/infra 引用数/gzip）不在这里管，`npm run stats` 按需看。
it("keeps cross-layer reverse dependencies at zero (KNOWN_LAYER_DEBT cap only)", () => {
  const { metrics } = collectRatchetMetrics();
  expect(checkLayerRedLines(metrics).failures).toEqual([]);
});

it("rejects increases over ratchet caps for AI calls, state writes, infra imports, and MudRPG hook args", () => {
  const base = {
    actRefCurrent: 0,
    layerViolations: {},
    directAiCalls: { ...KNOWN_DIRECT_AI_CALL_DEBT },
    directStateWrites: { ...KNOWN_STATE_WRITE_DEBT },
    externalInfraImports: { ...KNOWN_EXTERNAL_INFRA_CAP },
    mudRpgHookArgs: KNOWN_MUD_RPG_HOOK_ARGS_CAP,
  };
  expect(checkLayerRedLines(base).ok).toBe(true);

  const newAiCaller = checkLayerRedLines({
    ...base,
    directAiCalls: { ...base.directAiCalls, "ui/NewWidget.jsx": 1 },
  });
  expect(newAiCaller.ok).toBe(false);
  expect(newAiCaller.failures[0]).toContain("ui/NewWidget.jsx");

  const aiIncrease = checkLayerRedLines({
    ...base,
    directAiCalls: { ...base.directAiCalls, "engine/act/actCall.js": KNOWN_DIRECT_AI_CALL_DEBT["engine/act/actCall.js"] + 1 },
  });
  expect(aiIncrease.ok).toBe(false);

  const featureWrite = checkLayerRedLines({
    ...base,
    directStateWrites: { ...base.directStateWrites, features: 1 },
  });
  expect(featureWrite.ok).toBe(false);
  expect(featureWrite.failures[0]).toContain("features");

  const uiWriteIncrease = checkLayerRedLines({
    ...base,
    directStateWrites: { ...base.directStateWrites, ui: KNOWN_STATE_WRITE_DEBT.ui + 1 },
  });
  expect(uiWriteIncrease.ok).toBe(false);

  const infraIncrease = checkLayerRedLines({
    ...base,
    externalInfraImports: { ...base.externalInfraImports, ui: KNOWN_EXTERNAL_INFRA_CAP.ui + 1 },
  });
  expect(infraIncrease.ok).toBe(false);

  const hookArgsIncrease = checkLayerRedLines({
    ...base,
    mudRpgHookArgs: KNOWN_MUD_RPG_HOOK_ARGS_CAP + 1,
  });
  expect(hookArgsIncrease.ok).toBe(false);
});

it("blocks UI modules from importing callModel or callModelStream via any facade", async () => {
  const eslint = new ESLint({ cwd: resolve(srcDir, "..") });
  for (const snippet of [
    'import { callModel } from "../../infra/apiConfig.js";\nexport default callModel;',
    'import { callModelStream } from "../../infra/apiDiagnostics.js";\nexport default callModelStream;',
    'import { callModel } from "../../../engine/ports/ai.js";\nexport default callModel;',
  ]) {
    const [result] = await eslint.lintText(snippet, {
      filePath: resolve(srcDir, "ui/screens/FakeScreen.jsx"),
    });
    expect(result.messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  }
});
