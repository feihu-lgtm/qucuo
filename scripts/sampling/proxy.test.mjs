import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// A4 必修：SSE 代理集成桩——证明流式响应透传、usage 提取、归属头留底、不写 502。
const dir = mkdtempSync(join(tmpdir(), "a4proxy-"));
const LOG = join(dir, "ai_calls.jsonl");
const PORT = 5971;
const STUB_PORT = 5972;
let proxy, stub;

function sseBody() {
  return [
    'data: {"choices":[{"delta":{"content":"正文一"}}]}',
    'data: {"choices":[{"delta":{"content":"二段"}}]}',
    'data: {"usage":{"prompt_tokens":10,"completion_tokens":20,"completion_tokens_details":{"reasoning_tokens":5}}}',
    "data: [DONE]",
    "",
  ].join("\n");
}

beforeAll(async () => {
  writeFileSync(join(dir, "keyline"), "KEY=dummy-not-real");
  stub = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      if (body.stream) {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(sseBody());
      } else {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ id: "x1", choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: 1, completion_tokens_details: { reasoning_tokens: 0 } } }));
      }
    });
  });
  await new Promise((r) => stub.listen(STUB_PORT, "127.0.0.1", r));
  const TOKEN = join(dir, "proxy.token");
  proxy = spawn("node", ["scripts/sampling/proxy.mjs"], {
    env: {
      ...process.env,
      SAMPLING_KEYLINE: join(dir, "keyline"),
      SAMPLING_UPSTREAM: `http://127.0.0.1:${STUB_PORT}/v1/chat/completions`,
      SAMPLING_PROXY_PORT: String(PORT),
      SAMPLING_PROXY_LOG: LOG,
      SAMPLING_PROXY_TOKEN_PATH: TOKEN,
    },
    stdio: "pipe",
  });
  let proxyErr = "";
  proxy.stderr.on("data", (d) => { proxyErr += d; });
  // 轮询 token 文件+端口就绪（不赌固定 sleep），超时打印子进程 stderr
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const probe = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (probe.status === 403) ready = true; // 代理已起（验签生效）
    } catch { /* 未起 */ }
  }
  if (!ready) throw new Error(`proxy 8s 未就绪，子进程 stderr:\n${proxyErr}`);
});

afterAll(async () => {
  proxy?.kill();
  stub?.close();
  rmSync(dir, { recursive: true, force: true });
});

function post(body, headers = {}) {
  const token = readFileSync(join(dir, "proxy.token"), "utf8").trim();
  return fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...headers },
    body: JSON.stringify(body),
  });
}

function readLog() {
  return readFileSync(LOG, "utf8").trim().split("\n").map((l) => JSON.parse(l));
}

describe("A4 proxy SSE/归属/验签集成桩", () => {
  it("SSE 流式透传完整且 usage 提取进留底，不写 502", async () => {
    const res = await post({ model: "m", stream: true, messages: [] }, { "x-qucuo-trace": "sse-t1" });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("正文一");
    expect(text).toContain("[DONE]");
    await new Promise((r) => setTimeout(r, 300));
    const rec = readLog().find((r) => r.trace === "sse-t1");
    expect(rec).toBeTruthy();
    expect(rec.status).toBe(200);
    expect(rec.error).toBeUndefined();
    expect(rec.usage?.completion_tokens_details?.reasoning_tokens).toBe(5);
    expect(rec.sseRaw).toContain("正文一");
  });

  it("非流式透传 + lane/turn/trace 三头归属留底", async () => {
    const res = await post({ model: "m", messages: [] }, { "x-qucuo-lane": "3", "x-qucuo-turn": "7", "x-qucuo-trace": "plain-t1" });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 300));
    const rec = readLog().find((r) => r.trace === "plain-t1");
    expect(rec).toMatchObject({ lane: "3", turn: "7", trace: "plain-t1", status: 200 });
    expect(rec.response?.id).toBe("x1");
  });

  it("无令牌/错令牌一律 403 不转发", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    expect(res.status).toBe(403);
  });
});
