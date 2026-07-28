#!/usr/bin/env node
// JSX 属性作用域检查 —— 专抓「props 没传进来就用」这类 bug
// =============================================================================
// 【为什么需要这个】本项目已经栽过三类问题，前两类构建能抓，第三类抓不到：
//   ① version.js 写坏引号        → vite build 报错
//   ② 导出缺失（import 了不存在的名字）→ vite build 报 is not exported
//   ③ props 没传就用             → 构建完全成功，运行时才抛 ReferenceError
//
// 第三类的实例：CardImportScreen 里 ReviewPane 这个子组件的 props 解构没有
// apiCfg，但函数体内写了 <ReviewNpc apiCfg={apiCfg} />。两个文件语法都合法、
// 模块图也解析得通，于是构建绿灯上线，玩家扫描完切到审改页就白屏，
// 控制台只有一句 "apiCfg is not defined"。643 条测试也测不到——没有一条渲染
// 这个组件。
//
// 【查什么】只查一种最容易出错、也最容易判准的形态：JSX 属性值是单个标识符，
// 形如 attr={someName}。检查这个标识符能否在所属组件的作用域链里找到。
// 不做完整的 AST 分析（环境里没有 parser 依赖），靠正则收集声明；宁可漏报也
// 尽量不误报，所以对拿不准的一律放过。
//
// 用法：node scripts/propsCheck.mjs
// 退出码 0 = 没发现问题

import { readdirSync, statSync, readFileSync } from "fs";
import { join, relative } from "path";

const SRC = "src";
const files = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.jsx$/.test(n) && !n.includes(".test.")) files.push(p);
  }
})(SRC);

// JS 与浏览器的全局名字，出现这些不算问题
const GLOBALS = new Set([
  "window", "document", "console", "Math", "JSON", "Object", "Array", "String",
  "Number", "Boolean", "Date", "Promise", "Map", "Set", "WeakMap", "RegExp",
  "Error", "localStorage", "sessionStorage", "indexedDB", "fetch", "setTimeout",
  "setInterval", "clearTimeout", "clearInterval", "requestAnimationFrame",
  "structuredClone", "URL", "Blob", "FileReader", "TextDecoder", "TextEncoder",
  "React", "undefined", "null", "true", "false", "NaN", "Infinity", "atob", "btoa",
  "Uint8Array", "ArrayBuffer", "DataView", "Intl", "performance", "navigator", "alert",
]);

/** 收集一段代码里被声明的名字：const/let/var、解构、函数、参数、import */
function declaredIn(code) {
  const names = new Set();
  // 提取片段里出现的所有标识符，不锚定开头——箭头函数的嵌套括号会让捕获结果
  // 形如 "(sk, i"，锚在开头会把这一整段丢掉，于是 .map((sk, i) => …) 的参数
  // 全都收不到，报出一堆假问题。宁可多收几个名字（方向是漏报），不要误报。
  const add = (s) => { if (s) for (const m of String(s).matchAll(/[A-Za-z_$][\w$]*/g)) names.add(m[0]); };

  // import x, {a, b as c} from "..."
  for (const m of code.matchAll(/import\s+([^;]+?)\s+from\s+["']/g)) {
    add(m[1].replace(/[{}]/g, " ").replace(/\*\s+as\s+/g, " ").replace(/\bas\b/g, " "));
  }
  // const / let / var，含数组与对象解构
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*|\[[^\]]*\]|\{[^}]*\})/g)) {
    add(m[1].replace(/[[\]{}]/g, " ").replace(/:/g, " ").replace(/=[^,]*/g, " "));
  }
  // function 名 与 其参数
  for (const m of code.matchAll(/function\s*([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g)) {
    add(m[1]); add(m[2].replace(/[{}[\]]/g, " ").replace(/:/g, " ").replace(/=[^,]*/g, " "));
  }
  // 箭头函数参数：(a, b) => 与 a =>
  for (const m of code.matchAll(/\(([^)]*)\)\s*=>/g)) {
    add(m[1].replace(/[{}[\]]/g, " ").replace(/:/g, " ").replace(/=[^,]*/g, " "));
  }
  for (const m of code.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) add(m[1]);
  // catch (e)
  for (const m of code.matchAll(/catch\s*\(([^)]*)\)/g)) add(m[1]);
  return names;
}

/**
 * 找出文件里所有顶层组件/函数的起止行。
 * 只认顶层（行首无缩进）的 function 声明，这是本项目的一致写法。
 */
function topLevelFns(lines) {
  const marks = [];
  lines.forEach((l, i) => {
    const m = l.match(/^(?:export\s+default\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (m) marks.push({ name: m[1], start: i });
  });
  return marks.map((m, i) => ({
    ...m,
    end: i + 1 < marks.length ? marks[i + 1].start - 1 : lines.length - 1,
  }));
}

let problems = 0;
let checked = 0;

for (const file of files) {
  const src = readFileSync(file, "utf-8");
  const lines = src.split("\n");
  // 模块作用域只认「行首无缩进」的声明——本项目把样式常量放文件末尾是常见写法，
  // 只扫到第一个 function 之前会漏掉它们（topBtn / carArrow 就是这么被误报的）。
  // 同时因为只认顶层，组件内部（有缩进）的 props 与局部变量不会污染这一层，
  // 「props 缺口」才查得出来。
  const topLines = lines.filter(l => /^(?:export\s+)?(?:default\s+)?(?:import|const|let|var|function|class)\b/.test(l));
  // 多行 import 的续行是有缩进的，会被上面那道顶层过滤滤掉，于是
  //   import {
  //     Section, selStyle,      ← 这一行收不到
  //   } from "./ReviewParts.jsx";
  // 里的名字全部丢失。所以 import 语句要整条单独抓一遍（跨行匹配）。
  const importBlock = (src.match(/^import[\s\S]*?from\s+["'][^"']+["'];?/gm) || []).join("\n");
  const moduleScope = declaredIn(topLines.join("\n") + "\n" + importBlock);
  const fns = topLevelFns(lines);
  if (!fns.length) continue;

  for (const fn of fns) {
    const body = lines.slice(fn.start, fn.end + 1).join("\n");
    const scope = declaredIn(body);

    // JSX 属性值是单个标识符：attr={name}
    for (const m of body.matchAll(/\s([a-zA-Z_$][\w$]*)=\{\s*([A-Za-z_$][\w$]*)\s*\}/g)) {
      const ident = m[2];
      checked++;
      if (GLOBALS.has(ident)) continue;
      if (scope.has(ident) || moduleScope.has(ident)) continue;
      // 大写开头多半是组件名（as 属性传组件），放过
      if (/^[A-Z]/.test(ident)) continue;
      problems++;
      const at = fn.start + body.slice(0, m.index).split("\n").length;
      console.log(`✗ ${relative(".", file)}:${at}  组件 ${fn.name}() 内用了 ${ident}，`
        + `但它既不在该组件的 props/局部声明里，也不在模块作用域里`);
    }
  }
}

console.log(problems
  ? `\n发现 ${problems} 处（共检查 ${checked} 个 JSX 属性）`
  : `✓ ${checked} 个 JSX 属性的标识符都能在作用域里解析（${files.length} 个 jsx 文件）`);
process.exit(problems ? 1 : 0);
