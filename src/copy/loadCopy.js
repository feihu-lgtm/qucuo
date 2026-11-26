// src/copy 单源文案加载器（同构：vite/vitest 走 import.meta.glob 编译期内联，
// 纯 node 门禁脚本走 process.getBuiltinModule 读文件——?raw 直导在 node 会崩，
// 所以统一经此函数取文案正文）。
const viteFiles =
  typeof import.meta.glob === "function"
    ? import.meta.glob("./*.txt", { eager: true, query: "?raw", import: "default" })
    : null;

export function loadCopy(name) {
  if (viteFiles) {
    const hit = viteFiles[`./${name}`];
    if (hit === undefined) throw new Error(`copy 文案缺失: ${name}`);
    return hit;
  }
  const fs = globalThis.process?.getBuiltinModule?.("node:fs");
  if (!fs) throw new Error("loadCopy: 非 vite 且非 node 环境，无法读取 " + name);
  return fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
}
