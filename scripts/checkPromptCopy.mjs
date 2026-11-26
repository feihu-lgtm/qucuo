#!/usr/bin/env node
// 提示词文案单源门禁（copy-gate）
//
// 背景：外部审查/设计图纸钦定的提示词与文案必须逐字入库，工人手抄易删节丢信息量。
// 根治办法：长文案只许住在 src/copy/*.txt 独立文本文件里，代码用 `?raw` 原样引入——
// 文本文件本身就是唯一来源，不存在转抄面，图纸 diff 一次即终身保真。
//
// 本门禁扫描提示词定义目录里的内联长文案（>200 字符且含大量中文的字符串/模板字面量），
// 命中即视为「应搬进 txt 的存量债务」。债务清单冻结在本文件下方 INLINE_COPY_DEBT，
// 只减不增；新增提示词文案一律进 src/copy/*.txt，否则 CI 失败。

import { readFileSync, readdirSync, statSync } from "node:fs";
import * as espree from "espree";
import { join, relative } from "node:path";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const SCAN_DIRS = ["src/domain/rules/prompt", "src/engine/prompt"];
// 目录扫描之外单独点名的文件（intake 前哨提示词是图纸钦定文案重灾区）
const EXTRA_FILES = ["src/engine/turn/intakeTurn.js"];
const MIN_LEN = 200;

// 存量债务冻结清单：文件相对路径 → 允许的内联长文案数量（只减不增）。
// 新文件不允许出现在这里——新文件写长文案请直接建 src/copy/*.txt。
const INLINE_COPY_DEBT = {
  "src/domain/rules/prompt/calls/domainCalls.js": 4,
  "src/domain/rules/prompt/calls/nemesisCalls.js": 1,
  "src/domain/rules/prompt/calls/prepCalls.js": 1,
  "src/domain/rules/prompt/calls/sideCalls.js": 2,
  "src/domain/rules/prompt/enginePrompts.js": 4,
  "src/domain/rules/prompt/injectionBlocks.js": 2,
  "src/domain/rules/prompt/inputIntent.js": 1,
  "src/domain/rules/prompt/modePrimer.js": 1,
  "src/domain/rules/prompt/mvu.js": 1,
  "src/domain/rules/prompt/presetLegacy.js": 3, // 含历史指纹存档串（死文案冻结，不参与新文案规范）
  "src/domain/rules/prompt/presetSystem.js": 2,
  "src/domain/rules/prompt/promptCatalog.js": 1,
  "src/domain/rules/prompt/sysBase.js": 2,
  "src/engine/prompt/assemblePrompt.js": 3,
  "src/engine/prompt/roundNotes.js": 1,
  "src/engine/turn/intakeTurn.js": 1,
};

function walk(dir) {
  const out = [];
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

function cjkRatio(text) {
  const cjk = (text.match(/[一-鿿]/g) || []).length;
  return text.length ? cjk / text.length : 0;
}

// 用 espree AST 精确定位字符串/模板字面量（正则配对会被逃逸反引号带歪，不可靠）
function findInlineCopy(source, rel) {
  let ast;
  try {
    ast = espree.parse(source, {
      ecmaVersion: 2022,
      sourceType: "module",
      ecmaFeatures: { jsx: true },
    });
  } catch {
    return [];
  }
  const hits = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "TemplateLiteral") {
      const body = node.quasis.map((q) => q.value.cooked ?? "").join("");
      if (body.length >= MIN_LEN && cjkRatio(body) > 0.15) hits.push(body.length);
    } else if (node.type === "Literal" && typeof node.value === "string") {
      if (node.value.length >= MIN_LEN && cjkRatio(node.value) > 0.15) hits.push(node.value.length);
    }
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child.type === "string") visit(child);
    }
  };
  visit(ast);
  return hits;
}

const failures = [];
let totalHits = 0;
const scanFiles = [];
for (const dir of SCAN_DIRS) scanFiles.push(...walk(join(REPO_ROOT, dir)));
for (const f of EXTRA_FILES) scanFiles.push(join(REPO_ROOT, f));
for (const file of scanFiles) {
  {
    const rel = relative(REPO_ROOT, file);
    const hits = findInlineCopy(readFileSync(file, "utf8"), rel);
    if (!hits.length) continue;
    totalHits += hits.length;
    const cap = INLINE_COPY_DEBT[rel];
    if (cap === undefined) {
      failures.push(
        `${rel}: 发现 ${hits.length} 段内联长文案（>${MIN_LEN} 字符），不在冻结债务清单——` +
          `新提示词文案请建 src/copy/*.txt 并用 import text from "./xxx.txt?raw" 原样引入`
      );
    } else if (hits.length > cap) {
      failures.push(`${rel}: 内联长文案 ${hits.length} 段，超过冻结上限 ${cap}（只减不增）`);
    }
  }
}

if (process.argv.includes("--stats")) {
  console.log(`内联长文案存量: ${totalHits}`);
  process.exit(0);
}

if (failures.length) {
  console.error("copy-gate 未通过：\n" + failures.map((f) => `- ${f}`).join("\n"));
  process.exit(1);
}
console.log(`copy-gate 通过（存量内联长文案 ${totalHits} 段，冻结只减不增）`);
