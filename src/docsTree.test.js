import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// 文件树文档的自动守卫。
// 【为什么值得写一条测试来管文档】
// 0728 全量对账发现 docs/文件树.md 漏了 52 个文件——而且不只是新加的：
// quickBattle/ 整个目录、combat/ 三个文件、TeamDuelScreen、CodexScreen、
// 全部调试与可观测组件都漏着，另有一处幽灵条目（memory-recall.js 早改名了）。
// 文档漂移是悄无声息的：没人会因为漏登记而报错，但下一个人（包括以后的我）
// 就会照着不全的树去找代码，或者重复造一个已经存在的东西——
// memory/activityLog.js 与 memory/tally.js 功能重叠，正是这么来的。
// 所以钉一条：新增源文件必须登记进文件树；文件树也不许留已删除文件的幽灵条目。

const SRC = "src";
const DOC = "docs/文件树.md";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(name)) out.push(relative(SRC, p));
  }
  return out;
}

describe("docs/文件树.md 与真实文件系统对得上", () => {
  const doc = readFileSync(DOC, "utf-8");
  const files = walk(SRC);

  it("每个源文件都登记在册", () => {
    const missing = files.filter(f => !doc.includes(f.split("/").pop()));
    expect(missing, `以下文件未登记进 ${DOC}：\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("没有幽灵条目（文档提到但已不存在的文件）", () => {
    const names = new Set(files.map(f => f.split("/").pop()));
    const ghosts = [...new Set(
      (doc.match(/[A-Za-z][A-Za-z0-9_.\-]*\.jsx?\b/g) || [])
        .filter(m => !names.has(m) && !m.startsWith("vite") && !m.startsWith("eslint")),
    )];
    expect(ghosts, `文档提到但已不存在：${ghosts.join(", ")}`).toEqual([]);
  });

  it("文档里声明的文件数与实际一致（防统计行过期）", () => {
    const m = doc.match(/(\d+)\s*个\s*js\/jsx\s*文件/);
    expect(m, "文档里应有一行声明文件总数").toBeTruthy();
    expect(Number(m[1]), `声明 ${m[1]} 个，实际 ${files.length} 个`).toBe(files.length);
  });
});

// version.js 的语法守卫。
// 【为什么需要】上一次提交我在 version.js 的中文叙述里用了未转义的英文双引号
// （写成 真在"改名单"），把字符串提前截断 → vite build 直接失败。
// 而我提交前只跑了 vitest：**那批测试没有一条会 import version.js**，
// 所以测试全绿、构建是坏的，推上去才发现。
// 这条测试补上这个缺口：只要能 import 进来、且结构合法，语法就一定是对的。
describe("version.js 语法与结构（防「测试全绿但构建坏了」）", () => {
  it("能被解析并导入", async () => {
    const m = await import("./version.js");
    expect(Array.isArray(m.VERSION_HISTORY)).toBe(true);
    expect(m.VERSION_HISTORY.length).toBeGreaterThan(0);
  });

  it("每条都有 codename / time / notes[]", async () => {
    const { VERSION_HISTORY } = await import("./version.js");
    for (const e of VERSION_HISTORY.slice(0, 20)) {
      expect(typeof e.codename).toBe("string");
      expect(typeof e.time).toBe("string");
      expect(Array.isArray(e.notes)).toBe(true);
    }
  });

  it("CURRENT_VERSION 指向最新一条", async () => {
    const { VERSION_HISTORY, CURRENT_VERSION } = await import("./version.js");
    expect(CURRENT_VERSION).toBe(VERSION_HISTORY[0]);
  });
});

// CI 与本地校验的同构守卫。
// 【为什么需要】0728 才发现仓库有 GitHub Actions（deploy.yml），而它当时**只跑
// vite build --config vite.config.pages.js、不跑 vitest**；我这边则一直只跑默认
// config 的 build + vitest。两边各有盲区，而且正好互补：
//   · version.js 写坏（未转义引号）→ 本地 vitest 全绿、CI build 失败
//   · 逻辑改坏但语法没问题        → CI 全绿、本地 vitest 才抓得到
// 现已让 CI 也跑 vitest，并加 `npm run verify` 与 CI 完全同构。
// 这条测试钉住"两边不许再分叉"——CI 改了命令，本地脚本必须跟上。
describe("CI 与 npm run verify 同构（防两边分叉各留盲区）", () => {
  it("CI 既跑测试又跑构建", () => {
    const yml = readFileSync(".github/workflows/deploy.yml", "utf-8");
    expect(yml, "CI 必须跑 vitest").toMatch(/vitest run/);
    expect(yml, "CI 必须跑 pages 配置的构建").toMatch(/vite build --config vite\.config\.pages\.js/);
  });

  it("npm run verify 跑的就是 CI 那两步", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    const v = pkg.scripts?.verify || "";
    expect(v).toMatch(/vitest run/);
    expect(v).toMatch(/vite build --config vite\.config\.pages\.js/);
  });

  it("pages 配置的 base 是子路径（否则 Pages 上白屏）", () => {
    const cfg = readFileSync("vite.config.pages.js", "utf-8");
    expect(cfg).toMatch(/base:\s*["']\/qucuo\/["']/);
  });
});

// public 资源路径守卫。
// 【为什么需要】开场两张图当初写成硬编码的 "/intro-1.webp"，在本地（base "/"）
// 完全正常，但 GitHub Pages 把站点部在 /qucuo/ 子路径下，绝对路径会解析成
// https://<user>.github.io/intro-1.webp → 404。而我给它加的 onError 兜底又把 404
// 降级成渐变底，于是表现为"图没渲染"而不是破图，更难察觉。
// 项目里其余 public 资源（stones/ portraits/ mapui/）一直都走 import.meta.env.BASE_URL，
// 只有那两张漏了。这条测试扫源码，防同类漏改再来一次。
describe("public 资源必须走 BASE_URL（防 Pages 子路径下 404）", () => {
  it("源码里没有硬编码的 public 绝对路径", () => {
    const files = walk(SRC).filter(f => !f.includes(".test."));
    const bad = [];
    for (const f of files) {
      const src = readFileSync(join(SRC, f), "utf-8");
      src.split("\n").forEach((line, i) => {
        if (line.trim().startsWith("//") || line.trim().startsWith("*")) return; // 注释里出现无妨
        // 形如 "/xxx.webp" 的字符串字面量（相对 public 根的绝对路径）
        if (/["'`]\/[A-Za-z0-9_-]+\.(webp|png|jpe?g|svg|mp3|ogg)["'`]/.test(line)) {
          bad.push(`${f}:${i + 1}  ${line.trim().slice(0, 70)}`);
        }
      });
    }
    expect(bad, `以下位置硬编码了 public 绝对路径，Pages 子路径下会 404，请改走 import.meta.env.BASE_URL：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("开场图与卷轴都走了 BASE_URL", () => {
    const src = readFileSync("src/OpeningSequence.jsx", "utf-8");
    expect(src).toMatch(/BASE\s*\+\s*"intro-1\.webp"/);
    expect(src).toMatch(/BASE\s*\+\s*"intro-2\.webp"/);
    expect(src).toMatch(/import\.meta\.env\s*&&\s*import\.meta\.env\.BASE_URL/);
  });
});

// TDZ 守卫：deps 数组不许引用后面才定义的量。
// 【为什么需要】上线后报 "Cannot access 'qn' before initialization"。根因是我给
// handleNpcSteal（3470行附近）的依赖数组加了 noteAction，而 noteAction 定义在
// 3958 行——**函数体里的调用没问题**（运行时才执行，那时早已初始化），但
// **deps 数组是在 useCallback 那一行同步求值的**，那时 noteAction 还在 TDZ 里，
// 直接抛错、整个组件挂掉。
//
// 而 npm run verify 的 442 个测试一条都没抓到：vitest 里没有任何测试真的渲染
// MudRPG（没装 testing-library），vite build 也只做语法与打包、不执行组件。
// 也就是说"测试全绿 + 构建成功"对这一类错误完全没有覆盖。
//
// 好在 TDZ 是**静态可查**的：不需要渲染，扫一遍"deps 里的标识符 vs 它的定义行号"
// 就够。这条测试补的正是这个缺口。
// （同类隐患我之前已在 handleToggleEquip 处踩过一次并手动调过顺序——
//   踩两次说明靠记性不行，得让它自动失败。）
describe("Hook deps 不许引用后面才定义的量（TDZ 守卫）", () => {
  it.each(["src/MudRPG.jsx"])("%s 里没有 TDZ 风险", (file) => {
    const lines = readFileSync(file, "utf-8").split("\n");
    const defs = new Map();
    lines.forEach((l, i) => {
      const m = /^\s*const (\w+) = (useCallback|useMemo|useRef)\(/.exec(l);
      if (m) defs.set(m[1], i);
      const m2 = /^\s*const \[(\w+), set\w+\] = useState/.exec(l);
      if (m2) defs.set(m2[1], i);
    });
    const bad = [];
    lines.forEach((l, i) => {
      const m = /^\s*\}, \[([^\]]*)\]\);/.exec(l);
      if (!m) return;
      for (const name of m[1].match(/\b[a-zA-Z_]\w*\b/g) || []) {
        if (defs.has(name) && defs.get(name) > i) {
          bad.push(`行${i + 1} 的 deps 引用了 ${name}，但它定义在行${defs.get(name) + 1}`);
        }
      }
    });
    expect(bad, `以下位置会在渲染时抛 "Cannot access X before initialization"：\n  ${bad.join("\n  ")}`).toEqual([]);
  });
});
