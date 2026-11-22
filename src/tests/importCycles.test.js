// 守卫：src 里的相对 import 不得成环。
// 2026-11 断开了 promptRefs → fields → knowledge → buildPrompt → promptRefs（见 knowledgeRoot.js），
// 这条测试保证以后新增的环在 CI 里就被拦住，而不是等到初始化顺序出怪问题才发现。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IMPORT = /\b(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|\bimport\s*\(?\s*["']([^"']+)["']/g;

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return /\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}

function resolveImport(from, spec) {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, join(base, "index.js"), join(base, "index.jsx")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

function findImportCycles(files) {
  const graph = new Map(files.map((file) => {
    const source = stripComments(readFileSync(file, "utf8"));
    const targets = [...source.matchAll(IMPORT)]
      .map((match) => resolveImport(file, match[1] || match[2]))
      .filter(Boolean);
    return [file, [...new Set(targets)]];
  }));
  const cycles = [];
  const state = new Map();
  const stack = [];
  const visit = (node) => {
    state.set(node, "open");
    stack.push(node);
    for (const next of graph.get(node) || []) {
      if (!graph.has(next)) continue;
      if (state.get(next) === "open") {
        cycles.push(stack.slice(stack.indexOf(next)).concat(next).map((file) => file.slice(SRC.length + 1)));
      } else if (!state.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    state.set(node, "done");
  };
  for (const file of graph.keys()) if (!state.has(file)) visit(file);
  return cycles;
}

it("has no import cycles under src", () => {
  expect(findImportCycles(listFiles(SRC))).toEqual([]);
});
