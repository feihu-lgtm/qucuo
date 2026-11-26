// A4 CORS 预检实证：浏览器带 x-qucuo-* 自定义头的请求会触发预检，
// 必须验证代理实际放行。本脚本起本地 stub 上游 + 代理 + 无头浏览器，
// 从 http://localhost 页面源发带三头的 POST，验证预检与实请求都通、
// 且代理留底里 lane/turn/trace 三字段齐全。
//
// 用法：node scripts/sampling/verifyCors.mjs   （exit 0=通过）
import http from "node:http";
import { writeFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { chromium } from "playwright";

const TMP = `${process.env.HOME}/.sampling/cors-test`;
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
writeFileSync(`${TMP}/keyline`, "KEY=dummy-test-key-not-real");
const LOG = `${TMP}/ai_calls.jsonl`;

// 1. stub 上游：回一个最小 openai 形状
const stub = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      id: "stub-call-1",
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }));
  });
});
await new Promise((r) => stub.listen(5431, "127.0.0.1", r));

// 2. 起代理（upstream 指向 stub）
const proxy = spawn("node", ["scripts/sampling/proxy.mjs"], {
  env: {
    ...process.env,
    SAMPLING_KEYLINE: `${TMP}/keyline`,
    SAMPLING_UPSTREAM: "http://127.0.0.1:5431/v1/chat/completions",
    SAMPLING_PROXY_PORT: "5499",
    SAMPLING_PROXY_LOG: LOG,
  },
  stdio: "pipe",
});
await new Promise((r) => setTimeout(r, 1200));

// 3. 无头浏览器：从真实 http 页面源发带自定义头的 fetch
// （about:blank 是不透明源，chromium 直接拒发 fetch，不是预检问题）
const originSrv = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end("<html><body>cors-test</body></html>");
});
await new Promise((r) => originSrv.listen(5432, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5432/");
const result = await page.evaluate(async () => {
  try {
    const res = await fetch("http://127.0.0.1:5499/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-qucuo-lane": "9",
        "x-qucuo-turn": "42",
        "x-qucuo-trace": "cors-selftest",
      },
      body: JSON.stringify({ model: "test", messages: [] }),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, gotId: json?.id || null };
  } catch (e) {
    return { error: String(e?.message || e) };
  }
});
await browser.close();
originSrv.close();
proxy.kill();
stub.close();
await new Promise((r) => setTimeout(r, 400));

// 4. 校验：请求成功 + 留底三字段齐全
let pass = true;
const fails = [];
if (result.error) { pass = false; fails.push(`浏览器 fetch 失败：${result.error}`); }
else if (!result.ok) { pass = false; fails.push(`状态非 2xx：${result.status}`); }
try {
  const rec = readFileSync(LOG, "utf8").trim().split("\n").map((l) => JSON.parse(l)).find((r) => r.trace);
  if (!rec) { pass = false; fails.push("留底无 trace 归属记录"); }
  else {
    if (rec.lane !== "9") { pass = false; fails.push(`lane 归属错：${rec.lane}`); }
    if (rec.turn !== "42") { pass = false; fails.push(`turn 归属错：${rec.turn}`); }
    if (rec.trace !== "cors-selftest") { pass = false; fails.push(`trace 归属错：${rec.trace}`); }
  }
} catch (e) { pass = false; fails.push(`留底读取失败：${e.message}`); }

if (pass) {
  console.log("CORS 预检实证通过：x-qucuo-* 三头经浏览器预检放行，代理按头归属留底齐全");
  process.exit(0);
} else {
  console.error("CORS 预检实证失败：");
  for (const f of fails) console.error(`  ${f}`);
  process.exit(1);
}
