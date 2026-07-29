#!/usr/bin/env node
// props 传递链检查 —— 专抓「父传了、子没收」这类**静默**断链
// =============================================================================
// 【与 propsCheck.mjs 的分工】那个查的是反方向：子组件用了作用域里不存在的标识符
// （props 没传进来就用），后果是运行时 ReferenceError、页面白屏——响亮地坏掉。
// 这个查的是：父组件明明传了某个 prop，子组件的 props 解构里却没有它。后果是
// **什么都不会发生**，没有报错、没有白屏、测试全绿。
//
// 【已经栽过的实例】
//   · onImportWorld：MudRPG 传给 GlobalOverlays → 后者 props 解构里没有它 →
//     CardImportScreen 拿不到 → finish 里 `if (world.length && onImportWorld)`
//     短路 → 世界观条目从来没入过库。整条消费链都通着，断在这一层。
//   · 同一族的还有 apiCfg（那次是反方向，propsCheck 抓到了）。
// 两个方向合起来才是完整的 props 传递链检查。
//
// 【判准与取舍】只在能确定判准时报告，宁可漏报：
//   · 子组件用 (props) 整体接收、或有 ...rest → 跳过，它收得到
//   · 调用点带 {...spread} → 跳过，静态看不出传了什么
//   · 组件名在项目里重名 → 跳过并单独列出，不猜是哪一个
//   · 非本地组件（第三方库、HTML 标签）→ 跳过
//
// 用法：node scripts/propsFlow.mjs        退出码 0 = 没发现问题

import { readdirSync, statSync, readFileSync } from "fs";
import { join, dirname, normalize } from "path";

const SRC = "src";
const files = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.jsx$/.test(n) && !n.includes(".test.")) files.push(p);
  }
})(SRC);

// React 自己吃掉的属性，不会进 props 解构
const REACT_OWN = new Set(["key", "ref", "children", "dangerouslySetInnerHTML"]);

/**
 * 从 `(` 之后的参数文本里取出 props 解构的名字。
 * 返回 null 表示「这个组件不适合检查」（用了 props 整体接收，或有 rest）。
 */
