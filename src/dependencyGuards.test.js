import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

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
