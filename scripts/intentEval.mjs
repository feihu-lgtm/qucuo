#!/usr/bin/env node
// 行动识别评测入口。默认走规则 mock（CI 无凭据可跑）；真实模型：
//   node scripts/intentEval.mjs --provider vertex --project $GCP_PROJECT --model gemini-2.5-flash --adc $GOOGLE_APPLICATION_CREDENTIALS
// 其他 OpenAI 兼容服务：--provider http --base-url https://api.deepseek.com --model deepseek-chat（密钥读 INTENT_EVAL_API_KEY）。
// 输出 <out>/intent-eval.json 与 <out>/intent-eval.md。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAiClassifier } from "../src/engine/intent/aiClassifier.js";
import { createHttpAi } from "../src/engine/ports/ai.js";
import { runEval, toMarkdown, DEFAULT_THRESHOLDS } from "./intentEval/harness.mjs";
import { createRuleMockAi } from "./intentEval/mockAi.mjs";
import { createVertexEvalAi } from "./intentEval/vertexChat.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export function parseArgs(argv, env = process.env) {
  const args = {
    provider: env.INTENT_EVAL_PROVIDER || "mock",
    project: env.GCP_PROJECT || env.GOOGLE_CLOUD_PROJECT || "",
    location: env.VERTEX_LOCATION || "global",
    model: env.INTENT_EVAL_MODEL || "",
    adc: env.GOOGLE_APPLICATION_CREDENTIALS || "",
    baseUrl: env.INTENT_EVAL_BASE_URL || "",
    fixtures: join(here, "intentEval", "fixtures.json"),
    out: env.INTENT_EVAL_OUT || ".intent-eval",
    limit: 0,
    thresholds: DEFAULT_THRESHOLDS,
    logprobs: true,
  };
  const flags = { "--provider": "provider", "--project": "project", "--location": "location", "--model": "model", "--adc": "adc", "--base-url": "baseUrl", "--fixtures": "fixtures", "--out": "out", "--limit": "limit", "--thresholds": "thresholds" };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--no-logprobs") { args.logprobs = false; continue; }
    if (!(flag in flags)) throw new Error(`未知参数：${flag}`);
    const value = argv[++i];
    if (value === undefined) throw new Error(`${flag} 缺少取值`);
    args[flags[flag]] = value;
  }
  args.limit = Number(args.limit) || 0;
  if (typeof args.thresholds === "string") args.thresholds = args.thresholds.split(",").map(Number).filter((t) => t > 0 && t <= 1);
  return args;
}

export async function createEvalAi(args, env = process.env) {
  if (args.provider === "mock") return createRuleMockAi();
  if (args.provider === "vertex") {
    return createVertexEvalAi({ adcPath: args.adc, project: args.project, location: args.location, model: args.model, logprobs: args.logprobs });
  }
  if (args.provider === "http") {
    if (!args.baseUrl || !args.model) throw new Error("http provider 需要 --base-url 与 --model");
    return createHttpAi({ baseUrl: args.baseUrl, apiKey: env.INTENT_EVAL_API_KEY || "", model: args.model });
  }
  throw new Error(`未知 provider：${args.provider}（可选 mock / vertex / http）`);
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const fixtures = JSON.parse(await readFile(args.fixtures, "utf8"));
  const ai = await createEvalAi(args);
  const classifier = createAiClassifier(ai, { model: args.provider === "http" ? args.model : undefined });
  const report = await runEval({ fixtures, classifier, thresholds: args.thresholds, limit: args.limit });
  const meta = { provider: args.provider, model: args.model || null, generatedAt: new Date().toISOString() };
  const out = resolve(args.out);
  await mkdir(out, { recursive: true });
  await writeFile(join(out, "intent-eval.json"), JSON.stringify({ meta, ...report }, null, 2));
  await writeFile(join(out, "intent-eval.md"), toMarkdown(report, meta));
  process.stdout.write(`${toMarkdown({ ...report, results: report.results }, meta).split("\n## 按语料类型")[0]}\n报告：${join(out, "intent-eval.md")}\n`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`intentEval 失败：${error.message}\n`);
    process.exitCode = 1;
  });
}
