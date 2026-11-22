// 守卫：不留「谁都不引用」的导出。
// 一个导出在别的源码文件和测试里都搜不到、本文件里也只出现在定义处，就算死代码。
// 确实要留的（写好了还没接线、等产品决定的），登记在 KEEP 里并写明原因。
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = [SRC, resolve(SRC, "..", "cli")];
const EXPORT = /export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/g;

const KEEP = {};

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : listFiles(path);
    return /\.(js|jsx|mjs)$/.test(entry.name) ? [path] : [];
  });
}

it("has no export that nothing references", () => {
  const files = ROOTS.flatMap(listFiles);
  const text = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
  const unused = [];
  for (const file of files) {
    if (/\.test\./.test(file) || !file.startsWith(SRC)) continue;
    for (const [, name] of text.get(file).matchAll(EXPORT)) {
      const word = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`, "g");
      if ((text.get(file).match(word) || []).length > 1) continue;
      if (files.some((other) => other !== file && word.test(text.get(other)))) continue;
      const key = `${file.slice(SRC.length + 1)}:${name}`;
      if (!KEEP[key]) unused.push(key);
    }
  }
  expect(unused).toEqual([]);
});

it("every KEEP entry still exists", () => {
  for (const key of Object.keys(KEEP)) {
    const [file, name] = key.split(":");
    expect(readFileSync(join(SRC, file), "utf8")).toMatch(new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`));
  }
});
