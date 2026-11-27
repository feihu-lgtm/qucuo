import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
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
      // 路线甲硬红线：features 不得反向引用 engine（与 LAYER_ORDER 同层放行的 bug 区分开）
      if (importerLayer === "features" && targetLayer === "engine") {
        const rule = "features->engine";
        layerViolations[rule] = (layerViolations[rule] || 0) + 1;
        continue;
      }
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
    const rel = relativePath(srcRoot, file);
    // 纯静态内容/数据表豁免 400 行统计，避免为了行数指标把配置表强行对半切 A/B。
    if (rel.startsWith("content/") || rel.startsWith("domain/data/")) continue;
    const lines = countLines(readFileSync(file, "utf8"));
    if (lines > 400) largeFiles[rel] = lines;
  }
  return Object.fromEntries(Object.entries(largeFiles).sort());
}

function countFeatureCtxRef(sourceFiles) {
  let count = 0;
  for (const file of sourceFiles) {
    const source = stripComments(readFileSync(file, "utf8"));
    count += (source.match(/\bfeatureCtxRef\b/g) || []).length;
  }
  return count;
}

function countTopLevelObjectProps(body) {
  let depth = 0;
  let count = 0;
  let hasToken = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === "{" || ch === "[" || ch === "(") depth += 1;
    else if (ch === "}" || ch === "]" || ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === "," && depth === 0) {
      if (hasToken) count += 1;
      hasToken = false;
      continue;
    }
    if (!/\s/.test(ch)) hasToken = true;
  }
  if (hasToken) count += 1;
  return count;
}

function countMudRpgHookArgs(srcRoot) {
  const mudPath = resolve(srcRoot, "MudRPG.jsx");
  if (!existsSync(mudPath)) return 0;
  const source = stripComments(readFileSync(mudPath, "utf8"));
  let total = 0;
  for (const match of source.matchAll(/\buse[A-Z]\w*\s*\(\s*\{/g)) {
    const open = source.indexOf("{", match.index);
    let depth = 0;
    let close = -1;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}" && --depth === 0) {
        close = i;
        break;
      }
    }
    if (close > open) total += countTopLevelObjectProps(source.slice(open + 1, close));
  }
  return total;
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

