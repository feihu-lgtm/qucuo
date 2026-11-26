// src/copy 单源文案加载器（同构：vite/浏览器走 import.meta.glob 编译期内联，
// 纯 node 门禁脚本走 fs 读文件）。
// 注意：import.meta.glob 是 vite 编译期宏、运行时并不存在——绝不能用
// `typeof import.meta.glob === "function"` 探活（vite 下也是 undefined，必误判），
// 正确做法是按 node 运行时特征分流，glob 调用静态留在源码里供 vite 编译期替换。
const isNode = typeof globalThis.process?.versions?.node === "string";
const viteFiles = isNode
  ? null
  : import.meta.glob("./*.txt", { eager: true, query: "?raw", import: "default" });

export function loadCopy(name) {
  if (!isNode) {
    const hit = viteFiles[`./${name}`];
    if (hit === undefined) throw new Error(`copy 文案缺失: ${name}`);
    return hit;
  }
  const fs = globalThis.process?.getBuiltinModule?.("node:fs");
  if (!fs) throw new Error("loadCopy: 非 vite 且非 node 环境，无法读取 " + name);
  return fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
}
