import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const DOC_PATH = "docs/AI调用链架构说明.md";

// CI 门禁只判断「这轮改动碰到 AI 调用链关键面时，架构活文档是否同轮更新」。
// 它不能判断设计是否真的变了；因此宁可要求补一句“无变化/仍生效”，也不让说明漂移。
const WATCHED_PATHS = [
  /^src\/engine\/ports\//,
  /^src\/engine\/turn\//,
  /^src\/engine\/runTurn\.js$/,
  /^src\/engine\/playTurn\.js$/,
  /^src\/engine\/act\//,
  /^src\/engine\/intent\//,
  /^src\/engine\/prompt\//,
  /^src\/domain\/rules\/clapboard\//,
  /^src\/domain\/rules\/effects\//,
  /^src\/domain\/rules\/judge\//,
  /^src\/domain\/rules\/prompt\//,
  /^src\/domain\/rules\/state\//,
  /^src\/infra\/apiConfig\.js$/,
  /^src\/infra\/apiSse\.js$/,
  /^src\/infra\/apiTransport\.js$/,
  /^src\/infra\/providers\.js$/,
];

const TEST_FILE = /\.test\.jsx?$/;

function runGit(args) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = { base: null, head: "HEAD" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--base") args.base = argv[i + 1];
    if (argv[i] === "--head") args.head = argv[i + 1];
  }
  return args;
}

export function isWatchedChainFile(file) {
  return !TEST_FILE.test(file) && WATCHED_PATHS.some((pattern) => pattern.test(file));
}

export function evaluateChangedFiles(files, { docExists = true } = {}) {
  const watched = files.filter(isWatchedChainFile);
  const docUpdated = files.includes(DOC_PATH) && docExists;
  return { watched, docUpdated, pass: watched.length === 0 || docUpdated };
}

function changedFiles({ base, head }) {
  if (base) return runGit(["diff", "--name-only", `${base}...${head}`]);
  if (process.env.GITHUB_BASE_REF) {
    return runGit(["diff", "--name-only", `origin/${process.env.GITHUB_BASE_REF}...${head}`]);
  }
  if (process.env.GITHUB_EVENT_NAME === "push") {
    try {
      const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
      const before = event.before && !/^0+$/.test(event.before) ? event.before : `${head}^`;
      return runGit(["diff", "--name-only", before, head]);
    } catch { return []; }
  }
  return [];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = changedFiles(args);
  const result = evaluateChangedFiles(files, { docExists: existsSync(DOC_PATH) });
  const prContext = Boolean(args.base || process.env.GITHUB_BASE_REF);
  if (!prContext && existsSync(DOC_PATH) && readFileSync(DOC_PATH, "utf8").includes("本 PR")) {
    console.error("AI 调用链文档门禁：失败");
    console.error("main/非 PR 上下文中的架构说明不得残留状态草稿「本 PR」。");
    console.error("请按 git 历史改成“已合并 #编号”；仍在开的 PR 写“待合 #编号”。");
    process.exit(1);
  }
  if (result.pass) {
    if (result.watched.length) console.log("AI 调用链文档门禁：通过（架构说明已随本轮更新）");
    else console.log("AI 调用链文档门禁：通过（本轮未触碰调用链关键文件）");
    return;
  }
  console.error("AI 调用链文档门禁：失败");
  console.error("本轮改动了调用链关键文件：");
  for (const file of result.watched) console.error(`  - ${file}`);
  console.error(`但缺少同轮更新：${DOC_PATH}`);
  console.error("请在同一 PR 至少补一行当前状态/契约变化；若确认无架构变化，也写明“本次行为不变”。");
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