const SANCTIONED_AI_GATEWAYS = new Set([
  "engine/ports/withAI.js",
  "engine/ports/ai.js",
  "infra/apiTransport.js",
  "infra/apiDiagnostics.js",
  "debug/debugConsole.jsx",
]);
const DIRECT_AI_CALL_RE = /\b(?:callModel|callModelStream)\s*\(|\bai\.chat\s*\(/g;
const DIRECT_STATE_WRITE_RE = /\b(?:setVarTree|setVarTreeState)\s*(?:\?\.)?\(|\bgameActions\.set[A-Z]\w*\s*(?:\?\.)?\(/g;

function countDirectAiCalls(sourceFiles, srcRoot) {
  const counts = {};
  for (const file of sourceFiles) {
    const rel = relativePath(srcRoot, file);
    if (SANCTIONED_AI_GATEWAYS.has(rel)) continue;
    const source = stripComments(readFileSync(file, "utf8"));
    const matches = source.match(DIRECT_AI_CALL_RE);
    if (matches?.length) counts[rel] = matches.length;
  }
  return Object.fromEntries(Object.entries(counts).sort());
}

function countDirectStateWrites(sourceFiles, srcRoot) {
  const counts = {};
  for (const file of sourceFiles) {
    const rel = relativePath(srcRoot, file);
    const bucket = rel.startsWith("ui/")
      ? "ui"
      : rel.startsWith("app/hooks/")
        ? "app/hooks"
        : rel.startsWith("features/") && rel !== "features/run.js"
          ? "features"
          : null;
    if (!bucket) continue;
    const source = stripComments(readFileSync(file, "utf8"));
    const matches = source.match(DIRECT_STATE_WRITE_RE);
    if (matches?.length) counts[bucket] = (counts[bucket] || 0) + matches.length;
  }
  return Object.fromEntries(Object.entries(counts).sort());
}

// ── 前端结构统一（U 路线）的五项计数 ──────────────────────────────────────
// 口径：src/ 下非测试 .jsx，排除 debug/（调试入口不算界面）；全部先去注释再计数，
// 免得注释里提到 position:fixed 也被算进去。
const UI_FIXED_OVERLAY_RE = /\bposition\s*:\s*["'`]fixed["'`]/;
const UI_INLINE_STYLE_RE = /\bstyle=\{\{/g;
const UI_ZONE_THEME_RE = /\bzoneTheme\b/;

function isUiJsx(rel) {
  return rel.endsWith(".jsx") && !rel.startsWith("debug/");
}

function importsLayerPath(importer, source, srcRoot, prefix) {
  for (const specifier of extractImportSpecifiers(source)) {
    if (!specifier.startsWith(".")) continue;
    const target = resolveRelativeImport(importer, specifier, srcRoot);
    if (target && relativePath(srcRoot, target).startsWith(prefix)) return true;
  }
  return false;
}

export function countUiStructure(sourceFiles, srcRoot) {
  const overlayFiles = [];
  const rulesImporters = [];
  const portsImporters = [];
  const zoneThemeFiles = [];
  let inlineStyles = 0;

  for (const file of sourceFiles) {
    const rel = relativePath(srcRoot, file);
    if (!isUiJsx(rel)) continue;
    const raw = readFileSync(file, "utf8");
    const source = stripComments(raw);
    if (UI_FIXED_OVERLAY_RE.test(source)) overlayFiles.push(rel);
    inlineStyles += (source.match(UI_INLINE_STYLE_RE) || []).length;
    if (importsLayerPath(file, raw, srcRoot, "domain/rules/")) rulesImporters.push(rel);
    if (importsLayerPath(file, raw, srcRoot, "engine/ports/")) portsImporters.push(rel);
    if (UI_ZONE_THEME_RE.test(source)) zoneThemeFiles.push(rel);
  }

  return {
    uiStructure: {
      overlayFiles: overlayFiles.sort(),
      inlineStyles,
      rulesImporters: rulesImporters.sort(),
      portsImporters: portsImporters.sort(),
      zoneThemeFiles: zoneThemeFiles.sort(),
    },
  };
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
      actRefCurrent: countActRefCurrent(allFiles, srcRoot),
      featureCtxRefCount: countFeatureCtxRef(sourceFiles),
      mudRpgHookArgs: countMudRpgHookArgs(srcRoot),
      directAiCalls: countDirectAiCalls(sourceFiles, srcRoot),
      directStateWrites: countDirectStateWrites(sourceFiles, srcRoot),
      ...countUiStructure(sourceFiles, srcRoot),
    },
    notes: [bundle.note],
  };
}

// ── 硬红线（0 容忍或棘轮上限，违者直接 fail）────────────────────────────────
// 已清零的跨层反向依赖一律不许再出现（全库 0 容忍）。
// 其余结构性欠账（绕过 withAI 的直调、绕过 commitRound 的直写、MudRPG 参数数、
// 跨层直连 infra）以当前 main 基线封顶，只减不增。
export const KNOWN_LAYER_DEBT = {};

export const KNOWN_DIRECT_AI_CALL_DEBT = {};

export const KNOWN_STATE_WRITE_DEBT = {
  "app/hooks": 19,
  ui: 5,
};

export const KNOWN_MUD_RPG_HOOK_ARGS_CAP = 214;

export const KNOWN_EXTERNAL_INFRA_CAP = {
  app: 16,
  engine: 24,
  entry: 6,
  store: 2,
  ui: 33,
};

// 前端结构统一棘轮（路线图 U0）：五个数只许持平或下降。
// 数字降了就必须在同一个 PR 里把这里改成新值，否则同样失败——上限永远等于现状，
// 下一次回涨一处也能被抓到。
export const KNOWN_UI_STRUCTURE_CAP = {
  overlayFiles: 1,
  inlineStyles: 2063,
  rulesImporters: 73,
  portsImporters: 1,
  zoneThemeFiles: 0,
};

const UI_STRUCTURE_LABELS = {
  overlayFiles: "自建 position:fixed 浮层的 JSX 文件数",
  inlineStyles: "内联 style={{…}} 处数",
  rulesImporters: "import domain/rules 的 JSX 文件数",
  portsImporters: "import engine/ports 的 JSX 文件数",
  zoneThemeFiles: "使用 zoneTheme 的 JSX 文件数",
};

function uiStructureValue(value) {
  return Array.isArray(value) ? value.length : value;
}

export function checkUiStructure(uiStructure, caps = KNOWN_UI_STRUCTURE_CAP) {
  const failures = [];
  if (!uiStructure) return failures;
  for (const [key, cap] of Object.entries(caps)) {
    const actual = uiStructureValue(uiStructure[key]);
    if (actual === undefined) continue;
    const label = UI_STRUCTURE_LABELS[key] || key;
    if (actual > cap) {
      failures.push(`${label}: ${actual}，超过上限 ${cap}（只减不增）`);
    } else if (actual < cap) {
      failures.push(`${label}: 已降到 ${actual}，请在本 PR 把 KNOWN_UI_STRUCTURE_CAP.${key} 从 ${cap} 改为 ${actual}`);
    }
  }
  return failures;
}

// 路线甲硬红线：React ref 已赶出 engine/act，任何 .current 读写都不许回来。
// （\b 保证不误伤 currentStageIndex 这类数据字段。）
function countActRefCurrent(allFiles, srcRoot) {
  const actFiles = allFiles.filter((file) => relativePath(srcRoot, file).startsWith("engine/act/"));
  let count = 0;
  for (const file of actFiles) {
    const source = stripComments(readFileSync(file, "utf8"));
    count += (source.match(/\.current\b/g) || []).length;
  }
  return count;
}

function checkCapMap(failures, actualMap, capMap, formatUnexpected, formatExceeded) {
  for (const [key, count] of Object.entries(actualMap || {})) {
    const cap = capMap[key];
    if (cap === undefined) {
      failures.push(formatUnexpected(key, count));
    } else if (count > cap) {
      failures.push(formatExceeded(key, count, cap));
    }
  }
}

export function checkLayerRedLines(metrics) {
  const failures = [];
  if (metrics.actRefCurrent) {
    failures.push(`engine/act .current 读写: ${metrics.actRefCurrent} 处（红线 0 容忍）`);
  }
  checkCapMap(
    failures,
    metrics.layerViolations,
    KNOWN_LAYER_DEBT,
    (rule, count) => `${rule}: ${count} 条逆向依赖（红线 0 容忍）`,
    (rule, count, cap) => `${rule}: ${count} 条，超过现存欠账上限 ${cap}（只减不增）`,
  );
  checkCapMap(
    failures,
    metrics.directAiCalls,
    KNOWN_DIRECT_AI_CALL_DEBT,
    (file, count) => `绕过 withAI 的直调 [${file}]: ${count} 处（未登记新旁路，0 容忍）`,
    (file, count, cap) => `绕过 withAI 的直调 [${file}]: ${count} 处，超过存量上限 ${cap}（只减不增）`,
  );
  checkCapMap(
    failures,
    metrics.directStateWrites,
    KNOWN_STATE_WRITE_DEBT,
    (scope, count) => `绕过统一写入口 [${scope}]: ${count} 处（红线 0 容忍）`,
    (scope, count, cap) => `绕过统一写入口 [${scope}]: ${count} 处，超过存量上限 ${cap}（只减不增）`,
  );
  checkCapMap(
    failures,
    metrics.externalInfraImports,
    KNOWN_EXTERNAL_INFRA_CAP,
    (layer, count) => `跨层直连 infra [${layer}]: ${count} 处（未登记层，0 容忍）`,
    (layer, count, cap) => `跨层直连 infra [${layer}]: ${count} 处，超过存量上限 ${cap}（只减不增）`,
  );
  if ((metrics.mudRpgHookArgs ?? 0) > KNOWN_MUD_RPG_HOOK_ARGS_CAP) {
    failures.push(`MudRPG hook 参数数: ${metrics.mudRpgHookArgs}，超过存量上限 ${KNOWN_MUD_RPG_HOOK_ARGS_CAP}（只减不增）`);
  }
  failures.push(...checkUiStructure(metrics.uiStructure));
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
  pushMap("directAiCalls", metrics.directAiCalls);
  pushMap("directStateWrites", metrics.directStateWrites);
  push("distinctHexColors", metrics.distinctHexColors);
  push("totalHexOccurrences", metrics.totalHexOccurrences);
  pushMap("largeFiles", metrics.largeFiles);
  push("mainJsGzipBytes", metrics.mainJsGzipBytes ?? "n/a (dist missing)");
  push("featureCtxRefCount", metrics.featureCtxRefCount ?? 0);
  push("mudRpgHookArgs", metrics.mudRpgHookArgs ?? 0);
  for (const key of Object.keys(UI_STRUCTURE_LABELS)) {
    const value = metrics.uiStructure?.[key];
    if (value !== undefined) push(`ui.${key}`, uiStructureValue(value));
  }
  return lines;
}

function printLines(title, lines) {
  if (!lines.length) return;
  console.log(`${title}:`);
  for (const line of lines) console.log(`  - ${line}`);
}

// ── U0 Review 修：棘轮 caps 抬升拦截 ──
// 漏洞：caps 与计数同文件同 PR——加一个 inline style 同时把上限 +1 两边都过。
// 修复：与基线分支（PR 目标分支/origin/main）的 caps 逐键比对，抬升即失败；
// 合法抬升须在 scripts/ratchet-cap-exemptions.txt 登记一行豁免（评审可见的显式 artifact）。
// 新增 cap 键/新 cap 对象（基线不存在）不受限——它们本就是新登记欠账。
const CAP_OBJECT_NAMES = [
  "KNOWN_LAYER_DEBT",
  "KNOWN_DIRECT_AI_CALL_DEBT",
  "KNOWN_STATE_WRITE_DEBT",
  "KNOWN_EXTERNAL_INFRA_CAP",
  "KNOWN_UI_STRUCTURE_CAP",
];

// 候选链：RATCHET_BASE_REF（CI push 事件传 github.event.before=推送前 tip，
// 防 main 直推抬上限自比自蒙混）→ PR 目标分支 → origin/main → main。
// 每个候选都必须真实可解析，空串/全零 sha/不存在一律回落下一档。
function resolveCapsBaseRef() {
  const ghBase = process.env.GITHUB_BASE_REF;
  const candidates = [
    process.env.RATCHET_BASE_REF,
    ghBase ? `origin/${ghBase}` : null,
    "origin/main",
    "main",
  ].filter((cand) => cand && !/^0{40}$/.test(cand));
  for (const cand of candidates) {
    try {
      execSync(`git rev-parse --verify --quiet ${cand}`, { cwd: REPO_ROOT, stdio: ["ignore", "ignore", "ignore"] });
      return cand;
    } catch { /* try next */ }
  }
  return null;
}

async function loadBaseCapModule(baseRef) {
  try {
    const content = execSync(`git show ${baseRef}:scripts/ratchet.mjs`, {
      cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 8 * 1024 * 1024,
    });
    if (!content) return null;
    const dir = mkdtempSync(join(tmpdir(), "ratchet-base-"));
    const file = join(dir, "ratchet.base.mjs");
    writeFileSync(file, content);
    return await import(pathToFileURL(file).href);
  } catch {
    return null;
  }
}

// 豁免行格式「KEY=值 理由」（Review 修两条）：
// ①按值绑定——豁免只放行到登记的那个值，再往上抬需要新一行登记，
//   防止一次登记终身通行证（后续抬升对评审不可见）；
// ②理由必填——裸键/裸键=值没有评审可读的豁免缘由，一律视为无豁免。
export function loadCapExemptions() {
  const file = resolve(REPO_ROOT, "scripts/ratchet-cap-exemptions.txt");
  if (!existsSync(file)) return new Map();
  const map = new Map();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^(\S+?)=(\d+)\s+(\S.+)$/);
    if (m) map.set(m[1], { value: Number(m[2]), reason: m[3].trim() });
  }
  return map;
}

// 纯函数（测试直达）：当前 caps vs 基线 caps，抬升且无豁免的键列成 failures。
export function checkCapEscalation(baseMod, exemptions = new Map()) {
  if (!baseMod) return [];
  const failures = [];
  // 豁免只在「登记值 >= 当前抬起值」时放行——抬起超过登记值需新登记。
  const exempted = (id, val) => {
    const entry = exemptions.get(id);
    return !!entry && typeof entry.value === "number" && entry.value >= val && !!entry.reason;
  };
  const hint = (id) => `确需抬升须在 scripts/ratchet-cap-exemptions.txt 登记一行「${id}=抬起后值 理由」供评审`;
  const current = {
    KNOWN_LAYER_DEBT, KNOWN_DIRECT_AI_CALL_DEBT, KNOWN_STATE_WRITE_DEBT,
    KNOWN_EXTERNAL_INFRA_CAP, KNOWN_UI_STRUCTURE_CAP,
  };
  for (const name of CAP_OBJECT_NAMES) {
    const curObj = current[name] || {};
    const baseObj = baseMod[name] || {};
    for (const [key, val] of Object.entries(curObj)) {
      const baseVal = baseObj[key];
      if (baseVal === undefined) continue; // 新登记键不受限
      if (typeof val === "number" && typeof baseVal === "number" && val > baseVal) {
        const id = `${name}.${key}`;
        if (!exempted(id, val)) {
          failures.push(`棘轮上限抬升拦截: ${id} 从 ${baseVal} 抬到 ${val}——上限只减不增；${hint(id)}`);
        }
      }
    }
  }
  const curHook = KNOWN_MUD_RPG_HOOK_ARGS_CAP;
  const baseHook = baseMod.KNOWN_MUD_RPG_HOOK_ARGS_CAP;
  if (typeof baseHook === "number" && curHook > baseHook && !exempted("KNOWN_MUD_RPG_HOOK_ARGS_CAP", curHook)) {
    failures.push(`棘轮上限抬升拦截: KNOWN_MUD_RPG_HOOK_ARGS_CAP 从 ${baseHook} 抬到 ${curHook}——上限只减不增`);
  }
  return failures;
}

async function capEscalationFailures() {
  const baseRef = resolveCapsBaseRef();
  if (!baseRef) return { failures: [], note: "caps 基线分支不可解析（非 git 环境），抬升拦截跳过" };
  const baseMod = await loadBaseCapModule(baseRef);
  if (!baseMod) return { failures: [], note: `caps 基线 ${baseRef} 读取失败，抬升拦截跳过` };
  return { failures: checkCapEscalation(baseMod, loadCapExemptions()), note: "" };
}

async function runRatchet() {
  const { metrics, notes } = collectRatchetMetrics();

  if (process.argv.includes("--stats")) {
    for (const line of formatStats(metrics)) console.log(line);
    printLines("Note", notes);
    return;
  }

  const { failures } = checkLayerRedLines(metrics);
  const escalation = await capEscalationFailures();
  failures.push(...escalation.failures);
  if (escalation.note) console.log(`Note: ${escalation.note}`);
  printLines("Layer red-line violations", failures);
  if (!failures.length) console.log("Ratchet passed.");
  else process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runRatchet();
