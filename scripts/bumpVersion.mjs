#!/usr/bin/env node
// 版本升级脚本：自 v0.3.0 起每次面向玩家的发版都必须递增语义化版本号，
// 一键同步 package.json、package-lock.json、src/utils/version-current.json
// 与 src/utils/version-history.json。
//
// 用法示例：
//   npm run version:bump -- patch --codename "修复某某问题" --note "①【修复】..." --note "验证：..."
//   npm run version:bump -- minor --codename "新增某某系统" --note "①..."
//   npm run version:bump -- v0.3.1 --codename "..."
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)$/;

/**
 * 解析语义化版本号（允许可选前导 v）。
 * @param {string} versionStr
 * @returns {{ major: number, minor: number, patch: number, raw: string }}
 */
export function parseSemver(versionStr) {
  if (typeof versionStr !== "string") {
    throw new Error(`非法版本号（非字符串）：${String(versionStr)}`);
  }
  const m = SEMVER_RE.exec(versionStr.trim());
  if (!m) {
    throw new Error(`非法版本号格式 "${versionStr}"，应为 vX.Y.Z 或 X.Y.Z`);
  }
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  return { major, minor, patch, raw: `v${major}.${minor}.${patch}` };
}

/**
 * 比较两个语义化版本号，返回 -1 / 0 / 1。
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (const key of ["major", "minor", "patch"]) {
    if (pa[key] !== pb[key]) return pa[key] > pb[key] ? 1 : -1;
  }
  return 0;
}

/**
 * 基于当前版本计算下一个版本号，返回值统一带前导 "v"。
 * @param {string} currentVersion
 * @param {"patch" | "minor" | "major" | string} [bump="patch"]
 * @returns {string}
 */
export function nextSemver(currentVersion, bump = "patch") {
  const cur = parseSemver(currentVersion);
  if (bump === "patch") return `v${cur.major}.${cur.minor}.${cur.patch + 1}`;
  if (bump === "minor") return `v${cur.major}.${cur.minor + 1}.0`;
  if (bump === "major") return `v${cur.major + 1}.0.0`;
  const explicit = parseSemver(bump);
  if (compareSemver(explicit.raw, cur.raw) <= 0) {
    throw new Error(`目标版本号 ${explicit.raw} 必须严格大于当前版本号 ${cur.raw}`);
  }
  return explicit.raw;
}

/**
 * 格式化东八区（Asia/Shanghai）时间：YYYY-MM-DD HH:MM。
 * @param {Date} [date]
 * @returns {string}
 */
export function shanghaiTime(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}`;
}

function requireOptionValue(argv, index, flag) {
  if (index + 1 >= argv.length) {
    throw new Error(`参数 ${flag} 缺少值`);
  }
  const value = argv[index + 1];
  if (value.startsWith("-")) {
    throw new Error(`参数 ${flag} 的值不能是选项 "${value}"`);
  }
  return value;
}

export function parseCliArgs(argv) {
  let bump = "patch";
  let bumpSet = false;
  let codename = "";
  let time = "";
  const notes = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--codename") {
      codename = requireOptionValue(argv, i, "--codename");
      i += 1;
    } else if (arg === "--note") {
      notes.push(requireOptionValue(argv, i, "--note"));
      i += 1;
    } else if (arg === "--time") {
      time = requireOptionValue(argv, i, "--time");
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      return { help: true };
    } else if (!arg.startsWith("-") && !bumpSet) {
      bump = arg;
      bumpSet = true;
    } else {
      throw new Error(`未知或缺少值的参数：${arg}`);
    }
  }
  return { help: false, bump, codename, time, notes };
}

function runCli() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.help || !opts.codename.trim()) {
    console.error(
      "用法：npm run version:bump -- [patch|minor|major|vX.Y.Z] --codename \"<标题>\" [--note \"<条目>\"]... [--time \"YYYY-MM-DD HH:MM\"]",
    );
    process.exit(opts.help ? 0 : 1);
  }

  const pkgPath = "package.json";
  const lockPath = "package-lock.json";
  const currentPath = "src/utils/version-current.json";
  const historyPath = "src/utils/version-history.json";

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const current = JSON.parse(readFileSync(currentPath, "utf8"));
  const history = JSON.parse(readFileSync(historyPath, "utf8"));

  const baseVersion = current.version || pkg.version;
  const nextWithV = nextSemver(baseVersion, opts.bump);
  const nextBare = nextWithV.slice(1);
  const stamp = opts.time.trim() || shanghaiTime();
  const codename = opts.codename.trim();
  const notes = opts.notes.length > 0 ? opts.notes : [codename];

  pkg.version = nextBare;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.version = nextBare;
    if (lock.packages && lock.packages[""]) {
      lock.packages[""].version = nextBare;
    }
    writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  }

  const nextCurrent = { version: nextWithV, codename, time: stamp };
  writeFileSync(currentPath, `${JSON.stringify(nextCurrent)}\n`);

  history.unshift({
    version: nextWithV,
    codename,
    time: stamp,
    notes,
  });
  writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`);

  console.log(`版本已升级：${parseSemver(baseVersion).raw} -> ${nextWithV} (${stamp})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (err) {
    console.error(`版本升级失败：${err.message}`);
    process.exit(1);
  }
}
