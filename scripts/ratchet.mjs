import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// 分层模型：数字小在上层（可依赖下层），大在下层（不许反向依赖上层）。
// infra（存储/网络）与 content（生成数据）是最底层；entry/debug 是入口层。
// 没进这张表的层会被静默跳过（importerOrder === undefined），等于守卫有洞——
// 新目录出现时必须补进来。
const LAYER_ORDER = {
  entry: 0,
  debug: 0,
  ui: 0,
  app: 1,
  store: 1,
  features: 2,
  engine: 2,
  domain: 3,
  core: 3,
  utils: 3,
  infra: 4,
  content: 4,
};
const IMPORT_SOURCE = /\b(?:from\s*|import\s*(?:\(\s*)?)(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g;
const HEX_COLOR = /#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})(?![\da-f])/gi;

function stripComments(source) {
  let output = "";
  let quote = null;
  let escaped = false;
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      output += char;
      index += 1;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
    } else if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      output += char;
      index += 1;
    } else if (char === "/" && next === "/") {
      output += "  ";
      index += 2;
      while (index < source.length && source[index] !== "\n" && source[index] !== "\r") {
        output += " ";
        index += 1;
      }
    } else if (char === "/" && next === "*") {
      output += "  ";
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        const commentChar = source[index];
        output += commentChar === "\n" || commentChar === "\r" ? commentChar : " ";
        index += 1;
      }
      if (index < source.length) {
        output += "  ";
        index += 2;
      }
    } else {
      output += char;
      index += 1;
    }
  }

  return output;
}

export function extractImportSpecifiers(source) {
  const specifiers = [];
  for (const match of stripComments(source).matchAll(IMPORT_SOURCE)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (match[3] !== undefined && specifier.includes("${")) continue;
    specifiers.push(specifier);
  }
  return specifiers;
}

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
  const segment = relativePath(srcRoot, path).split("/")[0];
  // src 根目录下的文件（main.jsx 这类入口）没有目录层，归到入口层。
  if (/\.(?:js|jsx)$/.test(segment)) return "entry";
  return segment;
}

function countLayerImports(files, srcRoot) {
  const layerViolations = {};
  const externalInfraImports = {};

  for (const importer of files) {
    const source = readFileSync(importer, "utf8");
    const importerLayer = layerFor(srcRoot, importer);
    for (const specifier of extractImportSpecifiers(source)) {
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

// ── 硬红线（0 容忍，违者直接 fail）────────────────────────────────
// 已清零的跨层反向依赖一律不许再出现（全库 0 容忍）。
// 软指标（大文件、颜色数、externalInfraImports、gzip）一律只打印不阻断——npm run stats。
export const KNOWN_LAYER_DEBT = {};

export function checkLayerRedLines(metrics) {
  const failures = [];
  for (const [rule, count] of Object.entries(metrics.layerViolations || {})) {
    const cap = KNOWN_LAYER_DEBT[rule];
    if (cap === undefined) {
      failures.push(`${rule}: ${count} 条逆向依赖（红线 0 容忍）`);
    } else if (count > cap) {
      failures.push(`${rule}: ${count} 条，超过现存欠账上限 ${cap}（只减不增）`);
    }
  }
  return { ok: failures.length === 0, failures };
}

export function formatStats(metrics) {
  const lines = [];
  const push = (label, value) => lines.push(`${label}: ${value}`);
  const pushMap = (label, map) => {
    const entries = Object.entries(map || {});
    push(label, entries.length ? entries.map(([k, v]) => `${k}=${v}`).join(", ") : "0");
  };
  pushMap("layerViolations", metrics.layerViolations);
  pushMap("externalInfraImports", metrics.externalInfraImports);
  push("distinctHexColors", metrics.distinctHexColors);
  push("totalHexOccurrences", metrics.totalHexOccurrences);
  pushMap("largeFiles", metrics.largeFiles);
  push("mainJsGzipBytes", metrics.mainJsGzipBytes ?? "n/a (dist missing)");
  return lines;
}

function printLines(title, lines) {
  if (!lines.length) return;
  console.log(`${title}:`);
  for (const line of lines) console.log(`  - ${line}`);
}

function runRatchet() {
  const { metrics, notes } = collectRatchetMetrics();

  if (process.argv.includes("--stats")) {
    for (const line of formatStats(metrics)) console.log(line);
    printLines("Note", notes);
    return;
  }

  const { failures } = checkLayerRedLines(metrics);
  printLines("Layer red-line violations", failures);
  if (!failures.length) console.log("Ratchet passed.");
  else process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runRatchet();
