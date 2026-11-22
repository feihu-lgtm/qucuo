// 实时打印仓库目录树（替代已删除的手写 docs/文件树.md）。
// 用法：npm run tree            —— src/ 源码树 + 顶层目录清单
//       npm run tree -- <dir>  —— 只打指定目录（如 npm run tree -- src/ui）
// 产物只进终端，不进 git。
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".git", "dist", ".devin-files"]);
const KEEP_EXT = /\.(?:js|jsx|mjs|cjs|ts|tsx|css|html|json|md|txt|sh|py|yml|yaml)$/;

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) n += countFiles(p);
    else if (entry.isFile() && KEEP_EXT.test(entry.name)) n += 1;
  }
  return n;
}

function printTree(dir, prefix = "") {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((e) => !SKIP.has(e.name) && (e.isDirectory() || KEEP_EXT.test(e.name)))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  entries.forEach((entry, i) => {
    const last = i === entries.length - 1;
    const branch = last ? "└── " : "├── ";
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      console.log(`${prefix}${branch}${entry.name}/ (${countFiles(path)})`);
      printTree(path, prefix + (last ? "    " : "│   "));
    } else {
      console.log(`${prefix}${branch}${entry.name}`);
    }
  });
}

const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const target = resolve(REPO_ROOT, arg || "src");
console.log(`${relative(REPO_ROOT, target) || "."}/ (${countFiles(target)} 个文件)`);
printTree(target);
