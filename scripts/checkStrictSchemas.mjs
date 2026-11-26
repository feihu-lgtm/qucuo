// strict schema 静态门禁：凡会走原生结构化输出 strict 通道的 schema，
// 每一层 object 的 properties 键必须全部列入 required，且不得出现联合类型数组
// （如 type:["string","null"]）。strictCompatible:false 是显式声明不走 strict 的
// 例外（开放词条对象），门禁不覆盖也不许新增滥用。
// 用法：node scripts/checkStrictSchemas.mjs（接进 verify:fast / CI）
import { listPromptDefs } from "../src/domain/rules/prompt/registry.js";

// 动态 schema（函数形）按 id 给样例 ctx 求值后同样受检；
// 新注册动态 schema 时必须在此补样例，否则门禁直接失败（防漏检）。
const DYNAMIC_SCHEMA_SAMPLES = {
  "persuasion.turn": { persuade: { who: "测试", keys: [{ id: "k1" }, { id: "k2" }] } },
};

// 注册模块清单：凡含 definePrompt("call") 的模块都要 import 触发注册。
// 漏一个 = 漏检一批，故 ratchet 层另有 grep 比对（见文件尾 NOTE）。
const REGISTERING_MODULES = [
  "../src/engine/turn/intakeTurn.js",
  "../src/engine/ports/storyteller.js",
  "../src/engine/ports/cardScan/scanCalls.js",
  "../src/app/calls/hookCalls.js",
  "../src/domain/rules/memory/bookkeep.js",
  "../src/domain/rules/prompt/calls/domainCalls.js",
  "../src/domain/rules/prompt/calls/unifiedCalls.js",
  "../src/domain/rules/prompt/calls/sideCalls.js",
  "../src/domain/rules/prompt/calls/nemesisCalls.js",
  "../src/domain/rules/prompt/calls/prepCalls.js",
  "../src/domain/rules/prompt/calls/roamCalls.js",
];

function* walkObjects(node, path) {
  if (!node || typeof node !== "object") return;
  if (node.type === "object" && node.properties && typeof node.properties === "object") {
    yield { node, path };
  }
  for (const [key, value] of Object.entries(node.properties || {})) {
    yield* walkObjects(value, `${path}.properties.${key}`);
  }
  for (const combiner of ["anyOf", "oneOf", "allOf"]) {
    for (const [i, sub] of (node[combiner] || []).entries()) {
      yield* walkObjects(sub, `${path}.${combiner}[${i}]`);
    }
  }
  if (node.items) yield* walkObjects(node.items, `${path}.items`);
}

function* walkTypes(node, path) {
  if (!node || typeof node !== "object") return;
  yield { node, path };
  for (const [key, value] of Object.entries(node.properties || {})) {
    yield* walkTypes(value, `${path}.properties.${key}`);
  }
  for (const combiner of ["anyOf", "oneOf", "allOf"]) {
    for (const [i, sub] of (node[combiner] || []).entries()) {
      yield* walkTypes(sub, `${path}.${combiner}[${i}]`);
    }
  }
  if (node.items) yield* walkTypes(node.items, `${path}.items`);
}

export function checkSchemaStrict(id, schemaObj) {
  const violations = [];
  for (const { node, path } of walkTypes(schemaObj, "$")) {
    if (Array.isArray(node.type)) {
      violations.push(`${id} ${path}: 联合类型 type=${JSON.stringify(node.type)}（strict 门禁禁止，含 ["string","null"] 式可选）`);
    }
  }
  for (const { node, path } of walkObjects(schemaObj, "$")) {
    const keys = Object.keys(node.properties);
    const required = Array.isArray(node.required) ? node.required : [];
    const missing = keys.filter((k) => !required.includes(k));
    if (missing.length) {
      violations.push(`${id} ${path}: properties 键未全入 required：${missing.join(",")}`);
    }
  }
  return violations;
}

async function main() {
  // 交叉校验：src 里实际含 definePrompt("call" 的文件必须与 REGISTERING_MODULES 一致，
  // 否则新注册模块会绕过门禁。用 node 自带 fs 静态扫描，不依赖 ripgrep。
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const found = new Set();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { if (!name.includes("test") && name !== "node_modules") walk(full); continue; }
      if (!/\.(js|jsx)$/.test(name) || name.endsWith(".test.js")) continue;
      const src = readFileSync(full, "utf8");
      if (/definePrompt\(\s*["']call["']/.test(src)) found.add(full.replace(/\\/g, "/"));
    }
  };
  walk("src");
  const listed = new Set(REGISTERING_MODULES.map((m) => m.replace(/^\.\.\//, "")));
  const missing = [...found].filter((f) => !listed.has(f));
  const stale = [...listed].filter((f) => ![...found].some((g) => g.endsWith(f.split("/").pop())) && !found.has(f));
  if (missing.length) {
    console.error(`strict schema 门禁失败：源码新出现 definePrompt("call") 模块未登记进 REGISTERING_MODULES：\n  ✗ ${missing.join("\n  ✗ ")}`);
    process.exit(1);
  }
  void stale;
  for (const mod of REGISTERING_MODULES) {
    await import(mod);
  }
  const defs = listPromptDefs("call");
  if (!defs.length) {
    console.error("strict schema 门禁：未注册任何 call——模块清单可能失效");
    process.exit(1);
  }
  const violations = [];
  let checked = 0;
  const skipped = [];
  for (const def of defs) {
    if (!def.schema) continue;
    let resolved = def.schema;
    if (typeof def.schema === "function") {
      const sample = DYNAMIC_SCHEMA_SAMPLES[def.id];
      if (!sample) {
        violations.push(`${def.id}: 动态 schema 无门禁样例（DYNAMIC_SCHEMA_SAMPLES 漏注册）`);
        continue;
      }
      resolved = def.schema(sample);
    }
    if (resolved?.strictCompatible === false) {
      skipped.push(def.id);
      continue;
    }
    checked += 1;
    violations.push(...checkSchemaStrict(def.id, resolved?.schema || resolved));
  }
  if (violations.length) {
    console.error(`strict schema 门禁失败（${violations.length} 处）：`);
    for (const v of violations) console.error(`  ✗ ${v}`);
    process.exit(1);
  }
  console.log(`strict schema 门禁：通过（${checked} 个 schema 受检${skipped.length ? `，${skipped.length} 个 strictCompatible:false 显式豁免：${skipped.join("/")}` : ""}）`);
}

// NOTE: 新增 definePrompt("call") 模块时须同步 REGISTERING_MODULES——
// scripts/ratchet 侧有 grep 比对兜底（见 ratchet.mjs strictSchemaModules 段）。
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("strict schema 门禁执行异常：", err?.message || err);
    process.exit(1);
  });
}
