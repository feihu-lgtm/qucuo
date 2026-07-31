import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// 依赖链检查器的自动化入口
// ============================================================================
// 【为什么要有这个文件】scripts/ 下那两个检查器专抓构建与测试都抓不到的断链，
// 但它们是独立脚本——不进 CI 就没人记得跑，跟不存在没多少区别。propsCheck 写完
// 之后就一直是手动跑的状态，而这几轮真正栽的几次（onImportWorld 静默短路、
// portrait 与 neigong 被白名单剥掉）它本来有机会提前报出来。
//
// 【为什么不直接加进 npm run verify】docsTree.test.js 里有一条守卫钉着「verify
// 跑的就是 CI 那两步」（vitest + pages build），往那条命令里塞东西会撞它。
// 从 vitest 里调用等效：verify 的第一步就是 vitest，于是它们照样进了 CI。
//
// 两个检查器覆盖 props 传递链的两个方向，缺一个都是半瞎：
//   propsCheck ——子组件用了作用域里没有的名字（父没传子却用）→ 运行时 ReferenceError
//   propsFlow  ——父传了子却没解构（传了没人收）→ 什么都不发生，静默失效
const run = (script) => {
  try {
    return { ok: true, out: execFileSync("node", [script], { encoding: "utf-8" }) };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") };
  }
};

describe("props 传递链的两个方向都不能断", () => {
  it("propsCheck：没有「子组件用了但没传进来」的 props", () => {
    const r = run("scripts/propsCheck.mjs");
    expect(r.ok, `\n${r.out}`).toBe(true);
  }, 30000);

  it("propsFlow：没有「父组件传了但子没解构」的 props", () => {
    const r = run("scripts/propsFlow.mjs");
    expect(r.ok, `\n${r.out}`).toBe(true);
  }, 30000);
});

// 零入度守卫：src 下不该存在「没人 import 它」的源码文件。
// ============================================================================
// 【为什么要有这条】activityLog.js / memoryWrite.js / questHarness.js /
// PresetEditor.jsx / BuildingPanel.jsx 五个死文件堆积了一个多月没人发现——
// 它们不进构建（构建只从入口可达）、vitest 也不跑（没有测试 import 它们），
// 唯一发现途径是手工对依赖图。这条守卫把「死文件」从"没人知道"变成"测试红"。
//
// 【入口白名单】main.jsx / debug-*.jsx 由各 .html 的 <script type="module">
// 直接加载，不走 import 图，天然零入度——不算死文件。
const SRC_DIR = "src";
const ENTRY_WHITELIST = new Set([
  "main.jsx",
  "debug-main.jsx",
  "debug-gamble.jsx",
  "debug-item.jsx",
]);

function walkSource(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkSource(p, out);
    else if (/\.jsx?$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

describe("src 下没有零入度的死文件", () => {
  it("import 图零入度且不在入口白名单 → 报出来", () => {
    const files = walkSource(SRC_DIR).map((f) => resolve(f));
    const rel = (f) => relative(resolve(SRC_DIR), f);

    const deps = new Map(files.map((f) => [f, new Set()]));
    for (const f of files) {
      const src = readFileSync(f, "utf-8");
      const re = /from\s+["'](\.[^"']+)["']/g;
      let m;
      while ((m = re.exec(src))) {
        let p = join(f, "..", m[1]);
        if (!/\.(js|jsx)$/.test(p)) p += ".js";
        const r = resolve(p);
        if (files.includes(r)) deps.get(f).add(r);
      }
    }

    const indeg = new Map(files.map((f) => [f, 0]));
    for (const targets of deps.values()) for (const t of targets) indeg.set(t, indeg.get(t) + 1);

    const dead = files
      .map(rel)
      .filter((f) => !ENTRY_WHITELIST.has(f))
      .filter((f) => (indeg.get(resolve(SRC_DIR, f)) || 0) === 0);

    expect(dead, `以下文件无人 import（零入度死代码），删除或接线：\n  ${dead.join("\n  ")}`).toEqual([]);
  });
});
