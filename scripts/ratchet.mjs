import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = resolve(REPO_ROOT, "scripts/ratchet-baseline.json");
const LAYER_ORDER = {
  ui: 0,
  app: 1,
  store: 1,
  features: 2,
  engine: 2,
  domain: 3,
  core: 3,
  utils: 3,
};
const IMPORT_SOURCE = /\b(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g;
const HEX_COLOR = /#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})(?![\da-f])/gi;

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return entry.isFile() && /\.(?:js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

function relativePath(root, path) {
  return relative(root, path).split(sep).join("/");
}

function isTestFile(path) {
  return /\.(?:test|spec)\.(?:js|jsx)$/.test(path);
}

function resolveRelativeImport(importer, specifier, srcRoot) {
  const path = resolve(dirname(importer), specifier.split(/[?#]/, 1)[0]);
  const candidates = /\.(?:js|jsx)$/.test(path)
    ? [path]
    : [path, `${path}.js`, `${path}.jsx`, resolve(path, "index.js"), resolve(path, "index.jsx")];

  return candidates.find((candidate) => {
    const rel = relative(srcRoot, candidate);
    return !rel.startsWith(`..${sep}`) && rel !== ".." && existsSync(candidate) && statSync(candidate).isFile();
  });
}

function layerFor(srcRoot, path) {
  return relativePath(srcRoot, path).split("/")[0];
}

function countLayerImports(files, srcRoot) {
  const layerViolations = {};
  const externalInfraImports = {};

  for (const importer of files) {
    const source = readFileSync(importer, "utf8");
    const importerLayer = layerFor(srcRoot, importer);
    for (const match of source.matchAll(IMPORT_SOURCE)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      const target = resolveRelativeImport(importer, specifier, srcRoot);
      if (!target || isTestFile(target)) continue;
      const targetLayer = layerFor(srcRoot, target);
      if (targetLayer === "infra" && importerLayer !== "infra") {
        externalInfraImports[importerLayer] = (externalInfraImports[importerLayer] || 0) + 1;
        continue;
      }

      const importerOrder = LAYER_ORDER[importerLayer];
      const targetOrder = LAYER_ORDER[targetLayer];
      if (importerOrder === undefined || targetOrder === undefined || importerOrder <= targetOrder) continue;
      const rule = `${importerLayer}->${targetLayer}`;
      layerViolations[rule] = (layerViolations[rule] || 0) + 1;
    }
  }

  return {
    layerViolations: Object.fromEntries(Object.entries(layerViolations).sort()),
    externalInfraImports: Object.fromEntries(Object.entries(externalInfraImports).sort()),
  };
}

function countColors(files, srcRoot) {
  const colors = new Set();
  let totalHexOccurrences = 0;

  for (const file of files) {
    if (isTestFile(file) || basename(file) === "theme.js") continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(HEX_COLOR)) {
      colors.add(match[0].toLowerCase());
      totalHexOccurrences += 1;
    }
  }

  return {
    distinctHexColors: colors.size,
    totalHexOccurrences,
  };
}

function countLines(source) {
  if (source.length === 0) return 0;
  const lines = source.split(/\r\n|\n|\r/);
  if (/\r\n$|\n$|\r$/.test(source)) lines.pop();
  return lines.length;
}

function countLargeFiles(files, srcRoot) {
  const largeFiles = {};
  for (const file of files) {
    const lines = countLines(readFileSync(file, "utf8"));
    if (lines > 400) largeFiles[relativePath(srcRoot, file)] = lines;
  }
  return Object.fromEntries(Object.entries(largeFiles).sort());
}

function findMainJsFile(distRoot) {
  const htmlPath = resolve(distRoot, "index.html");
  if (existsSync(htmlPath)) {
    const html = readFileSync(htmlPath, "utf8");
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*>/gi)]
      .map((match) => match[1].replace(/[?#].*$/, ""));
    for (const script of scripts) {
      const path = resolve(distRoot, script.replace(/^[/\\]+/, ""));
      const rel = relative(distRoot, path);
      if (!rel.startsWith(`..${sep}`) && rel !== ".." && existsSync(path) && statSync(path).isFile()) return path;
    }
  }

  const files = listFiles(distRoot).filter((path) => path.endsWith(".js"));
  const entry = files.find((path) => /(?:^|[/\\])index-[^/\\]+\.js$/.test(path));
  if (entry) return entry;
  return files.sort((a, b) => statSync(b).size - statSync(a).size)[0];
}

function readMainJsGzipBytes(distRoot) {
  if (!existsSync(distRoot)) return { value: null, note: "dist/ is missing; main JS gzip metric skipped." };
  const file = findMainJsFile(distRoot);
  if (!file) return { value: null, note: "No main JS chunk found in dist/; gzip metric skipped." };
  return { value: gzipSync(readFileSync(file)).length, note: `Gzip measured from ${relativePath(distRoot, file)}.` };
}

export function collectRatchetMetrics(repoRoot = REPO_ROOT) {
  const srcRoot = resolve(repoRoot, "src");
  const allFiles = listFiles(srcRoot);
  const sourceFiles = allFiles.filter((file) => !isTestFile(file));
  const bundle = readMainJsGzipBytes(resolve(repoRoot, "dist"));

  return {
    metrics: {
      ...countLayerImports(sourceFiles, srcRoot),
      ...countColors(sourceFiles, srcRoot),
      largeFiles: countLargeFiles(allFiles, srcRoot),
      mainJsGzipBytes: bundle.value,
    },
    notes: [bundle.note],
  };
}

function compareCount(label, before, after, failures, improvements) {
  if (typeof before !== "number" || typeof after !== "number") {
    failures.push(`${label}: expected numeric values, got ${before} -> ${after}`);
    return;
  }
  if (after > before) failures.push(`${label}: ${before} -> ${after} (+${after - before})`);
  if (after < before) improvements.push(`${label}: ${before} -> ${after} (${after - before})`);
}

function compareCountMap(label, before = {}, after = {}, failures, improvements) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of [...keys].sort()) {
    compareCount(`${label}.${key}`, before[key] || 0, after[key] || 0, failures, improvements);
  }
}

export function compareRatchetMetrics(baseline, current) {
  const failures = [];
  const improvements = [];
  const notes = [];

  compareCountMap("layerViolations", baseline.layerViolations, current.layerViolations, failures, improvements);
  compareCountMap("externalInfraImports", baseline.externalInfraImports, current.externalInfraImports, failures, improvements);
  compareCount("distinctHexColors", baseline.distinctHexColors, current.distinctHexColors, failures, improvements);
  compareCount("totalHexOccurrences", baseline.totalHexOccurrences, current.totalHexOccurrences, failures, improvements);

  const baselineFiles = baseline.largeFiles || {};
  const currentFiles = current.largeFiles || {};
  for (const [file, lines] of Object.entries(currentFiles).sort()) {
    if (baselineFiles[file] === undefined) {
      failures.push(`largeFiles.${file}: new file has ${lines} lines (limit: 400)`);
    } else if (lines > baselineFiles[file]) {
      failures.push(`largeFiles.${file}: ${baselineFiles[file]} -> ${lines} (+${lines - baselineFiles[file]} lines)`);
    } else if (lines < baselineFiles[file]) {
      improvements.push(`largeFiles.${file}: ${baselineFiles[file]} -> ${lines} (${lines - baselineFiles[file]} lines)`);
    }
  }
  for (const [file, lines] of Object.entries(baselineFiles).sort()) {
    if (currentFiles[file] === undefined) improvements.push(`largeFiles.${file}: ${lines} -> <=400 or removed`);
  }

  if (current.mainJsGzipBytes === null || current.mainJsGzipBytes === undefined) {
    notes.push("main JS gzip metric skipped because dist/ is missing or has no main chunk.");
  } else if (typeof baseline.mainJsGzipBytes !== "number") {
    notes.push("main JS gzip baseline is missing; run npm run ratchet:update after building.");
  } else {
    const allowed = baseline.mainJsGzipBytes * 1.02;
    if (current.mainJsGzipBytes > allowed) {
      failures.push(`mainJsGzipBytes: ${baseline.mainJsGzipBytes} -> ${current.mainJsGzipBytes} (+${current.mainJsGzipBytes - baseline.mainJsGzipBytes} bytes; tolerance: 2%)`);
    } else if (current.mainJsGzipBytes < baseline.mainJsGzipBytes) {
      improvements.push(`mainJsGzipBytes: ${baseline.mainJsGzipBytes} -> ${current.mainJsGzipBytes} (${current.mainJsGzipBytes - baseline.mainJsGzipBytes} bytes)`);
    }
  }

  return { ok: failures.length === 0, failures, improvements, notes };
}

function readBaseline() {
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
}

function writeBaseline(metrics) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(metrics, null, 2)}\n`);
}

function printLines(title, lines) {
  if (!lines.length) return;
  console.log(`${title}:`);
  for (const line of lines) console.log(`  - ${line}`);
}

function runRatchet() {
  const update = process.argv.includes("--update");
  const { metrics, notes } = collectRatchetMetrics();
  printLines("Note", notes);

  if (update) {
    let previous = {};
    if (existsSync(BASELINE_PATH)) previous = readBaseline();
    if (metrics.mainJsGzipBytes === null && typeof previous.mainJsGzipBytes === "number") {
      metrics.mainJsGzipBytes = previous.mainJsGzipBytes;
    }
    writeBaseline(metrics);
    console.log(`Updated ${relativePath(REPO_ROOT, BASELINE_PATH)}.`);
    return;
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error("Ratchet baseline is missing; run npm run ratchet:update.");
    process.exitCode = 1;
    return;
  }

  const result = compareRatchetMetrics(readBaseline(), metrics);
  printLines("Note", result.notes);
  printLines("Ratchet regressions", result.failures);
  if (result.improvements.length) {
    console.log("Metrics improved, run ratchet:update to record the new baseline:");
    printLines("Improvements", result.improvements);
  }
  if (!result.failures.length) console.log("Ratchet passed.");
  else process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runRatchet();