function parsePropsParam(paramText) {
  const t = paramText.trim();
  if (!t) return new Set();                       // 无参组件
  if (!t.startsWith("{")) return null;            // function C(props) —— 整体接收
  // 取第一个参数（到平衡的 } 为止）
  let depth = 0, end = -1;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "{") depth++;
    else if (t[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  const inner = t.slice(1, end);
  if (inner.includes("...")) return null;         // 有 rest，收得到任何东西
  const names = new Set();
  // 逐个顶层逗号切分：嵌套解构与默认值里的逗号不算
  let d = 0, cur = "";
  const parts = [];
  for (const ch of inner) {
    if ("{[(".includes(ch)) d++;
    else if ("}])".includes(ch)) d--;
    if (ch === "," && d === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    // a / a = 1 / a: b / "a-b": c
    const m = s.match(/^["']?([A-Za-z_$][\w$]*)["']?\s*(?::|=|$)/);
    if (m) names.add(m[1]);
  }
  return names;
}

/** 建组件索引：名字 → [{ file, props|null }]，以及 file → (name → props) */
const index = new Map();
const byFile = new Map();
const add = (name, file, props) => {
  if (!index.has(name)) index.set(name, []);
  index.get(name).push({ file, props });
  if (!byFile.has(file)) byFile.set(file, new Map());
  byFile.get(file).set(name, props);
};

for (const f of files) {
  const code = readFileSync(f, "utf-8");
  // function Name(...) / export default function Name(...)
  for (const m of code.matchAll(/(?:export\s+default\s+)?function\s+([A-Z][\w$]*)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    let depth = 0, end = -1;
    for (let i = open; i < code.length; i++) {
      if (code[i] === "(") depth++;
      else if (code[i] === ")") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end > 0) add(m[1], f, parsePropsParam(code.slice(open + 1, end)));
  }
  // const Name = ({...}) => / const Name = (props) =>
  for (const m of code.matchAll(/(?:const|let)\s+([A-Z][\w$]*)\s*=\s*(?:React\.memo\()?\(/g)) {
    const open = m.index + m[0].length - 1;
    let depth = 0, end = -1;
    for (let i = open; i < code.length; i++) {
      if (code[i] === "(") depth++;
      else if (code[i] === ")") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end > 0 && /^\s*=>/.test(code.slice(end + 1))) {
      add(m[1], f, parsePropsParam(code.slice(open + 1, end)));
    }
  }
}

/** 扫出一个 JSX 开标签的完整文本（处理字符串、嵌套花括号里的 >） */
function readTag(code, start) {
  let i = start, depth = 0, quote = null;
  for (; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return code.slice(start, i + 1);
  }
  return null;
}

/** 从开标签里取属性名；返回 null 表示含展开、放弃这个调用点 */
function attrsOf(tag) {
  const body = tag.replace(/^<[A-Za-z][\w$.]*/, "").replace(/\/?>$/, "");
  if (/\{\s*\.\.\./.test(body)) return null;
  const names = new Set();
  // attr={...} / attr="..." / attr
  let i = 0, depth = 0, quote = null, token = "";
  const flushIfAttr = () => {
    const m = token.match(/([A-Za-z_$][\w$-]*)\s*=$/);
    if (m) names.add(m[1]);
    token = "";
  };
  for (; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (depth > 0) {
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      continue;
    }
    if (c === "{") { flushIfAttr(); depth++; continue; }
    if (c === '"' || c === "'") { flushIfAttr(); quote = c; continue; }
    if (/\s/.test(c)) {
      // 布尔简写属性：形如 <C disabled />
      const bare = token.trim().match(/^([A-Za-z_$][\w$-]*)$/);
      if (bare) names.add(bare[1]);
      token = "";
      continue;
    }
    token += c;
  }
  const bare = token.trim().match(/^([A-Za-z_$][\w$-]*)$/);
  if (bare) names.add(bare[1]);
  return names;
}

/**
 * 解析一个文件的 import，得出「这个文件里出现的组件名，定义在哪个文件」。
 * 【为什么需要】Bar / Btn / MoveButton / Bench 这四个名字在项目里各有两处定义。
 * 只按名字查会撞上重名而不得不跳过——而 Bar 与 Btn 恰好是最高频的两个共用零件，
 * 跳过它们等于这个检查在半数界面上是瞎的。按 import 路径定位就没有这个问题。
 */
function localScope(file, code) {
  const map = new Map();
  // 同文件定义的优先级最高
  for (const [n, p] of (byFile.get(file) || new Map())) map.set(n, { file, props: p });
  // import { A, B as C } from "./x.jsx"
  for (const m of code.matchAll(/import\s+([^;]+?)\s+from\s+["']([^"']+)["']/g)) {
    const spec = m[1], raw = m[2];
    if (!raw.startsWith(".")) continue;                 // 第三方，不管
    const base = dirname(file);
    const cands = [raw, raw + ".jsx", raw + ".js", raw + "/index.jsx"];
    let target = null;
    for (const c of cands) {
      const abs = normalize(join(base, c));
      if (byFile.has(abs)) { target = abs; break; }
    }
    if (!target) continue;
    // 具名导入
    const braced = spec.match(/\{([^}]*)\}/);
    if (braced) {
      for (const part of braced[1].split(",")) {
        const t = part.trim();
        if (!t) continue;
        const mm = t.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (!mm) continue;
        const orig = mm[1], local = mm[2] || mm[1];
        if (!/^[A-Z]/.test(local)) continue;
        const props = byFile.get(target)?.get(orig);
        if (props !== undefined) map.set(local, { file: target, props });
      }
    }
    // 默认导入：default 导出的组件名可能与本地名不同，按目标文件里的 export default 找
    const def = spec.replace(/\{[^}]*\}/g, "").replace(/,/g, " ").trim().split(/\s+/)[0];
    if (def && /^[A-Z]/.test(def)) {
      const tcode = readFileSync(target, "utf-8");
      const dm = tcode.match(/export\s+default\s+function\s+([A-Z][\w$]*)/);
      if (dm) {
        const props = byFile.get(target)?.get(dm[1]);
        if (props !== undefined) map.set(def, { file: target, props });
      }
    }
  }
  return map;
}

const problems = [];
const ambiguous = new Set();

for (const f of files) {
  const code = readFileSync(f, "utf-8");
  const scope = localScope(f, code);
  for (const m of code.matchAll(/<([A-Z][\w$]*)[\s/>]/g)) {
    const name = m[1];
    let def = scope.get(name);
    if (!def) {
      const defs = index.get(name);
      if (!defs) continue;                        // 第三方或未找到定义
      if (defs.length > 1) { ambiguous.add(name); continue; }
      def = defs[0];
    }
    if (def.props === null) continue;             // props 整体接收或有 rest
    const tag = readTag(code, m.index);
    if (!tag) continue;
    const attrs = attrsOf(tag);
    if (attrs === null) continue;                 // 含 {...spread}
    const line = code.slice(0, m.index).split("\n").length;
    for (const a of attrs) {
      if (REACT_OWN.has(a)) continue;
      if (!def.props.has(a)) {
        problems.push({ from: f, line, comp: name, prop: a, defFile: def.file });
      }
    }
  }
}

if (ambiguous.size) {
  console.log(`（跳过 ${ambiguous.size} 个重名组件，不猜是哪一个：${[...ambiguous].join(", ")}）`);
}

if (!problems.length) {
  const checkable = [...index.values()].flat().filter(d => d.props !== null).length;
  console.log(`✓ 没有「父传了、子没收」的 props（检查了 ${checkable} 个组件定义 / ${files.length} 个 jsx 文件）`);
  process.exit(0);
}

console.log(`✗ 发现 ${problems.length} 处 props 传了但子组件没有解构（会静默失效，不报错）：\n`);
for (const p of problems) {
  console.log(`  ${p.from}:${p.line}`);
  console.log(`    <${p.comp} ${p.prop}={…} />  但 ${p.defFile} 里 ${p.comp} 的 props 没有 ${p.prop}\n`);
}
process.exit(1);
